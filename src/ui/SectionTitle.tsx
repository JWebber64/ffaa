import React from "react";
import { cn } from "./cn";

export function SectionTitle({
  title,
  subtitle,
  right,
  className,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div>
        <div className="text-[18px] font-semibold text-fg0 leading-6">{title}</div>
        {subtitle ? <div className="mt-1 text-sm text-fg2">{subtitle}</div> : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}
