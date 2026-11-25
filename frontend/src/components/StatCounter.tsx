import * as React from "react";
import { cn } from "@/lib/utils";

export interface StatCounterProps {
  value: string | number;
  label: string;
  sublabel?: string;
  hideBorder?: boolean;
  className?: string;
}

export function StatCounter({
  value,
  label,
  sublabel,
  hideBorder = false,
  className,
}: StatCounterProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5",
        !hideBorder && "border-b border-[#26262A] pb-5",
        className
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#FF6B00] tabular-nums leading-none">
          {value}
        </span>
        {sublabel && (
          <span className="font-mono text-xs text-[#63636B]">{sublabel}</span>
        )}
      </div>
      <span className="text-xs uppercase tracking-wider font-medium text-[#9E9EA6]">
        {label}
      </span>
    </div>
  );
}
