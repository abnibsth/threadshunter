"use client";

import * as React from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  Play,
  Radar,
  Square,
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

export default function OverviewPage() {
  const {
    data: botStatus,
    error: statusError,
    mutate: mutateStatus,
  } = useSWR<BotStatus>("/api/bot/status", swrFetcher, {
    refreshInterval: 4000,
  });

  const { data: stats, mutate: mutateStats } = useSWR<DashboardStats>(
    "/api/bot/stats",
    swrFetcher,
    { refreshInterval: 8000 }
  );

  const { data: topLeads } = useSWR<LeadListResponse>(
    "/api/leads?status=PENDING_REVIEW&page=1&page_size=4",
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
  const [countdownText, setCountdownText] = React.useState<string>("--:--");

  React.useEffect(() => {
    const updateTick = () => {
      if (botStatus?.is_scheduler_running && botStatus.next_run_at) {
        setCountdownText(formatCountdown(botStatus.next_run_at));
      } else {
        setCountdownText("MANUAL");
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
        setBanner({ type: "success", text: "Periodic scheduler stopped." });
      } else {
        await api.startScheduler();
        setBanner({
          type: "success",
          text: `Scheduler armed — scanning every ${botStatus?.scan_interval_minutes ?? 25}m.`,
        });
      }
      await mutateStatus();
    } catch (err) {
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to update scheduler.",
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
        text: `Responder switched to ${nextMode.replace("_", "-")}.`,
      });
    } catch (err) {
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to switch mode.",
      });
    } finally {
      setModeUpdating(false);
    }
  };

  const postsScraped = stats?.posts_scraped ?? 0;
  const leadsFound = stats?.leads_found ?? 0;
  const commentsSent = stats?.comments_sent ?? 0;
  const maxComments =
    stats?.max_comments_per_day ?? botStatus?.max_comments_per_day ?? 12;
  const activeProducts = stats?.active_products ?? 0;
  const pendingCount = stats?.pending_review_count ?? 0;
  const isFullAuto = botStatus?.bot_mode === "FULL_AUTO";
  const isAuthOk = Boolean(botStatus?.auth_status?.connected);
  const isAiOk = Boolean(botStatus?.has_ai_api_key);

  // Segmented 12-slot visual meter for anti-ban quota
  const segmentTotal = Math.min(20, Math.max(6, maxComments));
  const filledSegments = Math.round(
    (Math.min(commentsSent, maxComments) / Math.max(1, maxComments)) *
      segmentTotal
  );

  const readinessSteps = [
    {
      done: isAuthOk,
      label: "Threads Session Cookie",
      detail: isAuthOk
        ? `${botStatus?.auth_status.threads_cookie_count ?? 0} cookies verified`
        : "Connect Chrome cookies",
      href: "/settings#auth-session",
    },
    {
      done: activeProducts > 0,
      label: "Shopee Affiliate Catalog",
      detail:
        activeProducts > 0
          ? `${activeProducts} active links locked`
          : "Import Shopee CSV / links",
      href: "/products",
    },
    {
      done: isAiOk,
      label: "LLM Intent Router",
      detail: isAiOk
        ? botStatus?.ai_model || "Configured"
        : "Set API key in Settings",
      href: "/settings",
    },
  ];

  return (
    <div className="space-y-12">
      {/* Backend Offline Alert */}
      {statusError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-4 rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-xs text-red-200"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
            <span>
              Backend API unreachable at{" "}
              <code className="font-mono text-white">
                {process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}
              </code>
              . Verify Docker container <code className="font-mono">threads_affiliate_backend</code> is running.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              mutateStatus();
              mutateStats();
            }}
            className="rounded-md border border-red-400/30 px-3 py-1 font-mono text-[11px] text-white hover:bg-red-500/20"
          >
            RETRY
          </button>
        </div>
      )}

      {/* =================================================================== */}
      {/* SECTION 1: EDITORIAL MASTHEAD + STACKED ARCHITECTURAL KPI METRICS   */}
      {/* =================================================================== */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-end pb-10 border-b border-[#1C1C20]">
        {/* Left Masthead (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Technical Telemetry Eyebrow */}
          <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] uppercase tracking-[0.14em] text-[#71717A]">
            <span className="text-[#FF6B00] font-semibold">CONSOLE // 01</span>
            <span className="text-[#27272A]">/</span>
            {botStatus?.is_scanning ? (
              <span className="inline-flex items-center gap-2 text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-[#FF6B00] animate-ping" />
                SCANNING &ldquo;{botStatus.current_keyword || "threads"}&rdquo;
              </span>
            ) : (
              <span>
                {botStatus?.is_scheduler_running
                  ? `AUTO-CYCLE EVERY ${botStatus.scan_interval_minutes}M`
                  : "STANDBY · ON-DEMAND"}
              </span>
            )}
          </div>

          {/* Crisp Editorial Display Title — No Cheesy Marketing Copy */}
          <div className="space-y-3">
            <h1 className="text-4xl sm:text-5xl lg:text-[56px] font-bold tracking-[-0.035em] text-white leading-[1.02]">
              Threads Intent
              <br />
              <span className="text-[#71717A] font-medium">
                Affiliate Dispatch.
              </span>
            </h1>
            <p className="max-w-lg text-sm text-[#8E8E98] leading-relaxed">
              Menangkap percakapan rekomendasi di Threads, mencocokkan khusus
              dengan{" "}
              <Link
                href="/products"
                className="text-white underline decoration-[#FF6B00]/60 underline-offset-4 hover:text-[#FF6B00]"
              >
                {activeProducts} link Shopee Affiliate milikmu
              </Link>
              , dan menyiapkan balasan kasual siap kirim.
            </p>
          </div>

          {/* Action Controls */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <PillButton
              variant="primary"
              loading={scanningReq || Boolean(botStatus?.is_scanning)}
              icon={<Radar className="h-3.5 w-3.5" />}
              onClick={handleManualScan}
            >
              {botStatus?.is_scanning ? "Scanning Feed..." : "Scan Threads Now"}
            </PillButton>

            <PillButton
              variant="secondary"
              loading={schedulerReq}
              icon={
                botStatus?.is_scheduler_running ? (
                  <Square className="h-3 w-3 fill-current" />
                ) : (
                  <Play className="h-3 w-3 fill-current" />
                )
              }
              onClick={handleToggleScheduler}
            >
              {botStatus?.is_scheduler_running
                ? "Stop Scheduler"
                : `Schedule (${botStatus?.scan_interval_minutes ?? 25}m)`}
            </PillButton>
          </div>

          {banner && (
            <div
              role="status"
              className={cn(
                "inline-flex items-center gap-3 rounded-lg border px-3.5 py-2 text-xs",
                banner.type === "success"
                  ? "border-emerald-500/30 bg-emerald-950/30 text-emerald-300"
                  : "border-[#FF6B00]/40 bg-[#FF6B00]/10 text-orange-200"
              )}
            >
              <span>{banner.text}</span>
              {banner.type === "error" && (
                <Link
                  href="/settings"
                  className="font-mono uppercase tracking-wider text-[#FF6B00] hover:underline"
                >
                  Settings →
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Pure Dominic Editorial Stacked Counters (No Boxy Card!) */}
        <div className="lg:col-span-5 lg:border-l lg:border-[#1C1C20] lg:pl-10">
          <StatCounter
            value={postsScraped > 0 ? `${postsScraped}+` : "0"}
            label="Posts Evaluated Today"
            sublabel={stats?.date_str || "TODAY"}
          />
          <StatCounter
            value={leadsFound > 0 ? `${leadsFound}+` : "0"}
            label="Buying-Intent Matches"
            sublabel={`${pendingCount} IN QUEUE`}
          />
          <StatCounter
            value={`${commentsSent}/${maxComments}`}
            label="Replies Sent Today"
            sublabel={isFullAuto ? "FULL-AUTO" : "SEMI-AUTO"}
            accent={commentsSent > 0}
            hideBorder
          />
        </div>
      </section>

      {/* =================================================================== */}
      {/* SECTION 2: 01–03 EDITORIAL BENTO PIPELINE (WITH ORANGE ANCHOR CARD) */}
      {/* =================================================================== */}
      <section aria-label="Pipeline Modules" className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* 01 // KEYWORD RADAR (Matte Architectural Dark) */}
        <div className="rounded-2xl bg-[#111113] border border-[#1F1F23] p-6 flex flex-col justify-between min-h-[240px] hover:border-[#2E2E34] transition-colors">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-semibold tracking-widest text-[#FF6B00]">
              01 // RADAR
            </span>
            <span className="font-mono text-[11px] text-[#71717A] bg-[#09090B] border border-[#1F1F23] rounded px-2 py-0.5">
              NEXT · {countdownText}
            </span>
          </div>

          <div className="my-5 flex flex-wrap gap-1.5">
            {(botStatus?.active_keywords?.length
              ? botStatus.active_keywords
              : ["rekomendasi tws", "spill parfum awet"]
            )
              .slice(0, 5)
              .map((kw) => {
                const active = botStatus?.current_keyword === kw;
                return (
                  <span
                    key={kw}
                    className={cn(
                      "rounded-md px-2.5 py-1 font-mono text-[11px] border transition-colors",
                      active
                        ? "bg-[#FF6B00] border-[#FF6B00] text-[#09090B] font-semibold"
                        : "bg-[#09090B] border-[#1F1F23] text-[#A1A1AA]"
                    )}
                  >
                    {kw}
                  </span>
                );
              })}
          </div>

          <div className="flex items-end justify-between gap-3 pt-3 border-t border-[#1C1C20]">
            <div>
              <h2 className="text-[15px] font-semibold text-white">
                Keyword Rotation
              </h2>
              <p className="text-xs text-[#71717A] mt-0.5">
                {botStatus?.active_keywords?.length ?? 0} queries · filter=recent
              </p>
            </div>
            <Link
              href="/settings"
              aria-label="Edit search keywords"
              className="text-[#71717A] hover:text-white transition-colors"
            >
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* 02 // AI INTENT ROUTER — DOMINIC SIGNATURE ELECTRIC ORANGE CARD */}
        <div className="rounded-2xl bg-gradient-to-b from-[#FF6B00] to-[#E04F00] text-white p-6 flex flex-col justify-between min-h-[240px] border border-[#FF8533]/40">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold tracking-widest text-[#09090B]">
              02 // AI ENGINE
            </span>
            <span className="rounded bg-[#09090B]/20 px-2 py-0.5 font-mono text-[11px] font-medium text-white">
              GATE ≥ {botStatus?.min_intent_score ?? 75}%
            </span>
          </div>

          <div className="my-5 space-y-2">
            <div className="font-mono text-lg font-bold tracking-tight text-white truncate">
              {botStatus?.ai_model || "gemini-2.5-flash"}
            </div>
            <div className="font-mono text-[11px] text-white/80 truncate">
              {formatProviderHost(
                botStatus?.ai_base_url || "",
                botStatus?.ai_provider || "openai_compatible"
              )}
            </div>
            <div className="pt-1 flex items-center gap-4 text-xs text-white/90">
              <span>
                Catalog: <strong>{activeProducts} links</strong>
              </span>
              <span>·</span>
              <span>
                Avg:{" "}
                <strong>
                  {stats?.avg_intent_score ? `${stats.avg_intent_score}%` : "—"}
                </strong>
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-3 border-t border-black/15">
            <span className="text-xs font-medium text-white/90">
              {isAiOk ? "API Key Configured" : "API Key Missing"}
            </span>
            <PillButton size="sm" variant="inverted" href="/settings">
              Router Config
            </PillButton>
          </div>
        </div>

        {/* 03 // STEALTH RESPONDER (Matte Architectural Dark + Segmented Meter) */}
        <div className="rounded-2xl bg-[#111113] border border-[#1F1F23] p-6 flex flex-col justify-between min-h-[240px] hover:border-[#2E2E34] transition-colors">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-semibold tracking-widest text-[#FF6B00]">
              03 // STEALTH
            </span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-[#A1A1AA]">
                {isFullAuto ? "FULL-AUTO" : "SEMI-AUTO"}
              </span>
              <Switch
                checked={isFullAuto}
                disabled={modeUpdating}
                aria-label="Toggle FULL_AUTO mode"
                onCheckedChange={handleToggleBotMode}
              />
            </div>
          </div>

          {/* Discrete 12-Tick Hardware Quota Bar */}
          <div className="my-5 space-y-2.5">
            <div className="flex items-center justify-between font-mono text-[11px]">
              <span className="text-[#71717A]">DAILY CAP</span>
              <span className="text-white">
                {commentsSent} / {maxComments} SENT
              </span>
            </div>
            <div
              className="grid gap-1"
              style={{
                gridTemplateColumns: `repeat(${segmentTotal}, minmax(0, 1fr))`,
              }}
              aria-hidden="true"
            >
              {Array.from({ length: segmentTotal }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-2.5 rounded-[2px]",
                    i < filledSegments ? "bg-[#FF6B00]" : "bg-[#1E1E24]"
                  )}
                />
              ))}
            </div>
            <p className="font-mono text-[11px] text-[#52525B]">
              TYPING 45–110MS · COOLDOWN 45–120S
            </p>
          </div>

          <div className="flex items-end justify-between gap-3 pt-3 border-t border-[#1C1C20]">
            <div>
              <h2 className="text-[15px] font-semibold text-white">
                Human Emulation
              </h2>
              <p className="text-xs text-[#71717A] mt-0.5">
                Locked to owned Shopee links only
              </p>
            </div>
            <Link
              href="/leads"
              aria-label="Open Leads Studio"
              className="text-[#71717A] hover:text-white transition-colors"
            >
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* SECTION 3: UNIFIED ARCHITECTURAL CONSOLE (TELEMETRY + QUEUE/SETUP)  */}
      {/* =================================================================== */}
      <section className="rounded-2xl border border-[#1F1F23] bg-[#0D0D10] overflow-hidden grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#1F1F23]">
        {/* Left Console Pane: Monospace Engine Telemetry (7 cols) */}
        <div className="lg:col-span-7 flex flex-col">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1F1F23] bg-[#111114]">
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  botStatus?.is_scanning
                    ? "bg-[#FF6B00] animate-pulse"
                    : "bg-emerald-400"
                )}
              />
              <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-white">
                Engine Telemetry Stream
              </h2>
            </div>
            <span className="font-mono text-[11px] text-[#52525B]">
              {botStatus?.last_scan_at
                ? `LAST RUN · ${formatRelativeTime(botStatus.last_scan_at).toUpperCase()}`
                : "AWAITING FIRST SCAN"}
            </span>
          </div>

          <div className="p-4 font-mono text-xs space-y-1.5 max-h-[320px] overflow-y-auto">
            {botStatus?.recent_logs && botStatus.recent_logs.length > 0 ? (
              botStatus.recent_logs.map((log, idx) => {
                const tagMap = {
                  success: { text: "OKAY", cls: "text-emerald-400" },
                  error: { text: "FAIL", cls: "text-red-400" },
                  warning: { text: "WARN", cls: "text-[#FF6B00]" },
                  info: { text: "INFO", cls: "text-[#71717A]" },
                }[log.level];

                return (
                  <div
                    key={`${log.timestamp}-${idx}`}
                    className="grid grid-cols-[54px_44px_1fr] items-baseline gap-2.5 rounded px-2 py-1.5 hover:bg-white/[0.02]"
                  >
                    <span className="text-[11px] text-[#52525B] tabular-nums">
                      {formatRelativeTime(log.timestamp)}
                    </span>
                    <span className={cn("text-[11px] font-semibold", tagMap.cls)}>
                      [{tagMap.text}]
                    </span>
                    <span className="text-[#D4D4D8] leading-relaxed break-words font-sans text-xs">
                      {log.message}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="py-14 text-center text-[#52525B]">
                No runtime events recorded yet.
              </div>
            )}
          </div>
        </div>

        {/* Right Console Pane: Priority Leads OR Live System Readiness Checklist (5 cols) */}
        <div className="lg:col-span-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1F1F23] bg-[#111114]">
              <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-white">
                {topLeads?.items?.length
                  ? "Priority Review Queue"
                  : "Pre-Flight Checklist"}
              </h2>
              <span className="font-mono text-[11px] text-[#FF6B00]">
                {pendingCount} QUEUED
              </span>
            </div>

            {topLeads?.items && topLeads.items.length > 0 ? (
              <div className="divide-y divide-[#1C1C20]">
                {topLeads.items.map((lead) => (
                  <Link
                    key={lead.id}
                    href="/leads"
                    className="block px-5 py-3.5 hover:bg-[#141418] transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-semibold text-white truncate">
                        @{lead.author_username}
                      </span>
                      <span
                        className={cn(
                          "font-mono text-[11px] font-bold px-1.5 py-0.5 rounded",
                          lead.intent_score >= 90
                            ? "bg-[#FF6B00] text-[#09090B]"
                            : "text-[#FF6B00] bg-[#FF6B00]/10"
                        )}
                      >
                        {lead.intent_score}%
                      </span>
                    </div>
                    <p className="text-xs text-[#8E8E98] line-clamp-2 leading-relaxed">
                      {lead.post_text}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-5 space-y-3">
                <p className="text-xs text-[#71717A] leading-relaxed">
                  Pastikan 3 komponen ini berstatus hijau agar bot hanya membalas
                  dengan link Shopee Affiliate milikmu:
                </p>
                <div className="space-y-2">
                  {readinessSteps.map((step) => (
                    <Link
                      key={step.label}
                      href={step.href}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[#1F1F23] bg-[#111114] px-3.5 py-3 hover:border-[#323238] transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px]",
                            step.done
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : "bg-[#FF6B00]/15 text-[#FF6B00] border border-[#FF6B00]/40 font-mono"
                          )}
                        >
                          {step.done ? <Check className="h-3 w-3" /> : "!"}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate">
                            {step.label}
                          </p>
                          <p className="font-mono text-[11px] text-[#71717A] truncate">
                            {step.detail}
                          </p>
                        </div>
                      </div>
                      <ArrowUpRight className="h-3.5 w-3.5 text-[#52525B] shrink-0" />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="px-5 py-3.5 border-t border-[#1F1F23] bg-[#111114] flex items-center justify-between">
            <span className="font-mono text-[11px] text-[#52525B]">
              {stats?.commented_total_count ?? 0} REPLIED TOTAL
            </span>
            <PillButton size="sm" variant="primary" href="/leads">
              Open Leads Studio
            </PillButton>
          </div>
        </div>
      </section>
    </div>
  );
}
