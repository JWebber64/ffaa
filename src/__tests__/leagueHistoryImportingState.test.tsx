/* @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const useLeagueHistoryMock = vi.hoisted(() => vi.fn());

vi.mock("../lib/firebase", () => ({ firestore: {} }));
vi.mock("../features/league-history/useLeagueHistory", () => ({ useLeagueHistory: useLeagueHistoryMock }));

import { LeagueHistoryImportingState } from "../features/league-history/ui/LeagueHistoryImportingState";
import LeagueHistoryApp from "../features/league-history/ui/LeagueHistoryApp";

afterEach(cleanup);

describe("League History importing state", () => {
  it("describes an active import without presenting it as missing history", () => {
    render(
      <MemoryRouter><LeagueHistoryImportingState /></MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Building League History" })).toBeInTheDocument();
    expect(screen.getByText("No action is required")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "League connections" })).toHaveAttribute("href", "/leagues");
    expect(screen.queryByText("This league is not in League History yet")).not.toBeInTheDocument();
  });

  it("routes the hook importing status to the active-import experience", () => {
    useLeagueHistoryMock.mockReturnValue({ status: "importing", data: null, error: "", refresh: vi.fn() });
    render(
      <MemoryRouter initialEntries={["/league/123/history"]}>
        <Routes><Route path="/league/:leagueId/history/*" element={<LeagueHistoryApp />} /></Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Building League History" })).toBeInTheDocument();
    expect(screen.queryByText("This league is not in League History yet")).not.toBeInTheDocument();
  });
});
