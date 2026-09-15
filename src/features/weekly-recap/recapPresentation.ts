import type { LineupPlayer } from "../league-history/analytics/lineupOptimizer";
import { positionColorKey } from "../../ui/positionColors";

export type RecapText = { type: "text"; text: string } | { type: "player"; text: string; playerId: string };
export type RivalryMeeting = { season: number; week: number; scoreA: number; scoreB: number };
export type RivalryGraphic = {
  winsA: number; winsB: number; ties: number; seasons: number[]; meetings: RivalryMeeting[];
  streak: { teamId: string; count: number } | null;
};

// Slot identity is not player eligibility. Keep Superflex and restricted flex
// lanes distinct even though they share the canonical FLEX color.
export function recapSlotLabel(value: string) {
  const slot = value.trim().toUpperCase().replace(/\d+$/u, "");
  if (["SUPER_FLEX", "SUPERFLEX", "SFLEX", "OP", "Q/W/R/T"].includes(slot)) return "SFLEX";
  if (["REC_FLEX", "REC FLEX"].includes(slot)) return "REC FLEX";
  if (["WRRB_FLEX", "W/R", "WR/RB"].includes(slot)) return "WR/RB";
  return (positionColorKey(slot) ?? slot).toUpperCase();
}

export function recordedStarterSlots(slots: string[]) {
  return slots.filter((slot) => !["BN", "BENCH", "IR", "INJURED_RESERVE", "RESERVE", "TAXI", "TAXI_SQUAD"].includes(slot.trim().toUpperCase()));
}

// References are inserted while writing, never guessed by searching names in
// finished prose. This also distinguishes two players with the same name.
export function playerReference(player: Pick<LineupPlayer, "providerPlayerId" | "playerName">) {
  return `\uE000${encodeURIComponent(JSON.stringify([player.providerPlayerId, player.playerName]))}\uE001`;
}

export function resolveRecapText(value: string): RecapText[] {
  const result: RecapText[] = [];
  let cursor = 0;
  for (const match of value.matchAll(/\uE000([^\uE001]+)\uE001/gu)) {
    if (match.index > cursor) result.push({ type: "text", text: value.slice(cursor, match.index) });
    const [playerId, name] = JSON.parse(decodeURIComponent(match[1]!)) as [string, string];
    result.push({ type: "player", text: name, playerId });
    cursor = match.index + match[0].length;
  }
  if (cursor < value.length) result.push({ type: "text", text: value.slice(cursor) });
  return result;
}
