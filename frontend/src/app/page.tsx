"use client";

import * as React from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Cpu,
  Play,
  Radar,
  ShieldCheck,
  Sparkles,
  Square,
  Terminal,
} from "lucide-react";
import {
  api,
  BotStatus,
  DashboardStats,
  LeadListResponse,
  swrFetcher,
} from "@/lib/api";
import {
  cn,
  formatCountdown,
  formatProviderHost,
  formatRelativeTime,
} from "@/lib/utils";
import { PillButton } from "@/components/PillButton";
import { StatCounter } from "@/components/StatCounter";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

export default function OverviewPage() {
  const {
    data: botStatus,
    error: statusError,
    mutate: mutateStatus,
  } = useSWR<BotStatus>("/api/bot/status", swrFetcher, {
    refreshInterval: 5000,
  });

  const {
    data: stats,
    mutate: mutateStats,
  } = useSWR<DashboardStats>("/api/bot/stats", swrFetcher, {
    refreshInterval: 8000,
  });

  const { data: topLeads } = useSWR<LeadListResponse>(
    "/api/leads?status=PENDING_REVIEW&page=1&page_size=3",
    swrFetcher,
    { refreshInterval: 10000 }
  );

  const [scanningReq, setScanningReq] = React.useState(false);
  const [schedulerReq, setSchedulerReq] = React.useState(false);
  const [modeUpdating, setModeUpdating] = React.useState(false);
  const [banner, setBanner] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [countdownText, setCountdownText] = React.useState<string>("Standby");

  React.useEffect(() => {
    const updateTick = () => {
      if (botStatus?.is_scheduler_running && botStatus.next_run_at) {
        setCountdownText(formatCountdown(botStatus.next_run_at));
      } else {
        setCountdownText("Standby");
      }
    };
    updateTick();
    const timer = setInterval(updateTick, 1000);
    return () => clearInterval(timer);
  }, [botStatus?.is_scheduler_running, botStatus?.next_run_at]);

  const handleManualScan = async () => {
    setBanner(null);
    setScanningReq(true);
    try {
      const res = await api.triggerManualScan();
      setBanner({ type: "success", text: res.message });
      await Promise.all([mutateStatus(), mutateStats()]);
    } catch (err) {
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to trigger scan.",
      });
    } finally {
      setScanningReq(false);
    }
  };

  const handleToggleScheduler = async () => {
    setBanner(null);
    setSchedulerReq(true);
    try {
      const running = Boolean(botStatus?.is_scheduler_running);
      if (running) {
        await api.stopScheduler();
        setBanner({ type: "success", text: "Auto-Scheduler dihentikan." });
      } else {
        await api.startScheduler();
        setBanner({
          type: "success",
          text: `Auto-Scheduler aktif setiap ${botStatus?.scan_interval_minutes ?? 25} menit.`,
        });
      }
      await mutateStatus();
    } catch (err) {
      setBanner({
        type: "error",
        text:
          err instanceof Error ? err.message : "Gagal mengubah status scheduler.",
      });
    } finally {
      setSchedulerReq(false);
    }
  };

  const handleToggleBotMode = async (isFullAuto: boolean) => {
    setModeUpdating(true);
    setBanner(null);
    try {
      const nextMode = isFullAuto ? "FULL_AUTO" : "SEMI_AUTO";
      await api.updateSettings({ bot_mode: nextMode });
      await mutateStatus();
      setBanner({
        type: "success",
        text: `Bot mode beralih ke ${nextMode.replace("_", " ")}.`,
      });
    } catch (err) {
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Gagal mengganti bot mode.",
      });
    } finally {
      setModeUpdating(false);
    }
  };

  const postsScraped = stats?.posts_scraped ?? 0;
  const leadsFound = stats?.leads_found ?? 0;
  const commentsSent = stats?.comments_sent ?? 0;
  const maxComments = stats?.max_comments_per_day ?? botStatus?.max_comments_per_day ?? 12;
  const quotaPct = Math.min(100, Math.round((commentsSent / Math.max(1, maxComments)) * 100));
  const isFullAuto = botStatus?.bot_mode === "FULL_AUTO";

  return (
    <div className="space-y-12">
      {/* Backend Connection Warning */}
      {statusError && (
        <div
          role="alert"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-red-500/10 border border-red-500/30 p-4 text-sm text-red-200"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-white">
                Tidak dapat terhubung ke FastAPI Backend
              </p>
              <p className="text-xs text-red-200/80 mt-0.5">
                Pastikan container backend berjalan di{" "}
                <code className="font-mono text-white">
                  {process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}
                </code>
                .
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              mutateStatus();
              mutateStats();
            }}
            className="self-start sm:self-center rounded-full border border-red-400/40 px-4 py-1.5 text-xs font-medium text-white hover:bg-red-500/20"
          >
            Retry
          </button>
        </div>
      )}

      {/* Hero Section: 2-Column Asymmetric Editorial Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
        {/* Left Column */}
        <div className="lg:col-span-7 space-y-7">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#151518] border border-[#26262A] px-3.5 py-1.5 text-xs font-medium text-[#9E9EA6]">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                botStatus?.is_scanning
                  ? "bg-[#FF6B00] animate-ping"
                  : botStatus?.is_scheduler_running
                  ? "bg-emerald-400"
                  : "bg-[#63636B]"
              )}
            />
            <span>
              {botStatus?.is_scanning
                ? `Scanning keyword "${botStatus.current_keyword || "..."}"`
                : botStatus?.is_scheduler_running
                ? `Auto-Scheduler Active · Next run ${countdownText}`
                : "Command Center Ready · Manual / Scheduled Mode"}
            </span>
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl lg:text-[54px] font-bold tracking-tight text-white leading-[1.06]">
              Autonomous Threads{" "}
              <span className="text-[#FF6B00]">Affiliate</span> Engine.
            </h1>
            <p className="max-w-xl text-base text-[#9E9EA6] leading-relaxed">
              Pantau postingan Threads ber-intent tinggi secara real-time, skor
              relevansi dengan katalog Shopee Affiliate lewat router AI pilihanmu,
              dan kirim balasan kasual natural dengan proteksi anti-ban.
            </p>
          </div>

          {/* Signature Dual PillButton Triggers */}
          <div className="flex flex-wrap items-center gap-4 pt-1">
            <PillButton
              variant="primary"
              loading={scanningReq || Boolean(botStatus?.is_scanning)}
              icon={<Radar className="h-4 w-4" />}
              onClick={handleManualScan}
            >
              {botStatus?.is_scanning ? "Scanning Threads..." : "Scan Threads Now"}
            </PillButton>

            <PillButton
              variant="secondary"
              loading={schedulerReq}
              icon={
                botStatus?.is_scheduler_running ? (
                  <Square className="h-3.5 w-3.5 fill-current" />
                ) : (
                  <Play className="h-3.5 w-3.5 fill-current" />
                )
              }
              onClick={handleToggleScheduler}
            >
              {botStatus?.is_scheduler_running
                ? "Stop Auto-Scheduler"
                : "Start Auto-Scheduler"}
            </PillButton>
          </div>

          {/* Action Feedback Banner */}
          {banner && (
            <div
              role="status"
              className={cn(
                "flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm",
                banner.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : "bg-[#FF6B00]/10 border-[#FF6B00]/40 text-orange-200"
              )}
            >
              <div className="flex items-center gap-2.5">
                {banner.type === "success" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 text-[#FF6B00]" />
                )}
                <span>{banner.text}</span>
              </div>
              {banner.type === "error" && (
                <Link
                  href="/settings"
                  className="shrink-0 text-xs font-semibold text-[#FF6B00] hover:underline"
                >
                  Open Settings →
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Editorial Stacked Orange KPI Counters */}
        <div className="lg:col-span-5 rounded-2xl bg-[#151518]/70 border border-[#26262A] p-6 sm:p-7 space-y-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <StatCounter
            value={postsScraped > 0 ? `${postsScraped}+` : "0"}
            label="Posts Scraped Today"
            sublabel={stats?.date_str || "TODAY"}
          />
          <StatCounter
            value={leadsFound > 0 ? `${leadsFound}+` : "0"}
            label="High-Intent Leads Matched"
            sublabel={`${stats?.pending_review_count ?? 0} pending`}
          />
          <StatCounter
            value={`${commentsSent} / ${maxComments}`}
            label="Affiliate Replies Sent"
            sublabel={`${quotaPct}% daily cap`}
            hideBorder
          />
        </div>
      </section>

      {/* Middle Section: 01, 02, 03 Live Pipeline Bento Cards */}
      <section aria-labelledby="pipeline-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2
            id="pipeline-heading"
            className="text-xs font-semibold uppercase tracking-[0.18em] text-[#63636B]"
          >
            Live Automation Pipeline
          </h2>
          <Link
            href="/settings"
            className="inline-flex items-center gap-1 text-xs font-medium text-[#9E9EA6] hover:text-[#FF6B00] transition-colors"
          >
            Configure Pipeline
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 01 Keyword Radar */}
          <div className="bg-[#151518] border border-[#26262A] hover:border-[#FF6B00]/50 rounded-2xl p-6 flex flex-col justify-between min-h-[225px] transition-colors shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="flex items-start justify-between gap-3">
              <span className="text-2xl font-bold text-[#FF6B00] font-mono">
                01
              </span>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#0B0B0C] border border-[#26262A] px-2.5 py-1 text-xs font-mono text-[#9E9EA6]">
                <Clock className="h-3.5 w-3.5 text-[#FF6B00]" />
                <span>{countdownText}</span>
              </div>
            </div>

            <div className="my-4 flex flex-wrap gap-1.5">
              {(botStatus?.active_keywords?.length
                ? botStatus.active_keywords
                : ["rekomendasi tws", "spill parfum awet"]
              )
                .slice(0, 5)
                .map((kw) => (
                  <span
                    key={kw}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs border",
                      botStatus?.current_keyword === kw
                        ? "bg-[#FF6B00]/20 border-[#FF6B00] text-white"
                        : "bg-[#0B0B0C] border-[#26262A] text-[#9E9EA6]"
                    )}
                  >
                    {kw}
                  </span>
                ))}
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-1.5">
                Keyword Radar
              </h3>
              <p className="text-sm text-[#9E9EA6]">
                Memindai{" "}
                <span className="text-white font-medium">
                  {botStatus?.active_keywords?.length ?? 0} keyword
                </span>{" "}
                aktif tiap {botStatus?.scan_interval_minutes ?? 25} menit di
                feed Threads terbaru.
              </p>
            </div>
          </div>

          {/* 02 AI Intent Filter */}
          <div className="bg-[#151518] border border-[#26262A] hover:border-[#FF6B00]/50 rounded-2xl p-6 flex flex-col justify-between min-h-[225px] transition-colors shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="flex items-start justify-between gap-3">
              <span className="text-2xl font-bold text-[#FF6B00] font-mono">
                02
              </span>
              <Badge variant={botStatus?.has_ai_api_key ? "orange" : "outline"}>
                <Cpu className="h-3 w-3" />
                {stats?.avg_intent_score
                  ? `${stats.avg_intent_score}% avg`
                  : `≥ ${botStatus?.min_intent_score ?? 75}% gate`}
              </Badge>
            </div>

            <div className="my-4 rounded-xl bg-[#0B0B0C] border border-[#26262A] p-3 space-y-1">
              <p className="font-mono text-xs text-white truncate">
                {botStatus?.ai_model || "gemini-2.5-flash"}
              </p>
              <p className="font-mono text-[11px] text-[#63636B] truncate">
                {formatProviderHost(
                  botStatus?.ai_base_url || "",
                  botStatus?.ai_provider || "openai_compatible"
                )}
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-1.5">
                AI Intent Filter
              </h3>
              <p className="text-sm text-[#9E9EA6]">
                Menyaring niat beli terhadap{" "}
                <span className="text-white font-medium">
                  {stats?.active_products ?? 0} produk aktif
                </span>{" "}
                dan meracik balasan kasual Indonesia.
              </p>
            </div>
          </div>

          {/* 03 Stealth Responder */}
          <div className="bg-[#151518] border border-[#26262A] hover:border-[#FF6B00]/50 rounded-2xl p-6 flex flex-col justify-between min-h-[225px] transition-colors shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="flex items-start justify-between gap-3">
              <span className="text-2xl font-bold text-[#FF6B00] font-mono">
                03
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] uppercase text-[#9E9EA6]">
                  {isFullAuto ? "FULL AUTO" : "SEMI AUTO"}
                </span>
                <Switch
                  checked={isFullAuto}
                  disabled={modeUpdating}
                  aria-label="Toggle FULL_AUTO mode"
                  onCheckedChange={handleToggleBotMode}
                />
              </div>
            </div>

            <div className="my-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Anti-Ban Guard Active
                </span>
                <span className="font-mono text-[#9E9EA6]">
                  {commentsSent}/{maxComments}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-[#0B0B0C] overflow-hidden border border-[#26262A]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#FF6B00] to-[#FF7A1A] transition-all duration-500"
                  style={{ width: `${quotaPct}%` }}
                />
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-1.5">
                Stealth Responder
              </h3>
              <p className="text-sm text-[#9E9EA6]">
                Mengetik karakter demi karakter (45–110ms) dengan delay acak &amp;
                batas kuota harian.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom Section: Live Activity Feed + Top Queued Leads */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Live Activity Feed */}
        <div className="lg:col-span-7 rounded-2xl bg-[#151518] border border-[#26262A] p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#26262A] pb-3">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-[#FF6B00]" />
              <h2 className="text-base font-semibold text-white">
                Live Automation Feed
              </h2>
            </div>
            <span className="font-mono text-xs text-[#63636B]">
              {botStatus?.last_scan_at
                ? `Last scan ${formatRelativeTime(botStatus.last_scan_at)}`
                : "No scans yet"}
            </span>
          </div>

          <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
            {botStatus?.recent_logs && botStatus.recent_logs.length > 0 ? (
              botStatus.recent_logs.map((log, idx) => (
                <div
                  key={`${log.timestamp}-${idx}`}
                  className="flex items-start gap-3 rounded-xl bg-[#0B0B0C]/70 border border-[#26262A]/70 px-3.5 py-2.5 text-xs"
                >
                  <span
                    className={cn(
                      "mt-1 h-2 w-2 rounded-full shrink-0",
                      log.level === "success" && "bg-emerald-400",
                      log.level === "error" && "bg-red-400",
                      log.level === "warning" && "bg-[#FF6B00]",
                      log.level === "info" && "bg-[#63636B]"
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[#E4E4E7] leading-relaxed break-words">
                      {log.message}
                    </p>
                  </div>
                  <span className="font-mono text-[11px] text-[#63636B] shrink-0">
                    {formatRelativeTime(log.timestamp)}
                  </span>
                </div>
              ))
            ) : (
              <div className="py-10 text-center text-sm text-[#63636B]">
                <Activity className="mx-auto h-6 w-6 mb-2 text-[#26262A]" />
                Belum ada log aktivitas. Klik &ldquo;Scan Threads Now&rdquo;
                untuk mulai memantau.
              </div>
            )}
          </div>
        </div>

        {/* High-Intent Queue Preview */}
        <div className="lg:col-span-5 rounded-2xl bg-[#151518] border border-[#26262A] p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#26262A] pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#FF6B00]" />
                <h2 className="text-base font-semibold text-white">
                  Hot Leads Waiting Review
                </h2>
              </div>
              <Badge variant="orange">
                {stats?.pending_review_count ?? 0} queued
              </Badge>
            </div>

            {topLeads?.items && topLeads.items.length > 0 ? (
              <div className="space-y-3">
                {topLeads.items.map((lead) => (
                  <Link
                    key={lead.id}
                    href="/leads"
                    className={cn(
                      "block rounded-xl p-3.5 transition-all border",
                      lead.intent_score >= 90
                        ? "bg-gradient-to-r from-[#FF6B00]/20 to-[#E04F00]/10 border-[#FF6B00]/50 hover:border-[#FF6B00]"
                        : "bg-[#0B0B0C]/70 border-[#26262A] hover:border-[#FF6B00]/50"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-semibold text-white truncate">
                        @{lead.author_username}
                      </span>
                      <span className="font-mono text-xs font-bold text-[#FF6B00]">
                        {lead.intent_score}% Match
                      </span>
                    </div>
                    <p className="text-xs text-[#9E9EA6] line-clamp-2 leading-relaxed">
                      {lead.post_text}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center space-y-2">
                <p className="text-sm font-medium text-white">
                  Antrian review masih kosong
                </p>
                <p className="text-xs text-[#9E9EA6]">
                  Upload <code className="font-mono text-white">auth_threads.json</code>{" "}
                  dan API key AI di Settings, lalu jalankan scan pertama.
                </p>
              </div>
            )}
          </div>

          <div className="pt-2 flex justify-end">
            <Link href="/leads">
              <PillButton size="sm" variant="primary">
                Open Leads Studio
              </PillButton>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
