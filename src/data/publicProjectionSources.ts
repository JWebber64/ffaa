import type { AuctionScoring } from "./playerValues";

export type PublicProjectionSource = {
  id: string;
  label: string;
  url: string;
  refreshMode: "automated" | "browser-capture" | "cataloged";
  includedInConsensus: boolean;
  scoring?: AuctionScoring;
  note: string;
};

/**
 * Independent publishers receive at most one consensus vote. Aggregators are
 * cataloged but excluded when their underlying publishers are already present.
 */
export const PUBLIC_PROJECTION_SOURCES: PublicProjectionSource[] = [
  {
    id: "espn-clay",
    label: "ESPN Mike Clay projections",
    url: "https://g.espncdn.com/s/ffldraftkit/26/NFLDK2026_CS_ClayProjections2026.pdf",
    refreshMode: "automated",
    includedInConsensus: true,
    scoring: "ppr",
    note: "Full public season stat-line projection guide.",
  },
  {
    id: "sleeper-season",
    label: "Sleeper season projections",
    url: "https://sleeper.com/leagues/1385319428408774656/players",
    refreshMode: "browser-capture",
    includedInConsensus: true,
    scoring: "ppr",
    note: "Read from Players > Projection > 2026 > Season in the public league UI.",
  },
  {
    id: "winwithodds",
    label: "WinWithOdds Vegas projections",
    url: "https://www.winwithodds.com/season_long_full_stats",
    refreshMode: "automated",
    includedInConsensus: true,
    scoring: "ppr",
    note: "Season-long player props converted to fantasy projections.",
  },
  {
    id: "fftoday-projections",
    label: "FFToday projections",
    url: "https://www.fftoday.com/rankings/playerproj.php?Season=2026",
    refreshMode: "automated",
    includedInConsensus: true,
    scoring: "halfPpr",
    note: "Full public positional tables with receptions and half-PPR points.",
  },
  {
    id: "cbs-projections",
    label: "CBS Sports projections",
    url: "https://www.cbssports.com/fantasy/football/stats/",
    refreshMode: "automated",
    includedInConsensus: true,
    scoring: "standard",
    note: "Full public positional tables with receptions and non-PPR points.",
  },
  {
    id: "razzball-projections",
    label: "Razzball projections",
    url: "https://football.razzball.com/projections/",
    refreshMode: "cataloged",
    includedInConsensus: false,
    note: "Public table is cataloged, but Cloudflare currently blocks unattended refreshes.",
  },
  {
    id: "fantasypros-consensus",
    label: "FantasyPros projection consensus",
    url: "https://www.fantasypros.com/nfl/projections/qb.php?week=draft",
    refreshMode: "cataloged",
    includedInConsensus: false,
    note: "Derivative ESPN/CBS/FFToday aggregate; excluded to prevent double counting.",
  },
  {
    id: "rotowire-projections",
    label: "RotoWire projections",
    url: "https://www.rotowire.com/football/projections.php",
    refreshMode: "cataloged",
    includedInConsensus: false,
    note: "The complete projection product requires a subscription.",
  },
];
