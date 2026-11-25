from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


DEFAULT_SYSTEM_PROMPT = (
    "Kamu adalah pengguna Threads asal Indonesia yang santai, ramah, dan suka berbagi "
    "rekomendasi produk berdasarkan pengalaman pemakaian pribadi. "
    "Gunakan bahasa percakapan kasual natural seperti teman sebaya ('gua', 'kemarin ambil ini', "
    "'so far awet parah', 'kalau buat budget segitu'). "
    "DILARANG KERAS memakai kalimat jualan kaku seperti 'Halo kak', 'Yuk diorder', "
    "'Cek keranjang kuning', 'Buruan checkout', atau emoji berlebihan. "
    "Tulis balasan singkat 1-3 kalimat yang relevan dengan kebutuhan si pembuat thread, "
    "sebutkan 1-2 keunggulan produk yang paling nyambung, lalu sisipkan link affiliate secara natural."
)


class Base(DeclarativeBase):
    """Base SQLAlchemy ORM declarative class."""


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    keywords: Mapped[str] = mapped_column(Text, nullable=False, default="")
    price_range: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    selling_points: Mapped[str] = mapped_column(Text, nullable=False, default="")
    affiliate_link: Mapped[str] = mapped_column(String(500), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    leads: Mapped[List["LeadPost"]] = relationship(
        "LeadPost", back_populates="matched_product"
    )


class LeadPost(Base):
    __tablename__ = "lead_posts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    post_shortcode: Mapped[str] = mapped_column(
        String(100), unique=True, index=True, nullable=False
    )
    post_url: Mapped[str] = mapped_column(String(500), nullable=False)
    author_username: Mapped[str] = mapped_column(String(150), nullable=False, default="unknown")
    post_text: Mapped[str] = mapped_column(Text, nullable=False)
    keyword_matched: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    intent_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0, index=True)
    is_buying_intent: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    ai_reasoning: Mapped[str] = mapped_column(Text, nullable=False, default="")
    matched_product_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True
    )
    draft_reply: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="PENDING_REVIEW", index=True
    )
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    scraped_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    commented_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    matched_product: Mapped[Optional[Product]] = relationship(
        "Product", back_populates="leads", lazy="selectin"
    )


class BotSetting(Base):
    __tablename__ = "bot_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    bot_mode: Mapped[str] = mapped_column(String(50), nullable=False, default="SEMI_AUTO")
    is_scheduler_running: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    scan_interval_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=25)
    max_comments_per_day: Mapped[int] = mapped_column(Integer, nullable=False, default=12)
    min_intent_score: Mapped[int] = mapped_column(Integer, nullable=False, default=75)
    search_keywords: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="rekomendasi tws, spill parfum awet, rekomendasi keyboard mechanical",
    )
    ai_provider: Mapped[str] = mapped_column(
        String(50), nullable=False, default="openai_compatible"
    )
    ai_base_url: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        default="https://generativelanguage.googleapis.com/v1beta/openai/",
    )
    ai_api_key: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    ai_model: Mapped[str] = mapped_column(
        String(150), nullable=False, default="gemini-2.5-flash"
    )
    custom_system_prompt: Mapped[str] = mapped_column(
        Text, nullable=False, default=DEFAULT_SYSTEM_PROMPT
    )
    telegram_bot_token: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    telegram_chat_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)


class DailyStat(Base):
    __tablename__ = "daily_stats"

    date_str: Mapped[str] = mapped_column(String(20), primary_key=True)
    posts_scraped: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    leads_found: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    comments_sent: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
