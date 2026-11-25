"use client";

import * as React from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  RotateCcw,
  Save,
  Send,
  ShoppingBag,
  SkipForward,
  Sparkles,
  Star,
} from "lucide-react";
import { LeadPost } from "@/lib/api";
import { cn, formatRelativeTime } from "@/lib/utils";
import { PillButton } from "./PillButton";

export interface LeadCardProps {
  lead: LeadPost;
  onSendReply: (leadId: number, draftReply: string) => Promise<void>;
  onSaveDraft: (leadId: number, draftReply: string) => Promise<void>;
  onSkip: (leadId: number) => Promise<void>;
  onRequeue?: (leadId: number) => Promise<void>;
}

export function LeadCard({
  lead,
  onSendReply,
  onSaveDraft,
  onSkip,
  onRequeue,
}: LeadCardProps) {
  const isFeatured = lead.intent_score >= 90 && lead.status === "PENDING_REVIEW";
  const [draft, setDraft] = React.useState<string>(lead.draft_reply || "");
  const [copied, setCopied] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [skipping, setSkipping] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setDraft(lead.draft_reply || "");
  }, [lead.draft_reply, lead.id]);

  const isDirty = draft.trim() !== (lead.draft_reply || "").trim();
  const filledStars = Math.max(1, Math.min(5, Math.round(lead.intent_score / 20)));

  const handleCopy = async () => {
    if (!draft.trim()) return;
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setActionError("Tidak bisa menyalin teks ke clipboard browser.");
    }
  };

  const handleSave = async () => {
    if (!draft.trim()) return;
    setActionError(null);
    setSaving(true);
    try {
      await onSaveDraft(lead.id, draft.trim());
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Gagal menyimpan draft.");
    } finally {
      setSaving(false);
    }
  };

  const handleReply = async () => {
    if (!draft.trim()) {
      setActionError("Draft balasan tidak boleh kosong.");
      return;
    }
    setActionError(null);
    setSending(true);
    try {
      await onSendReply(lead.id, draft.trim());
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Gagal mengirim balasan ke Threads."
      );
    } finally {
      setSending(false);
    }
  };

  const handleSkip = async () => {
    setActionError(null);
    setSkipping(true);
    try {
      await onSkip(lead.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Gagal melewati lead.");
    } finally {
      setSkipping(false);
    }
  };

  const handleRequeue = async () => {
    if (!onRequeue) return;
    setActionError(null);
    setSkipping(true);
    try {
      await onRequeue(lead.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Gagal memindahkan lead.");
    } finally {
      setSkipping(false);
    }
  };

  return (
    <article
      className={cn(
        "flex flex-col justify-between rounded-2xl p-6 transition-all duration-200",
        isFeatured
          ? "bg-gradient-to-b from-[#FF6B00] to-[#E04F00] text-white border border-white/20 shadow-[0_0_35px_rgba(255,107,0,0.3)]"
          : "bg-[#151518] border border-[#26262A] hover:border-[#FF6B00]/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
      )}
    >
      <div className="space-y-4">
        {/* Card Header: Author + Intent Score */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "truncate font-semibold text-sm",
                  isFeatured ? "text-white" : "text-white"
                )}
              >
                @{lead.author_username}
              </span>
              <a
                href={lead.post_url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open Threads post by @${lead.author_username}`}
                className={cn(
                  "inline-flex items-center justify-center rounded-md p-1 transition-colors",
                  isFeatured
                    ? "text-white/80 hover:text-white hover:bg-black/15"
                    : "text-[#63636B] hover:text-[#FF6B00] hover:bg-white/5"
                )}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            <div
              className={cn(
                "mt-1 flex flex-wrap items-center gap-2 text-xs",
                isFeatured ? "text-white/80" : "text-[#63636B]"
              )}
            >
              <span className="font-mono">{formatRelativeTime(lead.scraped_at)}</span>
              <span>•</span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-medium",
                  isFeatured
                    ? "bg-[#0B0B0C]/25 text-white"
                    : "bg-[#1E1E22] text-[#9E9EA6] border border-[#26262A]"
                )}
              >
                #{lead.keyword_matched}
              </span>
            </div>
          </div>

          {/* Intent Score & Stars */}
          <div
            className={cn(
              "shrink-0 rounded-xl px-2.5 py-1.5 text-right",
              isFeatured
                ? "bg-[#0B0B0C]/30 border border-white/20"
                : "bg-[#0B0B0C] border border-[#26262A]"
            )}
          >
            <div
              className={cn(
                "text-sm font-extrabold tabular-nums leading-none",
                isFeatured ? "text-white" : "text-[#FF6B00]"
              )}
            >
              {lead.intent_score}% Match
            </div>
            <div className="mt-1 flex items-center justify-end gap-0.5" aria-hidden="true">
              {Array.from({ length: 5 }).map((_, idx) => (
                <Star
                  key={idx}
                  className={cn(
                    "h-2.5 w-2.5",
                    idx < filledStars
                      ? isFeatured
                        ? "fill-white text-white"
                        : "fill-[#FF6B00] text-[#FF6B00]"
                      : isFeatured
                      ? "text-white/30"
                      : "text-[#26262A]"
                  )}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Featured Hot-Lead Ribbon */}
        {isFeatured && (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#0B0B0C]/30 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white">
            <Sparkles className="h-3 w-3" />
            High-Priority Buying Intent
          </div>
        )}

        {/* Original Threads Post Quote */}
        <blockquote
          className={cn(
            "rounded-xl p-3.5 text-sm leading-relaxed",
            isFeatured
              ? "bg-[#0B0B0C]/20 text-white border border-white/15"
              : "bg-[#0B0B0C]/65 text-[#E4E4E7] border border-[#26262A]"
          )}
        >
          “{lead.post_text}”
        </blockquote>

        {/* Matched Shopee Product Pill + AI Reasoning */}
        <div className="space-y-2">
          {lead.matched_product ? (
            <div
              className={cn(
                "inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
                isFeatured
                  ? "bg-[#0B0B0C]/35 text-white border border-white/20"
                  : "bg-[#FF6B00]/12 text-[#FF6B00] border border-[#FF6B00]/30"
              )}
            >
              <ShoppingBag className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{lead.matched_product.name}</span>
              {lead.matched_product.price_range && (
                <span
                  className={cn(
                    "hidden sm:inline font-mono text-[11px]",
                    isFeatured ? "text-white/80" : "text-[#9E9EA6]"
                  )}
                >
                  · {lead.matched_product.price_range}
                </span>
              )}
            </div>
          ) : (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-1 text-xs",
                isFeatured ? "bg-black/20 text-white/80" : "bg-[#1E1E22] text-[#63636B]"
              )}
            >
              No exact product matched
            </span>
          )}

          {lead.ai_reasoning && (
            <p
              className={cn(
                "text-xs leading-relaxed",
                isFeatured ? "text-white/85" : "text-[#9E9EA6]"
              )}
            >
              <span className="font-semibold">AI Note:</span> {lead.ai_reasoning}
            </p>
          )}
        </div>

        {/* Editable AI Draft Reply */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor={`reply-${lead.id}`}
              className={cn(
                "text-[11px] font-semibold uppercase tracking-wider",
                isFeatured ? "text-white/85" : "text-[#9E9EA6]"
              )}
            >
              AI Casual Reply Draft
            </label>
            {isDirty && (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className={cn(
                  "inline-flex items-center gap-1 text-[11px] font-medium underline-offset-2 hover:underline",
                  isFeatured ? "text-white" : "text-[#FF6B00]"
                )}
              >
                <Save className="h-3 w-3" />
                {saving ? "Saving..." : "Save edit"}
              </button>
            )}
          </div>
          <textarea
            id={`reply-${lead.id}`}
            rows={4}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={lead.status === "COMMENTED" || sending}
            placeholder="Tulis balasan Threads kasual + link Shopee affiliate..."
            className={cn(
              "w-full rounded-xl bg-[#0B0B0C]/85 border p-3 text-sm text-white placeholder:text-[#63636B] leading-relaxed focus-visible:outline-none focus-visible:ring-2 transition-colors disabled:opacity-65",
              isFeatured
                ? "border-white/25 focus-visible:ring-white/80"
                : "border-[#26262A] focus-visible:border-[#FF6B00] focus-visible:ring-[#FF6B00]/50"
            )}
          />
        </div>

        {/* Error Box if Playwright failed or action errored */}
        {(lead.error_message || actionError) && (
          <div
            role="alert"
            className={cn(
              "flex items-start gap-2 rounded-xl p-2.5 text-xs",
              isFeatured
                ? "bg-[#0B0B0C]/45 text-white border border-white/20"
                : "bg-red-500/10 text-red-300 border border-red-500/30"
            )}
          >
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="break-words">{actionError || lead.error_message}</span>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div
        className={cn(
          "mt-5 flex flex-wrap items-center justify-between gap-2 border-t pt-4",
          isFeatured ? "border-white/20" : "border-[#26262A]"
        )}
      >
        {lead.status === "COMMENTED" ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 text-xs font-medium text-emerald-400">
            <Check className="h-3.5 w-3.5" />
            Commented {formatRelativeTime(lead.commented_at)}
          </span>
        ) : (
          <PillButton
            size="sm"
            variant={isFeatured ? "inverted" : "primary"}
            icon={<Send className="h-3.5 w-3.5" />}
            loading={sending}
            onClick={handleReply}
          >
            Auto-Reply Now
          </PillButton>
        )}

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopy}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              isFeatured
                ? "bg-[#0B0B0C]/25 text-white hover:bg-[#0B0B0C]/40 border border-white/15"
                : "bg-[#1E1E22] text-[#9E9EA6] hover:text-white border border-[#26262A]"
            )}
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copy Text
              </>
            )}
          </button>

          {lead.status === "PENDING_REVIEW" ? (
            <button
              type="button"
              disabled={skipping}
              onClick={handleSkip}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50",
                isFeatured
                  ? "text-white/85 hover:text-white hover:bg-black/20"
                  : "text-[#63636B] hover:text-white hover:bg-white/5"
              )}
            >
              <SkipForward className="h-3.5 w-3.5" />
              Skip
            </button>
          ) : (
            lead.status !== "COMMENTED" &&
            onRequeue && (
              <button
                type="button"
                disabled={skipping}
                onClick={handleRequeue}
                className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-[#9E9EA6] hover:text-[#FF6B00] hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Re-queue
              </button>
            )
          )}
        </div>
      </div>
    </article>
  );
}
