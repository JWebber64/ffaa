import { useEffect, useMemo, useState } from "react";
import { cn } from "@/ui/cn";
import { appUrl } from "@/lib/appBasePath";
import { normalizeTeamAbbr } from "./teamMarkUtils";

const missingAssetKeys = new Set<string>();

function getInitialAssetSrc(team: string) {
  if (!team || team === "FA") return null;
  if (!missingAssetKeys.has(`${team}:svg`)) return appUrl(`teams/${team}.svg`);
  if (!missingAssetKeys.has(`${team}:png`)) return appUrl(`teams/${team}.png`);
  return null;
}

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
  const normalizedTeam = useMemo(() => normalizeTeamAbbr(team), [team]);
  const [assetSrc, setAssetSrc] = useState<string | null>(() => getInitialAssetSrc(normalizedTeam));

  useEffect(() => {
    setAssetSrc(getInitialAssetSrc(normalizedTeam));
  }, [normalizedTeam]);

  if (!normalizedTeam) return null;

  const label = title ?? `${normalizedTeam} team`;

  return (
    <span
      className={cn("team-mark", `team-mark-${size}`, className)}
      title={label}
      aria-label={label}
    >
      <span className="team-mark-frame" aria-hidden="true">
        {assetSrc ? (
          <img
            className="team-mark-image"
            src={assetSrc}
            alt=""
            loading="lazy"
            onError={() => {
              if (assetSrc.endsWith(".svg")) {
                missingAssetKeys.add(`${normalizedTeam}:svg`);
                setAssetSrc(appUrl(`teams/${normalizedTeam}.png`));
              } else {
                missingAssetKeys.add(`${normalizedTeam}:png`);
                setAssetSrc(null);
              }
            }}
          />
        ) : (
          <span className="team-mark-code">{normalizedTeam}</span>
        )}
      </span>
      {showLabel ? <span className="team-mark-label">{normalizedTeam}</span> : null}
    </span>
  );
}
