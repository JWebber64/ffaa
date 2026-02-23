import { cn } from "@/ui/cn";

type AssignedPlayer = {
  name: string;
  price?: number;
  meta?: string; // optional (NFL team, etc.)
};

export function SlotTile({
  slot,
  assigned,
  className,
}: {
  slot: string;
  assigned?: AssignedPlayer | null;
  className?: string;
}) {
  // Use fallback colors that match tokens.css values for universal color system
  const fallbackColors = {
    qb: "rgba(59, 130, 246, 0.55)",
    rb: "rgba(22, 163, 74, 0.55)", 
    wr: "rgba(16, 185, 129, 0.55)",
    te: "rgba(217, 119, 6, 0.55)",
    flex: "rgba(8, 145, 178, 0.55)",
    k: "rgba(190, 18, 60, 0.55)",
    dst: "rgba(194, 65, 12, 0.55)"
  };
  
  const edge = fallbackColors[slot.toLowerCase() as keyof typeof fallbackColors] || "rgba(255,255,255,0.18)";
  const glow = fallbackColors[slot.toLowerCase() as keyof typeof fallbackColors]?.replace('0.55', '0.18') || "rgba(255,255,255,0.06)";

  return (
    <div
      className={cn(
        "relative rounded-md border bg-[rgba(255,255,255,0.03)] px-2 py-1.5",
        "text-[11px] leading-tight",
        className
      )}
      style={{
        borderColor: edge,
        boxShadow: `0 0 0 1px ${glow} inset`,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold text-fg0">{slot}</div>
        {assigned?.price != null ? (
          <div className="font-mono text-fg2">${assigned.price}</div>
        ) : (
          <div className="text-fg3">—</div>
        )}
      </div>

      {assigned?.name ? (
        <div className="mt-1 truncate text-fg1" title={assigned.name}>
          {assigned.name}
          {assigned.meta ? <span className="text-fg3"> • {assigned.meta}</span> : null}
        </div>
      ) : (
        <div className="mt-1 truncate text-fg3" title="Empty">
          Empty
        </div>
      )}
    </div>
  );
}
