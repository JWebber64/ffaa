import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "../..");

const universalProfileConsumers = [
  "src/components/auction/NominationQueue.tsx",
  "src/components/PlayerPool.tsx",
  "src/components/unified/PlayerSearch.tsx",
  "src/features/auction-values/ComparisonTable.tsx",
  "src/features/auction-values/SourceSheet.tsx",
  "src/features/league-history/ui/draft/DraftIntelligencePanel.tsx",
  "src/features/league-history/ui/pages/ActivityPage.tsx",
  "src/features/league-history/ui/pages/SeasonsPage.tsx",
  "src/screens/Auctioneer.tsx",
  "src/screens/DraftBoard.tsx",
  "src/screens/LeagueLineup.tsx",
  "src/screens/LeagueMatchups.tsx",
  "src/screens/LeaguePlayers.tsx",
  "src/screens/LeagueTeams.tsx",
  "src/screens/MyHQ.tsx",
  "src/screens/tools/AuctionTeamBuilder.tsx",
  "src/screens/tools/PlayerCompare.tsx",
  "src/screens/tools/TeamRater.tsx",
  "src/screens_v2/DraftRoomV2.tsx",
  "src/screens_v2/OfflineDraftV2.tsx",
  "src/screens_v2/ResultsV2.tsx",
] as const;

const leagueSheetConsumers = [
  "src/features/native-draft/NativeDraftBoard.tsx",
  "src/features/native-lineup/NativeLineupWorkspace.tsx",
  "src/features/native-scoring/NativeLiveMatchupWorkspace.tsx",
  "src/features/native-trades/NativeTradeWorkspace.tsx",
  "src/features/native-waivers/NativeWaiverWorkspace.tsx",
] as const;

function source(path: string) {
  return readFileSync(resolve(projectRoot, path), "utf8");
}

describe("player profile consumer contract", () => {
  it("keeps the universal profile provider mounted for application-wide consumers", () => {
    expect(source("src/App.tsx")).toContain("<PlayerProfileProvider>");
  });

  it.each(universalProfileConsumers)("keeps PlayerProfileButton on %s", (path) => {
    expect(source(path)).toContain("PlayerProfileButton");
  });

  it("keeps the league player sheet mounted around every league workspace route", () => {
    expect(source("src/layouts/LeagueWorkspaceLayout.tsx")).toContain("<LeaguePlayerSheetProvider>");
  });

  it.each(leagueSheetConsumers)("keeps the league player-sheet trigger on %s", (path) => {
    expect(source(path)).toContain("useLeaguePlayerSheet");
  });

  it("keeps Stats Explorer's purpose-built profile drawer as the documented exception", () => {
    expect(source("src/screens/StatsExplorer.tsx")).toContain("StatsPlayerDrawer");
  });
});
