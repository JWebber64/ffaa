export function replaceLeagueRouteId(
  pathname: string,
  previousLeagueId: string,
  canonicalLeagueId: string,
) {
  const prefix = `/league/${encodeURIComponent(previousLeagueId)}`;
  if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) {
    return `/league/${encodeURIComponent(canonicalLeagueId)}`;
  }
  return `/league/${encodeURIComponent(canonicalLeagueId)}${pathname.slice(prefix.length)}`;
}
