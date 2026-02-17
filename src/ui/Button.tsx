import React from "react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";

export type UIButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
};

const base =
  "ffaa-sheen inline-flex items-center justify-center gap-2 select-none " +
  "rounded-full px-5 font-semibold tracking-tight " +
  "transition-all duration-200 ease-out " +
  "hover:-translate-y-[1px] active:translate-y-[1px] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-0 " +
  "disabled:opacity-55 disabled:cursor-not-allowed disabled:hover:translate-y-0";

const sizes: Record<NonNullable<UIButtonProps["size"]>, string> = {
  sm: "h-10 text-sm",
  md: "h-12 text-sm",
  lg: "h-12 text-base",
};

const variants: Record<Variant, string> = {
  primary:
    "text-white " +
    "bg-[linear-gradient(135deg,var(--a1),var(--a2))] " +
    "shadow-[0_18px_70px_rgba(0,0,0,0.60)] " +
    "border border-[rgba(255,255,255,0.10)] " +
    "hover:shadow-[0_22px_90px_rgba(0,0,0,0.72)] " +
    "hover:brightness-[1.07] " +
    "after:content-[''] after:absolute after:inset-0 after:rounded-full after:pointer-events-none " +
    "after:shadow-[0_0_0_1px_rgba(255,255,255,0.10),0_0_38px_var(--glow-a2)]",

  secondary:
    "text-[var(--text-0)] " +
    "bg-[rgba(255,255,255,0.06)] " +
    "border border-[rgba(255,255,255,0.10)] " +
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] " +
    "hover:bg-[rgba(255,255,255,0.08)] hover:brightness-[1.05]",

  ghost:
    "border border-transparent bg-transparent text-[var(--text-0)] " +
    "hover:bg-[rgba(255,255,255,0.06)]",

  danger:
    "border border-[rgba(251,113,133,0.30)] text-[var(--text-0)] " +
    "bg-[rgba(251,113,133,0.12)] hover:bg-[rgba(251,113,133,0.18)] " +
    "shadow-[0_10px_40px_rgba(0,0,0,0.35)]",
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
