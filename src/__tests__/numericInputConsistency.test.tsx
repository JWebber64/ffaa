// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
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

afterEach(cleanup);

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

    expect(globals).toMatch(/\.ffaa-number-field > input\[type="number"\]\s*\{[^}]*background:\s*var\(--color-surface-field\)\s*!important/s);
    expect(globals).toMatch(/\.ffaa-number-stepper\s*\{[^}]*width:\s*28px[^}]*height:\s*28px[^}]*background:\s*var\(--color-surface-field\)/s);
    expect(globals).toMatch(/\.draft-bid-stepper\s*\{[^}]*width:\s*28px[^}]*height:\s*28px[^}]*background:\s*var\(--color-surface-field\)/s);
    expect(globals).toMatch(/\.ffaa-custom-select-icon\s*\{[^}]*width:\s*28px[^}]*height:\s*28px[^}]*background:\s*var\(--color-surface-field\)/s);
    expect(globals).toMatch(/\.setup-budget-field > \.ffaa-number-stepper\s*\{[^}]*right:\s*5px[^}]*width:\s*24px[^}]*height:\s*24px/s);
    expect(readFileSync(resolve(projectRoot, "src/screens_v2/HostSetupV2.tsx"), "utf8")).toContain('shellClassName="setup-budget-field"');
    expect(refinement).toMatch(/\.auction-budget-input\s*\{[^}]*background:\s*var\(--color-surface-field\)/s);
    expect(tools).toMatch(/\.team-slot-stepper input\s*\{[^}]*background:\s*transparent/s);
  });

  it("increments and decrements a controlled value through accessible hit regions", () => {
    render(<ControlledBudget />);
    const input = screen.getByRole("spinbutton", { name: "Auction budget" }) as HTMLInputElement;

    fireEvent.click(screen.getByRole("button", { name: "Increase Auction budget" }));
    expect(input.value).toBe("201");
    expect((screen.getByRole("button", { name: "Increase Auction budget" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Decrease Auction budget" }));
    expect(input.value).toBe("200");
  });

  it("keeps direct native number inputs limited to the established draft stepper implementation", () => {
    const violations = collectTsxFiles(resolve(projectRoot, "src")).flatMap((path) => {
      if (path.endsWith("NumericInput.tsx")) return [];
      const source = readFileSync(path, "utf8");
      const hasNativeNumberInput = /<input[\s\S]{0,220}?type="number"/.test(source);
      return hasNativeNumberInput && !source.includes("draft-bid-stepper")
        ? [path.replace(`${projectRoot}\\`, "")]
        : [];
    });

    expect(violations).toEqual([]);
  });
});
