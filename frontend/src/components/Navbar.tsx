"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import { Menu, X } from "lucide-react";
import { BotStatus, swrFetcher } from "@/lib/api";
import { cn } from "@/lib/utils";
import { BrandLogo } from "./BrandLogo";

const NAV_ITEMS = [
  { href: "/", label: "Overview", code: "01" },
  { href: "/leads", label: "Leads Queue", code: "02" },
  { href: "/products", label: "Products", code: "03" },
  { href: "/settings", label: "Settings", code: "04" },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const { data: status } = useSWR<BotStatus>("/api/bot/status", swrFetcher, {
    refreshInterval: 8000,
    revalidateOnFocus: true,
    shouldRetryOnError: false,
  });

  const isAuthConnected = Boolean(status?.auth_status?.connected);
  const isScanning = Boolean(status?.is_scanning);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#1C1C20] bg-[#09090B]/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Identity */}
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="flex items-center gap-3 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00] rounded-md"
          >
            <BrandLogo size="md" pulse={isScanning} />
            <div className="flex items-baseline gap-2">
              <span className="font-bold tracking-[-0.02em] text-[15px] text-white">
                ThreadsHunter
              </span>
              <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-widest text-[#52525B]">
                v3.0
              </span>
            </div>
          </Link>

          {/* Architectural Desktop Navigation */}
          <nav
            aria-label="Primary Navigation"
            className="hidden md:flex items-center h-16 gap-1 border-l border-[#1C1C20] pl-6"
          >
            {NAV_ITEMS.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname?.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative flex h-16 items-center gap-2 px-3.5 text-[13px] font-medium transition-colors",
                    active
                      ? "text-white"
                      : "text-[#71717A] hover:text-[#D4D4D8]"
                  )}
                >
                  <span className="font-mono text-[10px] text-[#52525B]">
                    {item.code}
                  </span>
                  <span>{item.label}</span>
                  {active && (
                    <span
                      className="absolute inset-x-3 bottom-0 h-[2px] bg-[#FF6B00]"
                      aria-hidden="true"
                    />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Telemetry Status + Mobile Menu */}
        <div className="flex items-center gap-3">
          {isScanning && (
            <span className="hidden lg:inline-flex items-center gap-2 font-mono text-[11px] text-[#FF6B00] mr-1">
              <span className="h-1.5 w-1.5 rounded-full bg-[#FF6B00] animate-ping" />
              SCANNING
            </span>
          )}

          <Link
            href="/settings#auth-session"
            className={cn(
              "inline-flex items-center gap-2 rounded-md border px-2.5 py-1 font-mono text-[11px] tracking-wide transition-colors",
              isAuthConnected
                ? "bg-[#111113] border-[#27272A] text-[#D4D4D8] hover:border-[#3F3F46]"
                : "bg-[#FF6B00]/10 border-[#FF6B00]/40 text-[#FF6B00] hover:bg-[#FF6B00]/15"
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                isAuthConnected ? "bg-emerald-400" : "bg-[#FF6B00] animate-pulse"
              )}
              aria-hidden="true"
            />
            <span>
              {isAuthConnected ? "THREADS · CONNECTED" : "THREADS · AUTH NEEDED"}
            </span>
          </Link>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#27272A] bg-[#111113] text-[#A1A1AA] hover:text-white"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Sheet */}
      {mobileOpen && (
        <div className="md:hidden border-t border-[#1C1C20] bg-[#09090B] px-4 py-3">
          <div className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname?.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium",
                    active
                      ? "bg-[#18181B] text-white border-l-2 border-[#FF6B00]"
                      : "text-[#A1A1AA] hover:text-white hover:bg-[#121215]"
                  )}
                >
                  <span>{item.label}</span>
                  <span className="font-mono text-xs text-[#52525B]">
                    {item.code}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}
