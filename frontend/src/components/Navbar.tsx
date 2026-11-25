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
  { href: "/", label: "Overview" },
  { href: "/leads", label: "Leads Queue" },
  { href: "/products", label: "Products" },
  { href: "/settings", label: "Settings" },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const { data: status } = useSWR<BotStatus>("/api/bot/status", swrFetcher, {
    refreshInterval: 10000,
    revalidateOnFocus: true,
    shouldRetryOnError: false,
  });

  const isAuthConnected = Boolean(status?.auth_status?.connected);
  const isScanning = Boolean(status?.is_scanning);

  return (
    <header className="sticky top-4 z-40 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      <nav
        aria-label="Primary Navigation"
        className="flex items-center justify-between rounded-full bg-[#151518]/85 border border-[#26262A] px-4 sm:px-6 py-3 backdrop-blur-xl shadow-[0_12px_36px_rgba(0,0,0,0.45)]"
      >
        {/* Brand Logo + Title */}
        <Link
          href="/"
          className="flex items-center gap-2.5 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00] rounded-full pr-1"
        >
          <BrandLogo size="md" pulse={isScanning} />
          <span className="font-bold tracking-tight text-sm sm:text-base">
            Threads<span className="text-[#FF6B00]">Hunter</span>
          </span>
        </Link>

        {/* Desktop Nav Links */}
        <div className="hidden md:flex items-center gap-1">
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
                  "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-[#1E1E22] text-white border border-[#26262A]"
                    : "text-[#9E9EA6] hover:text-white hover:bg-white/5"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Live Session Badge + Mobile Trigger */}
        <div className="flex items-center gap-2.5">
          <Link
            href="/settings#auth-session"
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              isAuthConnected
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/15"
                : "bg-[#FF6B00]/10 border-[#FF6B00]/35 text-[#FF6B00] hover:bg-[#FF6B00]/15"
            )}
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                isAuthConnected ? "bg-emerald-400" : "bg-[#FF6B00] animate-pulse"
              )}
              aria-hidden="true"
            />
            <span className="hidden sm:inline">
              Threads Auth: {isAuthConnected ? "Connected" : "Required"}
            </span>
            <span className="sm:hidden">
              {isAuthConnected ? "Connected" : "Auth"}
            </span>
          </Link>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileOpen}
            className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#26262A] bg-[#0B0B0C] text-[#9E9EA6] hover:text-white"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </nav>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="md:hidden mt-2 rounded-2xl bg-[#151518]/95 border border-[#26262A] p-3 backdrop-blur-xl shadow-2xl">
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
                    "rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-[#FF6B00] text-white"
                      : "text-[#9E9EA6] hover:text-white hover:bg-[#1E1E22]"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}
