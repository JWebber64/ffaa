/* @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LeagueHistorySnapshot } from "../features/league-history/domain/types";

const useLeagueHistoryMock = vi.hoisted(() => vi.fn());
const useLeagueHistoryWeeksMock = vi.hoisted(() => vi.fn());

vi.mock("../features/league-history/useLeagueHistory", () => ({ useLeagueHistory: useLeagueHistoryMock }));
vi.mock("../features/league-history/useLeagueHistoryWeeks", () => ({ useLeagueHistoryWeeks: useLeagueHistoryWeeksMock }));

import { HistoryHealthPanel } from "../features/league-history/ui/HistoryHealthPanel";

afterEach(cleanup);

const baseDomain = {
  status: "complete" as const,
  observed: 12,
  expected: 12,
  source: "Sleeper source",
  sourceUrl: "",
  importedAt: "2026-09-01T00:00:00.000Z",
  reasons: ["expected-count-matched"],
};

const snapshot: LeagueHistorySnapshot = {
  league: { id: "league", provider: "sleeper", currentExternalLeagueId: "league", name: "Test", sport: "nfl", format: "auction", settings: {}, createdAt: "", updatedAt: "" },
  seasons: [],
  managers: [],
  franchises: [],
  matchups: [],
  weeklyResults: [],
  weeklyPlayerResults: [],
  playoffMatches: [],
  drafts: [],
  draftPicks: [],
  transactions: [],
  transactionAssets: [],
  coverage: {
    version: 1,
    generatedAt: "2026-09-01T00:00:00.000Z",
    seasons: [{
      seasonId: "season-2025",
      season: 2025,
      importedAt: "2026-09-01T00:00:00.000Z",
      domains: {
        franchises: baseDomain,
        managerIdentity: baseDomain,
        matchups: { ...baseDomain, status: "unknown", expected: null },
        weeklyResults: baseDomain,
        weeklyPlayerResults: baseDomain,
        drafts: { ...baseDomain, status: "partial", observed: 136, expected: 144, source: "Verified auction workbook", sourceUrl: "https://example.com/workbook", recordedSpend: 2367, expectedSpend: 2400, orderKnown: false },
        transactions: { ...baseDomain, status: "unknown", observed: 23, expected: null },
      },
    }],
  },
};

describe("HistoryHealthPanel", () => {
  beforeEach(() => {
    useLeagueHistoryMock.mockReturnValue({ status: "ready", data: snapshot, error: "", refresh: vi.fn() });
    useLeagueHistoryWeeksMock.mockReturnValue({ status: "ready", data: snapshot, error: "" });
  });

  it("shows exact source evidence and unknown denominators", () => {
    render(<MemoryRouter><HistoryHealthPanel leagueId="league" /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Some analytics are limited" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "League History coverage by season" })).toBeInTheDocument();
    expect(screen.getByText("2025")).toBeInTheDocument();
    expect(screen.getByText("136 / 144")).toBeInTheDocument();
    expect(screen.getByText("Partial source")).toBeInTheDocument();
    expect(screen.getAllByText("Available; completeness unknown").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Open source" })).toHaveAttribute("href", "https://example.com/workbook");
  });

  it("renders a useful missing-import state", () => {
    useLeagueHistoryMock.mockReturnValue({ status: "error", data: null, error: "Not imported", refresh: vi.fn() });
    render(<MemoryRouter><HistoryHealthPanel leagueId="league" /></MemoryRouter>);
    expect(screen.getByText("History source data is missing")).toBeInTheDocument();
    expect(screen.getByText("Not imported")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check again" })).toBeInTheDocument();
  });

  it("distinguishes an active import from missing history", () => {
    useLeagueHistoryMock.mockReturnValue({ status: "importing", data: null, error: "", refresh: vi.fn() });
    render(<MemoryRouter><HistoryHealthPanel leagueId="league" /></MemoryRouter>);
    expect(screen.getByText("Building League History")).toBeInTheDocument();
    expect(screen.getByText(/checks automatically/i)).toBeInTheDocument();
    expect(screen.queryByText("History source data is missing")).not.toBeInTheDocument();
  });
});
