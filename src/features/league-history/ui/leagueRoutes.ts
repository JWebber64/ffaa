const RECOVERABLE_SECTIONS = [
  "history/champions",
  "leaderboards",
  "transactions",
  "managers",
  "history",
  "records",
  "seasons",
  "drafts",
  "trades",
  "waivers",
  "h2h",
] as const;

export function leagueHistoryPath(leagueId: string, section = "") {
  const normalizedSection = section.replace(/^\/+|\/+$/g, "");
  const basePath = `/league/${encodeURIComponent(leagueId)}`;
  return normalizedSection ? `${basePath}/${normalizedSection}` : basePath;
}

export function recoverLeagueHistoryPath(leagueId: string, pathname: string) {
  const normalizedPath = pathname.replace(/\/+$/, "");
  const recoveredSection = RECOVERABLE_SECTIONS.find((section) => normalizedPath.endsWith(`/${section}`));
  return leagueHistoryPath(leagueId, recoveredSection ?? "");
}
