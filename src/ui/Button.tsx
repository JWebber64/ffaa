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
  "rounded-[12px] font-semibold tracking-tight " +
  "transform-gpu transition-[background-color,border-color,box-shadow,filter,transform] duration-200 ease-out " +
  "hover:scale-[1.015] active:scale-[0.99] active:brightness-95 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-0 " +
  "disabled:opacity-55 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:brightness-100 disabled:active:scale-100 disabled:active:brightness-100";

const sizes: Record<NonNullable<UIButtonProps["size"]>, string> = {
  sm: "h-9 px-3 text-xs",
  md: "h-11 px-6 text-sm",
  lg: "h-12 px-7 text-base",
};

const variants: Record<Variant, string> = {
  primary:
    "text-white relative overflow-hidden " +
    "bg-[linear-gradient(135deg,#10b981,#14b8a6)] " +
    "border border-[rgba(255,255,255,0.14)] " +
    "shadow-[0_18px_40px_rgba(16,185,129,0.35),0_12px_26px_rgba(0,0,0,0.45)] " +
    "hover:border-[rgba(255,255,255,0.24)] " +
    "hover:shadow-[0_22px_52px_rgba(16,185,129,0.35),0_16px_30px_rgba(0,0,0,0.5)] " +
    "hover:brightness-[1.08] " +
    "after:content-[''] after:absolute after:inset-[1px] after:rounded-[11px] after:pointer-events-none " +
    "after:bg-[linear-gradient(180deg,rgba(255,255,255,0.18),rgba(255,255,255,0))]",

  secondary:
    "text-[var(--text-0)] " +
    "bg-[rgba(255,255,255,0.05)] " +
    "border border-[rgba(255,255,255,0.07)] " +
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_10px_24px_rgba(0,0,0,0.25)] " +
    "hover:border-[rgba(255,255,255,0.16)] hover:bg-[rgba(255,255,255,0.08)] " +
    "hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_12px_28px_rgba(0,0,0,0.28)] hover:brightness-[1.06]",

  ghost:
    "border border-transparent bg-transparent text-[var(--text-0)] " +
    "hover:border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.06)]",

  danger:
    "border border-[rgba(251,113,133,0.30)] text-[var(--text-0)] " +
    "bg-[rgba(251,113,133,0.12)] hover:border-[rgba(251,113,133,0.46)] hover:bg-[rgba(251,113,133,0.18)] " +
    "shadow-[0_10px_40px_rgba(0,0,0,0.35)]",
};

export const Button = React.forwardRef<HTMLButtonElement, UIButtonProps>(function Button(
  {
    className,
    variant = "primary",
    size = "md",
    isLoading,
    disabled,
    children,
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      className={cn(
        "ui-button",
        `ui-button-${variant}`,
        `ui-button-${size}`,
        base,
        sizes[size],
        variants[variant],
        className
      )}
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
});
