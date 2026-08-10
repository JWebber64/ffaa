import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const root = process.cwd();
const analyticsRoot = resolve(root, "public", "data", "analytics");
const seasons = [2022, 2023, 2024, 2025];

const downloads = [
  ...seasons.map((season) => ({
    url: `https://github.com/ffverse/ffopportunity/releases/download/latest-data/ep_weekly_${season}.csv`,
    destination: resolve(analyticsRoot, "ffopportunity", `ep_weekly_${season}.csv`),
  })),
  {
    url: "https://github.com/nflverse/nflverse-data/releases/download/nextgen_stats/ngs_rushing.csv.gz",
    destination: resolve(analyticsRoot, "nflverse-nextgen", "ngs_rushing.csv.gz"),
  },
  {
    url: "https://github.com/nflverse/nflverse-data/releases/download/nextgen_stats/ngs_passing.csv.gz",
    destination: resolve(analyticsRoot, "nflverse-nextgen", "ngs_passing.csv.gz"),
  },
];

async function download(url: string, destination: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);

  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
  console.log(`Saved ${destination.replace(root + "\\", "")} from ${url}`);
}

async function main() {
  await Promise.all(downloads.map(({ url, destination }) => download(url, destination)));
}

void main();
