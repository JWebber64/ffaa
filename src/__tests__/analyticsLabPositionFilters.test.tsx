/* @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadAnalyticsData } from "@/data/analyticsData";
import { AnalyticsLab } from "@/screens/AnalyticsLab";

vi.mock("@/data/analyticsData", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/data/analyticsData")>();

  return {
    ...actual,
    loadAnalyticsData: vi.fn(),
  };
});

const loadAnalyticsDataMock = vi.mocked(loadAnalyticsData);

describe("Analytics Lab position filters", () => {
  beforeEach(() => {
    loadAnalyticsDataMock.mockReset();
    loadAnalyticsDataMock.mockResolvedValue({ players: [], teams: [] });
  });

  it("offers FLEX, kicker, and team-defense filters and applies them", async () => {
    render(
      <MemoryRouter initialEntries={["/analytics"]}>
        <AnalyticsLab />
      </MemoryRouter>,
    );

    const positionFilters = screen.getByRole("group", {
      name: "Filter Analytics Lab by position",
    });
    const flexFilter = within(positionFilters).getByRole("button", { name: "FLEX" });
    const kickerFilter = within(positionFilters).getByRole("button", { name: "K" });
    const defenseFilter = within(positionFilters).getByRole("button", { name: "DEF" });

    expect(flexFilter).toHaveAttribute("aria-pressed", "false");
    expect(kickerFilter).toHaveAttribute("aria-pressed", "false");
    expect(defenseFilter).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(flexFilter);

    await waitFor(() => {
      expect(flexFilter).toHaveAttribute("aria-pressed", "true");
      expect(loadAnalyticsDataMock).toHaveBeenCalledWith(
        expect.objectContaining({ position: "FLEX" }),
      );
    });
    expect(screen.getByRole("heading", { name: "Running back lab" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Receiver lab" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Quarterback lab" })).toBeNull();

    fireEvent.click(kickerFilter);

    await waitFor(() => {
      expect(kickerFilter).toHaveAttribute("aria-pressed", "true");
      expect(loadAnalyticsDataMock).toHaveBeenCalledWith(
        expect.objectContaining({ position: "K" }),
      );
    });

    fireEvent.click(defenseFilter);

    await waitFor(() => {
      expect(defenseFilter).toHaveAttribute("aria-pressed", "true");
      expect(loadAnalyticsDataMock).toHaveBeenCalledWith(
        expect.objectContaining({ position: "DEF" }),
      );
    });
  });
});
