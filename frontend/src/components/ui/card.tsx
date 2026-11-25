import * as React from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  featured?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, featured = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-2xl transition-colors duration-200",
        featured
          ? "bg-gradient-to-b from-[#FF6B00] to-[#E04F00] text-white border border-white/15 shadow-[0_0_35px_rgba(255,107,0,0.28)]"
          : "bg-[#151518] border border-[#26262A] hover:border-[#FF6B00]/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        className
      )}
      {...props}
    />
  )
);
Card.displayName = "Card";

export const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pb-3", className)} {...props} />
));
CardHeader.displayName = "CardHeader";

export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-lg font-semibold tracking-tight text-white", className)}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-sm text-[#9E9EA6]", className)} {...props} />
));
CardDescription.displayName = "CardDescription";

export const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-3", className)} {...props} />
));
CardContent.displayName = "CardContent";
