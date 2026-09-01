import { CalendarDays, ClipboardList, History, Sparkles, Trophy, Users, Wrench, type LucideIcon } from "lucide-react";

export type MenuLink = { to: string; label: string; detail: string; icon: LucideIcon };

export function buildLeagueLinks(activeLeagueId: string, activeLeagueName?: string): MenuLink[] {
  return [
    { to: "/my-hq", label: "This Week", detail: "Your next decisions", icon: Sparkles },
    { to: "/league/teams", label: "Teams", detail: "Saved rosters and projected starters", icon: Users },
    { to: "/league/lineup", label: "Lineup", detail: "Set and save weekly starters", icon: ClipboardList },
    { to: "/league/matchups", label: "Matchups", detail: "Weekly projection board", icon: CalendarDays },
    { to: "/league", label: "League HQ", detail: "Connect and manage leagues", icon: Trophy },
    {
      to: activeLeagueId ? `/league?league=${activeLeagueId}&view=futures` : "/league?view=futures",
      label: "Power Rankings & Odds",
      detail: "Power Index title odds and win totals",
      icon: Sparkles,
    },
    {
      to: activeLeagueId ? `/league/${activeLeagueId}/` : "/league",
      label: "League history",
      detail: activeLeagueName ? `Open ${activeLeagueName}` : "Connect a league first",
      icon: History,
    },
    { to: activeLeagueId ? `/league/${activeLeagueId}/managers` : "/league", label: "Managers", detail: "Careers and identity", icon: Users },
    { to: activeLeagueId ? `/league/${activeLeagueId}/h2h` : "/league", label: "Rivalries", detail: "Head-to-head history", icon: Trophy },
    { to: activeLeagueId ? `/league/${activeLeagueId}/records` : "/league", label: "Records", detail: "League-wide marks", icon: History },
    { to: activeLeagueId ? `/league?league=${activeLeagueId}&view=rules` : "/league", label: "Commissioner tools", detail: "Rules, imports, and settings", icon: Wrench },
  ];
}
