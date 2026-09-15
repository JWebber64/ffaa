/* @vitest-environment jsdom */
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { load, enrich } = vi.hoisted(() => ({ load: vi.fn(), enrich: vi.fn() }));
vi.mock("../features/weekly-recap/recapSource", () => ({ loadRecapWeek: load, loadRecapRivalries: enrich }));
import { useRecapWeek } from "../features/weekly-recap/useRecapWeek";
import type { RecapWeek } from "../features/weekly-recap/recapSource";

beforeEach(() => { vi.useFakeTimers(); load.mockReset(); enrich.mockReset().mockImplementation(async (data: RecapWeek) => data); vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible"); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
const week = (number: number, status: "final" | "pending" = "final") => ({ week: number, status, recaps: [] }) as unknown as RecapWeek;

describe("recap loading and refresh lifecycle", () => {
  it("shows the main report while history loads, then adds the rivalry", async () => {
    let finish: (value: RecapWeek) => void = () => {};
    const base = week(1);
    const enriched = { ...base, updatedAt: "enriched" };
    load.mockResolvedValue(base);
    enrich.mockReturnValueOnce(new Promise<RecapWeek>((resolve) => { finish = resolve; }));
    const { result } = renderHook(() => useRecapWeek("123", 2026, 1));
    await act(async () => {});
    expect(result.current.data).toBe(base);
    await act(async () => { finish(enriched); });
    expect(result.current.data).toBe(enriched);
  });
  it("does not let slow history overwrite a newer score correction for the same week", async () => {
    let finishOld: (value: RecapWeek) => void = () => {};
    const corrected = { ...week(1), updatedAt: "corrected" };
    load.mockResolvedValueOnce(week(1)).mockResolvedValueOnce(corrected);
    enrich.mockReturnValueOnce(new Promise<RecapWeek>((resolve) => { finishOld = resolve; }));
    const { result } = renderHook(() => useRecapWeek("123", 2026, 1));
    await act(async () => {});
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    await act(async () => { finishOld(week(1)); });
    expect(result.current.data).toBe(corrected);
  });
  it("ignores late history from a previously selected week", async () => {
    let finishOld: (value: RecapWeek) => void = () => {};
    load.mockResolvedValueOnce(week(1)).mockResolvedValueOnce(week(2));
    enrich.mockReturnValueOnce(new Promise<RecapWeek>((resolve) => { finishOld = resolve; }));
    const { result, rerender } = renderHook(({ selected }) => useRecapWeek("123", 2026, selected), { initialProps: { selected: 1 } });
    await act(async () => {});
    rerender({ selected: 2 });
    await act(async () => {});
    await act(async () => { finishOld(week(1)); });
    expect(result.current.data?.week).toBe(2);
  });
  it("checks visible pages each minute and picks up finalization without a generate button", async () => {
    load.mockResolvedValueOnce(week(1, "pending")).mockResolvedValueOnce(week(1));
    const { result } = renderHook(() => useRecapWeek("123", 2026, 1));
    await act(async () => {});
    expect(result.current.data?.status).toBe("pending");
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(result.current.data?.status).toBe("final");
    expect(load).toHaveBeenCalledTimes(2);
  });
  it("ignores a late response from the previously selected week", async () => {
    let finishOld: (value: RecapWeek) => void = () => {};
    load.mockReturnValueOnce(new Promise<RecapWeek>((resolve) => { finishOld = resolve; })).mockResolvedValueOnce(week(2));
    const { result, rerender } = renderHook(({ selectedWeek }) => useRecapWeek("123", 2026, selectedWeek), { initialProps: { selectedWeek: 1 } });
    rerender({ selectedWeek: 2 });
    expect(result.current.data).toBeNull();
    await act(async () => {});
    expect(result.current.data?.week).toBe(2);
    await act(async () => { finishOld(week(1)); });
    expect(result.current.data?.week).toBe(2);
  });
  it("shows request errors and supports an explicit retry", async () => {
    load.mockRejectedValueOnce(new Error("Source unavailable")).mockResolvedValueOnce(week(1));
    const { result } = renderHook(() => useRecapWeek("123"));
    await act(async () => {});
    expect(result.current.error).toBe("Source unavailable");
    await act(async () => { result.current.refresh(); });
    expect(result.current.error).toBe("");
    expect(result.current.data?.status).toBe("final");
  });
  it("does not read an unresolved league or poll a hidden page", async () => {
    load.mockResolvedValue(week(1));
    const { rerender } = renderHook(({ id }) => useRecapWeek(id), { initialProps: { id: "" } });
    await act(async () => {});
    expect(load).not.toHaveBeenCalled();
    rerender({ id: "123" });
    await act(async () => {});
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(load).toHaveBeenCalledTimes(1);
  });
});
