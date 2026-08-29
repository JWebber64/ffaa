import { appUrl } from "../../lib/appBasePath";

const OFFLINE_DRAFT_ID_PATTERN = /^[A-Za-z0-9_-]{20,80}$/u;

export type OfflineDraftCloudState = {
  teams: unknown;
  config: unknown;
  lastAssignment: unknown;
};

export type OfflineDraftCloudMetadata = {
  leagueId?: string;
  leagueName?: string;
  season?: string;
};

export type OfflineDraftCloudRecord = {
  id: string;
  ownerUserId: string;
  state: OfflineDraftCloudState;
  leagueId?: string;
  leagueName?: string;
  season?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export function normalizeOfflineDraftId(value: unknown) {
  const candidate = typeof value === "string" ? value.trim() : "";
  return OFFLINE_DRAFT_ID_PATTERN.test(candidate) ? candidate : "";
}

export function offlineDraftIdFromPath(pathname: string) {
  const match = String(pathname).match(/\/offline-draft\/([^/?#]+)/u);
  if (!match?.[1]) return "";

  try {
    return normalizeOfflineDraftId(decodeURIComponent(match[1]));
  } catch {
    return "";
  }
}

export function offlineDraftStorageKey(draftId?: string) {
  const normalizedId = normalizeOfflineDraftId(draftId);
  return normalizedId ? `ffaa.offlineDraft.v1:${normalizedId}` : "ffaa.offlineDraft.v1";
}

export function offlineDraftShareUrl(
  draftId: string,
  origin = typeof window === "undefined" ? "https://gamehqhub.com" : window.location.origin,
) {
  const normalizedId = normalizeOfflineDraftId(draftId);
  if (!normalizedId) throw new Error("Offline Draft ID is invalid.");
  return new URL(appUrl(`offline-draft/${normalizedId}`), origin).toString();
}
