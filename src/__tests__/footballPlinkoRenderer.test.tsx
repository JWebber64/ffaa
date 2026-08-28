// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
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
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Football Plinko reveal", () => {
  it("builds round avatar routes that strike seven rendered pegs before reaching a locked slot", async () => {
    const draw = await createDraftOrderDraw({
      participants: participants(),
      mode: "football-plinko",
      masterSeed: "AAECAwQFBgcICQoLDA0ODw",
    });
    const plan = await createDraftOrderAnimationPlan(draw);
    const { container } = render(
      <FootballPlinkoRenderer draw={draw} plan={plan} onReveal={vi.fn()} onComplete={vi.fn()} />,
    );

    expect(screen.getByText("Live drop")).toBeInTheDocument();
    expect(screen.getAllByText((_, element) => element?.tagName === "SPAN" && /^Pick \d+$/.test(element.textContent ?? ""))).toHaveLength(12);

    const tokens = [...container.querySelectorAll<HTMLElement>(".plinko-token")];
    const pegRows = [...container.querySelectorAll<HTMLElement>(".plinko-peg-row")]
      .map((row) => [...row.querySelectorAll<HTMLElement>("[data-peg-x]")].map((peg) => Number(peg.dataset.pegX)));
    expect(tokens).toHaveLength(12);
    expect(tokens.every((token) => token.dataset.shape === "round")).toBe(true);
    expect(container.querySelector(".plinko-ball-laces")).not.toBeInTheDocument();
    expect(tokens.every((token) => token.style.getPropertyValue("--plinko-x1").endsWith("cqw"))).toBe(true);
    expect(tokens.every((token) => token.dataset.impactCount === "7")).toBe(true);
    expect(container.querySelectorAll(".plinko-impact")).toHaveLength(84);
    expect(tokens.every((token) => token.dataset.path?.split(",").every((point, row) => pegRows[row]?.includes(Number(point))))).toBe(true);
    expect(new Set(tokens.map((token) => token.dataset.path)).size).toBeGreaterThan(5);
    expect(container.querySelector<HTMLElement>(".plinko-board")?.style.getPropertyValue("--plinko-slot-count")).toBe("12");
  });

  it("uses one-at-a-time deterministic launches and saves picks three, two, and one for last", async () => {
    const draw = await createDraftOrderDraw({
      participants: participants(),
      mode: "football-plinko",
      masterSeed: "AAECAwQFBgcICQoLDA0ODw",
    });
    const first = await createDraftOrderAnimationPlan(draw);
    const replay = await createDraftOrderAnimationPlan(draw);

    expect(replay).toEqual(first);
    const launchCues = [...first.cues].sort((a, b) => a.delayMs - b.delayMs);
    const launchRanks = launchCues.map((cue) => cue.rank);
    expect(launchRanks).not.toEqual(draw.finalParticipantIds.map((_, index) => index));
    expect(launchRanks.slice(-3)).toEqual([2, 1, 0]);
    expect(launchCues.slice(1).every((cue, index) => cue.delayMs - launchCues[index]!.delayMs > launchCues[index]!.durationMs)).toBe(true);
    expect(new Set(first.cues.map((cue) => cue.delayMs)).size).toBe(draw.participants.length);
  });

  it("replaces the waiting-card grid with a compact recent-landing strip and pick callout", async () => {
    vi.useFakeTimers();
    const draw = await createDraftOrderDraw({
      participants: participants(),
      mode: "football-plinko",
      masterSeed: "AAECAwQFBgcICQoLDA0ODw",
    });
    const plan = await createDraftOrderAnimationPlan(draw);
    const firstCue = [...plan.cues].sort((a, b) => a.delayMs - b.delayMs)[0]!;
    const firstParticipant = draw.participants.find((participant) => participant.id === firstCue.participantId)!;
    const firstPick = firstCue.rank + 1;
    const { container } = render(
      <FootballPlinkoRenderer draw={draw} plan={plan} onReveal={vi.fn()} onComplete={vi.fn()} />,
    );

    expect(container.querySelector(".showdown-live-order")).not.toBeInTheDocument();
    expect(container.querySelectorAll(".plinko-reveal-strip li")).toHaveLength(0);

    await act(async () => {
      vi.advanceTimersByTime(firstCue.delayMs + firstCue.durationMs + 1);
    });

    expect(container.querySelector(".plinko-landing-callout")).toHaveTextContent(`Pick ${firstPick}`);
    expect(container.querySelector(".plinko-landing-callout")).toHaveTextContent(firstParticipant.teamName);
    expect(container.querySelectorAll(".plinko-reveal-strip li")).toHaveLength(1);
  });
});
