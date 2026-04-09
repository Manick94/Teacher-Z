"""
LLM content generation service for Teacher-Z.

Provider chain:
  1. local_transformers  – TinyLlama (or any HF causal-LM) via transformers
  2. ollama              – Ollama HTTP API (/api/chat, then /api/generate)
  3. stub                – template-based content (no ML)

Prompt strategy:
  - The image caption is the #1 source of truth; the topic is derived from it
    and injected repeatedly so small models stay on-topic.
  - Ollama uses the /api/chat endpoint for better instruction following.
  - JSON is validated and repaired; stub always succeeds as fallback.
"""
from __future__ import annotations

import asyncio
import json
import re
from typing import Any

# ── Capability detection ──────────────────────────────────────────────────────

_TRANSFORMERS_AVAILABLE = False

try:
    import torch  # noqa: F401
    from transformers import AutoModelForCausalLM, AutoTokenizer  # noqa: F401
    _TRANSFORMERS_AVAILABLE = True
except ImportError:
    pass

# ── Model cache ───────────────────────────────────────────────────────────────

_MODEL_CACHE: dict[str, Any] = {}
_MODEL_LOCK = asyncio.Lock()


# ── Topic extraction ──────────────────────────────────────────────────────────

def _extract_topic(caption: str) -> str:
    """
    Distil the core topic from a (potentially long) image caption.
    Strips common vision-model preambles and caps length for prompt tightness.
    """
    cleaned = caption.strip()
    # Strip common vision-model preambles
    cleaned = re.sub(
        r"^(this image (shows?|depicts?|contains?|is of)|"
        r"a (photo(graph)? of|picture of|image of|photograph showing)|"
        r"an (image of|illustration of)|"
        r"the image shows?|i (see|can see)|there (is|are))\s+",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    # Remove leading articles: "a ", "an ", "the "
    cleaned = re.sub(r"^(a|an|the)\s+", "", cleaned, flags=re.IGNORECASE)
    # Take up to first comma / period / semi-colon / " with " / " and " for conciseness
    cleaned = re.split(r"[,;.]|\s+(with|and|that|which|where|while)\s+", cleaned)[0].strip()
    # Cap at 60 chars
    return cleaned[:60] if cleaned else caption[:60]


# ── Prompt builder ────────────────────────────────────────────────────────────

def _build_prompt(caption: str, subject: str, grade_level: str, lesson_type: str) -> str:
    """
    Build a topic-centric prompt that keeps small models (tinyllama, etc.)
    on the actual image subject.

    The topic derived from the caption is injected in every major field
    so the model cannot drift to generic content.
    """
    topic = _extract_topic(caption)
    grade_desc = f"Grade {grade_level}" if grade_level else "Middle school"

    return f"""You are a {subject} teacher creating a {lesson_type} about: {topic}

Image description: {caption}
Grade level: {grade_desc}
Subject: {subject}

Write ONLY a JSON object. No explanation, no markdown, no extra text.
Every field must be specifically about "{topic}" — do NOT write generic content.

{{
  "title": "{topic} — {lesson_type.title()} ({grade_desc})",
  "objectives": [
    "Identify and describe {topic}",
    "Explain how {topic} relates to {subject}",
    "Apply knowledge of {topic} to real examples"
  ],
  "vocabulary": [
    {{"term": "<most important word in {topic}>", "definition": "<clear definition relevant to {topic}>"}},
    {{"term": "<second key {subject} term>", "definition": "<definition>"}},
    {{"term": "<third key {subject} term>", "definition": "<definition>"}}
  ],
  "quiz": [
    {{
      "question": "What best describes {topic}?",
      "options": ["<correct answer about {topic}>", "<plausible wrong answer>", "<plausible wrong answer>", "<plausible wrong answer>"],
      "correct_index": 0,
      "explanation": "<why the first option is correct>"
    }},
    {{
      "question": "Where or when would you find {topic}?",
      "options": ["<correct>", "<wrong>", "<wrong>", "<wrong>"],
      "correct_index": 0,
      "explanation": "<explanation>"
    }},
    {{
      "question": "Why is {topic} important in {subject}?",
      "options": ["<correct>", "<wrong>", "<wrong>", "<wrong>"],
      "correct_index": 0,
      "explanation": "<explanation>"
    }}
  ],
  "fill_blanks": [
    {{"template": "___ is a key concept in {subject} studied in {grade_desc}.", "blanks": ["{topic}"]}},
    {{"template": "The main feature of {topic} is ___.", "blanks": ["<key characteristic>"]}}
  ],
  "discussion": [
    "How does {topic} appear in everyday life?",
    "What would change if {topic} did not exist?"
  ]
}}"""


# ── Transformers loader ───────────────────────────────────────────────────────

async def _load_transformers_model(model_name: str, model_dir: str):
    if not _TRANSFORMERS_AVAILABLE:
        return None
    key = f"transformers::{model_name}"
    if key in _MODEL_CACHE:
        return _MODEL_CACHE[key]
    async with _MODEL_LOCK:
        if key in _MODEL_CACHE:
            return _MODEL_CACHE[key]
        try:
            import torch
            from transformers import AutoModelForCausalLM, AutoTokenizer

            print(f"[llm_service] Loading {model_name} …")
            tokenizer = AutoTokenizer.from_pretrained(model_name, cache_dir=model_dir)
            model = AutoModelForCausalLM.from_pretrained(
                model_name,
                torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
                device_map="auto",
                cache_dir=model_dir,
            )
            model.eval()
            _MODEL_CACHE[key] = (tokenizer, model)
            print(f"[llm_service] {model_name} loaded")
            return _MODEL_CACHE[key]
        except Exception as exc:
            print(f"[llm_service] Failed to load transformers model: {exc}")
            return None


# ── Provider implementations ──────────────────────────────────────────────────

async def _generate_transformers(
    caption: str, subject: str, grade_level: str, lesson_type: str,
    model_name: str, model_dir: str,
) -> dict[str, Any] | None:
    result = await _load_transformers_model(model_name, model_dir)
    if result is None:
        return None
    tokenizer, model = result
    try:
        import torch
        prompt = _build_prompt(caption, subject, grade_level, lesson_type)
        messages = [
            {"role": "system", "content": "You are a teacher. Respond ONLY with valid JSON."},
            {"role": "user", "content": prompt},
        ]
        input_ids = tokenizer.apply_chat_template(
            messages, tokenize=True, add_generation_prompt=True, return_tensors="pt",
        )
        with torch.inference_mode():
            output = model.generate(
                input_ids,
                max_new_tokens=900,
                do_sample=True,
                temperature=0.3,
                top_p=0.9,
                repetition_penalty=1.1,
                pad_token_id=tokenizer.eos_token_id,
            )
        raw = tokenizer.decode(output[0][input_ids.shape[-1]:], skip_special_tokens=True)
        return _extract_json(raw)
    except Exception as exc:
        print(f"[llm_service] Transformers inference error: {exc}")
        return None


async def _generate_ollama(
    caption: str, subject: str, grade_level: str, lesson_type: str,
    ollama_url: str, ollama_model: str,
) -> dict[str, Any] | None:
    """
    Use Ollama's /api/chat endpoint for better instruction following.
    Falls back to /api/generate if chat is unavailable.
    """
    try:
        import httpx
        prompt = _build_prompt(caption, subject, grade_level, lesson_type)

        async with httpx.AsyncClient(timeout=120.0) as client:
            # Prefer /api/chat — better for instruction-following models
            try:
                resp = await client.post(
                    f"{ollama_url}/api/chat",
                    json={
                        "model": ollama_model,
                        "messages": [
                            {"role": "system", "content": "You are a teacher. Respond ONLY with valid JSON."},
                            {"role": "user", "content": prompt},
                        ],
                        "stream": False,
                        "format": "json",
                        "options": {"temperature": 0.3, "top_p": 0.9},
                    },
                )
                resp.raise_for_status()
                raw = resp.json().get("message", {}).get("content", "")
            except Exception:
                # Fallback to /api/generate
                resp = await client.post(
                    f"{ollama_url}/api/generate",
                    json={
                        "model": ollama_model,
                        "prompt": prompt,
                        "stream": False,
                        "format": "json",
                        "options": {"temperature": 0.3},
                    },
                )
                resp.raise_for_status()
                raw = resp.json().get("response", "")

        result = _extract_json(raw)
        if result:
            # Validate that key fields are present; repair missing ones
            result = _repair_content(result, caption, subject, grade_level, lesson_type)
            return result
    except Exception as exc:
        print(f"[llm_service] Ollama error: {exc}")
    return None


def _repair_content(
    data: dict[str, Any],
    caption: str,
    subject: str,
    grade_level: str,
    lesson_type: str,
) -> dict[str, Any]:
    """
    Ensure the parsed JSON has all required fields with minimum content.
    Fills any missing or empty field with sensible defaults derived from the caption.
    """
    topic = _extract_topic(caption)
    stub = _generate_stub(caption, subject, grade_level, lesson_type)

    data.setdefault("title", stub["title"])
    if not data.get("objectives"):
        data["objectives"] = stub["objectives"]
    if not data.get("vocabulary"):
        data["vocabulary"] = stub["vocabulary"]

    # Quiz: enforce list of dicts with required keys
    quiz = data.get("quiz", [])
    if not isinstance(quiz, list) or len(quiz) == 0:
        data["quiz"] = stub["quiz"]
    else:
        repaired = []
        for i, q in enumerate(quiz[:5]):
            if not isinstance(q, dict):
                continue
            repaired.append({
                "question": q.get("question", f"Question {i+1} about {topic}?"),
                "options": q.get("options", ["Option A", "Option B", "Option C", "Option D"]),
                "correct_index": int(q.get("correct_index", 0)),
                "explanation": q.get("explanation", f"This relates to {topic}."),
            })
        data["quiz"] = repaired if repaired else stub["quiz"]

    if not data.get("fill_blanks"):
        data["fill_blanks"] = stub["fill_blanks"]
    if not data.get("discussion"):
        data["discussion"] = stub["discussion"]

    return data


def _generate_stub(
    caption: str, subject: str, grade_level: str, lesson_type: str,
) -> dict[str, Any]:
    """Template-based content — always succeeds, topic-specific."""
    topic = _extract_topic(caption)
    grade_desc = f"Grade {grade_level}" if grade_level else "Middle school"
    return {
        "title": f"{topic} — {lesson_type.title()} ({grade_desc})",
        "objectives": [
            f"Identify and describe {topic}.",
            f"Explain how {topic} relates to {subject}.",
            f"Apply knowledge of {topic} to real-world examples.",
        ],
        "vocabulary": [
            {"term": topic.split()[0].capitalize() if topic.split() else "Topic",
             "definition": f"The main subject of this lesson: {topic}."},
            {"term": "Observation",
             "definition": "Carefully watching and recording details about something."},
            {"term": subject.capitalize(),
             "definition": f"The academic field that studies topics like {topic}."},
        ],
        "quiz": [
            {
                "question": f"What is the main subject shown in this image?",
                "options": [
                    f"{topic}",
                    "An unrelated concept",
                    "A different subject",
                    "None of the above",
                ],
                "correct_index": 0,
                "explanation": f"The image specifically shows {topic}.",
            },
            {
                "question": f"Which subject area does {topic} belong to?",
                "options": [subject.title(), "Mathematics", "Physical Education", "Art"],
                "correct_index": 0,
                "explanation": f"{topic} is a topic within {subject}.",
            },
            {
                "question": f"Why is observing {topic} useful for students?",
                "options": [
                    "It helps make connections and understand details",
                    "It replaces reading",
                    "It is not important",
                    "It is only for scientists",
                ],
                "correct_index": 0,
                "explanation": "Careful observation builds understanding and critical thinking.",
            },
        ],
        "fill_blanks": [
            {
                "template": f"___ is an important concept in {subject} at the {grade_desc} level.",
                "blanks": [topic],
            },
            {
                "template": f"When studying {topic}, students learn to ___ what they observe.",
                "blanks": ["describe and analyse"],
            },
        ],
        "discussion": [
            f"How does {topic} appear in everyday life?",
            f"What would change if {topic} did not exist?",
        ],
    }


# ── JSON extraction ───────────────────────────────────────────────────────────

def _extract_json(raw: str) -> dict[str, Any] | None:
    """Extract a JSON object from raw LLM output, tolerating surrounding text."""
    raw = raw.strip()
    # Direct parse
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass
    # Strip markdown fences
    fenced = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw, flags=re.DOTALL).strip()
    try:
        return json.loads(fenced)
    except json.JSONDecodeError:
        pass
    # Find first {...} block
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass
    return None


# ── Public API ────────────────────────────────────────────────────────────────

async def generate_content(
    caption: str,
    subject: str,
    grade_level: str,
    lesson_type: str,
    provider: str = "stub",
    model_name: str = "TinyLlama/TinyLlama-1.1B-Chat-v1.0",
    model_dir: str = "./models",
    ollama_url: str = "http://localhost:11434",
    ollama_model: str = "tinyllama",
) -> tuple[dict[str, Any], str]:
    """
    Generate educational content from an image caption.
    Returns (content_dict, provider_used).
    Always succeeds — falls back to stub if ML providers fail.
    """
    if provider == "local_transformers":
        result = await _generate_transformers(
            caption, subject, grade_level, lesson_type, model_name, model_dir,
        )
        if result:
            return result, f"transformers::{model_name}"

    if provider in ("local_transformers", "ollama"):
        result = await _generate_ollama(
            caption, subject, grade_level, lesson_type, ollama_url, ollama_model,
        )
        if result:
            return result, f"ollama::{ollama_model}"

    return _generate_stub(caption, subject, grade_level, lesson_type), "stub"


def is_transformers_available() -> bool:
    return _TRANSFORMERS_AVAILABLE
