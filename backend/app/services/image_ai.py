"""
Image captioning service for Teacher-Z.

Fallback chain (highest to lowest quality):
  1. Ollama vision (llava / moondream / llava-phi3) — uses actual image pixels
  2. BLIP (Salesforce/blip-image-captioning-base)   — requires torch + transformers
  3. Filename heuristic                              — always available

Vision models are auto-detected from the running Ollama instance.
"""
from __future__ import annotations

import asyncio
import base64
import io
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

# ── Capability detection (import-time, non-blocking) ─────────────────────────

_BLIP_AVAILABLE = False
_PIL_AVAILABLE = False

try:
    from PIL import Image as PILImage  # noqa: F401
    _PIL_AVAILABLE = True
except ImportError:
    pass

try:
    import torch  # noqa: F401
    from transformers import BlipForConditionalGeneration, BlipProcessor  # noqa: F401
    _BLIP_AVAILABLE = True and _PIL_AVAILABLE
except ImportError:
    pass

# ── Model cache ───────────────────────────────────────────────────────────────

_MODEL_CACHE: dict[str, Any] = {}
_MODEL_LOCK = asyncio.Lock()

# Vision models Ollama supports, checked in preference order
_OLLAMA_VISION_MODELS = [
    "llava", "llava-phi3", "llava:7b", "llava:13b", "llava-llama3",
    "bakllava", "moondream", "moondream2",
]


@dataclass
class CaptionResult:
    caption: str
    confidence: float       # 0.0 – 1.0 (estimated)
    method: str             # "ollama_vision" | "blip" | "filename"


# ── Ollama vision captioning ──────────────────────────────────────────────────

async def _get_ollama_vision_model(ollama_url: str) -> str | None:
    """Return the name of the first available vision-capable Ollama model, or None."""
    try:
        import httpx
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(f"{ollama_url}/api/tags")
            resp.raise_for_status()
            models = resp.json().get("models", [])
            available_names = [m["name"] for m in models]
            # Match by prefix (e.g. "llava:latest" matches "llava")
            for want in _OLLAMA_VISION_MODELS:
                for name in available_names:
                    if name.split(":")[0].lower() == want.split(":")[0].lower():
                        return name
    except Exception as exc:
        print(f"[image_ai] Could not query Ollama models: {exc}")
    return None


def _image_to_base64(image_path: str, max_px: int = 1024) -> str:
    """Load an image, resize if needed, and return as JPEG base64 string."""
    try:
        from PIL import Image
        with Image.open(image_path) as img:
            img = img.convert("RGB")
            if max(img.size) > max_px:
                img.thumbnail((max_px, max_px))
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=85)
            return base64.b64encode(buf.getvalue()).decode()
    except Exception:
        # Fallback: read raw bytes without PIL
        with open(image_path, "rb") as f:
            return base64.b64encode(f.read()).decode()


async def _caption_with_ollama_vision(
    image_path: str,
    ollama_url: str,
    model: str | None = None,
) -> CaptionResult | None:
    """Send the image to an Ollama vision model and return a rich caption."""
    try:
        import httpx

        if model is None:
            model = await _get_ollama_vision_model(ollama_url)
        if model is None:
            print("[image_ai] No Ollama vision model found (install llava or moondream)")
            return None

        img_b64 = _image_to_base64(image_path)
        prompt = (
            "Describe this image in one clear, detailed sentence. "
            "Identify the main subject (object, animal, plant, scene, diagram, or concept). "
            "Be specific — mention colour, shape, context, and any labels or text visible."
        )

        async with httpx.AsyncClient(timeout=90.0) as client:
            resp = await client.post(
                f"{ollama_url}/api/generate",
                json={
                    "model": model,
                    "prompt": prompt,
                    "images": [img_b64],
                    "stream": False,
                },
            )
            resp.raise_for_status()
            caption = resp.json().get("response", "").strip()
            if caption:
                print(f"[image_ai] Vision caption ({model}): {caption[:120]}")
                return CaptionResult(
                    caption=caption,
                    confidence=0.90,
                    method=f"ollama_vision::{model}",
                )
    except Exception as exc:
        print(f"[image_ai] Ollama vision error: {exc}")
    return None


# ── BLIP loader ───────────────────────────────────────────────────────────────

async def _load_blip(model_name: str, model_dir: str) -> tuple[Any, Any] | None:
    """Lazy-load BLIP model; returns (processor, model) or None on failure."""
    if not _BLIP_AVAILABLE:
        return None
    key = f"blip::{model_name}"
    if key in _MODEL_CACHE:
        return _MODEL_CACHE[key]
    async with _MODEL_LOCK:
        if key in _MODEL_CACHE:
            return _MODEL_CACHE[key]
        try:
            import torch
            from transformers import BlipForConditionalGeneration, BlipProcessor

            processor = BlipProcessor.from_pretrained(model_name, cache_dir=model_dir)
            model = BlipForConditionalGeneration.from_pretrained(
                model_name,
                torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
                cache_dir=model_dir,
            )
            model.eval()
            _MODEL_CACHE[key] = (processor, model)
            return _MODEL_CACHE[key]
        except Exception as exc:
            print(f"[image_ai] Failed to load BLIP model: {exc}")
            return None


async def _caption_with_blip(
    image_path: str,
    model_name: str,
    model_dir: str,
) -> CaptionResult | None:
    result = await _load_blip(model_name, model_dir)
    if result is None:
        return None
    processor, model = result
    try:
        import torch
        from PIL import Image

        image = Image.open(image_path).convert("RGB")
        inputs = processor(images=image, return_tensors="pt")
        with torch.inference_mode():
            output_ids = model.generate(
                **inputs,
                max_new_tokens=60,
                num_beams=4,
                early_stopping=True,
            )
        caption = processor.decode(output_ids[0], skip_special_tokens=True)
        return CaptionResult(caption=caption.strip(), confidence=0.75, method="blip")
    except Exception as exc:
        print(f"[image_ai] BLIP inference error: {exc}")
        return None


# ── Ollama text-based smart captioning ────────────────────────────────────────

async def _caption_with_ollama_text(
    filename: str,
    subject: str,
    ollama_url: str,
    ollama_model: str,
) -> CaptionResult | None:
    """
    Use the text LLM to infer what the image shows from its filename and subject.
    Works with any Ollama model — no vision required.
    """
    stem = Path(filename).stem
    human_name = re.sub(r"[_\-\.]+", " ", stem).strip()
    prompt = (
        f"I have an educational image file named '{human_name}' in a {subject} dataset. "
        "In one sentence, describe what this image most likely shows, being specific about the "
        "scientific concept, object, process, or diagram depicted. "
        "Start your answer directly with the description — no preamble."
    )
    try:
        import httpx
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{ollama_url}/api/generate",
                json={
                    "model": ollama_model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.2, "num_predict": 80},
                },
            )
            resp.raise_for_status()
            caption = resp.json().get("response", "").strip()
            # Clean up common LLM preambles
            caption = re.sub(
                r"^(sure[,!]?\s*|here(\'s| is)\s+(a\s+)?description[:\s]*|"
                r"this image (shows?|depicts?)[:\s]*)",
                "",
                caption,
                flags=re.IGNORECASE,
            ).strip().capitalize()
            if caption and len(caption) > 10:
                print(f"[image_ai] Smart caption ({ollama_model}): {caption[:120]}")
                return CaptionResult(caption=caption, confidence=0.55, method=f"ollama_text::{ollama_model}")
    except Exception as exc:
        print(f"[image_ai] Ollama text caption error: {exc}")
    return None


# ── Filename heuristic ────────────────────────────────────────────────────────

def _caption_from_filename(filename: str) -> CaptionResult:
    stem = Path(filename).stem
    words = re.sub(r"[_\-\.]+", " ", stem)
    words = re.sub(r"^\d+\s*", "", words)
    caption = words.strip().capitalize()
    if not caption:
        caption = "Educational image"
    return CaptionResult(caption=caption, confidence=0.2, method="filename")


# ── Public API ────────────────────────────────────────────────────────────────

async def caption_image(
    image_path: str,
    provider: str = "stub",
    model_name: str = "Salesforce/blip-image-captioning-base",
    model_dir: str = "./models",
    ollama_url: str = "http://localhost:11434",
    ollama_vision_model: str | None = None,
    ollama_model: str = "llama3.2:3b",
    subject: str = "general",
) -> CaptionResult:
    """
    Caption an image using the configured provider.

    provider:
        "ollama_vision" – try vision model (llava/moondream), then smart text
                          inference from filename, then filename heuristic
        "blip"          – BLIP transformer model then filename heuristic
        "stub"          – filename heuristic only (no ML)
    """
    if provider == "ollama_vision":
        # 1. Try actual vision model (llava, moondream, etc.)
        result = await _caption_with_ollama_vision(image_path, ollama_url, ollama_vision_model)
        if result is not None:
            return result
        # 2. No vision model — use text LLM to infer from filename + subject
        result = await _caption_with_ollama_text(
            Path(image_path).name, subject, ollama_url, ollama_model
        )
        if result is not None:
            return result
        # 3. BLIP as further fallback
        result = await _caption_with_blip(image_path, model_name, model_dir)
        if result is not None:
            return result

    elif provider == "blip":
        result = await _caption_with_blip(image_path, model_name, model_dir)
        if result is not None:
            return result

    return _caption_from_filename(Path(image_path).name)


def is_blip_available() -> bool:
    return _BLIP_AVAILABLE
