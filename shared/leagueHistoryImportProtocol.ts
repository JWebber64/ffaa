export const LEAGUE_HISTORY_IMPORT_ENDPOINT = "/ff/api/league-history/import";

export type LeagueHistoryImportStatus = "ready" | "importing" | "error";

export interface LeagueHistoryImportResponse {
  status: LeagueHistoryImportStatus;
  leagueId: string;
  message: string;
  historyId?: string;
  counts?: Record<string, number>;
}

export function normalizeLeagueHistoryImportId(value: unknown) {
  const leagueId = typeof value === "string" ? value.trim() : "";
  return /^\d{10,}$/.test(leagueId) ? leagueId : "";
}

export function isAllowedLeagueHistoryImportOrigin(value: string | undefined) {
  if (!value) return true;
  try {
    const url = new URL(value);
    if (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)) return true;
    if (url.protocol !== "https:") return false;
    return url.hostname === "gamehqhub.com"
      || url.hostname === "ffaa-six.vercel.app"
      || url.hostname === "ffaa-webbers-projects-9f9d0d10.vercel.app"
      || /^ffaa-[a-z0-9-]+-webbers-projects-9f9d0d10\.vercel\.app$/.test(url.hostname);
  } catch {
    return false;
  }
}
