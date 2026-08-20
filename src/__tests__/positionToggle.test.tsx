// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import PositionPickerModal from "../components/modals/PositionPickerModal";
import { PositionToggle } from "../ui/PositionToggle";
import { DEFAULT_POSITION_TOGGLE_OPTIONS } from "../ui/positionToggleOptions";

afterEach(cleanup);

describe("PositionToggle", () => {
  it("uses the shared position color tokens and exposes the selected state", () => {
    render(
      <PositionToggle
        ariaLabel="Position filter"
        options={DEFAULT_POSITION_TOGGLE_OPTIONS}
        value="WR"
        onChange={() => undefined}
      />,
    );

    expect(screen.getByRole("group", { name: "Position filter" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "All" }).style.getPropertyValue("--position-toggle-color")).toBe("var(--a2)");
    expect(screen.getByRole("button", { name: "QB" }).style.getPropertyValue("--position-toggle-color")).toBe("var(--pos-qb)");
    expect(screen.getByRole("button", { name: "DEF" }).style.getPropertyValue("--position-toggle-color")).toBe("var(--pos-dst)");
    expect(screen.getByRole("button", { name: "WR" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("reports the newly selected position", () => {
    const onChange = vi.fn();
    render(
      <PositionToggle
        ariaLabel="Position filter"
        options={DEFAULT_POSITION_TOGGLE_OPTIONS}
        value="ALL"
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "RB" }));
    expect(onChange).toHaveBeenCalledWith("RB");
  });

  it("uses the colored position control when assigning a roster slot", () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(
      <PositionPickerModal
        isOpen
        onClose={onClose}
        onConfirm={onConfirm}
        player={{ name: "Test Player" }}
        team={{ name: "Test Team" }}
        validSlots={[
          { id: "qb-slot", position: "QB" },
          { id: "flex-slot", position: "FLEX" },
        ]}
      />,
    );

    const group = screen.getByRole("group", { name: "Position slot for Test Player" });
    const qb = group.querySelector<HTMLButtonElement>('button[style*="--position-toggle-color"]');
    expect(qb?.style.getPropertyValue("--position-toggle-color")).toBe("var(--pos-qb)");

    fireEvent.click(screen.getByRole("button", { name: "FLEX" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onConfirm).toHaveBeenCalledWith("flex-slot");
    expect(onClose).toHaveBeenCalledOnce();
  });
});
