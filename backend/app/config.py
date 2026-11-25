from __future__ import annotations

from pathlib import Path
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATA_DIR = BACKEND_ROOT / "data"


class AppConfig(BaseSettings):
    """Application environment configuration loaded from env vars or .env."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    DATABASE_URL: str = (
        "postgresql+asyncpg://affiliate:affiliate_secret@postgres:5432/threads_affiliate"
    )
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"
    AUTH_STATE_PATH: str = str(DEFAULT_DATA_DIR / "auth_threads.json")
    SEED_PRODUCTS_PATH: str = str(DEFAULT_DATA_DIR / "seed_products.json")
    TZ: str = "Asia/Jakarta"

    @property
    def cors_origin_list(self) -> List[str]:
        origins = [item.strip() for item in self.CORS_ORIGINS.split(",") if item.strip()]
        return origins or ["http://localhost:3000"]

    @property
    def auth_state_file(self) -> Path:
        configured = Path(self.AUTH_STATE_PATH)
        if configured.exists() or configured.parent.exists():
            return configured
        return DEFAULT_DATA_DIR / "auth_threads.json"

    @property
    def seed_products_file(self) -> Path:
        configured = Path(self.SEED_PRODUCTS_PATH)
        if configured.exists():
            return configured
        return DEFAULT_DATA_DIR / "seed_products.json"


settings = AppConfig()
