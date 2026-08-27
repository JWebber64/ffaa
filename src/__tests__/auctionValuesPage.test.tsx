/* @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import AuctionValuesPage from "@/features/auction-values/AuctionValuesPage";

function renderRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/auction-values" element={<AuctionValuesPage />} />
        <Route path="/auction-values/source/:sourceId" element={<AuctionValuesPage />} />
        <Route path="/auction-values/print" element={<AuctionValuesPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Auction Values page", () => {
  let computedStyle: ReturnType<typeof vi.spyOn>;

  beforeAll(() => {
    computedStyle = vi.spyOn(window, "getComputedStyle").mockImplementation(() => ({
      display: "block",
      visibility: "visible",
      getPropertyValue: () => "",
    }) as unknown as CSSStyleDeclaration);
  });
  afterAll(() => computedStyle.mockRestore());
  afterEach(cleanup);
  beforeEach(() => window.localStorage.clear());

  it("restores scoring, budget, league size, source selection, search, and position from the URL", () => {
    renderRoute("/auction-values?format=half_ppr&budget=250&teams=12&sources=fftoday,usa-today&q=Jahmyr&position=RB&freshness=archive");
    expect(screen.getByRole("tab", { name: "Half PPR" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("spinbutton", { name: "Team auction budget" })).toHaveValue(250);
    expect(screen.getByRole("spinbutton", { name: "League size" })).toHaveValue(12);
    expect(screen.getByRole("searchbox", { name: "Search players" })).toHaveValue("Jahmyr");
    expect(screen.getByRole("button", { name: "RB" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByText("Jahmyr Gibbs").length).toBeGreaterThan(0);
  });

  it("switches all three formats and persists the last format", () => {
    renderRoute("/auction-values?freshness=archive");
    fireEvent.click(screen.getByRole("tab", { name: "Standard" }));
    expect(screen.getByRole("tab", { name: "Standard" })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("tab", { name: "Half PPR" }));
    fireEvent.click(screen.getByRole("tab", { name: "Full PPR" }));
    expect(screen.getByRole("tab", { name: "Full PPR" })).toHaveAttribute("aria-selected", "true");
    expect(JSON.parse(window.localStorage.getItem("ffaa.auctionValues.preferences.v1") ?? "{}").scoringFormat).toBe("ppr");
  }, 15_000);

  it("removes a selected source without reloading the page", async () => {
    renderRoute("/auction-values?sources=fftoday,usa-today&freshness=archive");
    expect(screen.getByLabelText("Selected comparison sources")).toHaveTextContent("2");
    fireEvent.click(screen.getByRole("button", { name: "Remove FFToday from comparison" }));
    await waitFor(() => expect(screen.getByLabelText("Selected comparison sources")).toHaveTextContent("1"));
  }, 15_000);

  it("renders a directly refreshed individual sheet route", () => {
    renderRoute("/auction-values/source/fftoday?format=standard&sources=fftoday");
    expect(screen.getByRole("heading", { name: "FFToday" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "FFToday auction values" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Raw value" })).toBeInTheDocument();
  });

  it("renders a stable print route with current comparison state", () => {
    renderRoute("/auction-values/print?format=ppr&teams=12&budget=200&sources=fftoday,usa-today&limit=50");
    expect(screen.getByRole("heading", { name: "Print settings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open browser print dialog/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Auction value comparison table" })).toBeInTheDocument();
    expect(screen.getByText(/Sources: FFToday, USA TODAY Auction Values/)).toBeInTheDocument();
  });

  it("renders without console errors", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    renderRoute("/auction-values?format=standard&sources=fftoday,usa-today&freshness=archive");
    expect(screen.getByRole("heading", { name: "Fantasy Football Auction Values" })).toBeInTheDocument();
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  }, 15_000);
});
