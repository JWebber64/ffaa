// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/stats/StatsPlayerDrawer", () => ({
  StatsPlayerDrawer: ({ player, onClose }: { player: { name: string } | null; onClose: () => void }) => player ? (
    <div role="dialog" aria-label={`${player.name} profile`}>
      <span>{player.name}</span>
      <button type="button" onClick={onClose}>Close</button>
    </div>
  ) : null,
}));

import {
  PlayerProfileButton,
  PlayerProfileProvider,
} from "@/features/player-profile/PlayerProfileProvider";

describe("PlayerProfileProvider", () => {
  it("opens the shared dialog from a player identity and closes it", () => {
    render(
      <PlayerProfileProvider>
        <PlayerProfileButton player={{ id: "ja", name: "Josh Allen", position: "QB", team: "BUF" }}>
          Josh Allen
        </PlayerProfileButton>
      </PlayerProfileProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Josh Allen" }));
    expect(screen.getByRole("dialog", { name: "Josh Allen profile" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
