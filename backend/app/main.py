from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.app.core.config import get_settings
from backend.app.db.database import create_tables
from backend.app.models.schemas import HealthResponse
from backend.app.services.image_ai import is_blip_available
from backend.app.services.llm_service import is_transformers_available

settings = get_settings()

logging.basicConfig(level=getattr(logging, settings.log_level.upper(), logging.INFO))
logger = logging.getLogger("teacher-z")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ───────────────────────────────────────────────────────────────
    logger.info("Teacher-Z starting up …")
    create_tables()
    # Ensure data directories exist
    settings.datasets_root.mkdir(parents=True, exist_ok=True)
    settings.models_root.mkdir(parents=True, exist_ok=True)
    # Seed default dataset folders
    for folder_name in ("science", "geography", "history", "math", "art"):
        (settings.datasets_root / folder_name).mkdir(exist_ok=True)
    logger.info(
        "LLM provider: %s | Image provider: %s",
        settings.llm_provider,
        settings.image_provider,
    )
    yield
    # ── Shutdown ──────────────────────────────────────────────────────────────
    logger.info("Teacher-Z shutting down.")


app = FastAPI(
    title="Teacher-Z API",
    description="Edge AI platform for K-12 educational content generation",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
from backend.app.api import auth, datasets, generate  # noqa: E402

app.include_router(auth.router, prefix="/api/v1")
app.include_router(datasets.router, prefix="/api/v1")
app.include_router(generate.router, prefix="/api/v1")


# ── Health endpoints ──────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse, tags=["health"])
def health():
    return HealthResponse(
        status="ok",
        version="1.0.0",
        llm_provider=settings.llm_provider,
        image_provider=settings.image_provider,
        models_loaded={
            "blip": is_blip_available(),
            "transformers": is_transformers_available(),
        },
    )


@app.get("/health/ready", tags=["health"])
def readiness():
    """Readiness probe — returns 200 when DB is accessible."""
    from backend.app.db.database import engine
    try:
        with engine.connect():
            pass
        return {"status": "ready"}
    except Exception as exc:
        return JSONResponse(status_code=503, content={"status": "not_ready", "detail": str(exc)})


@app.get("/", tags=["root"])
def root():
    return {
        "name": settings.app_name,
        "docs": "/docs",
        "health": "/health",
    }
