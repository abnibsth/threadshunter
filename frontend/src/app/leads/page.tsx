"use client";

import * as React from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Radar,
  RefreshCw,
  Search,
} from "lucide-react";
import { api, LeadListResponse, LeadStatus, swrFetcher } from "@/lib/api";
import { cn } from "@/lib/utils";
import { LeadCard } from "@/components/LeadCard";
import { PillButton } from "@/components/PillButton";

const STATUS_TABS: Array<{ key: LeadStatus; label: string }> = [
  { key: "PENDING_REVIEW", label: "Pending Review" },
  { key: "COMMENTED", label: "Commented" },
  { key: "IGNORED", label: "Ignored" },
  { key: "FAILED", label: "Failed" },
];

export default function LeadsPage() {
  const [activeTab, setActiveTab] = React.useState<LeadStatus>("PENDING_REVIEW");
  const [searchInput, setSearchInput] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [scanning, setScanning] = React.useState(false);
  const [notice, setNotice] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const queryPath = React.useMemo(() => {
    const params = new URLSearchParams({
      status: activeTab,
      page: String(page),
      page_size: "12",
    });
    if (debouncedSearch) params.set("search", debouncedSearch);
    return `/api/leads?${params.toString()}`;
  }, [activeTab, debouncedSearch, page]);

  const { data, error, isLoading, mutate } = useSWR<LeadListResponse>(
    queryPath,
    swrFetcher,
    { refreshInterval: 10000 }
  );

  const handleSendReply = async (leadId: number, draftReply: string) => {
    setNotice(null);
    await api.sendLeadReply(leadId, draftReply);
    setNotice({
      type: "success",
      text: "Balasan berhasil dikirim ke Threads secara natural!",
    });
    await mutate();
  };

  const handleSaveDraft = async (leadId: number, draftReply: string) => {
    await api.updateLead(leadId, { draft_reply: draftReply });
    setNotice({ type: "success", text: "Draft balasan tersimpan." });
    await mutate();
  };

  const handleSkip = async (leadId: number) => {
    await api.ignoreLead(leadId);
    await mutate();
  };

  const handleRequeue = async (leadId: number) => {
    await api.updateLead(leadId, { status: "PENDING_REVIEW" });
    await mutate();
  };

  const handleScanNow = async () => {
    setNotice(null);
    setScanning(true);
    try {
      const res = await api.triggerManualScan();
      setNotice({ type: "success", text: res.message });
    } catch (err) {
      setNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Gagal memulai scan.",
      });
    } finally {
      setScanning(false);
    }
  };

  const counts = data?.counts ?? {};
  const leads = data?.items ?? [];
  const totalPages = data?.pagination?.total_pages ?? 1;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#FF6B00]">
            Smart Reply Studio
          </p>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
            Scraped Threads Queue
          </h1>
          <p className="text-sm text-[#9E9EA6] max-w-2xl">
            Lead dengan skor niat beli <span className="text-white font-semibold">≥ 90%</span>{" "}
            disorot dengan kartu Electric Orange. Edit balasan kasual seperlunya
            lalu kirim otomatis dengan 1 klik.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => mutate()}
            aria-label="Refresh leads"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#151518] border border-[#26262A] text-[#9E9EA6] hover:border-[#FF6B00]/50 hover:text-white transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <PillButton
            loading={scanning}
            icon={<Radar className="h-4 w-4" />}
            onClick={handleScanNow}
          >
            Scan Fresh Leads
          </PillButton>
        </div>
      </div>

      {/* Filter Pills + Search Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#26262A] pb-5">
        <div className="flex flex-wrap items-center gap-2" role="tablist">
          {STATUS_TABS.map((tab) => {
            const isSelected = activeTab === tab.key;
            const tabCount = counts[tab.key] ?? 0;

            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => {
                  setActiveTab(tab.key);
                  setPage(1);
                }}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all",
                  isSelected
                    ? "bg-[#FF6B00] text-white shadow-[0_0_20px_rgba(255,107,0,0.28)]"
                    : "bg-[#151518] border border-[#26262A] text-[#9E9EA6] hover:text-white hover:border-[#FF6B00]/40"
                )}
              >
                <span>{tab.label}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-mono",
                    isSelected
                      ? "bg-[#0B0B0C]/30 text-white"
                      : "bg-[#0B0B0C] text-[#9E9EA6]"
                  )}
                >
                  {tabCount}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full lg:w-72">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#63636B]" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Cari @username, teks, keyword..."
            aria-label="Search leads"
            className="h-10 w-full rounded-full bg-[#151518] border border-[#26262A] pl-10 pr-4 text-sm text-white placeholder:text-[#63636B] focus-visible:outline-none focus-visible:border-[#FF6B00]"
          />
        </div>
      </div>

      {/* Inline Notification */}
      {notice && (
        <div
          role="status"
          className={cn(
            "flex items-center justify-between rounded-2xl border px-4 py-3 text-sm",
            notice.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-red-500/10 border-red-500/30 text-red-300"
          )}
        >
          <span>{notice.text}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-xs opacity-75 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div
          role="alert"
          className="rounded-2xl bg-red-500/10 border border-red-500/30 p-6 flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3 text-red-200 text-sm">
            <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
            <span>Gagal memuat antrian leads dari backend API.</span>
          </div>
          <button
            type="button"
            onClick={() => mutate()}
            className="rounded-full border border-red-400/40 px-4 py-1.5 text-xs font-medium text-white hover:bg-red-500/20"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* Loading Skeleton Grid */}
      {isLoading && (
        <div
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
          aria-busy="true"
          aria-label="Loading leads"
        >
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="h-[390px] rounded-2xl bg-[#151518] border border-[#26262A] p-6 animate-pulse flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="flex justify-between">
                  <div className="h-4 w-32 rounded bg-[#26262A]" />
                  <div className="h-8 w-20 rounded-xl bg-[#26262A]" />
                </div>
                <div className="h-24 w-full rounded-xl bg-[#0B0B0C]" />
                <div className="h-6 w-44 rounded-full bg-[#26262A]" />
                <div className="h-24 w-full rounded-xl bg-[#0B0B0C]" />
              </div>
              <div className="h-9 w-36 rounded-full bg-[#26262A]" />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && leads.length === 0 && (
        <div className="rounded-2xl bg-[#151518] border border-[#26262A] py-16 px-6 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0B0B0C] border border-[#26262A] text-[#FF6B00]">
            <Inbox className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-white">
              Belum ada lead di tab {STATUS_TABS.find((t) => t.key === activeTab)?.label}
            </h2>
            <p className="text-sm text-[#9E9EA6] max-w-md mx-auto">
              Jalankan manual scan atau aktifkan Auto-Scheduler untuk menangkap
              postingan Threads yang sedang mencari rekomendasi produk.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <PillButton onClick={handleScanNow} loading={scanning}>
              Scan Threads Now
            </PillButton>
            <Link
              href="/settings"
              className="rounded-full border border-[#26262A] bg-[#0B0B0C] px-5 py-2.5 text-sm font-medium text-[#9E9EA6] hover:text-white hover:border-[#FF6B00]/50"
            >
              Cek Konfigurasi AI &amp; Auth
            </Link>
          </div>
        </div>
      )}

      {/* 3-Column Bento Grid of Lead Cards */}
      {!isLoading && !error && leads.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {leads.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                onSendReply={handleSendReply}
                onSaveDraft={handleSaveDraft}
                onSkip={handleSkip}
                onRequeue={handleRequeue}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-[#26262A] pt-6">
              <p className="text-xs font-mono text-[#63636B]">
                Page {page} of {totalPages} · {data?.pagination.total_items} leads
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 rounded-full bg-[#151518] border border-[#26262A] px-3.5 py-1.5 text-xs font-medium text-white hover:border-[#FF6B00]/50 disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Prev
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex items-center gap-1 rounded-full bg-[#151518] border border-[#26262A] px-3.5 py-1.5 text-xs font-medium text-white hover:border-[#FF6B00]/50 disabled:opacity-40"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
