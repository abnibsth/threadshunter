import * as React from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[96px] w-full rounded-xl bg-[#0B0B0C]/90 border border-[#26262A] px-3.5 py-2.5 text-sm text-white placeholder:text-[#63636B] transition-colors focus-visible:outline-none focus-visible:border-[#FF6B00] focus-visible:ring-1 focus-visible:ring-[#FF6B00] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";
