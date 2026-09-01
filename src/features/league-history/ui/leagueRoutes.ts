import type { Manager } from "../domain/types";

const RECOVERABLE_SECTIONS = [
  "champions",
  "archive",
  "leaderboards",
  "transactions",
  "managers",
  "history",
  "records",
  "seasons",
  "drafts",
  "payouts",
  "trades",
  "waivers",
  "h2h",
] as const;

export function leagueHistoryPath(leagueId: string, section = "") {
  const normalizedSection = section.replace(/^\/+|\/+$/g, "");
  const canonicalSection = normalizedSection === "history"
    ? "archive"
    : normalizedSection.startsWith("history/")
      ? normalizedSection.slice("history/".length)
      : normalizedSection;
  const basePath = `/league/${encodeURIComponent(leagueId)}/history`;
  return canonicalSection ? `${basePath}/${canonicalSection}` : basePath;
}

export function leagueRivalryPath(leagueId: string, managerAId: string, managerBId: string) {
  return leagueHistoryPath(
    leagueId,
    `rivalries/${encodeURIComponent(managerAId)}/${encodeURIComponent(managerBId)}`,
  );
}

export function resolveLeagueHistoryManagerId(
  managers: ReadonlyArray<Pick<Manager, "id" | "provider" | "providerUserId">>,
  routeId: string,
) {
  const direct = managers.find((manager) => manager.id === routeId);
  if (direct) return direct.id;

  return managers.find((manager) => (
    manager.providerUserId === routeId
    || routeId === `${manager.provider}-user-${manager.providerUserId}`
  ))?.id ?? routeId;
}

export function recoverLeagueHistoryPath(leagueId: string, pathname: string) {
  const normalizedPath = pathname.replace(/\/+$/, "");
  const recoveredSection = RECOVERABLE_SECTIONS.find((section) => normalizedPath.endsWith(`/${section}`));
  return leagueHistoryPath(leagueId, recoveredSection ?? "");
}
