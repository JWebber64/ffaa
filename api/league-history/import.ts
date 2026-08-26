import {
  isAllowedLeagueHistoryImportOrigin,
  normalizeLeagueHistoryImportId,
  type LeagueHistoryImportResponse,
} from "../../shared/leagueHistoryImportProtocol";
import {
  getAutomaticLeagueHistoryImportStatus,
  runAutomaticLeagueHistoryImport,
} from "../../server/league-history/automaticImport";

interface ApiRequest {
  method?: string;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
  headers: Record<string, string | string[] | undefined>;
}

interface ApiResponse {
  setHeader(name: string, value: string): void;
  status(code: number): ApiResponse;
  json(value: LeagueHistoryImportResponse | { error: string }): void;
  end(): void;
}

function header(request: ApiRequest, name: string) {
  const value = request.headers[name] ?? request.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function requestBody(value: unknown) {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function queryLeagueId(request: ApiRequest) {
  const value = request.query?.leagueId;
  return Array.isArray(value) ? value[0] : value;
}

function setResponseHeaders(request: ApiRequest, response: ApiResponse) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Vary", "Origin");
  const origin = header(request, "origin");
  if (origin && isAllowedLeagueHistoryImportOrigin(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
  }
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  setResponseHeaders(request, response);
  const origin = header(request, "origin");
  if (!isAllowedLeagueHistoryImportOrigin(origin)) {
    response.status(403).json({ error: "This origin is not allowed to start League History imports." });
    return;
  }
  if (request.method === "OPTIONS") {
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");
    response.status(204).end();
    return;
  }
  if (request.method !== "GET" && request.method !== "POST") {
    response.status(405).json({ error: "Use GET or POST for League History imports." });
    return;
  }
  const leagueId = normalizeLeagueHistoryImportId(
    request.method === "GET" ? queryLeagueId(request) : requestBody(request.body).leagueId,
  );
  if (!leagueId) {
    response.status(400).json({ error: "Enter a valid numeric Sleeper league ID." });
    return;
  }
  try {
    const result = request.method === "GET"
      ? await getAutomaticLeagueHistoryImportStatus(leagueId)
      : await runAutomaticLeagueHistoryImport(leagueId);
    response.status(result.status === "importing" ? 202 : result.status === "ready" ? 200 : 409).json(result);
  } catch (error) {
    console.error("[league-history-import]", error);
    response.status(502).json({
      error: error instanceof Error ? error.message : "Automatic League History import failed.",
    });
  }
}
