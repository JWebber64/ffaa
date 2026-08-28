// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDraftOrderAnimationPlan, createDraftOrderDraw } from "../features/draft-order/draftOrderEngine";
import FootballPlinkoRenderer from "../features/draft-order/renderers/FootballPlinkoRenderer";
import type { DraftOrderParticipant } from "../features/draft-order/types";

function participants(count = 12): DraftOrderParticipant[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `manager-${index}`,
    source: "manual",
    managerName: `Manager ${index + 1}`,
    teamName: `Team ${index + 1}`,
    color: index % 2 === 0 ? "#42d57b" : "#f1b84b",
  }));
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

describe("Football Plinko reveal", () => {
  it("builds lateral peg routes and a stadium landing slot for every locked result", async () => {
    const draw = await createDraftOrderDraw({
      participants: participants(),
      mode: "football-plinko",
      masterSeed: "AAECAwQFBgcICQoLDA0ODw",
    });
    const plan = await createDraftOrderAnimationPlan(draw);
    const { container } = render(
      <FootballPlinkoRenderer draw={draw} plan={plan} onReveal={vi.fn()} onComplete={vi.fn()} />,
    );

    expect(screen.getByText("Ball drop")).toBeInTheDocument();
    expect(screen.getAllByText((_, element) => element?.tagName === "SPAN" && /^Pick \d+$/.test(element.textContent ?? ""))).toHaveLength(12);

    const tokens = [...container.querySelectorAll<HTMLElement>(".plinko-token")];
    expect(tokens).toHaveLength(12);
    expect(tokens.every((token) => token.style.getPropertyValue("--plinko-x1").endsWith("cqw"))).toBe(true);
    expect(tokens.every((token) => new Set(token.dataset.path?.split(",")).size > 4)).toBe(true);
    expect(new Set(tokens.map((token) => token.dataset.path)).size).toBeGreaterThan(5);
    expect(container.querySelector<HTMLElement>(".plinko-board")?.style.getPropertyValue("--plinko-slot-count")).toBe("12");
  });

  it("uses a deterministic launch sequence that is separate from pick rank", async () => {
    const draw = await createDraftOrderDraw({
      participants: participants(),
      mode: "football-plinko",
      masterSeed: "AAECAwQFBgcICQoLDA0ODw",
    });
    const first = await createDraftOrderAnimationPlan(draw);
    const replay = await createDraftOrderAnimationPlan(draw);

    expect(replay).toEqual(first);
    const launchRanks = [...first.cues]
      .sort((a, b) => a.delayMs - b.delayMs)
      .map((cue) => cue.rank);
    expect(launchRanks).not.toEqual(draw.finalParticipantIds.map((_, index) => index));
    expect(new Set(first.cues.map((cue) => cue.delayMs)).size).toBe(draw.participants.length);
  });
});
