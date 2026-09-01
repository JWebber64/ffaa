import type { Unsubscribe } from "firebase/firestore";

import {
  normalizeOfflineLeagueDraftRecord,
  subscribeToOfflineLeagueDraft,
  type OfflineLeagueDraftRecord,
} from "./offlineLeagueDraftPersistence";

export type SharedOfflineDraftPayload = {
  config: unknown;
  teams: unknown;
};

export type SharedOfflineDraftRecord = {
  leagueId: string;
  ownerUserId: string;
  payload: SharedOfflineDraftPayload;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type SharedOfflineDraftSnapshot = {
  currentUserId: string;
  record: SharedOfflineDraftRecord | null;
};

function sharedRecord(record: OfflineLeagueDraftRecord): SharedOfflineDraftRecord {
  const state = record.state as { config: unknown; teams: unknown };
  return {
    leagueId: record.leagueId,
    ownerUserId: record.ownerUserId,
    payload: { config: state.config, teams: state.teams },
    revision: record.version,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function normalizeSharedOfflineDraftRecord(value: unknown, expectedLeagueId = "") {
  const record = normalizeOfflineLeagueDraftRecord(value, expectedLeagueId);
  return record ? sharedRecord(record) : null;
}

export async function subscribeToSharedOfflineDraft(
  leagueId: string,
  onChange: (snapshot: SharedOfflineDraftSnapshot) => void,
  onError: (error: Error) => void,
): Promise<Unsubscribe> {
  return subscribeToOfflineLeagueDraft(
    leagueId,
    ({ currentUserId, record }) => onChange({
      currentUserId,
      record: record ? sharedRecord(record) : null,
    }),
    onError,
  );
}
