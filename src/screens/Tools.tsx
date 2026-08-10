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

  if (normalizedPath.endsWith("/player-compare")) return <PlayerCompare />;
  if (normalizedPath.endsWith("/auction-builder")) return <AuctionTeamBuilder />;
  if (normalizedPath.endsWith("/team-rater")) return <TeamRater />;
  if (normalizedPath.endsWith("/schedule")) return <ScheduleLab />;
  if (normalizedPath.endsWith("/offensive-line")) return <OffensiveLineEnvironment />;
  return <ToolsHub />;
}
