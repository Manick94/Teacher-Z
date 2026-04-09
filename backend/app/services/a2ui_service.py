"""
A2UI (Adaptive-to-User Interface) schema generation service.

The A2UI schema is a versioned JSON document that describes an interactive
educational UI.  The React frontend's A2UIRenderer component consumes this
schema and renders it as live, interactive components — quizzes, flashcards,
fill-in-the-blank exercises, annotated images, and vocabulary cards.

Algorithm
─────────
1. Caption the image  (image_ai.caption_image)
2. Generate content   (llm_service.generate_content)
3. Assemble A2UI doc  (this module — build_a2ui_document)
4. Validate schema    (pydantic A2UIDocument model)
5. Return serialised JSON + metadata

Component selection is driven by lesson_type:
  "lesson"      → content_block + image_annotation + quiz_block × 3
  "quiz"        → quiz_block × N
  "flashcard"   → flashcard_block
  "worksheet"   → content_block + fill_blank × N + word_bank
  "vocabulary"  → word_bank + flashcard_block
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any, Literal


LessonType = Literal["lesson", "quiz", "flashcard", "worksheet", "vocabulary"]


# ── A2UI component builders ───────────────────────────────────────────────────

def _make_content_block(heading: str, body: str, highlights: list[str] | None = None) -> dict:
    return {
        "id": f"comp-{uuid.uuid4().hex[:8]}",
        "type": "content_block",
        "props": {
            "heading": heading,
            "body": body,
            "highlight": highlights or [],
        },
    }


def _make_image_annotation(
    dataset_name: str,
    filename: str,
    caption: str,
    vocab_terms: list[str],
) -> dict:
    """
    Generate evenly-distributed annotation dots from vocabulary terms.
    Positions are deterministic (based on index) so they don't overlap.
    """
    colors = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"]
    rows, cols = 3, 3
    annotations = []
    for i, term in enumerate(vocab_terms[:6]):
        row = i // cols
        col = i % cols
        annotations.append({
            "id": f"ann-{i}",
            "x": round(0.15 + col * 0.35, 2),
            "y": round(0.15 + row * 0.35, 2),
            "label": term,
            "color": colors[i % len(colors)],
        })
    return {
        "id": f"comp-{uuid.uuid4().hex[:8]}",
        "type": "image_annotation",
        "props": {
            "src": f"/api/v1/datasets/{dataset_name}/images/{filename}",
            "alt": caption,
            "annotations": annotations,
        },
    }


def _make_quiz_block(q: dict) -> dict:
    return {
        "id": f"comp-{uuid.uuid4().hex[:8]}",
        "type": "quiz_block",
        "props": {
            "question": q.get("question", ""),
            "options": q.get("options", []),
            "correct_index": q.get("correct_index", 0),
            "explanation": q.get("explanation", ""),
            "points": 10,
        },
    }


def _make_flashcard_block(vocab: list[dict]) -> dict:
    cards = [
        {"front": v.get("term", ""), "back": v.get("definition", "")}
        for v in vocab
    ]
    return {
        "id": f"comp-{uuid.uuid4().hex[:8]}",
        "type": "flashcard_block",
        "props": {"cards": cards},
    }


def _make_fill_blank(fb: dict) -> dict:
    return {
        "id": f"comp-{uuid.uuid4().hex[:8]}",
        "type": "fill_blank",
        "props": {
            "template": fb.get("template", ""),
            "blanks": fb.get("blanks", []),
            "hint": fb.get("hint", ""),
        },
    }


def _make_word_bank(vocab: list[dict]) -> dict:
    words = [v.get("term", "") for v in vocab]
    targets = [
        {"id": f"t{i}", "definition": v.get("definition", ""), "answer": v.get("term", "")}
        for i, v in enumerate(vocab)
    ]
    return {
        "id": f"comp-{uuid.uuid4().hex[:8]}",
        "type": "word_bank",
        "props": {
            "words": words,
            "instructions": "Match each word to its correct definition.",
            "targets": targets,
        },
    }


def _make_objectives_block(objectives: list[str]) -> dict:
    body = "\n".join(f"• {o}" for o in objectives)
    return _make_content_block("Learning Objectives", body, [])


def _make_discussion_block(questions: list[str]) -> dict:
    body = "\n".join(f"{i+1}. {q}" for i, q in enumerate(questions))
    return _make_content_block("Discussion Questions", body, [])


# ── Document assembly ─────────────────────────────────────────────────────────

def build_a2ui_document(
    content: dict[str, Any],
    caption: str,
    caption_method: str,
    dataset_name: str,
    image_filename: str,
    subject: str,
    grade_level: str,
    lesson_type: LessonType,
    model_used: str,
) -> dict[str, Any]:
    """
    Assemble a complete A2UI document from LLM-generated content.

    The component list varies by lesson_type:
      "lesson"     → objectives + image (annotated) + content + all quizzes + flashcards + discussion
      "quiz"       → objectives + image + all quiz blocks
      "flashcard"  → image + flashcard deck
      "worksheet"  → objectives + image + all fill-blanks + word bank
      "vocabulary" → flashcard deck + word bank
    """
    title = content.get("title", f"Lesson: {caption}")
    objectives = content.get("objectives", [])
    vocab = content.get("vocabulary", [])
    quizzes = content.get("quiz", [])
    fill_blanks = content.get("fill_blanks", [])
    discussion = content.get("discussion", [])
    vocab_terms = [v.get("term", "") for v in vocab]

    components: list[dict] = []

    if lesson_type == "lesson":
        if objectives:
            components.append(_make_objectives_block(objectives))
        components.append(_make_image_annotation(dataset_name, image_filename, caption, vocab_terms))
        if vocab:
            body = "\n".join(f"**{v['term']}**: {v['definition']}" for v in vocab)
            components.append(_make_content_block("Key Vocabulary", body, vocab_terms))
        for q in quizzes:
            components.append(_make_quiz_block(q))
        if discussion:
            components.append(_make_discussion_block(discussion))

    elif lesson_type == "quiz":
        if objectives:
            components.append(_make_objectives_block(objectives))
        components.append(_make_image_annotation(dataset_name, image_filename, caption, vocab_terms))
        for q in quizzes:
            components.append(_make_quiz_block(q))

    elif lesson_type == "flashcard":
        components.append(_make_image_annotation(dataset_name, image_filename, caption, vocab_terms))
        if vocab:
            components.append(_make_flashcard_block(vocab))

    elif lesson_type == "worksheet":
        if objectives:
            components.append(_make_objectives_block(objectives))
        components.append(_make_image_annotation(dataset_name, image_filename, caption, vocab_terms))
        for fb in fill_blanks:
            components.append(_make_fill_blank(fb))
        if vocab:
            components.append(_make_word_bank(vocab))

    elif lesson_type == "vocabulary":
        components.append(_make_image_annotation(dataset_name, image_filename, caption, vocab_terms))
        if vocab:
            components.append(_make_flashcard_block(vocab))
            components.append(_make_word_bank(vocab))

    return {
        "schema_version": "1.0",
        "document_id": str(uuid.uuid4()),
        "metadata": {
            "title": title,
            "subject": subject,
            "grade_level": grade_level,
            "lesson_type": lesson_type,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "image_filename": image_filename,
            "dataset_name": dataset_name,
            "caption": caption,
            "caption_method": caption_method,
            "model_used": model_used,
        },
        "layout": {
            "type": "stack",
            "gap": "md",
        },
        "components": components,
    }


def serialise(doc: dict[str, Any]) -> str:
    return json.dumps(doc, ensure_ascii=False, indent=2)


def deserialise(raw: str) -> dict[str, Any]:
    return json.loads(raw)
