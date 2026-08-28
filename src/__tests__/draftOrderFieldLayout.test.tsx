// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDraftOrderAnimationPlan, createDraftOrderDraw } from "../features/draft-order/draftOrderEngine";
import DraftDashRenderer from "../features/draft-order/renderers/DraftDashRenderer";
import PuntBounceRenderer from "../features/draft-order/renderers/PuntBounceRenderer";
import type { DraftOrderMode, DraftOrderParticipant } from "../features/draft-order/types";

function participants(count = 12): DraftOrderParticipant[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `manager-${index}`,
    source: "manual",
    managerName: `Manager ${index + 1}`,
    teamName: `Team ${index + 1}`,
    avatarUrl: `https://example.com/avatar-${index}.png`,
    color: index % 2 === 0 ? "#42d57b" : "#f1b84b",
  }));
}

async function fieldProps(mode: DraftOrderMode, count = 12) {
  const draw = await createDraftOrderDraw({
    participants: participants(count),
    mode,
    masterSeed: "AAECAwQFBgcICQoLDA0ODw",
  });
  const plan = await createDraftOrderAnimationPlan(draw);
  return { draw, plan, complete: true, onReveal: vi.fn(), onComplete: vi.fn() };
}

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("draft order field identity rails", () => {
  it("keeps every Dash team avatar in a fixed left rail and a separate clipped race track", async () => {
    const { container } = render(<DraftDashRenderer {...await fieldProps("draft-dash")} />);

    expect(container.querySelectorAll(".dash-team")).toHaveLength(12);
    expect(container.querySelectorAll(".dash-team .showdown-participant-mark")).toHaveLength(12);
    expect(container.querySelectorAll(".dash-track")).toHaveLength(12);
    expect(container.querySelectorAll(".dash-lane.is-finished")).toHaveLength(12);
  });

  it("keeps every Punt avatar and settled result in the rail instead of floating over footballs", async () => {
    const { container } = render(<PuntBounceRenderer {...await fieldProps("punt-bounce")} />);

    expect(container.querySelectorAll(".punt-team .showdown-participant-mark")).toHaveLength(12);
    expect(container.querySelectorAll(".punt-team-result")).toHaveLength(12);
    expect(container.querySelectorAll(".punt-result-badge")).toHaveLength(0);
    expect(container.querySelector(".showdown-live-board.is-order-only")).toBeInTheDocument();
  });
});
