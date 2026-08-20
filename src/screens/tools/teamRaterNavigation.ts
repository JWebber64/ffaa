import type { ToolScoring } from "@/data/toolPlayerData";
import type { TeamRaterSlot, TeamRaterSlotPosition } from "@/data/teamRater";

type AuctionBuilderSlot = Exclude<TeamRaterSlotPosition, "SUPERFLEX">;

export interface TeamRaterNavigationState {
  source: "auction-builder";
  rosterIds: string[];
  teamCount: number;
  scoring: ToolScoring;
  slots: TeamRaterSlot[];
}

interface BuildTeamRaterNavigationStateOptions {
  rosterIds: string[];
  teamCount: number;
  scoring: ToolScoring;
  slots: Readonly<Record<AuctionBuilderSlot, number>>;
}

const SLOT_ORDER: TeamRaterSlotPosition[] = [
  "QB",
  "RB",
  "WR",
  "TE",
  "FLEX",
  "SUPERFLEX",
  "K",
  "DEF",
  "BENCH",
];

const SLOT_SET = new Set<TeamRaterSlotPosition>(SLOT_ORDER);
const SCORING_SET = new Set<ToolScoring>(["ppr", "halfPpr", "standard"]);

export function buildTeamRaterNavigationState({
  rosterIds,
  teamCount,
  scoring,
  slots,
}: BuildTeamRaterNavigationStateOptions): TeamRaterNavigationState {
  return {
    source: "auction-builder",
    rosterIds: [...new Set(rosterIds)],
    teamCount,
    scoring,
    slots: SLOT_ORDER.map((position) => ({
      position,
      count: position === "SUPERFLEX" ? 0 : slots[position],
    })),
  };
}

export function readTeamRaterNavigationState(value: unknown): TeamRaterNavigationState | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Partial<TeamRaterNavigationState>;
  if (candidate.source !== "auction-builder") return null;
  if (!Array.isArray(candidate.rosterIds) || !candidate.rosterIds.every((id) => typeof id === "string")) return null;
  if (typeof candidate.teamCount !== "number" || !Number.isFinite(candidate.teamCount)) return null;
  if (!candidate.scoring || !SCORING_SET.has(candidate.scoring)) return null;
  if (!Array.isArray(candidate.slots) || !candidate.slots.every((slot) => (
    slot
    && typeof slot === "object"
    && SLOT_SET.has(slot.position)
    && typeof slot.count === "number"
    && Number.isFinite(slot.count)
  ))) return null;

  return {
    source: "auction-builder",
    rosterIds: [...new Set(candidate.rosterIds)],
    teamCount: candidate.teamCount,
    scoring: candidate.scoring,
    slots: candidate.slots.map((slot) => ({ ...slot })),
  };
}
