import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type PackageManifest = {
  scripts?: Record<string, string>;
};

type VercelConfig = {
  buildCommand?: string;
};

const projectRoot = process.cwd();
const packageManifest = JSON.parse(
  readFileSync(resolve(projectRoot, "package.json"), "utf8"),
) as PackageManifest;
const vercelConfig = JSON.parse(
  readFileSync(resolve(projectRoot, "vercel.json"), "utf8"),
) as VercelConfig;

describe("Production release pipeline", () => {
  it("requires lint, the complete test suite, and an artifact build before Vercel can deploy", () => {
    const releaseVerification = packageManifest.scripts?.["release:verify"] ?? "";

    expect(vercelConfig.buildCommand).toBe("npm run release:verify");
    expect(releaseVerification).toContain("npm run lint");
    expect(releaseVerification).toContain("vitest run");
    expect(releaseVerification).toContain("npm run build:vercel:artifact");
    expect(packageManifest.scripts?.["build:vercel:artifact"]).toBeTruthy();
  });
});
