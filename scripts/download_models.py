#!/usr/bin/env python3
"""
download_models.py — Pre-download AI model weights into the models/ directory.

Run this once before starting the server to avoid slow cold-starts on first
generation request.

Usage:
    # Download image captioning model only (lighter, ~990MB)
    python scripts/download_models.py --image-only

    # Download LLM only (~1.1GB)
    python scripts/download_models.py --llm-only

    # Download both
    python scripts/download_models.py
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

MODEL_DIR = str(Path(__file__).parent.parent / "models")


def download_image_model(model_name: str = "Salesforce/blip-image-captioning-base"):
    try:
        from transformers import BlipForConditionalGeneration, BlipProcessor
        print(f"Downloading image captioning model: {model_name}")
        print("This may take several minutes (≈990 MB) …")
        BlipProcessor.from_pretrained(model_name, cache_dir=MODEL_DIR)
        BlipForConditionalGeneration.from_pretrained(model_name, cache_dir=MODEL_DIR)
        print(f"Image model downloaded to: {MODEL_DIR}")
    except ImportError:
        print("ERROR: transformers not installed. Run: pip install transformers torch")
        sys.exit(1)


def download_llm(model_name: str = "TinyLlama/TinyLlama-1.1B-Chat-v1.0"):
    try:
        from transformers import AutoModelForCausalLM, AutoTokenizer
        print(f"Downloading LLM: {model_name}")
        print("This may take several minutes (≈1.1 GB) …")
        AutoTokenizer.from_pretrained(model_name, cache_dir=MODEL_DIR)
        AutoModelForCausalLM.from_pretrained(model_name, cache_dir=MODEL_DIR)
        print(f"LLM downloaded to: {MODEL_DIR}")
    except ImportError:
        print("ERROR: transformers not installed. Run: pip install transformers torch")
        sys.exit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Download Teacher-Z AI models")
    parser.add_argument("--image-only", action="store_true")
    parser.add_argument("--llm-only", action="store_true")
    parser.add_argument("--image-model", default="Salesforce/blip-image-captioning-base")
    parser.add_argument("--llm-model", default="TinyLlama/TinyLlama-1.1B-Chat-v1.0")
    args = parser.parse_args()

    if not args.llm_only:
        download_image_model(args.image_model)
    if not args.image_only:
        download_llm(args.llm_model)

    print("\nAll models downloaded. You can now set:")
    print("  IMAGE_PROVIDER=blip")
    print("  LLM_PROVIDER=local_transformers")
    print("in your .env file.")
