import type { LeagueHistoryImportResponse } from "../../shared/leagueHistoryImportProtocol";

export interface AutomaticImportDependencies {
  findExisting(leagueId: string): Promise<LeagueHistoryImportResponse | null>;
  acquireLock(leagueId: string): Promise<boolean>;
  importLeague(leagueId: string): Promise<LeagueHistoryImportResponse>;
  recordFailure(leagueId: string, error: unknown): Promise<void>;
}

export async function runAutomaticLeagueHistoryImportWorkflow(
  leagueId: string,
  dependencies: AutomaticImportDependencies,
) {
  const existing = await dependencies.findExisting(leagueId);
  if (existing) return existing;
  if (!await dependencies.acquireLock(leagueId)) {
    const readyAfterLock = await dependencies.findExisting(leagueId);
    return readyAfterLock ?? {
      status: "importing" as const,
      leagueId,
      message: "League History is already being imported.",
    };
  }
  try {
    return await dependencies.importLeague(leagueId);
  } catch (error) {
    await dependencies.recordFailure(leagueId, error);
    throw error;
  }
}
