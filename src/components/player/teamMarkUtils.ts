const TEAM_ALIASES: Record<string, string> = {
  ARZ: "ARI",
  JAC: "JAX",
  JAX: "JAX",
  LA: "LAR",
  LVR: "LV",
  NOR: "NO",
  NWE: "NE",
  SFO: "SF",
  TAM: "TB",
  WSH: "WAS",
};

const TEAM_BYE_WEEKS: Record<string, number> = {
  ARI: 14,
  ATL: 11,
  BAL: 13,
  BUF: 7,
  CAR: 5,
  CHI: 10,
  CIN: 6,
  CLE: 11,
  DAL: 14,
  DEN: 10,
  DET: 6,
  GB: 11,
  HOU: 8,
  IND: 13,
  JAX: 7,
  KC: 5,
  LAC: 7,
  LAR: 11,
  LV: 13,
  MIA: 6,
  MIN: 6,
  NE: 11,
  NO: 8,
  NYG: 8,
  NYJ: 13,
  PHI: 10,
  PIT: 9,
  SEA: 11,
  SF: 8,
  TB: 10,
  TEN: 9,
  WAS: 7,
};

export function normalizeTeamAbbr(team: string | null | undefined) {
  const raw = String(team ?? "").trim().toUpperCase();
  if (!raw) return "";
  return TEAM_ALIASES[raw] ?? raw;
}

function cleanByeWeek(byeWeek: number | null | undefined) {
  return typeof byeWeek === "number" && Number.isFinite(byeWeek) && byeWeek > 0
    ? Math.round(byeWeek)
    : undefined;
}

export function getTeamByeWeek(team: string | null | undefined) {
  return TEAM_BYE_WEEKS[normalizeTeamAbbr(team)];
}

export function resolveByeWeek(team: string | null | undefined, byeWeek: number | null | undefined) {
  return cleanByeWeek(byeWeek) ?? getTeamByeWeek(team);
}

export function formatByeWeek(byeWeek: number | null | undefined) {
  const cleanWeek = cleanByeWeek(byeWeek);
  return cleanWeek ? `Bye ${cleanWeek}` : "";
}

export function formatTeamBye(team: string | null | undefined, byeWeek: number | null | undefined) {
  const normalizedTeam = normalizeTeamAbbr(team);
  const resolvedByeWeek = resolveByeWeek(normalizedTeam, byeWeek);
  return [normalizedTeam, resolvedByeWeek ? `Bye ${resolvedByeWeek}` : ""].filter(Boolean).join(" | ");
}
