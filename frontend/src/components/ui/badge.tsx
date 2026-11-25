import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "orange" | "success" | "danger" | "outline" | "inverted";
}

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  const styles: Record<NonNullable<BadgeProps["variant"]>, string> = {
    default: "bg-[#1E1E22] text-[#9E9EA6] border border-[#26262A]",
    orange: "bg-[#FF6B00]/15 text-[#FF6B00] border border-[#FF6B00]/35",
    success: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    danger: "bg-red-500/15 text-red-400 border border-red-500/30",
    outline: "bg-transparent text-[#9E9EA6] border border-[#26262A]",
    inverted: "bg-[#0B0B0C]/30 text-white border border-white/25",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        styles[variant],
        className
      )}
      {...props}
    />
  );
}
