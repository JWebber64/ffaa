import React from "react";
import { cn } from "./cn";

export function Badge({
  className,
  tone = "neutral",
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "accent" | "host" | "success" | "warning" | "danger";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-[rgba(255,255,255,0.07)] border-stroke text-fg1",
    accent: "bg-[rgba(16,185,129,0.16)] border-[rgba(16,185,129,0.45)] text-fg0",
    host: "bg-[var(--color-surface-badge-brand)] border-[var(--color-border-brand)] text-fg0",
    success: "bg-[rgba(52,211,153,0.18)] border-[rgba(52,211,153,0.45)] text-fg0",
    warning: "bg-[rgba(251,191,36,0.16)] border-[rgba(251,191,36,0.45)] text-fg0",
    danger: "bg-[rgba(251,113,133,0.16)] border-[rgba(251,113,133,0.45)] text-fg0",
  };

  return (
    <span
      className={cn(
        "ui-badge",
        `ui-badge-${tone}`,
        "inline-flex items-center rounded-[999px] border px-2.5 py-1 text-xs font-semibold",
        tones[tone],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
