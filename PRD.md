# PRODUCT REQUIREMENTS DOCUMENT (PRD) - v3.0 FULL-STACK & CUSTOM DESIGN EDITION
## Project Name: Threads Affiliate AI Hunter (Web Dashboard + Automation Engine)
## Architecture: Monorepo (Next.js 15 App Router + Python FastAPI/Playwright + PostgreSQL 16 + Docker)

---

## 1. SYSTEM ROLE & VIBE CODING RULES FOR AI AGENT
You are a Senior Full-Stack & Automation Engineer and UI/UX Specialist. Follow these strict rules:
1. **Monorepo Architecture**:
   - `/backend`: Python 3.11+, **FastAPI**, **SQLAlchemy 2.0 (Async)** + `asyncpg`, **Playwright (Async)**, and **APScheduler**.
   - `/frontend`: **Next.js 15 (App Router, TypeScript)**, **Tailwind CSS**, **shadcn/ui**, **Lucide Icons**, and **SWR** or **TanStack Query**.
   - `/docker-compose.yml`: Orchestrates PostgreSQL 16, Backend API/Worker, and Frontend Web UI.
2. **Universal / Custom AI Provider Support**:
   - Do NOT hardcode a single LLM provider.
   - Use the `openai` Python SDK (`AsyncOpenAI(api_key=..., base_url=...)`) as a universal client so the user can configure **any** OpenAI-compatible provider directly from the Next.js Settings UI (e.g., 9Router, OpenRouter, Gemini OpenAI endpoint, Groq, DeepSeek, or local Ollama), alongside native `google-genai` support.
3. **Dynamic Settings in PostgreSQL**:
   - Store AI configurations (`ai_provider`, `ai_base_url`, `ai_api_key`, `ai_model`, `custom_system_prompt`), scraping keywords, and anti-ban limits in PostgreSQL so they can be updated live via the Next.js UI without restarting containers.
4. **Strict UI Aesthetic Compliance**:
   - You MUST style the entire Next.js frontend according to **Section 5 (Obsidian & Electric Orange Editorial Design System)**. Never use default blue/indigo boilerplate themes.
5. **Anti-Ban & Human Emulation**:
   - Enforce daily comment caps, randomized human delays, character-by-character typing simulation, and Playwright stealth flags (`--disable-blink-features=AutomationControlled`).

---

## 2. MONOREPO DIRECTORY STRUCTURE
Create and maintain this exact folder structure:

```text
threads-affiliate-platform/
├── docker-compose.yml
├── .env.example
├── .gitignore
├── README.md
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── login_helper.py          # Run locally on Windows (headless=False) to generate auth_threads.json
│   ├── data/
│   │   ├── auth_threads.json    # Playwright session state (mounted via Docker volume & uploadable via UI)
│   │   └── seed_products.json   # Initial Shopee Affiliate products seed
│   └── app/
│       ├── __init__.py
│       ├── main.py              # FastAPI entry point, CORS, lifespan DB init & scheduler startup
│       ├── config.py            # Environment config (DATABASE_URL, CORS_ORIGINS)
│       ├── database.py          # Async SQLAlchemy engine & PostgreSQL session maker
│       ├── models.py            # SQLAlchemy ORM tables (Product, LeadPost, BotSetting, DailyStat)
│       ├── schemas.py           # Pydantic v2 request/response schemas
│       ├── routers/
│       │   ├── products.py      # CRUD endpoints for Shopee Affiliate products
│       │   ├── leads.py         # List/filter scraped Threads posts, edit reply, trigger instant comment
│       │   ├── settings.py      # Update AI Base URL, API Key, Model, Keywords, & Test AI endpoint
│       │   └── bot_control.py   # Start/Stop scheduler, manual scan trigger, upload auth_threads.json, KPI stats
│       └── services/
│           ├── ai_service.py    # Universal Multi-LLM client (Custom Base URL + OpenAI SDK / Gemini)
│           ├── scraper.py       # Playwright stealth Threads search & human-like reply engine
│           ├── scheduler.py     # APScheduler background periodic scraping job
│           └── telegram.py      # Optional Telegram notification & approval webhook
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── tsconfig.json
    ├── tailwind.config.ts
    └── src/
        ├── app/
        │   ├── globals.css      # Custom dark scrollbar, obsidian background, orange glow utilities
        │   ├── layout.tsx       # Top/Sidebar navigation with status pill & Plus Jakarta Sans font
        │   ├── page.tsx         # Overview Dashboard (Editorial KPI Stats, 01-03 Pipeline Cards, Live Feed)
        │   ├── leads/page.tsx   # Scraped Threads Queue (Filter tabs, Editable AI Reply, 1-Click Send)
        │   ├── products/page.tsx# Shopee Affiliate Catalog Manager (Bento Cards + CRUD Modal)
        │   └── settings/page.tsx# AI Provider Config (Base URL/API Key/Model), Keywords, Auth JSON Dropzone
        ├── components/
        │   ├── ui/              # Customized shadcn/ui components (Obsidian & Orange theme)
        │   ├── PillButton.tsx   # Signature orange pill button with inner circular white icon badge
        │   ├── StatCounter.tsx  # Editorial stacked large orange number stats (e.g., "200+")
        │   └── LeadCard.tsx     # Bento card for Threads post evaluation & reply editor
        └── lib/
            └── api.ts           # Typed Fetch/Axios wrapper talking to FastAPI backend
```

---

## 3. POSTGRESQL DATABASE SCHEMA (`backend/app/models.py`)

### Table 1: `products` (Shopee Affiliate Catalog)
| Column | Type | Details |
| :--- | :--- | :--- |
| `id` | `Integer` | Primary Key, Auto-increment |
| `name` | `String(255)` | Product title (e.g., `"Anker Soundcore R50i TWS"`) |
| `category` | `String(100)` | Niche tag (e.g., `"Gadget"`, `"Skincare"`, `"Home Office"`) |
| `keywords` | `Text` | Comma-separated matching hints (e.g., `"tws, earphone bluetooth, headset bass"`) |
| `price_range` | `String(100)` | Price context (e.g., `"Rp 150.000 - Rp 200.000"`) |
| `selling_points` | `Text` | Casual benefits for AI copywriting (e.g., `"bass empuk, baterai 30 jam, tahan air"`) |
| `affiliate_link` | `String(500)` | Shopee Affiliate shortlink (`https://s.shopee.co.id/...`) |
| `is_active` | `Boolean` | Default `True` |
| `created_at` | `DateTime` | Default `func.now()` |

### Table 2: `lead_posts` (Scraped Threads Posts)
| Column | Type | Details |
| :--- | :--- | :--- |
| `id` | `Integer` | Primary Key, Auto-increment |
| `post_shortcode` | `String(100)` | Unique Index (extracted from `/post/<shortcode>`) |
| `post_url` | `String(500)` | Full link to the Threads post |
| `author_username` | `String(150)` | Threads handle of the poster |
| `post_text` | `Text` | Raw scraped text content |
| `keyword_matched` | `String(150)` | The search keyword that discovered this post |
| `intent_score` | `Integer` | `0` to `100` score assigned by AI |
| `is_buying_intent` | `Boolean` | `True` if genuinely looking for recommendations/links |
| `ai_reasoning` | `Text` | Short explanation from the AI |
| `matched_product_id`| `Integer` | ForeignKey(`products.id`, nullable) |
| `draft_reply` | `Text` | Natural Indonesian reply drafted by AI (editable in UI) |
| `status` | `String(50)` | `PENDING_REVIEW`, `COMMENTED`, `IGNORED`, `FAILED` |
| `error_message` | `Text` | Nullable debug message if Playwright fails |
| `scraped_at` | `DateTime` | Default `func.now()` |
| `commented_at` | `DateTime` | Nullable timestamp when reply was sent |

### Table 3: `bot_settings` (Single-Row Dynamic Configuration, `id=1`)
| Column | Type | Default / Description |
| :--- | :--- | :--- |
| `id` | `Integer` | Primary Key (always `1`) |
| `bot_mode` | `String(50)` | `"SEMI_AUTO"` (manual approval in Web UI) or `"FULL_AUTO"` |
| `is_scheduler_running`| `Boolean` | `False` |
| `scan_interval_minutes`| `Integer` | `25` |
| `max_comments_per_day` | `Integer` | `12` |
| `min_intent_score` | `Integer` | `75` |
| `search_keywords` | `Text` | `"rekomendasi tws, spill parfum awet, rekomendasi keyboard mechanical"` |
| `ai_provider` | `String(50)` | `"openai_compatible"` (supports 9Router, OpenRouter, Groq, Gemini OpenAI endpoint) |
| `ai_base_url` | `String(500)` | `"https://generativelanguage.googleapis.com/v1beta/openai/"` |
| `ai_api_key` | `String(500)` | `""` (configured via Web UI) |
| `ai_model` | `String(150)` | `"gemini-2.5-flash"` |
| `custom_system_prompt` | `Text` | Default casual Indonesian Threads peer persona |
| `telegram_bot_token` | `String(255)` | Nullable |
| `telegram_chat_id` | `String(100)` | Nullable |

### Table 4: `daily_stats`
| Column | Type | Details |
| :--- | :--- | :--- |
| `date_str` | `String(20)` | Primary Key (`YYYY-MM-DD`) |
| `posts_scraped` | `Integer` | Default `0` |
| `leads_found` | `Integer` | Default `0` |
| `comments_sent` | `Integer` | Default `0` |

---

## 4. BACKEND API & AUTOMATION SPECIFICATIONS (`backend/`)

### 4.1 Universal AI Engine (`app/services/ai_service.py`)
- Dynamically fetches `ai_base_url`, `ai_api_key`, `ai_model`, and `custom_system_prompt` from `bot_settings` table on every run.
- Uses `AsyncOpenAI(api_key=settings.ai_api_key, base_url=settings.ai_base_url)` to evaluate scraped posts against active products.
- Enforces JSON output structure:
  ```json
  {
    "is_buying_intent": true,
    "intent_score": 90,
    "matched_product_id": 1,
    "reasoning": "User is asking for a durable commuter TWS under 200k.",
    "draft_reply": "Kalau buat komuter budget segitu paling aman ambil Anker R50i sih, gua pake dari tahun lalu baterainya awet parah dan bass-nya pas. Kemarin beli di toko official-nya pas diskon di sini: [https://s.shopee.co.id/xxx](https://s.shopee.co.id/xxx)"
  }
  ```
- **Tone Rules**: Must sound like a helpful Indonesian friend on Threads (`"gua"`, `"kemarin ambil ini"`, `"so far awet"`). Strictly forbid stiff sales phrases (`"Halo kak"`, `"Yuk diorder"`, `"Cek keranjang kuning"`).
- **Test Endpoint (`POST /api/settings/test-ai`)**: Accepts a sample post string and returns the live JSON response + latency (ms) so the user can test any custom provider (9Router, OpenRouter, Gemini, DeepSeek) from the Next.js Settings page.

### 4.2 Playwright Stealth Scraper & Responder (`app/services/scraper.py`)
- Uses `backend/data/auth_threads.json` for authenticated session context.
- **Session Upload Endpoint (`POST /api/bot/upload-auth`)**: Allows uploading `auth_threads.json` directly from the Next.js Settings UI to the VPS backend container, validating that the JSON contains valid `cookies` for `.threads.net`.
- **`scrape_keyword(keyword: str)`**:
  - Launches Chromium with `--disable-blink-features=AutomationControlled`, `locale="id-ID"`, `timezone_id="Asia/Jakarta"`.
  - Navigates to `https://www.threads.net/search?q={urllib.parse.quote(keyword)}&serp_type=default&filter=recent`.
  - Waits 4–7 seconds, scrolls twice naturally, and extracts post containers matching `/post/[A-Za-z0-9_-]+`.
  - Filters out any `post_shortcode` already in PostgreSQL `lead_posts`.
  - Evaluates new posts via `ai_service.py` and saves results to `lead_posts`.
  - If `bot_mode == "FULL_AUTO"` and `intent_score >= min_intent_score` and `comments_sent < max_comments_per_day`, automatically triggers `send_reply()` after a random 45–120s cooldown.
- **`send_reply(lead_id: int)`**:
  - Opens `lead.post_url`, waits 3–6 seconds, clicks Reply button (`aria-label="Reply"` or `"Balas"`).
  - Focuses `div[contenteditable="true"]` and types `lead.draft_reply` character-by-character (`delay=random.randint(45, 110)`).
  - Submits reply, waits 5 seconds, updates `lead.status = "COMMENTED"`, and increments `daily_stats.comments_sent`.

---

## 5. UI/UX DESIGN SYSTEM & VISUAL GUIDELINES (`frontend/`)
*(Inspired by the "Dominic" Dark Editorial Bento Reference)*

### 5.1 Color Palette & Surface Tokens
Configure `tailwind.config.ts` and `globals.css` with this exact dark-only palette:
- **Canvas Background (`bg-obsidian`)**: `#0B0B0C` (Deep matte obsidian black).
- **Primary Card Surface (`bg-surface`)**: `#151518` (Dark charcoal card with subtle top highlight).
- **Elevated / Hover Surface (`bg-surface-hover`)**: `#1E1E22`.
- **Card Border (`border-subtle`)**: `#26262A` (`1px solid`, transitions to `#FF6B00/50` on hover).
- **Signature Accent Orange (`accent-orange`)**: `#FF6B00` (Primary brand & Shopee affiliate highlight) with hover state `#FF7A1A`.
- **Featured Highlight Card Gradient**: `bg-gradient-to-b from-[#FF6B00] to-[#E04F00]` with crisp `#FFFFFF` text (used for the Hero Active Bot Card or Featured High-Intent Lead Card, mirroring the center orange pricing card in the reference).
- **Typography Colors**:
  - Primary Headings & Values: `#FFFFFF` (Pure crisp white)
  - Secondary Body Copy: `#9E9EA6` (Muted warm silver)
  - Muted Labels / Metadata: `#63636B`
- **Ambient Glow**: Add a subtle radial background glow at the top-center of the page:
  `background: radial-gradient(circle at 50% 0%, rgba(255, 107, 0, 0.14) 0%, rgba(11, 11, 12, 0) 60%);`

### 5.2 Typography & Editorial Hierarchy
- Load **`Plus Jakarta Sans`** (or **`Inter`**) for headings/body and **`JetBrains Mono`** for shortcodes, API URLs, and timers.
- **Hero Display Titles**: Large bold editorial style (`text-4xl md:text-5xl font-bold tracking-tight text-white`).
- **Editorial Stacked KPI Counters (`<StatCounter />`)**:
  - Mirror the top-right stat block from the reference (`20+`, `200+`, `500+`):
  - Huge orange numbers (`text-4xl font-extrabold text-[#FF6B00]`) stacked or aligned cleanly with a muted subtitle below (`text-xs uppercase tracking-wider text-[#9E9EA6]`) and a crisp `1px solid #26262A` horizontal divider (`border-b border-[#26262A] pb-4`).
- **Numbered Bento Process/Pipeline Cards (`01`, `02`, `03`)**:
  - Mirror the bottom-left 3-column numbered cards from the reference:
  - Square/vertical dark cards (`bg-[#151518] border border-[#26262A] rounded-2xl p-6 flex flex-col justify-between min-h-[210px]`).
  - Top-left displays a bold index number (`01`, `02`, `03`) in `text-2xl font-bold text-[#FF6B00]`.
  - Bottom displays a bold white title (`text-lg font-semibold text-white mb-2`) and muted description (`text-sm text-[#9E9EA6]`).

### 5.3 Signature Component: `<PillButton />`
Replicate the exact CTA button seen throughout the design reference:
- Shape: `rounded-full` pill (`bg-[#FF6B00] hover:bg-[#FF7A1A] text-white font-medium pl-5 pr-2 py-2 inline-flex items-center gap-3 transition-all shadow-[0_0_25px_rgba(255,107,0,0.3)]`).
- Inner Icon Badge: Inside the right side of the pill button, render a solid white circle (`w-7 h-7 rounded-full bg-white text-[#0B0B0C] flex items-center justify-center`) containing a `Lucide` arrow or action icon (`ArrowUpRight`, `Send`, or `Sparkles`).
- For buttons inside the **Featured Orange Gradient Card**, invert the pill to a sleek dark obsidian pill (`bg-[#0B0B0C] text-white`) with an orange circular icon badge.

### 5.4 Page-by-Page Layout Specifications

#### Page 1: `/` (Overview Command Center)
- **Top Navbar**: Minimal floating bar with Brand Logo dot (`w-2.5 h-2.5 rounded-full bg-[#FF6B00]`), navigation links (`Overview`, `Leads Queue`, `Products`, `Settings`), and a live session badge (`Threads Auth: Connected`).
- **Hero Section (2-Column Asymmetric Split)**:
  - **Left Column**: Large editorial heading (`"Autonomous Threads Affiliate Engine."`), status subtitle, and two signature `<PillButton />` triggers: **"Scan Threads Now"** and **"Start Auto-Scheduler"**.
  - **Right Column (Stacked Editorial Metrics)**: Vertical stack of 3 big orange counters separated by thin horizontal lines:
    1. `Posts Scraped Today` (e.g., `240+`)
    2. `High-Intent Leads Matched` (e.g., `18+`)
    3. `Affiliate Replies Sent` (e.g., `9 / 12`)
- **Middle Section (`01`, `02`, `03` Live Pipeline Bento Cards)**:
  - `01` **Keyword Radar**: Shows active search keywords currently rotating and next scheduled run countdown.
  - `02` **AI Intent Filter**: Shows current active LLM Model & Base URL (e.g., `gemini-2.5-flash` via Custom Router) and average match score.
  - `03` **Stealth Responder**: Shows anti-ban health, daily quota bar, and `SEMI_AUTO` / `FULL_AUTO` switch.

#### Page 2: `/leads` (Lead Queue & Smart Reply Studio)
- **Filter Pills**: `Pending Review`, `Commented`, `Ignored`.
- **3-Column Bento Grid of Lead Cards**:
  - Top-scoring lead (`intent_score >= 90`) gets the **Featured Vibrant Orange Card** (`bg-gradient-to-b from-[#FF6B00] to-[#E04F00] text-white`) treatment to immediately draw attention! Standard leads use `bg-[#151518] border border-[#26262A]`.
  - Each card displays:
    - Author `@username`, timestamp, matched keyword tag, and 5-star/percentage orange intent indicator (`92% Match`).
    - Original Threads post text quote.
    - Matched Shopee Product pill badge.
    - **Editable Textarea** (`bg-[#0B0B0C]/80 border border-[#26262A] rounded-xl p-3 text-sm text-white`) pre-filled with the AI's casual Indonesian reply + affiliate link.
    - Footer actions: Signature `<PillButton />` (**"Auto-Reply Now"**), **"Copy Text"** button, and **"Skip"** button.

#### Page 3: `/products` (Shopee Affiliate Catalog)
- Header with search bar and `<PillButton />` **"Add Affiliate Product"**.
- Grid of sleek dark cards (`rounded-2xl bg-[#151518] border border-[#26262A] p-6`) displaying Product Name, Category badge, Price Range in bold orange (`Rp 150rb - 200rb`), bulleted selling points (with orange check icons like the pricing cards in the reference), truncated Shopee link, and Active toggle switch.

#### Page 4: `/settings` (Universal AI Router, Scraper & Auth Session)
- **Card 1: Universal AI Provider Configuration**:
  - Quick Preset Pills: `Google Gemini`, `9Router / Custom OpenAI`, `OpenRouter`, `Groq`, `DeepSeek`.
  - Inputs for `AI Base URL`, `API Key` (password masked), `Model Name`, and `System Prompt Persona` textarea.
  - `<PillButton />` **"Test AI Connection"** that displays a live latency & sample reply preview box.
- **Card 2: Scraper & Anti-Ban Rules**:
  - Interactive keyword chips editor, `Bot Mode` (`SEMI_AUTO` vs `FULL_AUTO`), `Max Comments / Day` slider (`1`–`25`), and `Scan Interval (Minutes)`.
- **Card 3: Threads Session (`auth_threads.json`) Uploader**:
  - Drag-and-drop zone to upload `auth_threads.json` generated by `login_helper.py` on the local PC directly into the VPS container.

---

## 6. DOCKER & VPS DEPLOYMENT (`docker-compose.yml`)
Configure `docker-compose.yml` so the entire stack boots on the Linux VPS (4 vCPU / 8GB RAM) with a single command (`docker compose up -d --build`):
1. **`postgres`**: `postgres:16-alpine`, persistent volume `pg_affiliate_data`, port `5432`, healthcheck enabled.
2. **`backend`**: Python 3.11 slim + Playwright Chromium (`playwright install --with-deps chromium`), port `8000`, volume `./backend/data:/app/data` to persist `auth_threads.json`.
3. **`frontend`**: Next.js 15 app exposed on port `3000`, configured with `NEXT_PUBLIC_API_URL=http://localhost:8000` (or VPS IP).

---

## 7. STEP-BY-STEP IMPLEMENTATION PLAN FOR AI AGENT
Execute the project in these 4 structured phases:
- **Phase 1 (Docker, Postgres & FastAPI Core)**: Create `docker-compose.yml`, `backend/Dockerfile`, `requirements.txt`, SQLAlchemy async models (`models.py`), auto-table creation + seed data (`seed_products.json` and default `bot_settings`), and test FastAPI startup.
- **Phase 2 (Universal AI Engine & REST Routers)**: Implement `ai_service.py` with custom `base_url` + `api_key` support, `/api/products` CRUD, and `/api/settings` (including `/api/settings/test-ai`).
- **Phase 3 (Playwright Stealth Engine & Auth Upload)**: Implement `login_helper.py` (for local Windows login), `scraper.py` (Threads search & human-like typing reply), `scheduler.py`, `/api/leads`, and `/api/bot/upload-auth`.
- **Phase 4 (Next.js "Obsidian & Electric Orange" Dashboard)**: Scaffold `frontend/` with Tailwind CSS, implement the custom color tokens, `<PillButton />`, `<StatCounter />`, `01-03` Pipeline Cards, Featured Orange Gradient Lead Card, and connect all 4 pages (`/`, `/leads`, `/products`, `/settings`) to the FastAPI backend.