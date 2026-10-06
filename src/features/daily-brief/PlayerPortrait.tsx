import { useState } from "react";
import type { BriefEdition, Observation } from "./model";

export function PlayerPortrait({ player, edition }: { player: Observation; edition: BriefEdition }) {
  const [failedUrl, setFailedUrl] = useState("");
  const year = Number(player.date.slice(0, 4));
  const seasonStart = Number(player.date.slice(5, 7)) >= 7 ? year : year - 1;
  const espnId = edition.rostership?.find(row => row.platform === "espn")?.entries.find(row => row.id === player.id)?.providerId;
  const url = edition.sport === "hockey" && /^\d{7}$/.test(player.id) && /^[A-Z]{2,3}$/.test(player.team)
    ? `https://assets.nhle.com/mugs/nhl/${seasonStart}${seasonStart + 1}/${player.team}/${player.id}.png`
    : edition.sport === "football" && espnId && /^\d+$/.test(espnId)
      ? `https://a.espncdn.com/i/headshots/nfl/players/full/${espnId}.png` : null;
  return <span className="brief-portrait" aria-hidden="true">
    {url && url !== failedUrl ? <img src={url} alt="" loading="lazy" decoding="async" onError={() => setFailedUrl(url)} />
      : <span>{player.name.split(/\s+/).filter(Boolean).map(part => part[0]).slice(0, 2).join("")}</span>}
  </span>;
}
