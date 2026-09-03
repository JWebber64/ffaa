import type { ToolPlayer, ToolScoring } from "@/data/toolPlayerData";
import {
  DEFAULT_TEAM_RATER_SLOTS,
  type TeamRaterSettings,
  type TeamRaterSlot,
  type TeamRaterSlotPosition,
} from "@/data/teamRater";
import type { SleeperLeagueConnectionSummary } from "@/features/league-hq/sleeperConnections";

const SLEEPER_API = "https://api.sleeper.app/v1";
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

type SleeperLeague = {
  league_id?: string;
  name?: string;
  total_rosters?: number;
  roster_positions?: string[];
  scoring_settings?: Record<string, unknown>;
};

type SleeperRoster = {
  owner_id?: string | null;
  co_owners?: string[] | null;
  players?: string[] | null;
  reserve?: string[] | null;
  taxi?: string[] | null;
};

export type CurrentTeamRaterData = {
  leagueId: string;
  leagueName: string;
  teamName: string;
  players: ToolPlayer[];
  providerRosterSize: number;
  unmatchedPlayerCount: number;
  reservePlayerCount: number;
  settings: TeamRaterSettings;
  loadedAt: string;
};

function positiveInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
}

function normalizeSlot(value: string): TeamRaterSlotPosition | null {
  const normalized = value.trim().toUpperCase().replace(/[^A-Z]+/g, "_");
  if (normalized === "BN" || normalized === "BENCH") return "BENCH";
  if (normalized === "DST" || normalized === "D_ST" || normalized === "DEF") return "DEF";
  if (normalized === "SUPER_FLEX" || normalized === "SUPERFLEX" || normalized === "OP") return "SUPERFLEX";
  if (["FLEX", "RB_WR_TE", "WR_RB", "WR_TE", "REC_FLEX", "WRRB_FLEX"].includes(normalized)) return "FLEX";
  if (["QB", "RB", "WR", "TE", "K"].includes(normalized)) return normalized as TeamRaterSlotPosition;
  return null;
}

export function teamRaterSlotsFromSleeper(
  rosterSlots: ReadonlyArray<{ slot: string; count: number }>,
  providerRosterSize = 0,
): TeamRaterSlot[] {
  const counts = new Map<TeamRaterSlotPosition, number>();
  for (const entry of rosterSlots) {
    const position = normalizeSlot(entry.slot);
    const count = positiveInteger(entry.count);
    if (!position || !count) continue;
    counts.set(position, (counts.get(position) ?? 0) + count);
  }

  const configuredSize = [...counts.values()].reduce((sum, count) => sum + count, 0);
  if (providerRosterSize > configuredSize) {
    counts.set("BENCH", (counts.get("BENCH") ?? 0) + providerRosterSize - configuredSize);
  }

  const slots = SLOT_ORDER.map((position) => ({ position, count: counts.get(position) ?? 0 }));
  return slots.some((slot) => slot.count > 0)
    ? slots
    : DEFAULT_TEAM_RATER_SLOTS.map((slot) => ({ ...slot }));
}

function scoringFromLeague(scoring: Record<string, unknown> | undefined, fallback: ToolScoring) {
  const receptions = Number(scoring?.rec);
  if (!Number.isFinite(receptions)) return fallback;
  if (receptions >= 0.75) return "ppr";
  if (receptions >= 0.25) return "halfPpr";
  return "standard";
}

export function teamRaterSettingsFromConnection(
  connection: SleeperLeagueConnectionSummary | null,
): TeamRaterSettings {
  const settings = connection?.auctionSettings;
  return {
    scoring: settings?.scoring ?? "ppr",
    teamCount: settings?.teamCount || connection?.totalRosters || 12,
    slots: settings?.rosterSlots?.length
      ? teamRaterSlotsFromSleeper(settings.rosterSlots)
      : DEFAULT_TEAM_RATER_SLOTS.map((slot) => ({ ...slot })),
  };
}

async function sleeperJson<T>(path: string, signal: AbortSignal, fetcher: typeof fetch) {
  const response = await fetcher(`${SLEEPER_API}${path}`, { signal });
  if (!response.ok) throw new Error(`Sleeper returned ${response.status} while loading the current team.`);
  return response.json() as Promise<T>;
}

export async function loadCurrentTeamForRater(
  connection: SleeperLeagueConnectionSummary,
  players: ToolPlayer[],
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<CurrentTeamRaterData> {
  const managerId = connection.managerProviderUserId?.trim();
  if (!managerId) {
    throw new Error("Choose your Sleeper team identity before rating the current team.");
  }

  const [league, rosters] = await Promise.all([
    sleeperJson<SleeperLeague>(`/league/${connection.leagueId}`, signal, fetcher),
    sleeperJson<SleeperRoster[]>(`/league/${connection.leagueId}/rosters`, signal, fetcher),
  ]);
  const roster = rosters.find((candidate) => (
    candidate.owner_id === managerId || candidate.co_owners?.includes(managerId)
  ));
  if (!roster) {
    throw new Error(`${connection.managerDisplayName ?? "Your Sleeper account"} does not own a roster in this league.`);
  }

  const providerPlayerIds = [...new Set((roster.players ?? []).filter((id) => id && id !== "0"))];
  const playerByProviderId = new Map<string, ToolPlayer>();
  for (const player of players) {
    playerByProviderId.set(player.id, player);
    if (player.sleeperId) playerByProviderId.set(player.sleeperId, player);
  }
  const rosterPlayers = providerPlayerIds.flatMap((id) => playerByProviderId.get(id) ?? []);
  const unmatchedPlayerCount = providerPlayerIds.length - rosterPlayers.length;
  const reserveIds = new Set([...(roster.reserve ?? []), ...(roster.taxi ?? [])]);
  const fallbackSettings = teamRaterSettingsFromConnection(connection);
  const livePositions = league.roster_positions ?? [];
  const rosterSlots = livePositions.map((slot) => ({ slot, count: 1 }));

  return {
    leagueId: league.league_id || connection.leagueId,
    leagueName: league.name?.trim() || connection.leagueName,
    teamName: connection.managerTeamName?.trim()
      || connection.managerDisplayName?.trim()
      || "Current team",
    players: rosterPlayers,
    providerRosterSize: providerPlayerIds.length,
    unmatchedPlayerCount,
    reservePlayerCount: providerPlayerIds.filter((id) => reserveIds.has(id)).length,
    settings: {
      scoring: scoringFromLeague(league.scoring_settings, fallbackSettings.scoring),
      teamCount: positiveInteger(league.total_rosters) || fallbackSettings.teamCount,
      slots: rosterSlots.length
        ? teamRaterSlotsFromSleeper(rosterSlots, providerPlayerIds.length)
        : teamRaterSlotsFromSleeper(
            connection.auctionSettings?.rosterSlots ?? [],
            providerPlayerIds.length,
          ),
    },
    loadedAt: new Date().toISOString(),
  };
}
