import { cn } from "./cn";

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-[rgba(255,255,255,0.10)]", className)} />;
}
