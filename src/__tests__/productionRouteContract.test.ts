import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

describe("Production route contract", () => {
  it("retires legacy /ff/ service workers before the SPA fallback", () => {
    const config = JSON.parse(readFileSync(resolve(projectRoot, "vercel.json"), "utf8")) as {
      rewrites: Array<{ source: string; destination: string }>;
    };
    const workerRoute = config.rewrites.findIndex((rewrite) => rewrite.source === "/ff/sw.js");
    const appFallback = config.rewrites.findIndex((rewrite) => rewrite.source === "/ff/:path*");
    const worker = readFileSync(resolve(projectRoot, "public/sw.js"), "utf8");

    expect(workerRoute).toBeGreaterThanOrEqual(0);
    expect(workerRoute).toBeLessThan(appFallback);
    expect(config.rewrites[workerRoute]?.destination).toBe("/sw.js");
    expect(worker).toContain('addEventListener("install"');
    expect(worker).toContain("skipWaiting()");
    expect(worker).toContain("clients.claim()");
    expect(worker).not.toContain('addEventListener("fetch"');
  });
});
