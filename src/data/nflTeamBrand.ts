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

export interface NflTeamBrand {
  primary: string;
  secondary: string;
  accent: string;
  foreground: string;
}

const FREE_AGENT_BRAND: NflTeamBrand = {
  primary: "#33433a",
  secondary: "#111a15",
  accent: "#9fb3a7",
  foreground: "#f7fbf8",
};

const NFL_TEAM_BRANDS: Record<string, NflTeamBrand> = {
  ARI: { primary: "#97233f", secondary: "#000000", accent: "#ffb612", foreground: "#ffffff" },
  ATL: { primary: "#a71930", secondary: "#000000", accent: "#a5acaf", foreground: "#ffffff" },
  BAL: { primary: "#241773", secondary: "#000000", accent: "#9e7c0c", foreground: "#ffffff" },
  BUF: { primary: "#00338d", secondary: "#c60c30", accent: "#ffffff", foreground: "#ffffff" },
  CAR: { primary: "#0085ca", secondary: "#101820", accent: "#bfc0bf", foreground: "#ffffff" },
  CHI: { primary: "#0b162a", secondary: "#c83803", accent: "#ffffff", foreground: "#ffffff" },
  CIN: { primary: "#fb4f14", secondary: "#000000", accent: "#ffffff", foreground: "#ffffff" },
  CLE: { primary: "#311d00", secondary: "#ff3c00", accent: "#ffffff", foreground: "#ffffff" },
  DAL: { primary: "#003594", secondary: "#041e42", accent: "#869397", foreground: "#ffffff" },
  DEN: { primary: "#fb4f14", secondary: "#002244", accent: "#ffffff", foreground: "#ffffff" },
  DET: { primary: "#0076b6", secondary: "#b0b7bc", accent: "#ffffff", foreground: "#ffffff" },
  GB: { primary: "#203731", secondary: "#ffb612", accent: "#ffffff", foreground: "#ffffff" },
  HOU: { primary: "#03202f", secondary: "#a71930", accent: "#ffffff", foreground: "#ffffff" },
  IND: { primary: "#002c5f", secondary: "#a2aaad", accent: "#ffffff", foreground: "#ffffff" },
  JAX: { primary: "#006778", secondary: "#101820", accent: "#d7a22a", foreground: "#ffffff" },
  KC: { primary: "#e31837", secondary: "#ffb81c", accent: "#ffffff", foreground: "#ffffff" },
  LAC: { primary: "#0080c6", secondary: "#ffc20e", accent: "#ffffff", foreground: "#ffffff" },
  LAR: { primary: "#003594", secondary: "#ffa300", accent: "#ffcd00", foreground: "#ffffff" },
  LV: { primary: "#000000", secondary: "#a5acaf", accent: "#ffffff", foreground: "#ffffff" },
  MIA: { primary: "#008e97", secondary: "#fc4c02", accent: "#ffffff", foreground: "#ffffff" },
  MIN: { primary: "#4f2683", secondary: "#ffc62f", accent: "#ffffff", foreground: "#ffffff" },
  NE: { primary: "#002244", secondary: "#c60c30", accent: "#b0b7bc", foreground: "#ffffff" },
  NO: { primary: "#101820", secondary: "#d3bc8d", accent: "#ffffff", foreground: "#ffffff" },
  NYG: { primary: "#0b2265", secondary: "#a71930", accent: "#ffffff", foreground: "#ffffff" },
  NYJ: { primary: "#125740", secondary: "#000000", accent: "#ffffff", foreground: "#ffffff" },
  PHI: { primary: "#004c54", secondary: "#a5acaf", accent: "#ffffff", foreground: "#ffffff" },
  PIT: { primary: "#101820", secondary: "#ffb612", accent: "#ffffff", foreground: "#ffffff" },
  SEA: { primary: "#002244", secondary: "#69be28", accent: "#a5acaf", foreground: "#ffffff" },
  SF: { primary: "#aa0000", secondary: "#b3995d", accent: "#ffffff", foreground: "#ffffff" },
  TB: { primary: "#d50a0a", secondary: "#34302b", accent: "#ff7900", foreground: "#ffffff" },
  TEN: { primary: "#0c2340", secondary: "#4b92db", accent: "#c8102e", foreground: "#ffffff" },
  WAS: { primary: "#5a1414", secondary: "#ffb612", accent: "#ffffff", foreground: "#ffffff" },
};

export function normalizeNflTeam(team: string | null | undefined) {
  const raw = String(team ?? "").trim().toUpperCase();
  if (!raw) return "";
  return TEAM_ALIASES[raw] ?? raw;
}

export function getNflTeamBrand(team: string | null | undefined): NflTeamBrand {
  return NFL_TEAM_BRANDS[normalizeNflTeam(team)] ?? FREE_AGENT_BRAND;
}

export function getNflTeamCssVars(team: string | null | undefined) {
  const brand = getNflTeamBrand(team);
  return {
    "--team-primary": brand.primary,
    "--team-secondary": brand.secondary,
    "--team-accent": brand.accent,
    "--team-foreground": brand.foreground,
  };
}
