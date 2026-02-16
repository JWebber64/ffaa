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
    neutral: "bg-[rgba(255,255,255,0.06)] border-stroke text-fg1",
    accent: "bg-[rgba(124,58,237,0.16)] border-[rgba(124,58,237,0.35)] text-fg0",
    host: "bg-[rgba(34,211,238,0.14)] border-[rgba(34,211,238,0.35)] text-fg0",
    success: "bg-[rgba(52,211,153,0.14)] border-[rgba(52,211,153,0.35)] text-fg0",
    warning: "bg-[rgba(251,191,36,0.14)] border-[rgba(251,191,36,0.35)] text-fg0",
    danger: "bg-[rgba(251,113,133,0.14)] border-[rgba(251,113,133,0.35)] text-fg0",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold",
        tones[tone],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
