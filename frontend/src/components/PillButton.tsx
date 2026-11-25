"use client";

import * as React from "react";
import { ArrowUpRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PillButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "inverted" | "secondary";
  size?: "sm" | "md";
  icon?: React.ReactNode;
  loading?: boolean;
}

export const PillButton = React.forwardRef<HTMLButtonElement, PillButtonProps>(
  (
    {
      children,
      className,
      variant = "primary",
      size = "md",
      icon,
      loading = false,
      disabled,
      type = "button",
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    const pillVariants: Record<NonNullable<PillButtonProps["variant"]>, string> = {
      primary:
        "bg-[#FF6B00] hover:bg-[#FF7A1A] text-white shadow-[0_0_25px_rgba(255,107,0,0.3)] border border-transparent",
      inverted:
        "bg-[#0B0B0C] hover:bg-[#151518] text-white border border-white/10 shadow-lg",
      secondary:
        "bg-[#151518] hover:bg-[#1E1E22] text-white border border-[#26262A] hover:border-[#FF6B00]/50",
    };

    const badgeVariants: Record<NonNullable<PillButtonProps["variant"]>, string> = {
      primary: "bg-white text-[#0B0B0C]",
      inverted: "bg-[#FF6B00] text-white",
      secondary: "bg-[#FF6B00] text-white",
    };

    const sizeStyles: Record<NonNullable<PillButtonProps["size"]>, string> = {
      sm: "pl-4 pr-1.5 py-1.5 text-xs gap-2.5",
      md: "pl-5 pr-2 py-2 text-sm gap-3",
    };

    const iconCircleSizes: Record<NonNullable<PillButtonProps["size"]>, string> = {
      sm: "w-6 h-6",
      md: "w-7 h-7",
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        className={cn(
          "group rounded-full font-medium inline-flex items-center justify-between transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0B0C] disabled:opacity-55 disabled:pointer-events-none active:scale-[0.99]",
          pillVariants[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        <span className="whitespace-nowrap">{children}</span>
        <span
          className={cn(
            "rounded-full flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105",
            badgeVariants[variant],
            iconCircleSizes[size]
          )}
          aria-hidden="true"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            icon ?? <ArrowUpRight className="h-4 w-4" />
          )}
        </span>
      </button>
    );
  }
);

PillButton.displayName = "PillButton";
