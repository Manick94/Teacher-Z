from __future__ import annotations

import time
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.api.auth import get_current_user
from backend.app.core.config import get_settings
from backend.app.db.database import get_db
from backend.app.models.orm import Dataset, GeneratedLesson, User
from backend.app.models.schemas import GenerateRequest, GenerateResponse, LessonRead
from backend.app.services import a2ui_service, image_ai, llm_service

router = APIRouter(prefix="/generate", tags=["generation"])
settings = get_settings()

_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"}


def _dataset_folder(name: str) -> Path:
    return settings.datasets_root / name


# ── Main generation endpoint ─────────────────────────────────────────────────

@router.post("", response_model=GenerateResponse)
async def generate_lesson(
    payload: GenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # 1. Verify dataset access
    dataset = db.query(Dataset).filter(
        Dataset.name == payload.dataset_name,
        (Dataset.owner_id == current_user.id) | (Dataset.is_public == True),
    ).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # 2. Verify image exists
    folder = _dataset_folder(payload.dataset_name)
    image_path = (folder / payload.image_filename).resolve()
    if not str(image_path).startswith(str(folder.resolve())):
        raise HTTPException(status_code=400, detail="Invalid filename")
    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Image file not found")

    subject = payload.subject or dataset.subject or "general"
    grade_level = payload.grade_level or dataset.grade_level or "5"
    lesson_type = payload.lesson_type

    # 3. Check cache (skip if regenerate=True)
    if not payload.regenerate:
        cached = (
            db.query(GeneratedLesson)
            .filter(
                GeneratedLesson.dataset_id == dataset.id,
                GeneratedLesson.image_filename == payload.image_filename,
                GeneratedLesson.lesson_type == lesson_type,
                GeneratedLesson.grade_level == grade_level,
            )
            .order_by(GeneratedLesson.created_at.desc())
            .first()
        )
        if cached:
            return GenerateResponse(
                lesson_id=cached.uuid,
                caption=cached.caption or "",
                caption_method=cached.caption_method,
                a2ui_schema=a2ui_service.deserialise(cached.a2ui_schema),
                model_used=cached.model_used or "cached",
                generation_time_ms=cached.generation_time_ms or 0,
                cached=True,
            )

    # 4. Caption the image
    t0 = time.monotonic()
    caption_result = await image_ai.caption_image(
        image_path=str(image_path),
        provider=settings.image_provider,
        model_name=settings.image_model_name,
        model_dir=str(settings.models_root),
        ollama_url=settings.ollama_base_url,
        ollama_model=settings.ollama_model,
        subject=subject,
    )

    # 5. Generate educational content via LLM
    content, model_used = await llm_service.generate_content(
        caption=caption_result.caption,
        subject=subject,
        grade_level=grade_level,
        lesson_type=lesson_type,
        provider=settings.llm_provider,
        model_name=settings.llm_model_name,
        model_dir=str(settings.models_root),
        ollama_url=settings.ollama_base_url,
        ollama_model=settings.ollama_model,
    )

    # 6. Assemble A2UI document
    a2ui_doc = a2ui_service.build_a2ui_document(
        content=content,
        caption=caption_result.caption,
        caption_method=caption_result.method,
        dataset_name=payload.dataset_name,
        image_filename=payload.image_filename,
        subject=subject,
        grade_level=grade_level,
        lesson_type=lesson_type,
        model_used=model_used,
    )
    elapsed_ms = int((time.monotonic() - t0) * 1000)

    # 7. Persist to DB
    lesson = GeneratedLesson(
        dataset_id=dataset.id,
        image_filename=payload.image_filename,
        caption=caption_result.caption,
        caption_method=caption_result.method,
        a2ui_schema=a2ui_service.serialise(a2ui_doc),
        lesson_type=lesson_type,
        subject=subject,
        grade_level=grade_level,
        generated_by=current_user.id,
        model_used=model_used,
        generation_time_ms=elapsed_ms,
    )
    db.add(lesson)
    db.commit()
    db.refresh(lesson)

    return GenerateResponse(
        lesson_id=lesson.uuid,
        caption=caption_result.caption,
        caption_method=caption_result.method,
        a2ui_schema=a2ui_doc,
        model_used=model_used,
        generation_time_ms=elapsed_ms,
        cached=False,
    )


# ── Lesson CRUD ───────────────────────────────────────────────────────────────

@router.get("/lessons", response_model=list[LessonRead])
def list_lessons(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = 50,
    offset: int = 0,
):
    return (
        db.query(GeneratedLesson)
        .filter(GeneratedLesson.generated_by == current_user.id)
        .order_by(GeneratedLesson.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


@router.get("/lessons/{lesson_uuid}", response_model=LessonRead)
def get_lesson(
    lesson_uuid: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    lesson = db.query(GeneratedLesson).filter(
        GeneratedLesson.uuid == lesson_uuid,
        GeneratedLesson.generated_by == current_user.id,
    ).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return lesson


@router.delete("/lessons/{lesson_uuid}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lesson(
    lesson_uuid: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    lesson = db.query(GeneratedLesson).filter(
        GeneratedLesson.uuid == lesson_uuid,
        GeneratedLesson.generated_by == current_user.id,
    ).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    db.delete(lesson)
    db.commit()
