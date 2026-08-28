import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function readProjectFile(path: string) {
  return readFileSync(resolve(projectRoot, path), "utf8");
}

describe("punt motion contract", () => {
  it("keeps forward travel and spin continuous while vertical physics animate independently", () => {
    const renderer = readProjectFile("src/features/draft-order/renderers/PuntBounceRenderer.tsx");
    const styles = readProjectFile("src/features/draft-order/draft-order.css");

    expect(renderer).toContain('className="punt-ball-height"');
    expect(renderer).toContain('className="punt-ball-spin"');
    expect(styles).toContain("animation: punt-forward var(--punt-duration) linear");
    expect(styles).toContain("animation: punt-spin var(--punt-duration) linear");
    expect(styles).toContain("animation: punt-shadow-forward var(--punt-duration) linear");
    expect(styles).not.toContain("@keyframes punt-flight");
  });
});
