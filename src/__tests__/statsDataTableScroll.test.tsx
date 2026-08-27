/* @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StatsDataTable } from "@/components/stats/StatsDataTable";

let notifyResize: ResizeObserverCallback | null = null;

class ResizeObserverMock {
  constructor(callback: ResizeObserverCallback) {
    notifyResize = callback;
  }

  observe() {}

  disconnect() {}
}

describe("StatsDataTable horizontal scrolling", () => {
  afterEach(() => {
    notifyResize = null;
    vi.unstubAllGlobals();
  });

  it("shows a top scrollbar when the table overflows and keeps both scroll positions synchronized", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);

    const { container } = render(
      <StatsDataTable
        rows={[{ id: "one", player: "Player one", value: 42 }]}
        columns={[
          {
            id: "player",
            label: "Player",
            sticky: true,
            align: "left",
            sortValue: (row) => row.player,
            render: (row) => row.player,
          },
          {
            id: "value",
            label: "Value",
            sortValue: (row) => row.value,
            render: (row) => row.value,
          },
        ]}
        sort={{ columnId: "value", direction: "desc" }}
        onSortChange={vi.fn()}
        emptyMessage="No players"
        caption="Auction values"
      />,
    );

    const tableShell = container.querySelector<HTMLElement>(".stats-hub-table-shell");
    expect(tableShell).not.toBeNull();

    Object.defineProperty(tableShell, "clientWidth", { configurable: true, value: 800 });
    Object.defineProperty(tableShell, "scrollWidth", { configurable: true, value: 1900 });

    act(() => notifyResize?.([], {} as ResizeObserver));

    const topScrollbar = screen.getByRole("region", {
      name: "Horizontal scroll for Auction values",
    });
    const spacer = topScrollbar.firstElementChild as HTMLElement;
    expect(topScrollbar).toBeVisible();
    expect(spacer).toHaveStyle({ width: "1900px" });

    topScrollbar.scrollLeft = 420;
    fireEvent.scroll(topScrollbar);
    expect(tableShell?.scrollLeft).toBe(420);

    if (tableShell) tableShell.scrollLeft = 180;
    fireEvent.scroll(tableShell as HTMLElement);
    expect(topScrollbar.scrollLeft).toBe(180);
  });
});
