import type { LeagueCommandResponse } from "../../shared/leagueCommandProtocol";
import { isAllowedLeagueHistoryImportOrigin } from "../../shared/leagueHistoryImportProtocol";
import { authenticateFirebaseUser } from "./authenticateFirebaseUser";
import { LeagueCommandFailure } from "./commandSupport";
import { executeLeagueCommand } from "./executeLeagueCommand";
import { createFirestoreLeagueCommandStore } from "./store";

interface ApiRequest {
  method?: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
}

interface ApiResponse {
  setHeader(name: string, value: string): void;
  status(code: number): ApiResponse;
  json(value: LeagueCommandResponse): void;
  end(): void;
}

function header(request: ApiRequest, name: string) {
  const value = request.headers[name] ?? request.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function requestBody(value: unknown) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new LeagueCommandFailure("invalid_json", "The league command body is not valid JSON.");
  }
}

function setResponseHeaders(request: ApiRequest, response: ApiResponse) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Vary", "Origin");
  const origin = header(request, "origin");
  if (origin && isAllowedLeagueHistoryImportOrigin(origin)) response.setHeader("Access-Control-Allow-Origin", origin);
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  setResponseHeaders(request, response);
  const origin = header(request, "origin");
  if (!isAllowedLeagueHistoryImportOrigin(origin)) {
    response.status(403).json({ ok: false, error: { code: "origin_denied", message: "This origin cannot send GameHQ league commands." } });
    return;
  }
  if (request.method === "OPTIONS") {
    response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    response.status(204).end();
    return;
  }
  if (request.method !== "POST") {
    response.status(405).json({ ok: false, error: { code: "method_not_allowed", message: "Use POST for GameHQ league commands." } });
    return;
  }
  try {
    const user = await authenticateFirebaseUser(request.headers.authorization);
    const oidcToken = header(request, "x-vercel-oidc-token");
    const receipt = await executeLeagueCommand({
      commandValue: requestBody(request.body),
      actorUserId: user.userId,
      actorEmail: user.email,
      store: createFirestoreLeagueCommandStore(oidcToken),
    });
    response.status(200).json({ ok: true, receipt });
  } catch (error) {
    const failure = error instanceof LeagueCommandFailure
      ? error
      : error as Error & { status?: number; code?: string; currentRevision?: number };
    const status = error instanceof LeagueCommandFailure
      ? error.status
      : Math.min(599, Math.max(400, Number(failure.status) || 500));
    if (status >= 500) console.error("[league-command]", error);
    response.status(status).json({
      ok: false,
      error: {
        code: failure.code ?? "command_failed",
        message: failure.message || "The league command could not be processed.",
        ...(failure.currentRevision === undefined ? {} : { currentRevision: failure.currentRevision }),
      },
    });
  }
}
