export const LEAGUE_HQ_VIEWS = [
  { id: "overview", label: "Overview" },
  { id: "futures", label: "Power Rankings & Odds" },
  { id: "rules", label: "Rules" },
  { id: "managers", label: "Managers" },
  { id: "records", label: "Records" },
  { id: "seasons", label: "Season archive" },
  { id: "rivalries", label: "Rivalries" },
  { id: "draft", label: "Draft Central" },
] as const;

export type LeagueView = (typeof LEAGUE_HQ_VIEWS)[number]["id"];

export function isLeagueView(value: string | null): value is LeagueView {
  return LEAGUE_HQ_VIEWS.some((view) => view.id === value);
}

export function leagueOddsRedirectTarget(search: string) {
  const searchParams = new URLSearchParams(search);
  searchParams.set("view", "futures");
  return { pathname: "/league", search: `?${searchParams.toString()}` };
}
