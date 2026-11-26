import * as React from "react";
import { cn } from "@/lib/utils";

export interface StatCounterProps {
  value: string | number;
  label: string;
  sublabel?: string;
  hideBorder?: boolean;
  accent?: boolean;
  className?: string;
}

export function StatCounter({
  value,
  label,
  sublabel,
  hideBorder = false,
  accent = true,
  className,
}: StatCounterProps) {
  return (
    <div
      className={cn(
        "flex items-end justify-between gap-4 py-4 first:pt-0 last:pb-0",
        !hideBorder && "border-b border-[#1F1F23]",
        className
      )}
    >
      <div className="space-y-1">
        <div
          className={cn(
            "text-4xl sm:text-[44px] font-extrabold tracking-[-0.04em] tabular-nums leading-none",
            accent ? "text-[#FF6B00]" : "text-white"
          )}
        >
          {value}
        </div>
        <div className="text-[11px] uppercase tracking-[0.14em] font-medium text-[#8E8E98]">
          {label}
        </div>
      </div>

      {sublabel && (
        <span className="font-mono text-[11px] uppercase tracking-wider text-[#52525B] pb-0.5">
          {sublabel}
        </span>
      )}
    </div>
  );
}
