export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

// ---------------------------------------------------------------------------
// Shared Domain Types (mirroring backend/app/schemas.py)
// ---------------------------------------------------------------------------
export interface Product {
  id: number;
  name: string;
  category: string;
  keywords: string;
  price_range: string;
  selling_points: string;
  affiliate_link: string;
  is_active: boolean;
  created_at: string;
}

export interface ProductPayload {
  name: string;
  category: string;
  keywords: string;
  price_range: string;
  selling_points: string;
  affiliate_link: string;
  is_active: boolean;
}

export interface BulkProductImportResponse {
  imported_count: number;
  updated_count: number;
  skipped_count: number;
  items: Product[];
}

export type LeadStatus = "PENDING_REVIEW" | "COMMENTED" | "IGNORED" | "FAILED";

export interface MatchedProductSummary {
  id: number;
  name: string;
  category: string;
  price_range: string;
  affiliate_link: string;
}

export interface LeadPost {
  id: number;
  post_shortcode: string;
  post_url: string;
  author_username: string;
  post_text: string;
  keyword_matched: string;
  intent_score: number;
  is_buying_intent: boolean;
  ai_reasoning: string;
  matched_product_id: number | null;
  matched_product: MatchedProductSummary | null;
  draft_reply: string;
  status: LeadStatus;
  error_message: string | null;
  scraped_at: string;
  commented_at: string | null;
}

export interface LeadListResponse {
  items: LeadPost[];
  counts: Record<string, number>;
  pagination: {
    page: number;
    page_size: number;
    total_items: number;
    total_pages: number;
  };
}

export type BotMode = "SEMI_AUTO" | "FULL_AUTO";
export type AIProviderType = "openai_compatible" | "google_genai";

export interface BotSetting {
  id: number;
  bot_mode: BotMode;
  is_scheduler_running: boolean;
  scan_interval_minutes: number;
  max_comments_per_day: number;
  min_intent_score: number;
  search_keywords: string;
  ai_provider: AIProviderType;
  ai_base_url: string;
  has_ai_api_key: boolean;
  ai_api_key_masked: string;
  ai_model: string;
  custom_system_prompt: string;
  telegram_bot_token_masked: string;
  has_telegram_bot_token: boolean;
  telegram_chat_id: string | null;
}

export interface BotSettingUpdate {
  bot_mode?: BotMode;
  scan_interval_minutes?: number;
  max_comments_per_day?: number;
  min_intent_score?: number;
  search_keywords?: string;
  ai_provider?: AIProviderType;
  ai_base_url?: string;
  ai_api_key?: string;
  ai_model?: string;
  custom_system_prompt?: string;
  telegram_bot_token?: string;
  telegram_chat_id?: string | null;
}

export interface TestAIRequest {
  sample_post: string;
  ai_provider?: AIProviderType;
  ai_base_url?: string;
  ai_api_key?: string;
  ai_model?: string;
  custom_system_prompt?: string;
}

export interface TestAIResponse {
  is_buying_intent: boolean;
  intent_score: number;
  matched_product_id: number | null;
  matched_product_name: string | null;
  reasoning: string;
  draft_reply: string;
  latency_ms: number;
  provider_used: string;
  model_used: string;
}

export interface AuthStatus {
  connected: boolean;
  cookie_count: number;
  threads_cookie_count: number;
  has_session_cookie: boolean;
  updated_at: string | null;
  message: string;
}

export interface ActivityLogItem {
  timestamp: string;
  level: "info" | "success" | "warning" | "error";
  message: string;
}

export interface BotStatus {
  bot_mode: BotMode;
  is_scheduler_running: boolean;
  scan_interval_minutes: number;
  next_run_at: string | null;
  is_scanning: boolean;
  current_keyword: string | null;
  last_scan_at: string | null;
  last_scan_summary: string | null;
  active_keywords: string[];
  ai_provider: AIProviderType;
  ai_base_url: string;
  ai_model: string;
  has_ai_api_key: boolean;
  min_intent_score: number;
  max_comments_per_day: number;
  auth_status: AuthStatus;
  recent_logs: ActivityLogItem[];
}

export interface DailyStatItem {
  date_str: string;
  posts_scraped: number;
  leads_found: number;
  comments_sent: number;
}

export interface DashboardStats {
  date_str: string;
  posts_scraped: number;
  leads_found: number;
  comments_sent: number;
  max_comments_per_day: number;
  pending_review_count: number;
  commented_total_count: number;
  ignored_total_count: number;
  failed_total_count: number;
  total_products: number;
  active_products: number;
  avg_intent_score: number;
  history: DailyStatItem[];
}

export interface ScanTriggerResponse {
  started: boolean;
  message: string;
  keywords: string[];
}

// ---------------------------------------------------------------------------
// Core Request Helper & SWR Fetcher
// ---------------------------------------------------------------------------
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;

  const headers: HeadersInit = isFormData
    ? { ...(init?.headers || {}) }
    : {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      };

  const response = await fetch(url, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const errBody = await response.json();
      if (typeof errBody?.detail === "string") {
        detail = errBody.detail;
      } else if (Array.isArray(errBody?.detail) && errBody.detail[0]?.msg) {
        detail = errBody.detail[0].msg;
      }
    } catch {
      const text = await response.text().catch(() => "");
      if (text) detail = text.slice(0, 200);
    }
    throw new ApiError(response.status, detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const swrFetcher = <T>(path: string): Promise<T> => request<T>(path);

// ---------------------------------------------------------------------------
// Typed API Endpoints
// ---------------------------------------------------------------------------
export const api = {
  // Bot control & overview
  getBotStatus: () => request<BotStatus>("/api/bot/status"),
  getDashboardStats: () => request<DashboardStats>("/api/bot/stats"),
  startScheduler: () =>
    request<BotStatus>("/api/bot/scheduler/start", { method: "POST" }),
  stopScheduler: () =>
    request<BotStatus>("/api/bot/scheduler/stop", { method: "POST" }),
  triggerManualScan: (keywords?: string[]) =>
    request<ScanTriggerResponse>("/api/bot/scan", {
      method: "POST",
      body: JSON.stringify(keywords ? { keywords } : {}),
    }),
  uploadAuthFile: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return request<AuthStatus>("/api/bot/upload-auth", {
      method: "POST",
      body: formData,
    });
  },
  importCookiesJson: (rawJson: string) =>
    request<AuthStatus>("/api/bot/import-cookies", {
      method: "POST",
      body: JSON.stringify({ raw_json: rawJson }),
    }),

  // Leads
  listLeads: (params?: {
    status?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.search) qs.set("search", params.search);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.pageSize) qs.set("page_size", String(params.pageSize));
    const query = qs.toString();
    return request<LeadListResponse>(`/api/leads${query ? `?${query}` : ""}`);
  },
  updateLead: (
    leadId: number,
    payload: { draft_reply?: string; status?: LeadStatus; matched_product_id?: number | null }
  ) =>
    request<LeadPost>(`/api/leads/${leadId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  sendLeadReply: (leadId: number, draftReply?: string) =>
    request<LeadPost>(`/api/leads/${leadId}/reply`, {
      method: "POST",
      body: JSON.stringify(draftReply ? { draft_reply: draftReply } : {}),
    }),
  ignoreLead: (leadId: number) =>
    request<LeadPost>(`/api/leads/${leadId}/ignore`, { method: "POST" }),
  deleteLead: (leadId: number) =>
    request<void>(`/api/leads/${leadId}`, { method: "DELETE" }),

  // Products
  listProducts: (params?: { search?: string; category?: string; activeOnly?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set("search", params.search);
    if (params?.category && params.category !== "All") qs.set("category", params.category);
    if (params?.activeOnly) qs.set("active_only", "true");
    const query = qs.toString();
    return request<Product[]>(`/api/products${query ? `?${query}` : ""}`);
  },
  createProduct: (payload: ProductPayload) =>
    request<Product>("/api/products", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateProduct: (productId: number, payload: Partial<ProductPayload>) =>
    request<Product>(`/api/products/${productId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteProduct: (productId: number) =>
    request<void>(`/api/products/${productId}`, { method: "DELETE" }),
  bulkImportProducts: (rawText: string, defaultCategory = "Shopee Affiliate") =>
    request<BulkProductImportResponse>("/api/products/bulk-import", {
      method: "POST",
      body: JSON.stringify({
        raw_text: rawText,
        default_category: defaultCategory,
      }),
    }),

  // Settings & AI Tester
  getSettings: () => request<BotSetting>("/api/settings"),
  updateSettings: (payload: BotSettingUpdate) =>
    request<BotSetting>("/api/settings", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  testAiConnection: (payload: TestAIRequest) =>
    request<TestAIResponse>("/api/settings/test-ai", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
