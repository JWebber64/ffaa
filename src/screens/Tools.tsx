import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import { OffensiveLineEnvironment } from "@/screens/tools/OffensiveLineEnvironment";
import { AuctionTeamBuilder } from "@/screens/tools/AuctionTeamBuilder";
import { PlayerCompare } from "@/screens/tools/PlayerCompare";
import { ScheduleLab } from "@/screens/tools/ScheduleLab";
import { TeamRater } from "@/screens/tools/TeamRater";
import { ToolsHub } from "@/screens/tools/ToolsHub";
import "@/screens/tools/tools.css";

export default function Tools() {
  const { pathname } = useLocation();
  const normalizedPath = pathname.replace(/\/+$/, "");
  const [recentPaths, setRecentPaths] = useState<string[]>([]);

  useEffect(() => {
    const storageKey = "ffaa.recentDecisionTools.v1";
    let saved: string[] = [];
    try {
      const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]") as unknown;
      saved = Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
    } catch {
      // Invalid local state is equivalent to an empty recent-tools list.
    }
    if (normalizedPath !== "/tools") {
      saved = [normalizedPath, ...saved.filter((path) => path !== normalizedPath)].slice(0, 5);
      window.localStorage.setItem(storageKey, JSON.stringify(saved));
    }
    setRecentPaths(saved);
  }, [normalizedPath]);

  if (normalizedPath.endsWith("/player-compare")) return <PlayerCompare />;
  if (normalizedPath.endsWith("/auction-builder")) return <AuctionTeamBuilder />;
  if (normalizedPath.endsWith("/team-rater")) return <TeamRater />;
  if (normalizedPath.endsWith("/schedule")) return <ScheduleLab />;
  if (normalizedPath.endsWith("/offensive-line")) return <OffensiveLineEnvironment />;
  return <ToolsHub recentPaths={recentPaths} />;
}
