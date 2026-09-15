import { useState } from "react";
import { UserRound } from "lucide-react";
import { TeamMark } from "../../components/player/TeamMark";
import { PositionBadge } from "../../ui/PositionBadge";
import { cn } from "../../ui/cn";
import { PlayerProfileButton } from "../player-profile/PlayerProfileProvider";
import type { ToolScoring } from "../../data/toolPlayerData";
import type { RecapPlayer as Player } from "./matchupRecap";
import type { RecapText } from "./recapPresentation";

export function RecapPortrait({ player, large = false }: { player: Player; large?: boolean }) {
  const [failedUrl, setFailedUrl] = useState("");
  const src = player.headshotUrl;
  return <span className={cn("recap-portrait", large && "recap-portrait-large")}>
    {src && failedUrl !== src ? <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailedUrl(src)} /> : <UserRound aria-hidden="true" />}
    <span className="recap-portrait-helmet"><TeamMark team={player.nflTeam} size={large ? "sm" : "xs"} /></span>
  </span>;
}

export function RecapPlayerLink({ player, week, scoring, portrait = true, large = false }: { player: Player; week: number; scoring: ToolScoring; portrait?: boolean; large?: boolean }) {
  return <PlayerProfileButton className={cn("recap-player-link", large && "recap-player-feature")} scoring={scoring}
    player={{ sleeperId: player.providerPlayerId, name: player.playerName, position: player.position, team: player.nflTeam, weeklyActualPoints: player.fantasyPoints, weeklyActualPointsWeek: week }}>
    {portrait ? <RecapPortrait player={player} large={large} /> : null}<span>{player.playerName}{large ? <span className="recap-player-meta"><PositionBadge position={player.position} /> {player.nflTeam || "Team unavailable"}</span> : null}</span>
  </PlayerProfileButton>;
}

export function RecapProse({ paragraphs, players, week, scoring }: { paragraphs: RecapText[][]; players: Player[]; week: number; scoring: ToolScoring }) {
  const byId = new Map(players.map((player) => [player.providerPlayerId, player]));
  const seen = new Set<string>();
  return <>{paragraphs.map((paragraph, index) => <p key={index}>{paragraph.map((part, partIndex) => {
    if (part.type === "text") return part.text;
    const player = byId.get(part.playerId);
    if (!player) return part.text;
    const first = !seen.has(part.playerId);
    seen.add(part.playerId);
    return <RecapPlayerLink key={`${part.playerId}/${partIndex}`} player={player} week={week} scoring={scoring} portrait={first} />;
  })}</p>)}</>;
}
