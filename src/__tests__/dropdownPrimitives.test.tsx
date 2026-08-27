/* @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DropdownMenu, DropdownMenuItem } from "../ui/DropdownMenu";
import { UniversalSelect } from "../ui/UniversalSelect";

describe("shared dropdown primitives", () => {
  it("closes DropdownMenu after an enabled item action", () => {
    const onSelect = vi.fn();
    render(
      <DropdownMenu trigger={<button type="button">Controls</button>}>
        <DropdownMenuItem onClick={onSelect}>Pause draft</DropdownMenuItem>
      </DropdownMenu>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Controls" }));
    fireEvent.click(screen.getByRole("button", { name: "Pause draft" }));

    expect(onSelect).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Pause draft" })).not.toBeInTheDocument();
  });

  it("closes UniversalSelect after choosing an option", () => {
    render(
      <UniversalSelect aria-label="Scoring format" defaultValue="ppr">
        <option value="ppr">PPR</option>
        <option value="half">Half PPR</option>
      </UniversalSelect>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Scoring format: PPR" }));
    fireEvent.click(screen.getByRole("option", { name: "Half PPR" }));

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Scoring format: Half PPR" })).toHaveAttribute("aria-expanded", "false");
  });
});
