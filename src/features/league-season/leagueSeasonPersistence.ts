import {
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
  where,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";

import { ensureFirebaseUserId, ensurePermanentFirebaseUserId } from "../../lib/authSession";
import { firestore } from "../../lib/firebase";
import { normalizeSharedOfflineDraftRecord } from "../offline-draft/offlineDraftSync";
import {
  buildRoundRobinSchedule,
  normalizeLineupAssignments,
  parseLeagueSeasonDraft,
  type LeagueLineupAssignments,
  type LeagueScheduleMatchup,
  type LeagueSeasonDraft,
} from "./leagueSeasonModel";

const LEAGUE_SEASON_VERSION = 1;
const REGULAR_SEASON_WEEKS = 14;

export type FranchiseClaimStatus = "requested" | "approved";

export type FranchiseClaim = {
  leagueId: string;
  franchiseId: string;
  franchiseName: string;
  requestedByUserId: string;
  requestedDisplayName: string;
  status: FranchiseClaimStatus;
  approvedUserId: string;
  requestedAt: string;
  approvedAt: string;
  updatedAt: string;
};

export type PublishedLeagueSeasonRecord = {
  leagueId: string;
  commissionerUserId: string;
  season: LeagueSeasonDraft;
  schedule: LeagueScheduleMatchup[];
  revision: number;
  sourceDraftRevision: number;
  createdAt: string;
  publishedAt: string;
  updatedAt: string;
};

export type ManagerMembership = {
  leagueId: string;
  userId: string;
  franchiseId: string;
  franchiseName: string;
  displayName: string;
  status: FranchiseClaimStatus;
  requestedAt: string;
  approvedAt: string;
  updatedAt: string;
};

export type LeagueSeasonManagementSnapshot = {
  currentUserId: string;
  record: PublishedLeagueSeasonRecord | null;
  claims: FranchiseClaim[];
  membership: ManagerMembership | null;
};

export type SavedLeagueLineup = {
  leagueId: string;
  franchiseId: string;
  week: number;
  weekKey: string;
  seasonRevision: number;
  assignments: LeagueLineupAssignments;
  revision: number;
  updatedByUserId: string;
  createdAt: string;
  updatedAt: string;
};

export type LeagueWeekSettings = {
  leagueId: string;
  week: number;
  weekKey: string;
  locked: boolean;
  updatedByUserId: string;
  createdAt: string;
  updatedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function wholeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : fallback;
}

function normalizeLeagueId(value: string) {
  const leagueId = value.trim();
  if (!/^\d{10,}$/.test(leagueId)) throw new Error("A valid active league is required.");
  return leagueId;
}

function normalizeFranchiseId(value: string) {
  const franchiseId = value.trim();
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(franchiseId)) throw new Error("This franchise id is not supported.");
  return franchiseId;
}

function normalizeManagerName(value: string) {
  const displayName = value.trim().replace(/\s+/g, " ").slice(0, 50);
  if (displayName.length < 2) throw new Error("Enter the manager name the commissioner will recognize.");
  return displayName;
}

function seasonRef(leagueId: string) {
  return doc(firestore, "leagueSeasons", normalizeLeagueId(leagueId));
}

function claimsRef(leagueId: string) {
  return collection(firestore, "leagueSeasons", normalizeLeagueId(leagueId), "franchiseClaims");
}

function membershipsRef(leagueId: string) {
  return collection(firestore, "leagueSeasons", normalizeLeagueId(leagueId), "managerMemberships");
}

function membershipRef(leagueId: string, userId: string) {
  return doc(membershipsRef(leagueId), userId);
}

function claimRef(leagueId: string, franchiseId: string) {
  return doc(claimsRef(leagueId), normalizeFranchiseId(franchiseId));
}

function lineupsRef(leagueId: string) {
  return collection(firestore, "leagueSeasons", normalizeLeagueId(leagueId), "lineups");
}

function weekKey(week: number) {
  return `week-${normalizeWeek(week)}`;
}

function weekSettingsRef(leagueId: string, week: number) {
  return doc(firestore, "leagueSeasons", normalizeLeagueId(leagueId), "weekSettings", weekKey(week));
}

function auditEventsRef(leagueId: string) {
  return collection(firestore, "leagueSeasons", normalizeLeagueId(leagueId), "auditEvents");
}

function lineupRef(leagueId: string, franchiseId: string, week: number) {
  return doc(lineupsRef(leagueId), `${normalizeFranchiseId(franchiseId)}_week_${normalizeWeek(week)}`);
}

function normalizeWeek(value: number) {
  const week = Math.round(Number(value));
  if (!Number.isFinite(week) || week < 1 || week > 18) throw new Error("League week must be between 1 and 18.");
  return week;
}

function normalizeSchedule(value: unknown, season: LeagueSeasonDraft): LeagueScheduleMatchup[] {
  if (!Array.isArray(value)) return [];
  const franchiseIds = new Set(season.franchises.map((franchise) => franchise.id));
  const seen = new Set<string>();
  return value.flatMap((entry): LeagueScheduleMatchup[] => {
    if (!isRecord(entry)) return [];
    const id = text(entry.id);
    const week = wholeNumber(entry.week);
    const homeFranchiseId = text(entry.homeFranchiseId);
    const awayFranchiseId = text(entry.awayFranchiseId);
    if (
      !id || seen.has(id) || week < 1 || week > 18
      || homeFranchiseId === awayFranchiseId
      || !franchiseIds.has(homeFranchiseId)
      || !franchiseIds.has(awayFranchiseId)
    ) return [];
    seen.add(id);
    return [{ id, week, homeFranchiseId, awayFranchiseId }];
  });
}

export function normalizePublishedLeagueSeasonRecord(
  value: unknown,
  expectedLeagueId = "",
): PublishedLeagueSeasonRecord | null {
  if (!isRecord(value) || !isRecord(value.payload)) return null;
  const leagueId = text(value.league_id);
  const commissionerUserId = text(value.commissioner_user_id);
  if (!/^\d{10,}$/.test(leagueId) || !commissionerUserId || (expectedLeagueId && leagueId !== expectedLeagueId)) return null;
  const season = parseLeagueSeasonDraft(value.payload, {
    leagueId,
    source: "published",
    revision: wholeNumber(value.source_draft_revision),
    updatedAt: text(value.updated_at),
  });
  if (!season) return null;
  return {
    leagueId,
    commissionerUserId,
    season,
    schedule: normalizeSchedule(value.schedule, season),
    revision: wholeNumber(value.revision),
    sourceDraftRevision: wholeNumber(value.source_draft_revision),
    createdAt: text(value.created_at),
    publishedAt: text(value.published_at),
    updatedAt: text(value.updated_at),
  };
}

export function normalizeFranchiseClaim(value: unknown, expectedLeagueId = ""): FranchiseClaim | null {
  if (!isRecord(value)) return null;
  const leagueId = text(value.league_id);
  const franchiseId = text(value.franchise_id);
  const status = value.status === "requested" || value.status === "approved" ? value.status : null;
  const approvedUserId = text(value.approved_user_id);
  if (
    !/^\d{10,}$/.test(leagueId)
    || (expectedLeagueId && leagueId !== expectedLeagueId)
    || !/^[A-Za-z0-9_-]{1,100}$/.test(franchiseId)
    || !status
    || !text(value.requested_by_user_id)
    || (status === "approved" && !approvedUserId)
  ) return null;
  return {
    leagueId,
    franchiseId,
    franchiseName: text(value.franchise_name),
    requestedByUserId: text(value.requested_by_user_id),
    requestedDisplayName: text(value.requested_display_name),
    status,
    approvedUserId,
    requestedAt: text(value.requested_at),
    approvedAt: text(value.approved_at),
    updatedAt: text(value.updated_at),
  };
}

export function normalizeManagerMembership(value: unknown, expectedLeagueId = ""): ManagerMembership | null {
  if (!isRecord(value)) return null;
  const leagueId = text(value.league_id);
  const userId = text(value.user_id);
  const franchiseId = text(value.franchise_id);
  const status = value.status === "requested" || value.status === "approved" ? value.status : null;
  if (
    !/^\d{10,}$/.test(leagueId)
    || (expectedLeagueId && leagueId !== expectedLeagueId)
    || !userId
    || !/^[A-Za-z0-9_-]{1,100}$/.test(franchiseId)
    || !status
  ) return null;
  return {
    leagueId,
    userId,
    franchiseId,
    franchiseName: text(value.franchise_name),
    displayName: text(value.display_name),
    status,
    requestedAt: text(value.requested_at),
    approvedAt: text(value.approved_at),
    updatedAt: text(value.updated_at),
  };
}

export function normalizeSavedLeagueLineup(value: unknown, expectedLeagueId = ""): SavedLeagueLineup | null {
  if (!isRecord(value) || !isRecord(value.assignments)) return null;
  const leagueId = text(value.league_id);
  const franchiseId = text(value.franchise_id);
  const week = wholeNumber(value.week);
  if (
    !/^\d{10,}$/.test(leagueId)
    || (expectedLeagueId && leagueId !== expectedLeagueId)
    || !/^[A-Za-z0-9_-]{1,100}$/.test(franchiseId)
    || week < 1 || week > 18
  ) return null;
  const assignments = Object.fromEntries(
    Object.entries(value.assignments).flatMap(([slotKey, playerId]) => {
      const normalizedSlotKey = text(slotKey);
      const normalizedPlayerId = text(playerId);
      return normalizedSlotKey && normalizedPlayerId ? [[normalizedSlotKey, normalizedPlayerId]] : [];
    }),
  );
  return {
    leagueId,
    franchiseId,
    week,
    weekKey: text(value.week_key) || weekKey(week),
    seasonRevision: wholeNumber(value.season_revision),
    assignments,
    revision: wholeNumber(value.revision),
    updatedByUserId: text(value.updated_by_user_id),
    createdAt: text(value.created_at),
    updatedAt: text(value.updated_at),
  };
}

export function normalizeLeagueWeekSettings(value: unknown, expectedLeagueId = ""): LeagueWeekSettings | null {
  if (!isRecord(value)) return null;
  const leagueId = text(value.league_id);
  const week = wholeNumber(value.week);
  const normalizedWeekKey = text(value.week_key);
  if (
    !/^\d{10,}$/.test(leagueId)
    || (expectedLeagueId && leagueId !== expectedLeagueId)
    || week < 1 || week > 18
    || normalizedWeekKey !== weekKey(week)
    || typeof value.locked !== "boolean"
  ) return null;
  return {
    leagueId,
    week,
    weekKey: normalizedWeekKey,
    locked: value.locked,
    updatedByUserId: text(value.updated_by_user_id),
    createdAt: text(value.created_at),
    updatedAt: text(value.updated_at),
  };
}

export async function subscribeToLeagueSeasonManagement(
  leagueIdValue: string,
  onChange: (snapshot: LeagueSeasonManagementSnapshot) => void,
  onError: (error: Error) => void,
): Promise<Unsubscribe> {
  const leagueId = normalizeLeagueId(leagueIdValue);
  const currentUserId = await ensureFirebaseUserId();
  let record: PublishedLeagueSeasonRecord | null = null;
  let claims: FranchiseClaim[] = [];
  let membership: ManagerMembership | null = null;
  let seasonLoaded = false;
  let claimsLoaded = false;
  let membershipLoaded = false;

  const emit = () => {
    if (!seasonLoaded || !claimsLoaded || !membershipLoaded) return;
    const currentFranchiseIds = new Set(record?.season.franchises.map((franchise) => franchise.id) ?? []);
    onChange({
      currentUserId,
      record,
      claims: record ? claims.filter((claim) => currentFranchiseIds.has(claim.franchiseId)) : [],
      membership: membership && currentFranchiseIds.has(membership.franchiseId) ? membership : null,
    });
  };
  const fail = (error: unknown) => onError(error instanceof Error ? error : new Error(String(error)));
  const stopSeason = onSnapshot(seasonRef(leagueId), (snapshot) => {
    if (!snapshot.exists()) record = null;
    else {
      record = normalizePublishedLeagueSeasonRecord(snapshot.data(), leagueId);
      if (!record) {
        fail(new Error("The published league season contains invalid data."));
        return;
      }
    }
    seasonLoaded = true;
    emit();
  }, fail);
  const stopClaims = onSnapshot(claimsRef(leagueId), (snapshot) => {
    claims = snapshot.docs.flatMap((entry) => {
      const claim = normalizeFranchiseClaim(entry.data(), leagueId);
      return claim ? [claim] : [];
    });
    claimsLoaded = true;
    emit();
  }, fail);
  const stopMembership = onSnapshot(membershipRef(leagueId, currentUserId), (snapshot) => {
    membership = snapshot.exists() ? normalizeManagerMembership(snapshot.data(), leagueId) : null;
    membershipLoaded = true;
    emit();
  }, fail);

  return () => {
    stopSeason();
    stopClaims();
    stopMembership();
  };
}

export async function publishLeagueSeason(leagueIdValue: string) {
  const leagueId = normalizeLeagueId(leagueIdValue);
  const currentUserId = await ensurePermanentFirebaseUserId();
  const offlineDraftReference = doc(firestore, "offlineLeagueDrafts", leagueId);
  const publishedReference = seasonRef(leagueId);
  let published: PublishedLeagueSeasonRecord | null = null;

  await runTransaction(firestore, async (transaction) => {
    const [draftSnapshot, seasonSnapshot] = await Promise.all([
      transaction.get(offlineDraftReference),
      transaction.get(publishedReference),
    ]);
    const draftRecord = draftSnapshot.exists()
      ? normalizeSharedOfflineDraftRecord(draftSnapshot.data() as DocumentData, leagueId)
      : null;
    if (!draftRecord) throw new Error("Save the draft to the shared league before publishing the season.");
    if (draftRecord.ownerUserId !== currentUserId) throw new Error("Only the draft owner can publish this league season.");
    const sourceSeason = parseLeagueSeasonDraft(draftRecord.payload, {
      leagueId,
      source: "published",
      revision: draftRecord.revision,
      updatedAt: draftRecord.updatedAt,
    });
    if (!sourceSeason) throw new Error("The saved draft cannot be converted into a league season.");
    const existing = seasonSnapshot.exists()
      ? normalizePublishedLeagueSeasonRecord(seasonSnapshot.data(), leagueId)
      : null;
    if (seasonSnapshot.exists() && !existing) throw new Error("The current published season is invalid and was not overwritten.");
    if (existing && existing.commissionerUserId !== currentUserId) throw new Error("Only the league commissioner can republish this season.");

    const timestamp = new Date().toISOString();
    const schedule = buildRoundRobinSchedule(sourceSeason.franchises, REGULAR_SEASON_WEEKS);
    const nextRecord = {
      version: LEAGUE_SEASON_VERSION,
      league_id: leagueId,
      commissioner_user_id: currentUserId,
      source_draft_revision: draftRecord.revision,
      payload: clone(draftRecord.payload),
      schedule: clone(schedule),
      franchise_ids: sourceSeason.franchises.map((franchise) => franchise.id),
      revision: (existing?.revision ?? 0) + 1,
      created_at: existing?.createdAt || timestamp,
      published_at: timestamp,
      updated_at: timestamp,
    };
    transaction.set(publishedReference, nextRecord);
    published = normalizePublishedLeagueSeasonRecord(nextRecord, leagueId);
  });

  if (!published) throw new Error("The league season could not be published.");
  return published;
}

function requirePublishedFranchise(record: PublishedLeagueSeasonRecord | null, franchiseId: string) {
  const franchise = record?.season.franchises.find((candidate) => candidate.id === franchiseId);
  if (!record || !franchise) throw new Error("This franchise is not part of the published season.");
  return { record, franchise };
}

export async function requestFranchiseClaim(leagueIdValue: string, franchiseIdValue: string, displayNameValue: string) {
  const leagueId = normalizeLeagueId(leagueIdValue);
  const franchiseId = normalizeFranchiseId(franchiseIdValue);
  const requestedDisplayName = normalizeManagerName(displayNameValue);
  const currentUserId = await ensurePermanentFirebaseUserId();
  const reference = claimRef(leagueId, franchiseId);
  const managerReference = membershipRef(leagueId, currentUserId);

  await runTransaction(firestore, async (transaction) => {
    const [seasonSnapshot, claimSnapshot, membershipSnapshot] = await Promise.all([
      transaction.get(seasonRef(leagueId)),
      transaction.get(reference),
      transaction.get(managerReference),
    ]);
    const published = seasonSnapshot.exists()
      ? normalizePublishedLeagueSeasonRecord(seasonSnapshot.data(), leagueId)
      : null;
    const { franchise } = requirePublishedFranchise(published, franchiseId);
    if (claimSnapshot.exists()) throw new Error("This franchise already has a request or approved manager.");
    if (membershipSnapshot.exists()) throw new Error("Each manager can request or control only one franchise in this league.");
    const timestamp = new Date().toISOString();
    const claim = {
      league_id: leagueId,
      franchise_id: franchiseId,
      franchise_name: franchise.displayName,
      requested_by_user_id: currentUserId,
      requested_display_name: requestedDisplayName,
      status: "requested",
      approved_user_id: "",
      requested_at: timestamp,
      approved_at: "",
      updated_at: timestamp,
    };
    transaction.set(reference, claim);
    transaction.set(managerReference, {
      league_id: leagueId,
      user_id: currentUserId,
      franchise_id: franchiseId,
      franchise_name: franchise.displayName,
      display_name: requestedDisplayName,
      status: "requested",
      requested_at: timestamp,
      approved_at: "",
      updated_at: timestamp,
    });
  });
}

export async function assignFranchiseToCommissioner(leagueIdValue: string, franchiseIdValue: string, displayNameValue: string) {
  const leagueId = normalizeLeagueId(leagueIdValue);
  const franchiseId = normalizeFranchiseId(franchiseIdValue);
  const requestedDisplayName = normalizeManagerName(displayNameValue);
  const currentUserId = await ensurePermanentFirebaseUserId();
  const reference = claimRef(leagueId, franchiseId);
  const managerReference = membershipRef(leagueId, currentUserId);

  await runTransaction(firestore, async (transaction) => {
    const [seasonSnapshot, claimSnapshot, membershipSnapshot] = await Promise.all([
      transaction.get(seasonRef(leagueId)),
      transaction.get(reference),
      transaction.get(managerReference),
    ]);
    const published = seasonSnapshot.exists()
      ? normalizePublishedLeagueSeasonRecord(seasonSnapshot.data(), leagueId)
      : null;
    const { record, franchise } = requirePublishedFranchise(published, franchiseId);
    if (record.commissionerUserId !== currentUserId) throw new Error("Only the commissioner can assign a team directly.");
    if (claimSnapshot.exists()) throw new Error("This franchise already has a request or approved manager.");
    if (membershipSnapshot.exists()) throw new Error("Each manager can control only one franchise in this league.");
    const timestamp = new Date().toISOString();
    transaction.set(reference, {
      league_id: leagueId,
      franchise_id: franchiseId,
      franchise_name: franchise.displayName,
      requested_by_user_id: currentUserId,
      requested_display_name: requestedDisplayName,
      status: "approved",
      approved_user_id: currentUserId,
      requested_at: timestamp,
      approved_at: timestamp,
      updated_at: timestamp,
    });
    transaction.set(managerReference, {
      league_id: leagueId,
      user_id: currentUserId,
      franchise_id: franchiseId,
      franchise_name: franchise.displayName,
      display_name: requestedDisplayName,
      status: "approved",
      requested_at: timestamp,
      approved_at: timestamp,
      updated_at: timestamp,
    });
  });
}

export async function approveFranchiseClaim(leagueIdValue: string, franchiseIdValue: string) {
  const leagueId = normalizeLeagueId(leagueIdValue);
  const franchiseId = normalizeFranchiseId(franchiseIdValue);
  const currentUserId = await ensurePermanentFirebaseUserId();
  const reference = claimRef(leagueId, franchiseId);

  await runTransaction(firestore, async (transaction) => {
    const [seasonSnapshot, claimSnapshot] = await Promise.all([
      transaction.get(seasonRef(leagueId)),
      transaction.get(reference),
    ]);
    const published = seasonSnapshot.exists()
      ? normalizePublishedLeagueSeasonRecord(seasonSnapshot.data(), leagueId)
      : null;
    const claim = claimSnapshot.exists() ? normalizeFranchiseClaim(claimSnapshot.data(), leagueId) : null;
    if (!published || published.commissionerUserId !== currentUserId) throw new Error("Only the commissioner can approve team access.");
    if (!claim || claim.status !== "requested") throw new Error("This team no longer has a pending request.");
    const managerReference = membershipRef(leagueId, claim.requestedByUserId);
    const membershipSnapshot = await transaction.get(managerReference);
    const membership = membershipSnapshot.exists()
      ? normalizeManagerMembership(membershipSnapshot.data(), leagueId)
      : null;
    if (membership && (membership.franchiseId !== franchiseId || membership.status !== "requested")) {
      throw new Error("This manager already has a different team membership.");
    }
    const timestamp = new Date().toISOString();
    transaction.update(reference, {
      status: "approved",
      approved_user_id: claim.requestedByUserId,
      approved_at: timestamp,
      updated_at: timestamp,
    });
    transaction.set(managerReference, {
      league_id: leagueId,
      user_id: claim.requestedByUserId,
      franchise_id: franchiseId,
      franchise_name: claim.franchiseName,
      display_name: claim.requestedDisplayName,
      status: "approved",
      requested_at: membership?.requestedAt || claim.requestedAt,
      approved_at: timestamp,
      updated_at: timestamp,
    });
  });
}

export async function removeFranchiseClaim(leagueIdValue: string, franchiseIdValue: string) {
  const leagueId = normalizeLeagueId(leagueIdValue);
  const franchiseId = normalizeFranchiseId(franchiseIdValue);
  const currentUserId = await ensurePermanentFirebaseUserId();
  const reference = claimRef(leagueId, franchiseId);

  await runTransaction(firestore, async (transaction) => {
    const [seasonSnapshot, claimSnapshot] = await Promise.all([
      transaction.get(seasonRef(leagueId)),
      transaction.get(reference),
    ]);
    const published = seasonSnapshot.exists()
      ? normalizePublishedLeagueSeasonRecord(seasonSnapshot.data(), leagueId)
      : null;
    const claim = claimSnapshot.exists() ? normalizeFranchiseClaim(claimSnapshot.data(), leagueId) : null;
    if (!claim) return;
    const canRemove = published?.commissionerUserId === currentUserId
      || claim.requestedByUserId === currentUserId
      || claim.approvedUserId === currentUserId;
    if (!canRemove) throw new Error("You cannot remove another manager's team access.");
    const membershipUserId = claim.approvedUserId || claim.requestedByUserId;
    const managerReference = membershipRef(leagueId, membershipUserId);
    const membershipSnapshot = await transaction.get(managerReference);
    transaction.delete(reference);
    if (membershipSnapshot.exists()) transaction.delete(managerReference);
  });
}

export async function subscribeToLeagueWeekLineups(
  leagueIdValue: string,
  weekValue: number,
  onChange: (lineups: SavedLeagueLineup[]) => void,
  onError: (error: Error) => void,
): Promise<Unsubscribe> {
  const leagueId = normalizeLeagueId(leagueIdValue);
  const week = normalizeWeek(weekValue);
  await ensureFirebaseUserId();
  return onSnapshot(
    query(lineupsRef(leagueId), where("week", "==", week)),
    (snapshot) => onChange(snapshot.docs.flatMap((entry) => {
      const lineup = normalizeSavedLeagueLineup(entry.data(), leagueId);
      return lineup ? [lineup] : [];
    })),
    (error) => onError(error instanceof Error ? error : new Error(String(error))),
  );
}

export async function subscribeToLeagueWeekSettings(
  leagueIdValue: string,
  weekValue: number,
  onChange: (settings: LeagueWeekSettings | null) => void,
  onError: (error: Error) => void,
): Promise<Unsubscribe> {
  const leagueId = normalizeLeagueId(leagueIdValue);
  const week = normalizeWeek(weekValue);
  await ensureFirebaseUserId();
  return onSnapshot(
    weekSettingsRef(leagueId, week),
    (snapshot) => {
      if (!snapshot.exists()) {
        onChange(null);
        return;
      }
      const settings = normalizeLeagueWeekSettings(snapshot.data(), leagueId);
      if (!settings) {
        onError(new Error("This week's lineup lock settings are invalid."));
        return;
      }
      onChange(settings);
    },
    (error) => onError(error instanceof Error ? error : new Error(String(error))),
  );
}

export async function setLeagueWeekLocked(leagueIdValue: string, weekValue: number, locked: boolean) {
  const leagueId = normalizeLeagueId(leagueIdValue);
  const week = normalizeWeek(weekValue);
  const currentUserId = await ensurePermanentFirebaseUserId();
  const reference = weekSettingsRef(leagueId, week);

  await runTransaction(firestore, async (transaction) => {
    const [seasonSnapshot, settingsSnapshot] = await Promise.all([
      transaction.get(seasonRef(leagueId)),
      transaction.get(reference),
    ]);
    const published = seasonSnapshot.exists()
      ? normalizePublishedLeagueSeasonRecord(seasonSnapshot.data(), leagueId)
      : null;
    if (!published || published.commissionerUserId !== currentUserId) {
      throw new Error("Only the commissioner can lock or reopen a lineup week.");
    }
    const existing = settingsSnapshot.exists()
      ? normalizeLeagueWeekSettings(settingsSnapshot.data(), leagueId)
      : null;
    if (settingsSnapshot.exists() && !existing) throw new Error("The current week lock is invalid and was not overwritten.");
    const timestamp = new Date().toISOString();
    transaction.set(reference, {
      league_id: leagueId,
      week,
      week_key: weekKey(week),
      locked,
      updated_by_user_id: currentUserId,
      created_at: existing?.createdAt || timestamp,
      updated_at: timestamp,
    });
  });
}

export async function saveLeagueLineup(
  leagueIdValue: string,
  franchiseIdValue: string,
  weekValue: number,
  assignmentsValue: unknown,
  overrideReasonValue = "",
) {
  const leagueId = normalizeLeagueId(leagueIdValue);
  const franchiseId = normalizeFranchiseId(franchiseIdValue);
  const week = normalizeWeek(weekValue);
  const currentUserId = await ensurePermanentFirebaseUserId();
  const reference = lineupRef(leagueId, franchiseId, week);
  const auditReference = doc(auditEventsRef(leagueId));
  let saved: SavedLeagueLineup | null = null;

  await runTransaction(firestore, async (transaction) => {
    const [seasonSnapshot, claimSnapshot, lineupSnapshot, settingsSnapshot] = await Promise.all([
      transaction.get(seasonRef(leagueId)),
      transaction.get(claimRef(leagueId, franchiseId)),
      transaction.get(reference),
      transaction.get(weekSettingsRef(leagueId, week)),
    ]);
    const published = seasonSnapshot.exists()
      ? normalizePublishedLeagueSeasonRecord(seasonSnapshot.data(), leagueId)
      : null;
    const { record, franchise } = requirePublishedFranchise(published, franchiseId);
    const claim = claimSnapshot.exists() ? normalizeFranchiseClaim(claimSnapshot.data(), leagueId) : null;
    const isCommissioner = record.commissionerUserId === currentUserId;
    const canManage = isCommissioner
      || (claim?.status === "approved" && claim.approvedUserId === currentUserId);
    if (!canManage) throw new Error("The commissioner must approve this team before you can save its lineup.");
    const settings = settingsSnapshot.exists()
      ? normalizeLeagueWeekSettings(settingsSnapshot.data(), leagueId)
      : null;
    if (settingsSnapshot.exists() && !settings) throw new Error("This week's lineup lock settings are invalid.");
    const isLocked = Boolean(settings?.locked);
    if (isLocked && !isCommissioner) throw new Error(`Week ${week} lineups are locked by the commissioner.`);
    const overrideReason = overrideReasonValue.trim().replace(/\s+/g, " ").slice(0, 240);
    if (isLocked && isCommissioner && overrideReason.length < 4) {
      throw new Error("Enter an override reason before changing a locked lineup.");
    }
    const assignments = normalizeLineupAssignments(franchise, record.season.rosterSlots, assignmentsValue);
    const existing = lineupSnapshot.exists() ? normalizeSavedLeagueLineup(lineupSnapshot.data(), leagueId) : null;
    if (lineupSnapshot.exists() && !existing) throw new Error("The current saved lineup is invalid and was not overwritten.");
    const timestamp = new Date().toISOString();
    const nextRecord = {
      league_id: leagueId,
      franchise_id: franchiseId,
      week,
      week_key: weekKey(week),
      season_revision: record.revision,
      assignments: clone(assignments),
      revision: (existing?.revision ?? 0) + 1,
      audit_event_id: auditReference.id,
      updated_by_user_id: currentUserId,
      created_at: existing?.createdAt || timestamp,
      updated_at: timestamp,
    };
    transaction.set(reference, nextRecord);
    transaction.set(auditReference, {
      league_id: leagueId,
      event_id: auditReference.id,
      lineup_id: reference.id,
      type: isLocked ? "lineup_override" : "lineup_saved",
      actor_user_id: currentUserId,
      franchise_id: franchiseId,
      week,
      week_key: weekKey(week),
      season_revision: record.revision,
      before_assignments: clone(existing?.assignments ?? {}),
      after_assignments: clone(assignments),
      reason: overrideReason,
      created_at: timestamp,
    });
    saved = normalizeSavedLeagueLineup(nextRecord, leagueId);
  });

  if (!saved) throw new Error("The weekly lineup could not be saved.");
  return saved;
}
