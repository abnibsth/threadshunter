"use client";

import * as React from "react";
import useSWR, { useSWRConfig } from "swr";
import {
  AlertCircle,
  CheckCircle2,
  Cpu,
  Eye,
  EyeOff,
  FileJson,
  KeyRound,
  Plus,
  Save,
  Shield,
  Sparkles,
  UploadCloud,
  X,
  Zap,
} from "lucide-react";
import {
  AIProviderType,
  api,
  AuthStatus,
  BotMode,
  BotSetting,
  swrFetcher,
  TestAIResponse,
} from "@/lib/api";
import { cn, formatRelativeTime } from "@/lib/utils";
import { PillButton } from "@/components/PillButton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface ProviderPreset {
  id: string;
  label: string;
  ai_provider: AIProviderType;
  ai_base_url: string;
  ai_model: string;
}

const AI_PRESETS: ProviderPreset[] = [
  {
    id: "gemini",
    label: "Google Gemini",
    ai_provider: "openai_compatible",
    ai_base_url: "https://generativelanguage.googleapis.com/v1beta/openai/",
    ai_model: "gemini-2.5-flash",
  },
  {
    id: "9router",
    label: "9Router / Custom OpenAI",
    ai_provider: "openai_compatible",
    ai_base_url: "http://localhost:20128/v1",
    ai_model: "gemini-2.5-flash",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    ai_provider: "openai_compatible",
    ai_base_url: "https://openrouter.ai/api/v1",
    ai_model: "google/gemini-2.5-flash",
  },
  {
    id: "groq",
    label: "Groq",
    ai_provider: "openai_compatible",
    ai_base_url: "https://api.groq.com/openai/v1",
    ai_model: "llama-3.3-70b-versatile",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    ai_provider: "openai_compatible",
    ai_base_url: "https://api.deepseek.com/v1",
    ai_model: "deepseek-chat",
  },
];

const DEFAULT_SAMPLE_POST =
  "Guys minta rekomendasi TWS di bawah 200rb dong yang bass nya empuk dan baterainya awet buat naik KRL tiap hari";

export default function SettingsPage() {
  const { mutate: globalMutate } = useSWRConfig();
  const {
    data: settings,
    error: settingsError,
    mutate: mutateSettings,
  } = useSWR<BotSetting>("/api/settings", swrFetcher);

  const { data: authStatus, mutate: mutateAuth } = useSWR<AuthStatus>(
    "/api/bot/auth-status",
    swrFetcher
  );

  // Form state hydrated from PostgreSQL bot_settings
  const [aiProvider, setAiProvider] = React.useState<AIProviderType>("openai_compatible");
  const [aiBaseUrl, setAiBaseUrl] = React.useState("");
  const [aiApiKey, setAiApiKey] = React.useState("");
  const [showApiKey, setShowApiKey] = React.useState(false);
  const [aiModel, setAiModel] = React.useState("");
  const [systemPrompt, setSystemPrompt] = React.useState("");

  const [keywords, setKeywords] = React.useState<string[]>([]);
  const [newKeyword, setNewKeyword] = React.useState("");
  const [botMode, setBotMode] = React.useState<BotMode>("SEMI_AUTO");
  const [maxComments, setMaxComments] = React.useState<number>(12);
  const [minIntentScore, setMinIntentScore] = React.useState<number>(75);
  const [scanInterval, setScanInterval] = React.useState<number>(25);

  const [telegramToken, setTelegramToken] = React.useState("");
  const [telegramChatId, setTelegramChatId] = React.useState("");

  const [hydrated, setHydrated] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saveNotice, setSaveNotice] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Test AI state
  const [samplePost, setSamplePost] = React.useState(DEFAULT_SAMPLE_POST);
  const [testingAi, setTestingAi] = React.useState(false);
  const [testResult, setTestResult] = React.useState<TestAIResponse | null>(null);
  const [testError, setTestError] = React.useState<string | null>(null);

  // Auth JSON Uploader & Clipboard Paste state
  const [dragActive, setDragActive] = React.useState(false);
  const [uploadingAuth, setUploadingAuth] = React.useState(false);
  const [pastedCookies, setPastedCookies] = React.useState("");
  const [uploadNotice, setUploadNotice] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (settings && !hydrated) {
      setAiProvider(settings.ai_provider);
      setAiBaseUrl(settings.ai_base_url);
      setAiModel(settings.ai_model);
      setSystemPrompt(settings.custom_system_prompt);
      setKeywords(
        (settings.search_keywords || "")
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean)
      );
      setBotMode(settings.bot_mode);
      setMaxComments(settings.max_comments_per_day);
      setMinIntentScore(settings.min_intent_score);
      setScanInterval(settings.scan_interval_minutes);
      setTelegramChatId(settings.telegram_chat_id || "");
      setHydrated(true);
    }
  }, [settings, hydrated]);

  const applyPreset = (preset: ProviderPreset) => {
    setAiProvider(preset.ai_provider);
    setAiBaseUrl(preset.ai_base_url);
    setAiModel(preset.ai_model);
  };

  const addKeywordChip = () => {
    const clean = newKeyword.trim();
    if (!clean) return;
    if (!keywords.some((k) => k.toLowerCase() === clean.toLowerCase())) {
      setKeywords((prev) => [...prev, clean]);
    }
    setNewKeyword("");
  };

  const removeKeywordChip = (target: string) => {
    setKeywords((prev) => prev.filter((k) => k !== target));
  };

  const handleSaveAll = async () => {
    setSaveNotice(null);
    setSaving(true);
    try {
      const updated = await api.updateSettings({
        ai_provider: aiProvider,
        ai_base_url: aiBaseUrl.trim(),
        ai_api_key: aiApiKey.trim() || undefined,
        ai_model: aiModel.trim(),
        custom_system_prompt: systemPrompt,
        search_keywords: keywords.join(", "),
        bot_mode: botMode,
        max_comments_per_day: maxComments,
        min_intent_score: minIntentScore,
        scan_interval_minutes: Math.max(5, Number(scanInterval) || 25),
        telegram_bot_token: telegramToken.trim() || undefined,
        telegram_chat_id: telegramChatId.trim() || null,
      });

      setAiApiKey("");
      setTelegramToken("");
      await mutateSettings(updated, false);
      setSaveNotice({
        type: "success",
        text: "Semua konfigurasi tersimpan live ke PostgreSQL tanpa restart container!",
      });
    } catch (err) {
      setSaveNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Gagal menyimpan pengaturan.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestAi = async () => {
    setTestError(null);
    setTestResult(null);
    setTestingAi(true);
    try {
      const result = await api.testAiConnection({
        sample_post: samplePost,
        ai_provider: aiProvider,
        ai_base_url: aiBaseUrl.trim() || undefined,
        ai_api_key: aiApiKey.trim() || undefined,
        ai_model: aiModel.trim() || undefined,
        custom_system_prompt: systemPrompt || undefined,
      });
      setTestResult(result);
    } catch (err) {
      setTestError(
        err instanceof Error ? err.message : "Koneksi AI gagal."
      );
    } finally {
      setTestingAi(false);
    }
  };

  const handleAuthUpload = async (file: File | null | undefined) => {
    if (!file) return;
    setUploadNotice(null);
    setUploadingAuth(true);
    try {
      const statusRes = await api.uploadAuthFile(file);
      await mutateAuth(statusRes, false);
      await globalMutate("/api/bot/status");
      setUploadNotice({
        type: "success",
        text: `Berhasil upload! ${statusRes.message}`,
      });
    } catch (err) {
      setUploadNotice({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Upload auth_threads.json gagal.",
      });
    } finally {
      setUploadingAuth(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleConnectPastedCookies = async (explicitText?: string) => {
    setUploadNotice(null);
    let candidate = (explicitText ?? pastedCookies).trim();

    if (!candidate && typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        candidate = (await navigator.clipboard.readText()).trim();
        if (candidate) setPastedCookies(candidate);
      } catch {
        // Clipboard permission denied — ask user to Ctrl+V into textarea
      }
    }

    if (!candidate) {
      setUploadNotice({
        type: "error",
        text: "Tempelkan (Ctrl+V) teks JSON dari Cookie-Editor ke kotak di bawah terlebih dahulu.",
      });
      return;
    }

    setUploadingAuth(true);
    try {
      const statusRes = await api.importCookiesJson(candidate);
      await mutateAuth(statusRes, false);
      await globalMutate("/api/bot/status");
      setPastedCookies("");
      setUploadNotice({
        type: "success",
        text: `Sesi Chrome berhasil tersambung tanpa buka browser baru! ${statusRes.message}`,
      });
    } catch (err) {
      setUploadNotice({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Gagal menghubungkan cookie JSON.",
      });
    } finally {
      setUploadingAuth(false);
    }
  };

  const safetyMeta =
    maxComments <= 12
      ? { label: "Safe Anti-Ban Zone", cls: "text-emerald-400" }
      : maxComments <= 18
      ? { label: "Moderate Velocity", cls: "text-[#FF6B00]" }
      : { label: "High Risk — Monitor Closely", cls: "text-red-400" };

  return (
    <div className="space-y-8">
      {/* Header + Global Save CTA */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#FF6B00]">
            Dynamic PostgreSQL Config
          </p>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
            AI Router, Anti-Ban &amp; Session
          </h1>
          <p className="text-sm text-[#9E9EA6] max-w-2xl">
            Ganti AI provider (Gemini, 9Router, OpenRouter, Groq, DeepSeek, Ollama),
            atur keyword pencarian, dan upload session Threads secara live tanpa
            restart Docker container.
          </p>
        </div>

        <PillButton
          loading={saving}
          icon={<Save className="h-4 w-4" />}
          onClick={handleSaveAll}
        >
          Save Configuration
        </PillButton>
      </div>

      {/* Global Save Feedback */}
      {saveNotice && (
        <div
          role="status"
          className={cn(
            "flex items-center gap-2.5 rounded-2xl border px-4 py-3 text-sm",
            saveNotice.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-red-500/10 border-red-500/30 text-red-300"
          )}
        >
          {saveNotice.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
          )}
          <span>{saveNotice.text}</span>
        </div>
      )}

      {settingsError && (
        <div
          role="alert"
          className="rounded-2xl bg-red-500/10 border border-red-500/30 p-4 text-sm text-red-200"
        >
          Gagal mengambil konfigurasi dari backend FastAPI.
        </div>
      )}

      {/* ================================================================= */}
      {/* CARD 1: Universal AI Provider Configuration                       */}
      {/* ================================================================= */}
      <section className="rounded-2xl bg-[#151518] border border-[#26262A] p-6 sm:p-7 space-y-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#26262A] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FF6B00]/15 text-[#FF6B00] border border-[#FF6B00]/30">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                Universal AI Provider Configuration
              </h2>
              <p className="text-xs text-[#9E9EA6]">
                Gunakan preset atau isi custom OpenAI-compatible Base URL apapun.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAiProvider("openai_compatible")}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                aiProvider === "openai_compatible"
                  ? "bg-[#FF6B00] text-white"
                  : "bg-[#0B0B0C] border border-[#26262A] text-[#9E9EA6] hover:text-white"
              )}
            >
              OpenAI SDK (Universal)
            </button>
            <button
              type="button"
              onClick={() => setAiProvider("google_genai")}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                aiProvider === "google_genai"
                  ? "bg-[#FF6B00] text-white"
                  : "bg-[#0B0B0C] border border-[#26262A] text-[#9E9EA6] hover:text-white"
              )}
            >
              Native google-genai
            </button>
          </div>
        </div>

        {/* Quick Preset Pills */}
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-[#63636B]">
            Quick Provider Presets
          </p>
          <div className="flex flex-wrap gap-2">
            {AI_PRESETS.map((preset) => {
              const isSelected =
                aiProvider === preset.ai_provider &&
                aiBaseUrl.trim() === preset.ai_base_url;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-xs font-medium border transition-all",
                    isSelected
                      ? "bg-[#FF6B00]/15 border-[#FF6B00] text-[#FF6B00]"
                      : "bg-[#0B0B0C] border-[#26262A] text-[#9E9EA6] hover:text-white hover:border-[#FF6B00]/40"
                  )}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Inputs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label
              htmlFor="ai-base-url"
              className="text-xs font-medium text-[#9E9EA6]"
            >
              AI Base URL
            </label>
            <Input
              id="ai-base-url"
              className="font-mono text-xs"
              disabled={aiProvider === "google_genai"}
              placeholder="https://generativelanguage.googleapis.com/v1beta/openai/"
              value={aiBaseUrl}
              onChange={(e) => setAiBaseUrl(e.target.value)}
            />
            {aiProvider === "google_genai" && (
              <p className="text-[11px] text-[#63636B]">
                Mode native google-genai menggunakan endpoint resmi Google Gemini secara otomatis.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="ai-model"
              className="text-xs font-medium text-[#9E9EA6]"
            >
              Model Name
            </label>
            <Input
              id="ai-model"
              className="font-mono text-xs"
              placeholder="gemini-2.5-flash"
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
            />
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="ai-api-key"
                className="text-xs font-medium text-[#9E9EA6]"
              >
                API Key
              </label>
              {settings?.has_ai_api_key ? (
                <Badge variant="success">
                  <KeyRound className="h-3 w-3" />
                  Saved: {settings.ai_api_key_masked}
                </Badge>
              ) : (
                <Badge variant="outline">Not configured yet</Badge>
              )}
            </div>
            <div className="relative">
              <Input
                id="ai-api-key"
                type={showApiKey ? "text" : "password"}
                className="font-mono text-xs pr-11"
                placeholder={
                  settings?.has_ai_api_key
                    ? "Biarkan kosong untuk mempertahankan API Key yang tersimpan..."
                    : "Masukkan API Key provider pilihanmu..."
                }
                value={aiApiKey}
                onChange={(e) => setAiApiKey(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowApiKey((v) => !v)}
                aria-label={showApiKey ? "Hide API key" : "Show API key"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#63636B] hover:text-white"
              >
                {showApiKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <label
              htmlFor="system-prompt"
              className="text-xs font-medium text-[#9E9EA6]"
            >
              System Prompt Persona (Bahasa Indonesia Kasual)
            </label>
            <Textarea
              id="system-prompt"
              rows={4}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Deskripsikan gaya bahasa persona Threads kamu..."
            />
          </div>
        </div>

        {/* Live AI Test Sandbox */}
        <div className="rounded-2xl bg-[#0B0B0C] border border-[#26262A] p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#FF6B00]" />
              <h3 className="text-sm font-semibold text-white">
                Live AI Connection &amp; Copywriting Sandbox
              </h3>
            </div>
            <PillButton
              size="sm"
              loading={testingAi}
              icon={<Zap className="h-3.5 w-3.5" />}
              onClick={handleTestAi}
            >
              Test AI Connection
            </PillButton>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="sample-post"
              className="text-[11px] uppercase tracking-wider text-[#63636B]"
            >
              Sample Threads Post
            </label>
            <Input
              id="sample-post"
              value={samplePost}
              onChange={(e) => setSamplePost(e.target.value)}
            />
          </div>

          {testError && (
            <div
              role="alert"
              className="rounded-xl bg-red-500/10 border border-red-500/30 p-3.5 text-xs text-red-300 flex items-start gap-2"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="break-words">{testError}</span>
            </div>
          )}

          {testResult && (
            <div className="rounded-xl bg-[#151518] border border-[#FF6B00]/40 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={testResult.is_buying_intent ? "orange" : "default"}>
                    Intent: {testResult.intent_score}%
                  </Badge>
                  <Badge variant="success">{testResult.latency_ms} ms</Badge>
                  {testResult.matched_product_name && (
                    <Badge variant="outline">
                      Matched: {testResult.matched_product_name}
                    </Badge>
                  )}
                </div>
                <span className="font-mono text-[11px] text-[#63636B]">
                  {testResult.model_used}
                </span>
              </div>
              <p className="text-xs text-[#9E9EA6]">
                <span className="font-semibold text-white">Reasoning:</span>{" "}
                {testResult.reasoning}
              </p>
              <div className="rounded-lg bg-[#0B0B0C] border border-[#26262A] p-3">
                <p className="text-[11px] uppercase tracking-wider text-[#63636B] mb-1">
                  Generated Threads Reply Preview
                </p>
                <p className="text-sm text-white leading-relaxed">
                  {testResult.draft_reply}
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ================================================================= */}
      {/* CARD 2: Scraper & Anti-Ban Rules                                  */}
      {/* ================================================================= */}
      <section className="rounded-2xl bg-[#151518] border border-[#26262A] p-6 sm:p-7 space-y-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="flex items-center gap-3 border-b border-[#26262A] pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FF6B00]/15 text-[#FF6B00] border border-[#FF6B00]/30">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">
              Scraper &amp; Anti-Ban Rules
            </h2>
            <p className="text-xs text-[#9E9EA6]">
              Atur rotasi keyword pencarian, batas komentar harian, dan mode eksekusi bot.
            </p>
          </div>
        </div>

        {/* Interactive Keyword Chips Editor */}
        <div className="space-y-3">
          <label
            htmlFor="new-keyword"
            className="text-xs font-medium text-[#9E9EA6]"
          >
            Active Search Keywords ({keywords.length})
          </label>
          <div className="flex flex-wrap gap-2">
            {keywords.map((kw) => (
              <span
                key={kw}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#0B0B0C] border border-[#26262A] pl-3.5 pr-2 py-1.5 text-xs text-white"
              >
                <span>{kw}</span>
                <button
                  type="button"
                  onClick={() => removeKeywordChip(kw)}
                  aria-label={`Remove keyword ${kw}`}
                  className="flex h-4 w-4 items-center justify-center rounded-full text-[#63636B] hover:bg-[#FF6B00] hover:text-white transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {keywords.length === 0 && (
              <span className="text-xs text-[#63636B]">
                Belum ada keyword. Tambahkan minimal 1 keyword di bawah.
              </span>
            )}
          </div>
          <div className="flex gap-2 max-w-md">
            <Input
              id="new-keyword"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addKeywordChip();
                }
              }}
              placeholder="cth: rekomendasi skincare kulit berminyak"
            />
            <Button variant="secondary" onClick={addKeywordChip}>
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
        </div>

        {/* Bot Mode Selector */}
        <div className="space-y-2.5">
          <p className="text-xs font-medium text-[#9E9EA6]">Execution Mode</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setBotMode("SEMI_AUTO")}
              className={cn(
                "text-left rounded-2xl p-4 border transition-all",
                botMode === "SEMI_AUTO"
                  ? "bg-[#FF6B00]/12 border-[#FF6B00]"
                  : "bg-[#0B0B0C] border-[#26262A] hover:border-[#FF6B00]/40"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-white">
                  SEMI_AUTO (Recommended)
                </span>
                {botMode === "SEMI_AUTO" && <Badge variant="orange">Selected</Badge>}
              </div>
              <p className="mt-1.5 text-xs text-[#9E9EA6] leading-relaxed">
                Bot scrape &amp; buat draft AI otomatis, lalu masuk ke Leads Queue
                untuk kamu review dan kirim dengan 1 klik.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setBotMode("FULL_AUTO")}
              className={cn(
                "text-left rounded-2xl p-4 border transition-all",
                botMode === "FULL_AUTO"
                  ? "bg-[#FF6B00]/12 border-[#FF6B00]"
                  : "bg-[#0B0B0C] border-[#26262A] hover:border-[#FF6B00]/40"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-white">
                  FULL_AUTO (Hands-Free)
                </span>
                {botMode === "FULL_AUTO" && <Badge variant="orange">Selected</Badge>}
              </div>
              <p className="mt-1.5 text-xs text-[#9E9EA6] leading-relaxed">
                Langsung membalas lead yang lolos threshold dengan jeda anti-ban
                acak 45–120 detik hingga batas kuota harian.
              </p>
            </button>
          </div>
        </div>

        {/* Sliders & Interval Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          {/* Max Comments / Day Slider (1-25) */}
          <div className="rounded-xl bg-[#0B0B0C] border border-[#26262A] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label
                htmlFor="max-comments"
                className="text-xs font-medium text-[#9E9EA6]"
              >
                Max Comments / Day
              </label>
              <span className="font-mono text-lg font-bold text-[#FF6B00]">
                {maxComments}
              </span>
            </div>
            <input
              id="max-comments"
              type="range"
              min={1}
              max={25}
              value={maxComments}
              onChange={(e) => setMaxComments(Number(e.target.value))}
              className="orange-slider w-full"
            />
            <div className="flex items-center justify-between text-[11px]">
              <span className={safetyMeta.cls}>{safetyMeta.label}</span>
              <span className="font-mono text-[#63636B]">1 – 25</span>
            </div>
          </div>

          {/* Min Intent Score Slider */}
          <div className="rounded-xl bg-[#0B0B0C] border border-[#26262A] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label
                htmlFor="min-intent"
                className="text-xs font-medium text-[#9E9EA6]"
              >
                Min Intent Score
              </label>
              <span className="font-mono text-lg font-bold text-[#FF6B00]">
                {minIntentScore}%
              </span>
            </div>
            <input
              id="min-intent"
              type="range"
              min={50}
              max={95}
              step={5}
              value={minIntentScore}
              onChange={(e) => setMinIntentScore(Number(e.target.value))}
              className="orange-slider w-full"
            />
            <div className="flex items-center justify-between text-[11px] text-[#63636B]">
              <span>Quality gate</span>
              <span className="font-mono">50% – 95%</span>
            </div>
          </div>

          {/* Scan Interval Minutes */}
          <div className="rounded-xl bg-[#0B0B0C] border border-[#26262A] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label
                htmlFor="scan-interval"
                className="text-xs font-medium text-[#9E9EA6]"
              >
                Scan Interval (Minutes)
              </label>
              <span className="font-mono text-xs text-[#63636B]">APScheduler</span>
            </div>
            <Input
              id="scan-interval"
              type="number"
              min={5}
              max={1440}
              className="font-mono"
              value={scanInterval}
              onChange={(e) => setScanInterval(Number(e.target.value))}
            />
            <p className="text-[11px] text-[#63636B]">
              Disarankan 20–35 menit agar pola browsing natural.
            </p>
          </div>
        </div>

        {/* Optional Telegram Alerts */}
        <div className="border-t border-[#26262A] pt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="tg-token"
                className="text-xs font-medium text-[#9E9EA6]"
              >
                Telegram Bot Token (Optional)
              </label>
              {settings?.has_telegram_bot_token && (
                <span className="font-mono text-[11px] text-emerald-400">
                  Saved ({settings.telegram_bot_token_masked})
                </span>
              )}
            </div>
            <Input
              id="tg-token"
              type="password"
              className="font-mono text-xs"
              placeholder="123456:ABC-DEF... (leave blank to keep)"
              value={telegramToken}
              onChange={(e) => setTelegramToken(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="tg-chat-id"
              className="text-xs font-medium text-[#9E9EA6]"
            >
              Telegram Chat ID (Optional)
            </label>
            <Input
              id="tg-chat-id"
              className="font-mono text-xs"
              placeholder="-1001234567890 atau user chat id"
              value={telegramChatId}
              onChange={(e) => setTelegramChatId(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* CARD 3: Threads Session (auth_threads.json) Uploader              */}
      {/* ================================================================= */}
      <section
        id="auth-session"
        className="rounded-2xl bg-[#151518] border border-[#26262A] p-6 sm:p-7 space-y-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#26262A] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FF6B00]/15 text-[#FF6B00] border border-[#FF6B00]/30">
              <FileJson className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                Threads Session (auth_threads.json)
              </h2>
              <p className="text-xs text-[#9E9EA6]">
                Upload session Playwright hasil login lokal langsung ke volume container backend.
              </p>
            </div>
          </div>

          <Badge variant={authStatus?.connected ? "success" : "orange"}>
            {authStatus?.connected
              ? `Connected · ${authStatus.threads_cookie_count} cookies`
              : "Session Required"}
          </Badge>
        </div>

        {/* Instant Paste from Existing Chrome (No New Browser Needed) */}
        <div className="rounded-2xl bg-[#0B0B0C] border border-[#FF6B00]/35 p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">
                Pakai Sesi dari Chrome Kamu Sekarang (Tanpa Buka Browser Baru)
              </p>
              <p className="text-xs text-[#9E9EA6] mt-0.5">
                1. Buka <code className="font-mono text-white">threads.com</code> di Chrome lama kamu &rarr;{" "}
                2. Klik ekstensi <code className="font-mono text-[#FF6B00]">Cookie-Editor</code> &rarr;{" "}
                <strong className="text-white">Export &rarr; JSON</strong> &rarr;{" "}
                3. Klik tombol di kanan (atau Ctrl+V di bawah).
              </p>
            </div>
            <PillButton
              size="sm"
              loading={uploadingAuth}
              onClick={() => handleConnectPastedCookies()}
            >
              Paste &amp; Connect Chrome
            </PillButton>
          </div>

          <Textarea
            rows={3}
            value={pastedCookies}
            onChange={(e) => setPastedCookies(e.target.value)}
            className="font-mono text-xs"
            placeholder='Atau tekan Ctrl+V di sini untuk menempel JSON dari Cookie-Editor ([{ "domain": ".threads.com", ... }]) lalu klik Paste & Connect Chrome...'
          />
        </div>

        {/* Dropzone (Alternative File Upload) */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            const dropped = e.dataTransfer.files?.[0];
            handleAuthUpload(dropped);
          }}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          aria-label="Upload auth_threads.json file"
          className={cn(
            "cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all",
            dragActive
              ? "border-[#FF6B00] bg-[#FF6B00]/10"
              : "border-[#26262A] bg-[#0B0B0C]/70 hover:border-[#FF6B00]/60"
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => handleAuthUpload(e.target.files?.[0])}
          />
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#151518] border border-[#26262A] text-[#FF6B00] mb-3">
            <UploadCloud className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold text-white">
            {uploadingAuth
              ? "Validating & uploading auth_threads.json..."
              : "Drag & drop auth_threads.json di sini, atau klik untuk memilih file"}
          </p>
          <p className="mt-1 text-xs text-[#63636B]">
            Mendukung <code className="font-mono text-[#9E9EA6]">auth_threads.json</code>{" "}
            dari <code className="font-mono text-[#9E9EA6]">login_helper.py</code>{" "}
            ataupun file Export JSON dari ekstensi Chrome{" "}
            <code className="font-mono text-[#9E9EA6]">Cookie-Editor</code> di{" "}
            <code className="font-mono text-[#9E9EA6]">threads.com</code>.
          </p>
        </div>

        {/* Auth Diagnostic Bar */}
        {authStatus && (
          <div className="rounded-xl bg-[#0B0B0C] border border-[#26262A] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <span className="text-[#9E9EA6]">{authStatus.message}</span>
            <span className="font-mono text-[#63636B] shrink-0">
              {authStatus.updated_at
                ? `Updated ${formatRelativeTime(authStatus.updated_at)}`
                : "Not uploaded"}
            </span>
          </div>
        )}

        {uploadNotice && (
          <div
            role="status"
            className={cn(
              "rounded-xl border px-4 py-3 text-xs flex items-center gap-2",
              uploadNotice.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : "bg-red-500/10 border-red-500/30 text-red-300"
            )}
          >
            {uploadNotice.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{uploadNotice.text}</span>
          </div>
        )}

        {/* Local Windows Login Helper Instructions */}
        <div className="rounded-xl bg-[#0B0B0C] border border-[#26262A] p-4 space-y-2">
          <p className="text-xs font-semibold text-white">
            Cara generate auth_threads.json dari PC Windows lokal:
          </p>
          <pre className="overflow-x-auto rounded-lg bg-[#151518] border border-[#26262A] p-3 font-mono text-xs text-[#FF6B00]">
            {`cd backend\npip install playwright && playwright install chromium\npython login_helper.py`}
          </pre>
          <p className="text-[11px] text-[#63636B]">
            Login ke akun Threads pada jendela Chromium yang terbuka, lalu tekan
            ENTER di terminal. Upload file{" "}
            <code className="font-mono text-[#9E9EA6]">backend/data/auth_threads.json</code>{" "}
            ke dropzone di atas.
          </p>
        </div>
      </section>
    </div>
  );
}
