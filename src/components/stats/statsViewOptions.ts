import {
  Activity,
  BadgeDollarSign,
  CalendarSearch,
  ChartNoAxesCombined,
  Shield,
  TrendingUp,
  Trophy,
} from "lucide-react";

export const STATS_VIEW_OPTIONS = [
  {
    value: "leaders",
    label: "Leaders",
    description: "Fantasy scoring and recent form",
    icon: Trophy,
  },
  {
    value: "draft",
    label: "Draft",
    description: "ADP, projections, and values",
    icon: ChartNoAxesCombined,
  },
  {
    value: "auction",
    label: "Auction Values",
    description: "Consensus and every value source",
    icon: BadgeDollarSign,
  },
  {
    value: "opportunity",
    label: "Opportunity",
    description: "Touches, targets, and usage",
    icon: Activity,
  },
  {
    value: "trends",
    label: "Trends",
    description: "Recent production and market movement",
    icon: TrendingUp,
  },
  {
    value: "matchups",
    label: "Matchups",
    description: "Opponent and schedule context",
    icon: CalendarSearch,
  },
  {
    value: "teams",
    label: "Teams / D/ST",
    description: "Team usage and defensive scoring",
    icon: Shield,
  },
] as const;

export type StatsView = (typeof STATS_VIEW_OPTIONS)[number]["value"];
