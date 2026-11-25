"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface BrandLogoProps {
  size?: "sm" | "md" | "lg";
  pulse?: boolean;
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<BrandLogoProps["size"]>, string> = {
  sm: "h-7 w-7 rounded-lg",
  md: "h-9 w-9 rounded-xl",
  lg: "h-12 w-12 rounded-2xl",
};

export function BrandLogo({
  size = "md",
  pulse = false,
  className,
}: BrandLogoProps) {
  const [src, setSrc] = React.useState<string>("/logo.jpg");

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden bg-[#0B0B0C] border border-[#FF6B00]/35 shadow-[0_0_16px_rgba(255,107,0,0.28)]",
        SIZE_CLASSES[size],
        pulse && "ring-2 ring-[#FF6B00]/60 animate-pulse",
        className
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="ThreadsHunter Logo"
        onError={() => {
          if (src !== "/logo.svg") {
            setSrc("/logo.svg");
          }
        }}
        className={cn(
          "h-full w-full object-cover",
          src === "/logo.jpg" ? "scale-[1.42]" : "scale-100"
        )}
      />
    </span>
  );
}
