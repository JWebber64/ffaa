import { cn } from "../ui/cn";

export function AuctionPhraseBanner({ phrase }: { phrase: string | null }) {
  if (!phrase) return null;

  return (
    <div className="rounded-xl border border-[rgba(124,58,237,0.35)] bg-[linear-gradient(135deg,rgba(124,58,237,0.18),rgba(34,211,238,0.10))] shadow-s2 p-4 sm:p-5 transition-all duration-300">
      <div className={cn(
        "text-[20px] sm:text-[24px] font-semibold text-fg0 tracking-wide",
        "animate-[fadeIn_300ms_ease]"
      )}>
        {phrase}
      </div>
    </div>
  );
}
