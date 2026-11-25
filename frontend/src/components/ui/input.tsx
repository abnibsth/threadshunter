import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-10 w-full rounded-xl bg-[#0B0B0C] border border-[#26262A] px-3.5 py-2 text-sm text-white placeholder:text-[#63636B] transition-colors focus-visible:outline-none focus-visible:border-[#FF6B00] focus-visible:ring-1 focus-visible:ring-[#FF6B00] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
