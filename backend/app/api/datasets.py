from __future__ import annotations

import mimetypes
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from backend.app.api.auth import get_current_user, _get_current_user
from backend.app.core.config import get_settings
from backend.app.db.database import get_db
from backend.app.models.orm import Dataset, User
from backend.app.models.schemas import DatasetCreate, DatasetDetail, DatasetRead, ImageItem

router = APIRouter(prefix="/datasets", tags=["datasets"])
settings = get_settings()

_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg"}


def _dataset_folder(name: str) -> Path:
    return settings.datasets_root / name


def _count_images(folder: Path) -> int:
    if not folder.exists():
        return 0
    return sum(1 for f in folder.iterdir() if f.suffix.lower() in _IMAGE_EXTS)


def _list_image_items(dataset_name: str, folder: Path) -> list[ImageItem]:
    if not folder.exists():
        return []
    items = []
    for f in sorted(folder.iterdir()):
        if f.suffix.lower() not in _IMAGE_EXTS:
            continue
        mime, _ = mimetypes.guess_type(f.name)
        items.append(
            ImageItem(
                filename=f.name,
                url=f"/api/v1/datasets/{dataset_name}/images/{f.name}",
                size_bytes=f.stat().st_size,
                mime_type=mime or "image/jpeg",
            )
        )
    return items


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=list[DatasetRead])
def list_datasets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all datasets owned by the current user plus public ones."""
    rows = (
        db.query(Dataset)
        .filter(
            (Dataset.owner_id == current_user.id) | (Dataset.is_public == True)
        )
        .order_by(Dataset.created_at.desc())
        .all()
    )
    # Sync image_count with filesystem
    for row in rows:
        actual = _count_images(_dataset_folder(row.name))
        if actual != row.image_count:
            row.image_count = actual
    db.commit()
    return rows


@router.post("", response_model=DatasetRead, status_code=status.HTTP_201_CREATED)
def create_dataset(
    payload: DatasetCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Register a dataset folder that already exists under data/datasets/."""
    folder = _dataset_folder(payload.name)
    folder.mkdir(parents=True, exist_ok=True)

    existing = db.query(Dataset).filter(
        Dataset.name == payload.name, Dataset.owner_id == current_user.id
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Dataset with that name already exists")

    dataset = Dataset(
        name=payload.name,
        display_name=payload.display_name or payload.name.replace("_", " ").title(),
        description=payload.description,
        subject=payload.subject,
        grade_level=payload.grade_level,
        owner_id=current_user.id,
        folder_path=str(folder),
        image_count=_count_images(folder),
        is_public=payload.is_public,
    )
    db.add(dataset)
    db.commit()
    db.refresh(dataset)
    return dataset


@router.get("/{name}", response_model=DatasetDetail)
def get_dataset(
    name: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = db.query(Dataset).filter(
        Dataset.name == name,
        (Dataset.owner_id == current_user.id) | (Dataset.is_public == True),
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Dataset not found")
    folder = _dataset_folder(name)
    images = _list_image_items(name, folder)
    row.image_count = len(images)
    db.commit()
    detail = DatasetDetail.model_validate(row)
    detail.images = images
    return detail


@router.delete("/{name}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dataset(
    name: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = db.query(Dataset).filter(
        Dataset.name == name, Dataset.owner_id == current_user.id
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Dataset not found or not owned by you")
    db.delete(row)
    db.commit()


@router.get("/{name}/images", response_model=list[ImageItem])
def list_images(
    name: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = db.query(Dataset).filter(
        Dataset.name == name,
        (Dataset.owner_id == current_user.id) | (Dataset.is_public == True),
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return _list_image_items(name, _dataset_folder(name))


@router.get("/{name}/images/{filename}")
def serve_image(
    name: str,
    filename: str,
    token: str | None = Query(default=None),  # fallback for <img src=...> tags
    credentials: HTTPAuthorizationCredentials | None = Depends(HTTPBearer(auto_error=False)),
    db: Session = Depends(get_db),
):
    """Serve a single image file through the authenticated API.
    Accepts auth via Bearer header OR ?token= query param (for <img> tags).
    """
    raw_token = (credentials.credentials if credentials else None) or token
    if not raw_token:
        raise HTTPException(status_code=403, detail="Not authenticated")
    current_user = _get_current_user(raw_token, db)

    row = db.query(Dataset).filter(
        Dataset.name == name,
        (Dataset.owner_id == current_user.id) | (Dataset.is_public == True),
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # Security: prevent path traversal
    folder = _dataset_folder(name)
    image_path = (folder / filename).resolve()
    if not str(image_path).startswith(str(folder.resolve())):
        raise HTTPException(status_code=400, detail="Invalid filename")
    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")

    media_type, _ = mimetypes.guess_type(filename)
    return FileResponse(str(image_path), media_type=media_type or "image/jpeg")
