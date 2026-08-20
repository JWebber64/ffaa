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
    expect(design).toContain("compact teal up/down chevron control");
    expect(design).toContain("Do not expose browser-native number arrows");
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
