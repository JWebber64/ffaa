import { cn } from "@/ui/cn";
import { getPositionRgb } from "@/components/roster/positionColors";

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
  const rgbString = getPositionRgb(slot);
  const rgbParts = rgbString.split(',').map(s => parseInt(s.trim()));
  const rgb = rgbParts.length === 3 ? { r: rgbParts[0], g: rgbParts[1], b: rgbParts[2] } : null;
  const edge = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.55)` : "rgba(255,255,255,0.18)";
  const glow = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.18)` : "rgba(255,255,255,0.06)";

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
