import { describe, expect, it, vi } from "vitest";

import {
  isAllowedLeagueHistoryImportOrigin,
  normalizeLeagueHistoryImportId,
  type LeagueHistoryImportResponse,
} from "../../shared/leagueHistoryImportProtocol";
import {
  firestoreObject,
  firestoreDocument,
  fromFirestoreValue,
  splitFirestoreWrites,
  toFirestoreValue,
} from "../../server/league-history/firestoreRest";
import { runAutomaticLeagueHistoryImportWorkflow } from "../../server/league-history/importWorkflow";
import { ensureLeagueHistoryImported } from "../features/league-history/automaticImport";

const leagueId = "123456789012345678";

function response(payload: LeagueHistoryImportResponse, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("automatic League History imports", () => {
  it("accepts only numeric Sleeper IDs and trusted app origins", () => {
    expect(normalizeLeagueHistoryImportId(` ${leagueId} `)).toBe(leagueId);
    expect(normalizeLeagueHistoryImportId("not-a-league")).toBe("");
    expect(isAllowedLeagueHistoryImportOrigin("https://gamehqhub.com")).toBe(true);
    expect(isAllowedLeagueHistoryImportOrigin("https://ffaa-abc123-webbers-projects-9f9d0d10.vercel.app")).toBe(true);
    expect(isAllowedLeagueHistoryImportOrigin("https://example.com")).toBe(false);
  });

  it("round-trips plain history data through Firestore REST fields", () => {
    const source = {
      name: "Test League",
      seasons: [2025, 2026],
      scoring: { rec: 1, bonus: 0.5 },
      active: true,
      optional: null,
    };
    expect(fromFirestoreValue(toFirestoreValue(source))).toEqual(source);
    expect(firestoreObject(firestoreDocument("leagueHistories/test", source))).toEqual(source);
  });

  it("keeps Firestore commits below the write-count boundary", () => {
    const writes = Array.from({ length: 401 }, (_, index) => ({
      update: firestoreDocument(`leagueHistoryImports/${index}`, { index }),
    }));
    expect(splitFirestoreWrites(writes).map((group) => group.length)).toEqual([400, 1]);
  });

  it("does not overwrite an existing permanent history", async () => {
    const ready: LeagueHistoryImportResponse = { status: "ready", leagueId, message: "ready", historyId: leagueId };
    const dependencies = {
      findExisting: vi.fn().mockResolvedValue(ready),
      acquireLock: vi.fn(),
      importLeague: vi.fn(),
      recordFailure: vi.fn(),
    };
    await expect(runAutomaticLeagueHistoryImportWorkflow(leagueId, dependencies)).resolves.toEqual(ready);
    expect(dependencies.acquireLock).not.toHaveBeenCalled();
    expect(dependencies.importLeague).not.toHaveBeenCalled();
  });

  it("records a failed import after acquiring the per-league lock", async () => {
    const failure = new Error("Sleeper unavailable");
    const dependencies = {
      findExisting: vi.fn().mockResolvedValue(null),
      acquireLock: vi.fn().mockResolvedValue(true),
      importLeague: vi.fn().mockRejectedValue(failure),
      recordFailure: vi.fn().mockResolvedValue(undefined),
    };
    await expect(runAutomaticLeagueHistoryImportWorkflow(leagueId, dependencies)).rejects.toThrow("Sleeper unavailable");
    expect(dependencies.recordFailure).toHaveBeenCalledWith(leagueId, failure);
  });

  it("starts an import and polls an import already in progress", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({ status: "importing", leagueId, message: "working" }, 202))
      .mockResolvedValueOnce(response({ status: "importing", leagueId, message: "working" }, 202))
      .mockResolvedValueOnce(response({ status: "ready", leagueId, historyId: leagueId, message: "ready" }));
    await expect(ensureLeagueHistoryImported(leagueId, {
      fetcher,
      pollIntervalMs: 0,
      maxWaitMs: 5_000,
    })).resolves.toMatchObject({ status: "ready", historyId: leagueId });
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls[0]?.[0]).toBe("/ff/api/league-history/import");
    expect(String(fetcher.mock.calls[1]?.[0])).toContain(`leagueId=${leagueId}`);
  });
});
