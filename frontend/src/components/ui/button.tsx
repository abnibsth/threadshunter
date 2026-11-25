import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "inverted";
  size?: "sm" | "md" | "lg" | "icon";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "secondary", size = "md", type = "button", ...props }, ref) => {
    const variantStyles: Record<NonNullable<ButtonProps["variant"]>, string> = {
      primary:
        "bg-[#FF6B00] text-white hover:bg-[#FF7A1A] shadow-[0_0_20px_rgba(255,107,0,0.25)] border border-transparent",
      secondary:
        "bg-[#151518] text-white border border-[#26262A] hover:bg-[#1E1E22] hover:border-[#FF6B00]/50",
      ghost:
        "bg-transparent text-[#9E9EA6] hover:text-white hover:bg-white/5 border border-transparent",
      danger:
        "bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 hover:text-red-300",
      inverted:
        "bg-[#0B0B0C]/90 text-white border border-white/15 hover:bg-[#0B0B0C]",
    };

    const sizeStyles: Record<NonNullable<ButtonProps["size"]>, string> = {
      sm: "h-8 px-3 text-xs rounded-lg gap-1.5",
      md: "h-10 px-4 text-sm rounded-xl gap-2",
      lg: "h-11 px-5 text-sm rounded-xl gap-2",
      icon: "h-9 w-9 rounded-xl p-0",
    };

    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex items-center justify-center font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0B0C] disabled:opacity-50 disabled:pointer-events-none",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
