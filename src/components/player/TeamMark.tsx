import type { CSSProperties } from "react";
import { cn } from "@/ui/cn";
import { getNflTeamCssVars } from "@/data/nflTeamBrand";
import { normalizeTeamAbbr } from "./teamMarkUtils";

export function TeamMark({
  team,
  size = "sm",
  showLabel = false,
  className,
  title,
}: {
  team: string | null | undefined;
  size?: "xs" | "sm" | "md";
  showLabel?: boolean;
  className?: string;
  title?: string;
}) {
  const normalizedTeam = normalizeTeamAbbr(team);

  if (!normalizedTeam) return null;

  const label = title ?? `${normalizedTeam} team`;
  const teamStyle = getNflTeamCssVars(normalizedTeam) as CSSProperties;

  return (
    <span
      className={cn("team-mark", `team-mark-${size}`, className)}
      data-team={normalizedTeam || "FA"}
      style={teamStyle}
      title={label}
      aria-label={label}
    >
      <span className="team-mark-frame" aria-hidden="true">
        <span className="team-mark-code">{normalizedTeam}</span>
      </span>
      {showLabel ? <span className="team-mark-label">{normalizedTeam}</span> : null}
    </span>
  );
}
