import { collection, doc, getDoc, getDocs, onSnapshot, type Unsubscribe } from "firebase/firestore";

import { firestore } from "../../lib/firebase";
import { normalizeSeasonTeam } from "../league-membership/leaguePeople";
import type { NativeDraft, NativeDraftSelection, NativeDraftTeamState, SeasonTeam } from "../league-domain/types";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function records(value: unknown) {
  return Array.isArray(value) ? value.map(record) : [];
}

function strings(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string" && Boolean(entry.trim())) : [];
}

function normalizeSelection(value: unknown): NativeDraftSelection | null {
  const data = record(value);
  const source = text(data.source);
  const playerId = text(data.player_id);
  const franchiseId = text(data.franchise_id);
  if (!playerId || !franchiseId || !["pick", "autopick", "auction"].includes(source)) return null;
  return {
    id: text(data.id),
    playerId,
    franchiseId,
    overallPick: Math.max(1, numberValue(data.overall_pick, 1)),
    round: Math.max(1, numberValue(data.round, 1)),
    price: Math.max(0, numberValue(data.price)),
    rosterTransactionId: text(data.roster_transaction_id),
    selectedAt: text(data.selected_at),
    source: source as NativeDraftSelection["source"],
  };
}

function normalizeTeamState(value: unknown): NativeDraftTeamState | null {
  const data = record(value);
  const franchiseId = text(data.franchise_id);
  if (!franchiseId) return null;
  return {
    franchiseId,
    budget: Math.max(0, numberValue(data.budget)),
    spent: Math.max(0, numberValue(data.spent)),
    picks: Math.max(0, numberValue(data.picks)),
  };
}

export function normalizeNativeDraft(value: unknown, leagueId: string, seasonId: string, expectedId = ""): NativeDraft | null {
  const data = record(value);
  const id = text(data.id);
  const format = text(data.format);
  const mode = text(data.mode);
  const status = text(data.status);
  if (!id || (expectedId && id !== expectedId) || text(data.league_id) !== leagueId || text(data.season_id) !== seasonId) return null;
  if (!["auction", "snake", "linear", "third_round_reversal"].includes(format) || !["live", "slow"].includes(mode) || !["lobby", "live", "paused", "complete"].includes(status)) return null;
  const auction = record(data.auction_state);
  const queues = Object.fromEntries(Object.entries(record(data.queues)).map(([franchiseId, value]) => [franchiseId, strings(value)]));
  return {
    id,
    leagueId,
    seasonId,
    settingsVersionId: text(data.settings_version_id),
    format: format as NativeDraft["format"],
    mode: mode as NativeDraft["mode"],
    status: status as NativeDraft["status"],
    revision: Math.max(1, numberValue(data.revision, 1)),
    seasonRevision: Math.max(1, numberValue(data.season_revision, 1)),
    orderFranchiseIds: strings(data.order_franchise_ids),
    rosterSize: Math.max(1, numberValue(data.roster_size, 1)),
    pickSeconds: Math.max(1, numberValue(data.pick_seconds, 60)),
    nominationSeconds: Math.max(1, numberValue(data.nomination_seconds, 30)),
    bidSeconds: Math.max(1, numberValue(data.bid_seconds, 10)),
    antiSnipeSeconds: Math.max(0, numberValue(data.anti_snipe_seconds)),
    minimumBid: Math.max(1, numberValue(data.minimum_bid, 1)),
    auctionBudget: Math.max(0, numberValue(data.auction_budget)),
    spectatorEnabled: Boolean(data.spectator_enabled),
    spectatorCode: text(data.spectator_code),
    teamStates: records(data.team_states).map(normalizeTeamState).filter((entry): entry is NativeDraftTeamState => Boolean(entry)),
    selections: records(data.selections).map(normalizeSelection).filter((entry): entry is NativeDraftSelection => Boolean(entry)),
    queues,
    overallPick: Math.max(1, numberValue(data.overall_pick, 1)),
    currentFranchiseId: text(data.current_franchise_id) || null,
    currentDeadlineAt: text(data.current_deadline_at) || null,
    auctionState: text(auction.player_id) ? {
      playerId: text(auction.player_id),
      nominatedByFranchiseId: text(auction.nominated_by_franchise_id),
      highBidderFranchiseId: text(auction.high_bidder_franchise_id),
      currentBid: Math.max(0, numberValue(auction.current_bid)),
      startedAt: text(auction.started_at),
      endsAt: text(auction.ends_at),
    } : null,
    createdAt: text(data.created_at),
    startedAt: text(data.started_at) || null,
    completedAt: text(data.completed_at) || null,
    updatedAt: text(data.updated_at),
  };
}

export async function getNativeDraft(leagueId: string, seasonId: string, draftId: string) {
  if (!leagueId || !seasonId || !draftId) return null;
  const snapshot = await getDoc(doc(firestore, "leagues", leagueId, "seasons", seasonId, "drafts", draftId));
  return snapshot.exists() ? normalizeNativeDraft(snapshot.data(), leagueId, seasonId, draftId) : null;
}

export function subscribeNativeDraft(
  leagueId: string,
  seasonId: string,
  draftId: string,
  onDraft: (draft: NativeDraft | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(firestore, "leagues", leagueId, "seasons", seasonId, "drafts", draftId),
    (snapshot) => onDraft(snapshot.exists() ? normalizeNativeDraft(snapshot.data(), leagueId, seasonId, draftId) : null),
    (error) => onError?.(error instanceof Error ? error : new Error(String(error))),
  );
}

export function subscribeNativeDraftShare(
  shareToken: string,
  onDraft: (draft: NativeDraft | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(firestore, "nativeDraftShares", shareToken),
    (snapshot) => {
      if (!snapshot.exists()) {
        onDraft(null);
        return;
      }
      const data = record(snapshot.data());
      onDraft(normalizeNativeDraft(data.state, text(data.league_id), text(data.season_id), text(data.draft_id)));
    },
    (error) => onError?.(error instanceof Error ? error : new Error(String(error))),
  );
}

export async function listNativeDraftTeams(leagueId: string, seasonId: string): Promise<SeasonTeam[]> {
  const snapshot = await getDocs(collection(firestore, "leagues", leagueId, "seasons", seasonId, "seasonTeams"));
  return snapshot.docs
    .map((entry) => normalizeSeasonTeam(entry.data(), leagueId, seasonId))
    .filter((entry): entry is SeasonTeam => entry !== null && entry.status === "active")
    .sort((left, right) => (left.draftPosition ?? Number.MAX_SAFE_INTEGER) - (right.draftPosition ?? Number.MAX_SAFE_INTEGER));
}
