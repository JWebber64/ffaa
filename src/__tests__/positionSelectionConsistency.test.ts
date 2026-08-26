import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function readProjectFile(path: string) {
  return readFileSync(resolve(projectRoot, path), "utf8");
}

describe("position selection consistency", () => {
  it("uses the shared colored toggle for every button-style position selector", () => {
    for (const path of [
      "src/screens/tools/AuctionTeamBuilder.tsx",
      "src/components/PlayerPool.tsx",
      "src/components/modals/PositionPickerModal.tsx",
    ]) {
      expect(readProjectFile(path), path).toContain("<PositionToggle");
    }

    expect(readProjectFile("src/screens/tools/AuctionTeamBuilder.tsx")).not.toContain("auction-position-filter");
    expect(readProjectFile("src/components/PlayerPool.tsx")).not.toContain('role="tab"');
    expect(readProjectFile("src/components/modals/PositionPickerModal.tsx")).not.toContain("RadioGroup");
  });

  it("uses the complete shared filter options on every player position toggle", () => {
    for (const path of [
      "src/components/PlayerPool.tsx",
      "src/components/manager/MobileManagerDraftView.tsx",
      "src/screens/AnalyticsLab.tsx",
      "src/screens/StatsExplorer.tsx",
      "src/screens/tools/AuctionTeamBuilder.tsx",
      "src/screens/tools/TeamRater.tsx",
      "src/screens_v2/DraftRoomV2.tsx",
      "src/screens_v2/OfflineDraftV2.tsx",
    ]) {
      expect(readProjectFile(path), path).toContain("DEFAULT_POSITION_TOGGLE_OPTIONS");
    }
  });

  it("keeps dropdown and multi-select position controls tied to position color tokens", () => {
    expect(readProjectFile("src/screens/tools/ScheduleLab.tsx")).toContain("data-position={option}");
    expect(readProjectFile("src/screens_v2/OfflineDraftV2.tsx")).toContain("position={positionSelectToken(position)}");
    expect(readProjectFile("src/components/roster/RosterRow.tsx")).toContain("'--chip-color': posColor");
  });
});
