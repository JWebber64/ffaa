import { appUrl } from "@/lib/appBasePath";
import type { SleeperPlayerRow } from "@/data/playerStatCategories";

let directoryPromise: Promise<SleeperPlayerRow[]> | null = null;

export function loadSleeperPlayerDirectory() {
  if (!directoryPromise) {
    directoryPromise = fetch(appUrl("data/players-2026-sleeper.json"))
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Sleeper player directory returned ${response.status}`);
        }
        const rows = (await response.json()) as unknown;
        if (!Array.isArray(rows)) throw new Error("Sleeper player directory is invalid");
        return rows as SleeperPlayerRow[];
      })
      .catch((error) => {
        directoryPromise = null;
        throw error;
      });
  }

  return directoryPromise;
}
