"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PillButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "inverted" | "secondary";
  size?: "sm" | "md";
  icon?: React.ReactNode;
  loading?: boolean;
  href?: string;
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
      href,
      type = "button",
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    const pillVariants: Record<NonNullable<PillButtonProps["variant"]>, string> = {
      primary:
        "bg-[#FF6B00] hover:bg-[#FF7A1A] text-white border border-[#FF852E]/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]",
      inverted:
        "bg-[#09090B] hover:bg-[#141417] text-white border border-black/40 shadow-sm",
      secondary:
        "bg-[#121215] hover:bg-[#1A1A1F] text-[#E4E4E7] hover:text-white border border-[#27272A] hover:border-[#3F3F46]",
    };

    const badgeVariants: Record<NonNullable<PillButtonProps["variant"]>, string> = {
      primary: "bg-white text-[#09090B]",
      inverted: "bg-[#FF6B00] text-white",
      secondary: "bg-[#222227] text-[#FF6B00] group-hover:bg-[#FF6B00] group-hover:text-white",
    };

    const sizeStyles: Record<NonNullable<PillButtonProps["size"]>, string> = {
      sm: "pl-4 pr-1.5 py-1.5 text-xs gap-2.5",
      md: "pl-5 pr-1.5 py-1.5 text-[13px] gap-3",
    };

    const iconCircleSizes: Record<NonNullable<PillButtonProps["size"]>, string> = {
      sm: "w-6 h-6",
      md: "w-7 h-7",
    };

    const sharedClasses = cn(
      "group rounded-full font-semibold tracking-[-0.01em] inline-flex items-center justify-between transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00] focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090B] disabled:opacity-50 disabled:pointer-events-none active:translate-y-[0.5px]",
      pillVariants[variant],
      sizeStyles[size],
      className
    );

    const innerContent = (
      <>
        <span className="whitespace-nowrap">{children}</span>
        <span
          className={cn(
            "rounded-full flex items-center justify-center shrink-0 transition-colors duration-150",
            badgeVariants[variant],
            iconCircleSizes[size]
          )}
          aria-hidden="true"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            icon ?? <ArrowUpRight className="h-3.5 w-3.5 stroke-[2.25]" />
          )}
        </span>
      </>
    );

    if (href && !isDisabled) {
      return (
        <Link href={href} className={sharedClasses}>
          {innerContent}
        </Link>
      );
    }

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        className={sharedClasses}
        {...props}
      >
        {innerContent}
      </button>
    );
  }
);

PillButton.displayName = "PillButton";
