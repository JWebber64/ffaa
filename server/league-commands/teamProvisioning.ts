import type { FirestoreWrite } from "../league-history/firestoreRest";
import type { LeagueSettingsV1 } from "../../shared/leagueSettings";
import {
  createOnlyWrite,
  deriveGamehqUuid,
  LeagueCommandFailure,
  replaceWrite,
  text,
  wholeNumber,
} from "./commandSupport";
import type { LeagueCommandStore, LeagueCommandStoredDocument } from "./store";

function teamPath(leagueId: string, seasonId: string, franchiseId: string) {
  return `leagues/${leagueId}/seasons/${seasonId}/seasonTeams/${franchiseId}`;
}

function franchisePath(leagueId: string, franchiseId: string) {
  return `leagues/${leagueId}/franchises/${franchiseId}`;
}

function activeTeam(document: LeagueCommandStoredDocument) {
  return text(document.data.status) !== "retired";
}

function draftPosition(document: LeagueCommandStoredDocument) {
  return wholeNumber(document.data.draft_position, Number.MAX_SAFE_INTEGER);
}

function teamBudget(settings: LeagueSettingsV1) {
  return settings.draft.format === "auction"
    ? { initial: settings.draft.auctionBudget, remaining: settings.draft.auctionBudget, currency: "USD" }
    : {};
}

export async function reconcileSeasonTeams(input: {
  store: LeagueCommandStore;
  leagueId: string;
  seasonId: string;
  settings: LeagueSettingsV1;
  actorUserId: string;
  commandId: string;
  processedAt: string;
}) {
  const { store, leagueId, seasonId, settings, actorUserId, commandId, processedAt } = input;
  const [teamDocuments, grantDocuments, invitationDocuments] = await Promise.all([
    store.list(`leagues/${leagueId}/seasons/${seasonId}/seasonTeams`),
    store.list(`leagues/${leagueId}/roleGrants`),
    store.list(`leagues/${leagueId}/invitations`),
  ]);
  const activeTeams = teamDocuments.filter(activeTeam).sort((left, right) => draftPosition(left) - draftPosition(right));
  const retiredTeams = teamDocuments.filter((document) => !activeTeam(document)).sort((left, right) => draftPosition(left) - draftPosition(right));
  const writes: FirestoreWrite[] = [];
  let createdCount = 0;
  let restoredCount = 0;
  let retiredCount = 0;

  if (activeTeams.length > settings.teamCount) {
    const retiring = [...activeTeams].sort((left, right) => draftPosition(right) - draftPosition(left)).slice(0, activeTeams.length - settings.teamCount);
    const retiringIds = new Set(retiring.map((document) => text(document.data.franchise_id) || text(document.data.id)));
    const assigned = grantDocuments.some((document) => retiringIds.has(text(document.data.franchise_id)) && !text(document.data.revoked_at));
    const invited = invitationDocuments.some((document) => retiringIds.has(text(document.data.franchise_id)) && text(document.data.status) === "pending");
    if (assigned || invited) {
      throw new LeagueCommandFailure(
        "team_count_in_use",
        "Remove managers and pending invitations from the highest-numbered teams before reducing the league size.",
        409,
      );
    }
    for (const team of retiring) {
      const franchiseId = text(team.data.franchise_id) || text(team.data.id);
      const franchise = await store.get(franchisePath(leagueId, franchiseId));
      writes.push(replaceWrite(store, team, teamPath(leagueId, seasonId, franchiseId), {
        ...team.data,
        status: "retired",
        updated_at: processedAt,
      }));
      if (franchise) {
        writes.push(replaceWrite(store, franchise, franchisePath(leagueId, franchiseId), {
          ...franchise.data,
          retired_at: processedAt,
        }));
      }
      retiredCount += 1;
    }
  }

  const needed = Math.max(0, settings.teamCount - activeTeams.length);
  const restorable = retiredTeams.slice(0, needed);
  for (const team of restorable) {
    const franchiseId = text(team.data.franchise_id) || text(team.data.id);
    const franchise = await store.get(franchisePath(leagueId, franchiseId));
    writes.push(replaceWrite(store, team, teamPath(leagueId, seasonId, franchiseId), {
      ...team.data,
      status: "active",
      budget: teamBudget(settings),
      updated_at: processedAt,
    }));
    if (franchise) {
      writes.push(replaceWrite(store, franchise, franchisePath(leagueId, franchiseId), {
        ...franchise.data,
        retired_at: "",
      }));
    }
    restoredCount += 1;
  }

  const remaining = needed - restorable.length;
  const usedPositions = teamDocuments.map(draftPosition).filter(Number.isFinite);
  let nextPosition = usedPositions.length ? Math.max(...usedPositions) + 1 : 1;
  for (let index = 0; index < remaining; index += 1) {
    const position = nextPosition;
    nextPosition += 1;
    const franchiseId = deriveGamehqUuid(actorUserId, `${commandId}:team:${position}`, "franchise");
    writes.push(
      createOnlyWrite(store, franchisePath(leagueId, franchiseId), {
        schema_version: 1,
        id: franchiseId,
        league_id: leagueId,
        created_at: processedAt,
        retired_at: "",
        legacy_franchise_id: "",
      }),
      createOnlyWrite(store, teamPath(leagueId, seasonId, franchiseId), {
        schema_version: 1,
        id: franchiseId,
        league_id: leagueId,
        season_id: seasonId,
        franchise_id: franchiseId,
        name: `Team ${position}`,
        logo_url: "",
        colors: { primary: "", secondary: "" },
        division_id: "",
        draft_position: position,
        budget: teamBudget(settings),
        cap: {},
        roster_revision: 1,
        roster_player_ids: [],
        status: "active",
        created_at: processedAt,
        updated_at: processedAt,
      }),
    );
    createdCount += 1;
  }

  return {
    writes,
    activeCount: settings.teamCount,
    createdCount,
    restoredCount,
    retiredCount,
  };
}
