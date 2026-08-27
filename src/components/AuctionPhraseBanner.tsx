import { cn } from "../ui/cn";

export function AuctionPhraseBanner({ phrase }: { phrase: string | null }) {
  if (!phrase) return null;

  return (
    <div className="rounded-2xl border border-[rgba(16,185,129,0.35)] bg-[linear-gradient(135deg,rgba(16,185,129,0.18),color-mix(in oklch, var(--green-400) 12%, transparent),color-mix(in oklch, var(--green-400) 8%, transparent))] shadow-[0_18px_60px_rgba(0,0,0,0.35)] p-4 sm:p-5 transition-all duration-300">
      <div className={cn(
        "text-[20px] sm:text-[24px] font-semibold text-fg0 tracking-wide",
        "animate-[fadeIn_300ms_ease]"
      )}>
        {phrase}
      </div>
    </div>
  );
}
