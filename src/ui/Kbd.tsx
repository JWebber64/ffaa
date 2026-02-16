import React from "react";
import { cn } from "./cn";

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-stroke bg-[rgba(255,255,255,0.04)] px-2 py-1 text-[12px] text-fg1",
        className
      )}
    >
      {children}
    </span>
  );
}
