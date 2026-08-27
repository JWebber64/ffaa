/* @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlayerSearch } from "../components/unified/PlayerSearch";

vi.mock("../store/draftStore", () => {
  const state = { players: [], selectors: { topAvailable: () => [] } };
  return { useDraftStore: (selector: (value: typeof state) => unknown) => selector(state) };
});

describe("player search dropdown", () => {
  it("closes its results after selecting a player for a bid", async () => {
    render(
      <PlayerSearch
        debounceMs={0}
        onBid={vi.fn()}
        players={[{ id: "player-1", name: "Test Quarterback", pos: "QB", nflTeam: "BUF", rank: 1 }]}
        showBidButton
      />,
    );

    const input = screen.getByPlaceholderText(/Search players/);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Test" } });
    const option = await screen.findByRole("option", { name: /Test Quarterback/ });
    fireEvent.click(option);

    await waitFor(() => expect(screen.queryByRole("option", { name: /Test Quarterback/ })).not.toBeInTheDocument());
    expect(screen.getByText(/Player: Test Quarterback/)).toBeInTheDocument();
  });
});
