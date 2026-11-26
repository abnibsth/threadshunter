import * as React from "react";
import { cn } from "@/lib/utils";

export interface BrandLogoProps {
  size?: "sm" | "md" | "lg";
  pulse?: boolean;
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<BrandLogoProps["size"]>, string> = {
  sm: "h-6 w-6 rounded-md",
  md: "h-8 w-8 rounded-lg",
  lg: "h-11 w-11 rounded-xl",
};

/**
 * Crisp inline geometric SVG mark (concentric Threads spiral + 4-point AI star + growth arrow).
 * Zero external image requests so it renders instantaneously on SSR without broken image states.
 */
export function BrandLogo({
  size = "md",
  pulse = false,
  className,
}: BrandLogoProps) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center bg-[#111114] border border-[#27272A]",
        SIZE_CLASSES[size],
        pulse && "border-[#FF6B00] ring-2 ring-[#FF6B00]/25",
        className
      )}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 512 512"
        fill="none"
        className="h-[82%] w-[82%]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M324 388 C264 426 178 416 132 362 C82 304 86 206 142 152 C196 100 288 98 340 146 C364 168 364 202 338 224 L294 264"
          stroke="#FF6B00"
          strokeWidth="30"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M150 264 C150 202 198 156 260 156 C284 156 306 164 322 178"
          stroke="#FF6B00"
          strokeWidth="30"
          strokeLinecap="round"
        />
        <path
          d="M162 326 C192 362 248 372 296 352 C314 344 334 346 346 360"
          stroke="#FF6B00"
          strokeWidth="30"
          strokeLinecap="round"
        />
        <path
          d="M126 322 L208 240 C234 214 274 214 294 242"
          stroke="#FF6B00"
          strokeWidth="30"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M198 286 C214 316 254 324 284 300 L318 268"
          stroke="#FF6B00"
          strokeWidth="30"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M342 258 L338 302 C336 334 368 346 386 318 C398 298 398 258 380 226"
          stroke="#FF6B00"
          strokeWidth="30"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M348 214 L414 148"
          stroke="#FF6B00"
          strokeWidth="30"
          strokeLinecap="round"
        />
        <path
          d="M352 148 L414 148 L414 210"
          stroke="#FF6B00"
          strokeWidth="30"
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
        <path
          d="M248 238 C251 255 260 263 276 266 C260 269 251 277 248 294 C245 277 236 269 220 266 C236 263 245 255 248 238 Z"
          fill="#FF6B00"
        />
      </svg>
    </span>
  );
}
