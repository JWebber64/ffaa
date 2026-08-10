import { cn } from "@/ui/cn";

type AssignedPlayer = {
  name: string;
  price?: number;
  meta?: string; // optional (NFL team, etc.)
};

function getPlayerNameParts(name: string | null | undefined) {
  return String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((part) => {
      if (!part.includes("-") || part.length < 10) return [part];
      const segments = part.split("-").filter(Boolean);
      return segments.map((segment, index) => (index < segments.length - 1 ? `${segment}-` : segment));
    });
}

function getPlayerNameSizeClass(parts: string[]) {
  const longestPart = parts.reduce((longest, part) => Math.max(longest, part.length), 0);
  const totalLength = parts.join("").length;

  if (longestPart >= 12 || totalLength >= 20) return "text-[8px]";
  if (longestPart >= 10 || totalLength >= 17) return "text-[9px]";
  if (longestPart >= 8 || totalLength >= 14) return "text-[10px]";
  return "text-[11px]";
}

function getMetaParts(meta: string | null | undefined) {
  const parts = String(meta ?? "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 2 && /^b\d+$/i.test(parts[1] ?? "")) {
    return [parts[0], "bye", parts[1]!.slice(1)];
  }

  const byeMatch = parts.length === 2 ? parts[1]?.match(/^bye\s+(\d+)$/i) : null;
  if (byeMatch?.[1]) {
    return [parts[0], "bye", byeMatch[1]];
  }

  return parts;
}

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
  const nameParts = assigned?.name ? getPlayerNameParts(assigned.name) : [];
  const metaParts = assigned?.meta ? getMetaParts(assigned.meta) : [];

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
      {assigned?.name ? (
        <div
          className={cn(
            "grid items-center gap-2",
            metaParts.length > 0
              ? "grid-cols-[34px_minmax(0,1fr)_28px]"
              : "grid-cols-[34px_minmax(0,1fr)]"
          )}
        >
          <div className="grid gap-0.5">
            <div className="font-semibold text-fg0">{slot}</div>
            <div className="font-mono text-fg2">${assigned.price ?? 0}</div>
          </div>
          <div
            className={cn(
              "descender-safe-text grid min-w-0 max-w-full content-center overflow-hidden whitespace-normal break-normal font-semibold text-fg1",
              getPlayerNameSizeClass(nameParts)
            )}
            title={assigned.name}
          >
            {nameParts.map((part, index) => (
              <span key={`${part}-${index}`} className="block max-w-full overflow-hidden whitespace-nowrap">
                {part}
              </span>
            ))}
          </div>
          {metaParts.length > 0 ? (
            <div className="descender-safe-text grid w-[28px] max-w-[28px] content-center justify-items-end overflow-hidden text-right text-[8px] uppercase text-fg3">
              {metaParts.map((part) => (
                <div key={part} className="max-w-full overflow-hidden whitespace-nowrap">
                  {part}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="grid grid-cols-[34px_minmax(0,1fr)] items-center gap-2">
          <div className="grid gap-0.5">
            <div className="font-semibold text-fg0">{slot}</div>
            <div className="text-fg3">-</div>
          </div>
          <div className="truncate text-fg3" title="Empty">
            Empty
          </div>
        </div>
      )}
    </div>
  );
}
