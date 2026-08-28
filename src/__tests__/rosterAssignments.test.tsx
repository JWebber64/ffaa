// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import TeamBoard from "../components/draft/TeamBoard";
import {
  getTeamRosterAssignments,
  isRosterPlayerEligibleForSlot,
  moveRosterPlayerToSlot,
  type RosterPlayer,
  type RosterSlot,
} from "../components/draft/rosterAssignments";

const rosterSlots: RosterSlot[] = [
  { slot: "QB", count: 1 },
  { slot: "WR", count: 1 },
  { slot: "FLEX", count: 1, flexEligible: ["RB", "WR", "TE"] },
  { slot: "BENCH", count: 2 },
  { slot: "IR", count: 1 },
];

const benchReceiver: RosterPlayer = {
  playerId: "bench-wr",
  name: "Bench Receiver",
  pos: "WR",
  price: 3,
  team: "SF",
  byeWeek: 8,
};

const startingReceiver: RosterPlayer = {
  playerId: "starting-wr",
  name: "Starting Receiver",
  pos: "WR",
  price: 24,
};

function assignmentFor(assignments: ReturnType<typeof getTeamRosterAssignments>, key: string) {
  return assignments.find((assignment) => assignment.key === key)?.assigned?.playerId ?? null;
}

describe("roster slot assignments", () => {
  it("keeps an explicitly benched receiver on the bench when the roster reloads", () => {
    const assignments = getTeamRosterAssignments(rosterSlots, [
      { ...benchReceiver, assignedSlot: "BENCH-0" },
      startingReceiver,
    ]);

    expect(assignmentFor(assignments, "WR-0")).toBe("starting-wr");
    expect(assignmentFor(assignments, "BENCH-0")).toBe("bench-wr");
  });

  it("swaps an occupied eligible destination instead of dropping either player", () => {
    const movedRoster = moveRosterPlayerToSlot(
      rosterSlots,
      [benchReceiver, startingReceiver],
      "bench-wr",
      "BENCH-0"
    );
    const assignments = getTeamRosterAssignments(rosterSlots, movedRoster);

    expect(assignmentFor(assignments, "WR-0")).toBe("starting-wr");
    expect(assignmentFor(assignments, "BENCH-0")).toBe("bench-wr");
    expect(movedRoster).toHaveLength(2);
  });

  it("only permits the player's natural, flex, and bench destinations", () => {
    const assignments = getTeamRosterAssignments(rosterSlots, [benchReceiver]);
    const eligibleKeys = assignments
      .filter((assignment) => isRosterPlayerEligibleForSlot(benchReceiver, assignment))
      .map((assignment) => assignment.key);

    expect(eligibleKeys).toEqual(["WR-0", "FLEX-0", "BENCH-0", "BENCH-1"]);
    expect(moveRosterPlayerToSlot(rosterSlots, [benchReceiver], "bench-wr", "QB-0")).toEqual([
      benchReceiver,
    ]);
  });

  it("keeps team and bye visible while the whole player card moves to an eligible slot", () => {
    const onPlayerMove = vi.fn();
    let dragPayload = "";
    const dataTransfer = {
      dropEffect: "none",
      effectAllowed: "none",
      setData: vi.fn((_type: string, value: string) => {
        dragPayload = value;
      }),
      getData: vi.fn(() => dragPayload),
    };
    render(
      <TeamBoard
        teams={[
          {
            teamId: "offline-t1",
            name: "Team 1",
            budget: 200,
            spent: 3,
            roster: [benchReceiver],
          },
        ]}
        rosterSlots={rosterSlots}
        onPlayerMove={onPlayerMove}
      />
    );

    const playerCard = screen.getByRole("button", { name: "Move Bench Receiver from WR" });
    expect(playerCard.getAttribute("draggable")).toBe("true");
    expect(screen.getByLabelText("SF | Bye 8")).toBeTruthy();
    expect(screen.queryByRole("combobox", { name: /Move Bench Receiver/ })).toBeNull();

    fireEvent.dragStart(playerCard, { dataTransfer });
    const benchSlot = screen.getByRole("button", { name: "Move Bench Receiver to BN1" });
    fireEvent.dragOver(benchSlot, { dataTransfer });
    fireEvent.drop(benchSlot, { dataTransfer });
    fireEvent.dragEnd(playerCard, { dataTransfer });
    fireEvent.click(playerCard);

    expect(onPlayerMove).toHaveBeenCalledWith("offline-t1", "bench-wr", "BENCH-0");
    expect(screen.queryByRole("button", { name: "Move Bench Receiver to BN1" })).toBeNull();
  });
});
