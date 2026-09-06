import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type Rewrite = {
  source: string;
  destination: string;
};

type ManifestIcon = {
  src: string;
  sizes: string;
  type: string;
  purpose: string;
};

const projectRoot = process.cwd();
const cacheVersion = "20260906";
const pngSignature = "89504e470d0a1a0a";

describe("Production favicon contract", () => {
  it("uses one cache-busted football favicon family", () => {
    const index = readFileSync(resolve(projectRoot, "index.html"), "utf8");
    const manifest = JSON.parse(
      readFileSync(resolve(projectRoot, "public/site.webmanifest"), "utf8"),
    ) as { icons: ManifestIcon[] };

    expect(index).toContain(`/ff/favicon-32.png?v=${cacheVersion}`);
    expect(index).toContain(`/ff/icon-180.png?v=${cacheVersion}`);
    expect(index).toContain(`/ff/site.webmanifest?v=${cacheVersion}`);
    expect(index).not.toContain("favicon.svg");
    expect(manifest.icons).toEqual([
      {
        src: `/ff/icon-192.png?v=${cacheVersion}`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `/ff/icon-512.png?v=${cacheVersion}`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ]);

    for (const file of ["favicon-32.png", "icon-180.png", "icon-192.png", "icon-512.png"]) {
      const path = resolve(projectRoot, "public", file);
      expect(existsSync(path), file).toBe(true);
      expect(readFileSync(path).subarray(0, 8).toString("hex"), file).toBe(pngSignature);
    }
    expect(existsSync(resolve(projectRoot, "public/favicon.svg"))).toBe(false);
  });

  it("serves every browser icon asset before the SPA fallback", () => {
    const config = JSON.parse(
      readFileSync(resolve(projectRoot, "vercel.json"), "utf8"),
    ) as { rewrites: Rewrite[] };
    const fallbackIndex = config.rewrites.findIndex((rewrite) => rewrite.source === "/ff/:path*");
    const requiredRewrites: Rewrite[] = [
      { source: "/ff/favicon-32.png", destination: "/favicon-32.png" },
      { source: "/ff/icon-180.png", destination: "/icon-180.png" },
      { source: "/ff/icon-192.png", destination: "/icon-192.png" },
      { source: "/ff/icon-512.png", destination: "/icon-512.png" },
      { source: "/ff/site.webmanifest", destination: "/site.webmanifest" },
    ];

    expect(fallbackIndex).toBeGreaterThanOrEqual(0);
    for (const required of requiredRewrites) {
      const rewriteIndex = config.rewrites.findIndex(
        (rewrite) => rewrite.source === required.source && rewrite.destination === required.destination,
      );
      expect(rewriteIndex, required.source).toBeGreaterThanOrEqual(0);
      expect(rewriteIndex, required.source).toBeLessThan(fallbackIndex);
    }
  });
});
