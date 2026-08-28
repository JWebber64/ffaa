// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDraftOrderAnimationPlan, createDraftOrderDraw } from "../features/draft-order/draftOrderEngine";
import type { DraftOrderParticipant, DraftRoomOrderContext } from "../features/draft-order/types";
import { INITIAL_SHOWDOWN_STATE } from "../features/draft-order/showdownMachine";

const adapterMocks = vi.hoisted(() => ({
  importLeague: vi.fn(),
  importRoom: vi.fn(),
  loadRoom: vi.fn(),
  apply: vi.fn(),
}));

const persistenceMocks = vi.hoisted(() => ({
  save: vi.fn(),
  share: vi.fn(),
  loadShare: vi.fn(),
}));

vi.mock("../features/draft-order/draftOrderLeagueAdapter", () => ({
  loadSleeperDraftOrderParticipants: adapterMocks.importLeague,
  loadDraftRoomOrderContextByCode: adapterMocks.importRoom,
  loadDraftRoomOrderContext: adapterMocks.loadRoom,
  applyDraftOrderToRoom: adapterMocks.apply,
}));

vi.mock("../features/draft-order/draftOrderPersistence", () => ({
  saveDraftOrderDraw: persistenceMocks.save,
  createDraftOrderShare: persistenceMocks.share,
  loadSharedDraftOrderDraw: persistenceMocks.loadShare,
}));

import DraftOrderShowdown from "../features/draft-order/DraftOrderShowdown";

function participants(count = 8, source: DraftOrderParticipant["source"] = "manual"): DraftOrderParticipant[] {
  return Array.from({ length: count }, (_, index) => ({
    id: source === "draft-room" ? `draft-room:user-${index}` : `manager-${index}`,
    source,
    ...(source === "draft-room" ? { sourceId: `user-${index}` } : {}),
    managerName: `Manager ${index + 1}`,
    teamName: `Team ${index + 1}`,
    color: "var(--green-400)",
  }));
}

function roomContext(isHost: boolean): DraftRoomOrderContext {
  return {
    draftId: "room-id",
    code: "ABC123",
    draftType: "snake",
    teamCount: 8,
    humanSeatCount: 8,
    isHost,
    isLobby: true,
    participants: participants(8, "draft-room"),
  };
}

function renderShowdown(route = "/draft-order") {
  return render(<MemoryRouter initialEntries={[route]}><DraftOrderShowdown /></MemoryRouter>);
}

async function pasteManagersAndStart() {
  fireEvent.change(screen.getByLabelText("Manager or team names"), { target: { value: Array.from({ length: 8 }, (_, index) => `Team ${index + 1}`).join("\n") } });
  fireEvent.click(screen.getByRole("button", { name: "Add names" }));
  fireEvent.click(screen.getByRole("button", { name: "Choose game" }));
  fireEvent.click(screen.getByRole("button", { name: "Start Showdown" }));
  await screen.findByLabelText("Showdown countdown");
}

async function seedResults(context: DraftRoomOrderContext | null = null) {
  const drawParticipants = context?.participants ?? participants();
  const draw = await createDraftOrderDraw({
    participants: drawParticipants,
    mode: "draft-dash",
    masterSeed: "AAECAwQFBgcICQoLDA0ODw",
    ...(context ? { draftId: context.draftId } : {}),
  });
  const animationPlan = await createDraftOrderAnimationPlan(draw);
  window.localStorage.setItem("ffaa.draftOrder.active.v1", JSON.stringify({
    ...INITIAL_SHOWDOWN_STATE,
    phase: "results",
    participants: drawParticipants,
    selectedMode: draw.mode,
    draw,
    animationPlan,
    roomContext: context,
  }));
  return draw;
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  window.matchMedia = vi.fn().mockImplementation(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
  adapterMocks.importLeague.mockResolvedValue({ leagueName: "Test League", participants: participants() });
  adapterMocks.importRoom.mockResolvedValue(roomContext(true));
  adapterMocks.loadRoom.mockResolvedValue(roomContext(true));
  adapterMocks.apply.mockResolvedValue({ applied: true });
  persistenceMocks.save.mockResolvedValue({ saved: true, remote: false });
  persistenceMocks.share.mockResolvedValue({ url: "https://gamehqhub.com/ff/draft-order?share=token", remote: true });
  persistenceMocks.loadShare.mockReset();
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Draft Order Showdown UI", () => {
  it("shows all three game images without the split preview card", () => {
    renderShowdown();
    fireEvent.change(screen.getByLabelText("Manager or team names"), { target: { value: Array.from({ length: 8 }, (_, index) => `Team ${index + 1}`).join("\n") } });
    fireEvent.click(screen.getByRole("button", { name: "Add names" }));
    fireEvent.click(screen.getByRole("button", { name: "Choose game" }));

    const artwork = Array.from(document.querySelectorAll<HTMLImageElement>(".mode-picker-art img"));
    expect(artwork).toHaveLength(3);
    expect(artwork.map((image) => image.getAttribute("src"))).toEqual([
      "/images/draft-order/draft-dash.jpg",
      "/images/draft-order/football-plinko.jpg",
      "/images/draft-order/punt-bounce.jpg",
    ]);
    expect(artwork.map((image) => [image.width, image.height])).toEqual([
      [1672, 941],
      [1672, 941],
      [1818, 865],
    ]);
    expect(document.querySelector(".mode-preview")).not.toBeInTheDocument();
    expect(document.querySelector(".mode-picker svg")).not.toBeInTheDocument();
  });

  it("supports pasted manual entry, editable stable participants, game selection, and immediate countdown", async () => {
    renderShowdown();
    expect(screen.getByRole("button", { name: "Reset" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Manager or team names"), { target: { value: Array.from({ length: 8 }, (_, index) => `Team ${index + 1}`).join("\n") } });
    fireEvent.click(screen.getByRole("button", { name: "Add names" }));
    fireEvent.click(screen.getByRole("button", { name: "Choose game" }));
    expect(screen.getByRole("button", { name: "Reset" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /40-Yard Draft Dash/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Football Plinko/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Punt Bounce/ })).toBeInTheDocument();
    expect(screen.queryByText("Helmet Shuffle")).not.toBeInTheDocument();
    expect(screen.queryByText("Fumble-Pile Reveal")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start Showdown" }));
    expect(await screen.findByLabelText("Showdown countdown")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Manager or team names")).not.toBeInTheDocument();
    expect(screen.queryByText("Commitment hash")).not.toBeInTheDocument();
    expect(screen.getByText("Draw 1")).toBeInTheDocument();
  }, 10_000);

  it("imports an existing league through the setup flow", async () => {
    renderShowdown("/draft-order?league=123456789012345");
    fireEvent.click(screen.getByRole("button", { name: "Import league managers" }));
    await waitFor(() => expect(adapterMocks.importLeague).toHaveBeenCalledWith("123456789012345"));
    expect(await screen.findByDisplayValue("Manager 1")).toBeInTheDocument();
    expect(screen.getByText("Imported 8 managers from Test League.")).toBeInTheDocument();
  });

  it("runs the countdown, skips animation, copies the full order, and replays without rerolling", async () => {
    await import("../features/draft-order/renderers/DraftDashRenderer");
    renderShowdown();
    await pasteManagersAndStart();
    const skip = await screen.findByRole("button", { name: "Skip" }, { timeout: 6_000 });
    fireEvent.click(skip);
    expect(screen.getByRole("dialog", { name: /owns the first pick/ })).toBeInTheDocument();
    expect(document.querySelector(".showdown-dash")).toBeInTheDocument();
    expect(screen.getByText(/owns the first pick/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close draft order popup" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const viewOrder = screen.getByRole("button", { name: "View order" });
    expect(screen.getByRole("heading", { name: "40-Yard Draft Dash" })).toBeInTheDocument();
    await waitFor(() => expect(viewOrder).toHaveFocus());
    fireEvent.click(viewOrder);
    expect(screen.getByRole("dialog", { name: /owns the first pick/ })).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Copy Order" })); await Promise.resolve(); });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining("GameHQ Draft Order"));
    fireEvent.click(screen.getByRole("button", { name: "Replay Animation" }));
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Draw 1")).toBeInTheDocument();
  }, 10_000);

  it("rejects unauthorized official application in the result UI", async () => {
    await seedResults(roomContext(false));
    renderShowdown();
    const applyButton = screen.getByRole("button", { name: "Apply to Draft Room" });
    expect(applyButton).toBeDisabled();
    expect(screen.getByText("Only that room's host can apply the official order.")).toBeInTheDocument();
    expect(adapterMocks.apply).not.toHaveBeenCalled();
  });

  it("saves, shares, applies a host-authorized order, and visibly separates a reroll", async () => {
    const firstDraw = await seedResults(roomContext(true));
    renderShowdown();
    fireEvent.click(screen.getByRole("button", { name: "Save Draw" }));
    await waitFor(() => expect(persistenceMocks.save).toHaveBeenCalledWith(expect.objectContaining({ id: firstDraw.id }), false));
    fireEvent.click(screen.getByRole("button", { name: "Share Replay" }));
    await waitFor(() => expect(persistenceMocks.share).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Apply to Draft Room" }));
    await waitFor(() => expect(adapterMocks.apply).toHaveBeenCalledWith(expect.objectContaining({ isHost: true }), expect.objectContaining({ id: firstDraw.id })));
    expect(await screen.findByRole("button", { name: "Applied to Draft Room" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Generate New Order" }));
    expect(await screen.findByLabelText("Showdown countdown")).toBeInTheDocument();
    expect(screen.getByText("Draw 2")).toBeInTheDocument();
  });

  it("resets a completed draw back to empty setup and clears its active record", async () => {
    await seedResults();
    renderShowdown();

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("Reset Draft Order Showdown"));
    expect(screen.getByLabelText("Manager or team names")).toHaveValue("");
    expect(screen.queryByText(/owns the first pick/)).not.toBeInTheDocument();
    expect(window.localStorage.getItem("ffaa.draftOrder.active.v1")).toBeNull();
  });

  it("loads a shared replay as the exact read-only result without offering a reroll", async () => {
    const draw = await createDraftOrderDraw({ participants: participants(), mode: "football-plinko", masterSeed: "AAECAwQFBgcICQoLDA0ODw" });
    await createDraftOrderAnimationPlan(draw);
    persistenceMocks.loadShare.mockResolvedValue(draw);
    renderShowdown("/draft-order?share=token");
    expect(await screen.findByText(/owns the first pick/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Generate New Order" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Replay Animation" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset" })).toBeInTheDocument();
  });
});
