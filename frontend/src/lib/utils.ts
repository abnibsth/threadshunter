import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(isoDate?: string | null): string {
  if (!isoDate) return "—";
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return "—";

  const diffSeconds = Math.floor((Date.now() - parsed.getTime()) / 1000);
  if (diffSeconds < 0) {
    const abs = Math.abs(diffSeconds);
    if (abs < 60) return `in ${abs}s`;
    const mins = Math.floor(abs / 60);
    if (mins < 60) return `in ${mins}m`;
    return `in ${Math.floor(mins / 60)}h`;
  }
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const mins = Math.floor(diffSeconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatCountdown(isoDate?: string | null): string {
  if (!isoDate) return "Standby";
  const target = new Date(isoDate).getTime();
  if (Number.isNaN(target)) return "Standby";
  const remaining = Math.max(0, Math.floor((target - Date.now()) / 1000));
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function truncateUrl(url: string, maxLength = 34): string {
  if (!url) return "";
  const cleaned = url.replace(/^https?:\/\//i, "");
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength - 3)}...`;
}

export function formatProviderHost(baseUrl: string, provider: string): string {
  if (provider === "google_genai") return "Google GenAI Native SDK";
  if (!baseUrl) return "Custom OpenAI Endpoint";
  try {
    const parsed = new URL(baseUrl);
    return parsed.hostname;
  } catch {
    return baseUrl.slice(0, 32);
  }
}
