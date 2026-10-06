import { useState } from "react";
import type { BriefEdition } from "./model";
import { teamLogoUrl } from "./teamLogos";
export function TeamLogo({ team, sport }: { team: string; sport: BriefEdition["sport"] }) {
  const [failedUrl, setFailedUrl] = useState("");
  const url = teamLogoUrl(team, sport);
  return <span className="brief-team-logo" aria-hidden="true">{url && url !== failedUrl ? <img src={url} alt="" loading="lazy" decoding="async" width="28" height="28" onError={() => setFailedUrl(url)} /> : null}</span>;
}
