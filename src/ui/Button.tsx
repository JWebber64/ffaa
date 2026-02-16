import React from "react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";

export type UIButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
};

const base =
  "inline-flex items-center justify-center gap-2 select-none " +
  "rounded-md border border-stroke px-4 font-medium " +
  "transition active:translate-y-[1px] disabled:opacity-60 disabled:cursor-not-allowed " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(34,211,238,0.6)] focus-visible:ring-offset-0";

const sizes: Record<NonNullable<UIButtonProps["size"]>, string> = {
  sm: "h-9 text-sm",
  md: "h-11 text-sm",
  lg: "h-12 text-base",
};

const variants: Record<Variant, string> = {
  primary:
    "bg-[linear-gradient(135deg,rgba(124,58,237,0.95),rgba(34,211,238,0.75))] " +
    "text-white border-transparent shadow-s1 hover:brightness-[1.05]",
  secondary:
    "bg-panel text-fg0 hover:bg-[rgba(255,255,255,0.09)] shadow-s1",
  ghost:
    "bg-transparent text-fg0 border-transparent hover:bg-[rgba(255,255,255,0.06)]",
  danger:
    "bg-[rgba(251,113,133,0.15)] text-fg0 border-[rgba(251,113,133,0.35)] hover:bg-[rgba(251,113,133,0.22)]",
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  isLoading,
  disabled,
  children,
  ...props
}: UIButtonProps) {
  return (
    <button
      className={cn(base, sizes[size], variants[variant], className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="inline-flex items-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          <span>Loading</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}
