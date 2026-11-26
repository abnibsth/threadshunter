from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Products Schemas
# ---------------------------------------------------------------------------
class ProductBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    category: str = Field(..., min_length=1, max_length=100)
    keywords: str = Field(default="")
    price_range: str = Field(default="", max_length=100)
    selling_points: str = Field(default="")
    affiliate_link: str = Field(..., min_length=5, max_length=500)
    is_active: bool = True


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    category: Optional[str] = Field(default=None, min_length=1, max_length=100)
    keywords: Optional[str] = None
    price_range: Optional[str] = Field(default=None, max_length=100)
    selling_points: Optional[str] = None
    affiliate_link: Optional[str] = Field(default=None, min_length=5, max_length=500)
    is_active: Optional[bool] = None


class ProductResponse(ProductBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BulkProductImportRequest(BaseModel):
    raw_text: str = Field(..., min_length=5)
    default_category: str = Field(default="Shopee Affiliate", max_length=100)


class BulkProductImportResponse(BaseModel):
    imported_count: int
    updated_count: int
    skipped_count: int
    items: List[ProductResponse]


# ---------------------------------------------------------------------------
# Lead Posts Schemas
# ---------------------------------------------------------------------------
LeadStatus = Literal["PENDING_REVIEW", "COMMENTED", "IGNORED", "FAILED"]


class MatchedProductSummary(BaseModel):
    id: int
    name: str
    category: str
    price_range: str
    affiliate_link: str

    model_config = ConfigDict(from_attributes=True)


class LeadPostResponse(BaseModel):
    id: int
    post_shortcode: str
    post_url: str
    author_username: str
    post_text: str
    keyword_matched: str
    intent_score: int
    is_buying_intent: bool
    ai_reasoning: str
    matched_product_id: Optional[int] = None
    matched_product: Optional[MatchedProductSummary] = None
    draft_reply: str
    status: str
    error_message: Optional[str] = None
    scraped_at: datetime
    commented_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class LeadUpdateRequest(BaseModel):
    draft_reply: Optional[str] = None
    status: Optional[LeadStatus] = None
    matched_product_id: Optional[int] = None


class LeadReplyRequest(BaseModel):
    draft_reply: Optional[str] = None


class PaginationMeta(BaseModel):
    page: int
    page_size: int
    total_items: int
    total_pages: int


class LeadListResponse(BaseModel):
    items: List[LeadPostResponse]
    counts: Dict[str, int]
    pagination: PaginationMeta


# ---------------------------------------------------------------------------
# Bot Settings & AI Test Schemas
# ---------------------------------------------------------------------------
BotMode = Literal["SEMI_AUTO", "FULL_AUTO"]
AIProviderType = Literal["openai_compatible", "google_genai"]


class BotSettingResponse(BaseModel):
    id: int
    bot_mode: str
    is_scheduler_running: bool
    scan_interval_minutes: int
    max_comments_per_day: int
    min_intent_score: int
    search_keywords: str
    ai_provider: str
    ai_base_url: str
    has_ai_api_key: bool
    ai_api_key_masked: str
    ai_model: str
    custom_system_prompt: str
    telegram_bot_token_masked: str = ""
    has_telegram_bot_token: bool = False
    telegram_chat_id: Optional[str] = None


class BotSettingUpdate(BaseModel):
    bot_mode: Optional[BotMode] = None
    scan_interval_minutes: Optional[int] = Field(default=None, ge=5, le=1440)
    max_comments_per_day: Optional[int] = Field(default=None, ge=1, le=50)
    min_intent_score: Optional[int] = Field(default=None, ge=0, le=100)
    search_keywords: Optional[str] = None
    ai_provider: Optional[AIProviderType] = None
    ai_base_url: Optional[str] = Field(default=None, max_length=500)
    ai_api_key: Optional[str] = Field(default=None, max_length=500)
    ai_model: Optional[str] = Field(default=None, max_length=150)
    custom_system_prompt: Optional[str] = None
    telegram_bot_token: Optional[str] = Field(default=None, max_length=255)
    telegram_chat_id: Optional[str] = Field(default=None, max_length=100)


class TestAIRequest(BaseModel):
    sample_post: str = Field(
        default="Guys minta rekomendasi TWS di bawah 200rb dong yang bass nya enak dan baterainya awet buat naik KRL tiap hari",
        min_length=5,
    )
    ai_provider: Optional[AIProviderType] = None
    ai_base_url: Optional[str] = None
    ai_api_key: Optional[str] = None
    ai_model: Optional[str] = None
    custom_system_prompt: Optional[str] = None


class TestAIResponse(BaseModel):
    is_buying_intent: bool
    intent_score: int
    matched_product_id: Optional[int] = None
    matched_product_name: Optional[str] = None
    reasoning: str
    draft_reply: str
    latency_ms: int
    provider_used: str
    model_used: str


# ---------------------------------------------------------------------------
# Bot Control, Auth & KPI Stats Schemas
# ---------------------------------------------------------------------------
class AuthStatusResponse(BaseModel):
    connected: bool
    cookie_count: int
    threads_cookie_count: int
    has_session_cookie: bool
    updated_at: Optional[datetime] = None
    message: str


class ActivityLogItem(BaseModel):
    timestamp: datetime
    level: Literal["info", "success", "warning", "error"]
    message: str


class BotStatusResponse(BaseModel):
    bot_mode: str
    is_scheduler_running: bool
    scan_interval_minutes: int
    next_run_at: Optional[datetime] = None
    is_scanning: bool
    current_keyword: Optional[str] = None
    last_scan_at: Optional[datetime] = None
    last_scan_summary: Optional[str] = None
    active_keywords: List[str]
    ai_provider: str
    ai_base_url: str
    ai_model: str
    has_ai_api_key: bool
    min_intent_score: int
    max_comments_per_day: int
    auth_status: AuthStatusResponse
    recent_logs: List[ActivityLogItem]


class DailyStatItem(BaseModel):
    date_str: str
    posts_scraped: int
    leads_found: int
    comments_sent: int

    model_config = ConfigDict(from_attributes=True)


class DashboardStatsResponse(BaseModel):
    date_str: str
    posts_scraped: int
    leads_found: int
    comments_sent: int
    max_comments_per_day: int
    pending_review_count: int
    commented_total_count: int
    ignored_total_count: int
    failed_total_count: int
    total_products: int
    active_products: int
    avg_intent_score: float
    history: List[DailyStatItem]


class ScanTriggerRequest(BaseModel):
    keywords: Optional[List[str]] = None


class ScanTriggerResponse(BaseModel):
    started: bool
    message: str
    keywords: List[str]


class RawCookieImportRequest(BaseModel):
    raw_json: str = Field(..., min_length=2)

