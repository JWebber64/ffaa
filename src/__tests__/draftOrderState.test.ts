import { describe, expect, it } from "vitest";
import {
  draftOrderShowdownReducer,
  INITIAL_SHOWDOWN_STATE,
} from "../features/draft-order/showdownMachine";
import type { DraftOrderParticipant } from "../features/draft-order/types";

const participants: DraftOrderParticipant[] = Array.from({ length: 8 }, (_, index) => ({
  id: `manager-${index}`,
  managerName: `Manager ${index + 1}`,
  teamName: `Team ${index + 1}`,
  color: "var(--green-400)",
  source: "manual",
}));

describe("draft order state machine", () => {
  it("locks participant editing outside setup and game selection", () => {
    const setup = draftOrderShowdownReducer(INITIAL_SHOWDOWN_STATE, { type: "set-participants", participants });
    const choosing = draftOrderShowdownReducer(setup, { type: "choose-game" });
    const changed = draftOrderShowdownReducer(choosing, { type: "set-participants", participants: participants.slice(0, 4) });
    expect(changed.participants).toHaveLength(4);

    const running = { ...changed, phase: "running" as const };
    const rejected = draftOrderShowdownReducer(running, { type: "set-participants", participants });
    expect(rejected.participants).toHaveLength(4);
  });

  it("does not advance setup without at least two participants", () => {
    const one = draftOrderShowdownReducer(INITIAL_SHOWDOWN_STATE, { type: "set-participants", participants: participants.slice(0, 1) });
    expect(draftOrderShowdownReducer(one, { type: "choose-game" }).phase).toBe("setup");
  });

  it("resets every active field back to a clean setup", () => {
    const activeState = {
      ...INITIAL_SHOWDOWN_STATE,
      phase: "results" as const,
      participants,
      leagueId: "league-123",
      readOnly: true,
      accepted: true,
    };

    expect(draftOrderShowdownReducer(activeState, { type: "reset" })).toEqual(INITIAL_SHOWDOWN_STATE);
  });
});
