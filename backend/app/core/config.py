from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── App ───────────────────────────────────────────────────────────────────
    app_name: str = "Teacher-Z"
    env: Literal["development", "production"] = "development"
    log_level: str = "INFO"

    # ── Auth ──────────────────────────────────────────────────────────────────
    secret_key: str = "dev-insecure-secret-change-in-prod"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 7

    # ── Database ──────────────────────────────────────────────────────────────
    database_url: str = "sqlite:///./teacherz.db"

    # ── CORS ──────────────────────────────────────────────────────────────────
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    # ── Paths ──────────────────────────────────────────────────────────────────
    data_dir: str = "./data"
    model_dir: str = "./models"

    @property
    def datasets_root(self) -> Path:
        return Path(self.data_dir) / "datasets"

    @property
    def models_root(self) -> Path:
        return Path(self.model_dir)

    # ── AI providers ─────────────────────────────────────────────────────────
    llm_provider: Literal["local_transformers", "ollama", "stub"] = "stub"
    image_provider: Literal["blip", "ollama_vision", "stub"] = "stub"

    # Model identifiers
    llm_model_name: str = "TinyLlama/TinyLlama-1.1B-Chat-v1.0"
    image_model_name: str = "Salesforce/blip-image-captioning-base"

    # Ollama
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "tinyllama"

    @field_validator("data_dir", "model_dir", mode="before")
    @classmethod
    def resolve_path(cls, v: str) -> str:
        return str(Path(v).resolve())


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
