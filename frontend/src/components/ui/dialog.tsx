"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: DialogProps) {
  const closeRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          "relative w-full max-w-xl rounded-2xl bg-[#151518] border border-[#26262A] p-6 shadow-2xl max-h-[90vh] overflow-y-auto",
          className
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#26262A] pb-4 mb-5">
          <div>
            <h2
              id="dialog-title"
              className="text-xl font-bold tracking-tight text-white"
            >
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-sm text-[#9E9EA6]">{description}</p>
            )}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[#26262A] bg-[#0B0B0C] text-[#9E9EA6] hover:border-[#FF6B00]/50 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
