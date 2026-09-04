// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";

import { NumericInput } from "../ui/NumericInput";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function collectTsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return collectTsxFiles(path);
    return extname(entry.name) === ".tsx" ? [path] : [];
  });
}

function ControlledBudget() {
  const [value, setValue] = useState(200);
  return (
    <NumericInput
      aria-label="Auction budget"
      max={201}
      min={199}
      onChange={(event) => setValue(Number(event.target.value))}
      value={value}
    />
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("numeric input consistency", () => {
  it("documents the one shared numeric-stepper rule", () => {
    const design = readFileSync(resolve(projectRoot, "DESIGN.md"), "utf8");
    expect(design).toContain("compact green-accented up/down chevron control");
    expect(design).toContain("Do not expose browser-native number arrows");
  });

  it("uses the stepper palette across the complete numeric field", () => {
    const globals = readFileSync(resolve(projectRoot, "src/styles/globals.css"), "utf8");
    const refinement = readFileSync(resolve(projectRoot, "src/styles/refinement.css"), "utf8");
    const tools = readFileSync(resolve(projectRoot, "src/screens/tools/tools.css"), "utf8");

    expect(globals).toMatch(/\.ffaa-number-field > input\[type="number"\]\s*\{[^}]*padding-right:\s*46px[^}]*appearance:\s*textfield/s);
    expect(globals).toMatch(/\.ffaa-number-stepper\s*\{[^}]*width:\s*32px[^}]*height:\s*32px[^}]*border-radius:\s*10px[^}]*--green-300/s);
    expect(globals).not.toMatch(/\.draft-bid-stepper\s*\{/s);
    expect(globals).toMatch(/\.ffaa-custom-select-icon\s*\{[^}]*place-items:\s*center[^}]*width:\s*24px[^}]*height:\s*24px/s);
    expect(globals).not.toMatch(/\.setup-budget-field > \.ffaa-number-stepper\s*\{/s);
    expect(refinement).toMatch(/\.auction-budget-input\s*\{[^}]*background:\s*var\(--color-surface-field\)/s);
    expect(tools).toMatch(/\.team-slot-stepper input\s*\{[^}]*background:\s*transparent/s);
  });

  it("increments and decrements a controlled value through accessible hit regions", () => {
    const { container } = render(<ControlledBudget />);
    const input = screen.getByRole("spinbutton", { name: "Auction budget" }) as HTMLInputElement;

    expect(container.querySelector(".ffaa-number-stepper-visual > svg.ffaa-control-chevron")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Increase Auction budget" }));
    expect(input.value).toBe("201");
    expect((screen.getByRole("button", { name: "Increase Auction budget" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Decrease Auction budget" }));
    expect(input.value).toBe("200");
  });

  it("prefers the controlled value when compatibility callers also provide a default", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<NumericInput aria-label="Legacy amount" value={7} defaultValue={1} readOnly />);

    expect((screen.getByRole("spinbutton", { name: "Legacy amount" }) as HTMLInputElement).value).toBe("7");
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("reserves enough room to show the auction bid beside its stepper", () => {
    const tools = readFileSync(resolve(projectRoot, "src/screens/tools/tools.css"), "utf8");
    const width = tools.match(/\.auction-selected-ticket label > span\s*\{[^}]*width:\s*(\d+)px/s)?.[1];

    expect(Number(width)).toBeGreaterThanOrEqual(112);
  });

  it("routes every editable native number field through NumericInput", () => {
    const violations = collectTsxFiles(resolve(projectRoot, "src")).flatMap((path) => {
      if (path.endsWith("NumericInput.tsx") || path.includes(`${sep}__tests__${sep}`)) return [];
      const source = readFileSync(path, "utf8");
      const hasNativeNumberInput = /<input[\s\S]{0,220}?type="number"/.test(source);
      return hasNativeNumberInput ? [path.replace(`${projectRoot}${sep}`, "")] : [];
    });

    expect(violations).toEqual([]);
  });
});
