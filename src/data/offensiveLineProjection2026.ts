export const OFFENSIVE_LINE_PROJECTION_SEASON = 2026;
export const OFFENSIVE_LINE_PROJECTION_AS_OF = "2026-07-31";

export type OffensiveLineProjectionSourceId =
  | "fantasyAlarm"
  | "fantasyPros"
  | "sharp"
  | "fourForFour";

const TEAM_META = [
  ["ARI", "Arizona Cardinals"],
  ["ATL", "Atlanta Falcons"],
  ["BAL", "Baltimore Ravens"],
  ["BUF", "Buffalo Bills"],
  ["CAR", "Carolina Panthers"],
  ["CHI", "Chicago Bears"],
  ["CIN", "Cincinnati Bengals"],
  ["CLE", "Cleveland Browns"],
  ["DAL", "Dallas Cowboys"],
  ["DEN", "Denver Broncos"],
  ["DET", "Detroit Lions"],
  ["GB", "Green Bay Packers"],
  ["HOU", "Houston Texans"],
  ["IND", "Indianapolis Colts"],
  ["JAX", "Jacksonville Jaguars"],
  ["KC", "Kansas City Chiefs"],
  ["LAC", "Los Angeles Chargers"],
  ["LAR", "Los Angeles Rams"],
  ["LV", "Las Vegas Raiders"],
  ["MIA", "Miami Dolphins"],
  ["MIN", "Minnesota Vikings"],
  ["NE", "New England Patriots"],
  ["NO", "New Orleans Saints"],
  ["NYG", "New York Giants"],
  ["NYJ", "New York Jets"],
  ["PHI", "Philadelphia Eagles"],
  ["PIT", "Pittsburgh Steelers"],
  ["SEA", "Seattle Seahawks"],
  ["SF", "San Francisco 49ers"],
  ["TB", "Tampa Bay Buccaneers"],
  ["TEN", "Tennessee Titans"],
  ["WAS", "Washington Commanders"],
] as const;

export type OffensiveLineProjectionTeam = (typeof TEAM_META)[number][0];

interface OffensiveLineProjectionSource {
  id: OffensiveLineProjectionSourceId;
  label: string;
  shortLabel: string;
  publishedAt: string;
  updatedAt?: string;
  url: string;
  methodology: string;
  rankings: Record<OffensiveLineProjectionTeam, number>;
}

const FANTASY_ALARM_RANKINGS = {
  DEN: 1, LAR: 2, PHI: 3, IND: 4, SF: 5, ATL: 6, BUF: 7, CHI: 8,
  TB: 9, MIN: 10, LAC: 11, CAR: 12, PIT: 13, KC: 14, DET: 15, SEA: 16,
  NO: 17, DAL: 18, NE: 19, NYG: 20, NYJ: 21, ARI: 22, LV: 23, JAX: 24,
  HOU: 25, BAL: 26, WAS: 27, MIA: 28, CIN: 29, TEN: 30, GB: 31, CLE: 32,
} satisfies Record<OffensiveLineProjectionTeam, number>;

const FANTASY_PROS_RANKINGS = {
  DEN: 1, PHI: 2, LAC: 3, IND: 4, CHI: 5, MIN: 6, NO: 7, BUF: 8,
  CAR: 9, LAR: 10, TB: 11, DET: 12, KC: 13, NYJ: 14, NYG: 15, JAX: 16,
  NE: 17, BAL: 18, SEA: 19, WAS: 20, DAL: 21, MIA: 22, CIN: 23, PIT: 24,
  SF: 25, LV: 26, GB: 27, CLE: 28, ATL: 29, HOU: 30, ARI: 31, TEN: 32,
} satisfies Record<OffensiveLineProjectionTeam, number>;

const SHARP_RANKINGS = {
  DEN: 1, PHI: 2, BUF: 3, TB: 4, LAR: 5, CHI: 6, SF: 7, LAC: 8,
  SEA: 9, ATL: 10, IND: 10, CAR: 12, MIN: 12, DET: 14, NE: 15, NO: 16,
  JAX: 17, DAL: 17, NYJ: 19, NYG: 20, PIT: 21, WAS: 22, KC: 23, BAL: 24,
  LV: 25, ARI: 26, GB: 27, CIN: 28, MIA: 29, TEN: 30, HOU: 31, CLE: 32,
} satisfies Record<OffensiveLineProjectionTeam, number>;

const FOUR_FOR_FOUR_RANKINGS = {
  DEN: 1, LAR: 2, CAR: 3, PHI: 4, CHI: 5, TB: 6, SF: 7, KC: 8,
  MIN: 9, NE: 10, DAL: 11, BUF: 12, JAX: 13, IND: 14, ARI: 15, PIT: 16,
  LAC: 17, NYG: 18, DET: 19, NYJ: 19, LV: 21, HOU: 22, SEA: 23, ATL: 24,
  WAS: 25, BAL: 26, NO: 27, TEN: 28, CIN: 29, GB: 30, CLE: 31, MIA: 32,
} satisfies Record<OffensiveLineProjectionTeam, number>;

export const OFFENSIVE_LINE_PROJECTION_SOURCES: readonly OffensiveLineProjectionSource[] = [
  {
    id: "fantasyAlarm",
    label: "Fantasy Alarm",
    shortLabel: "Fantasy Alarm",
    publishedAt: "2026-07-31",
    url: "https://www.fantasyalarm.com/articles/nfl/fantasy-football-draft-guide/2026-nfl-offensive-line-rankings/190983",
    methodology: "Projected starters, continuity, coaching, and 2025 pass- and run-blocking reference grades.",
    rankings: FANTASY_ALARM_RANKINGS,
  },
  {
    id: "fantasyPros",
    label: "FantasyPros",
    shortLabel: "FantasyPros",
    publishedAt: "2026-07-18",
    url: "https://www.fantasypros.com/2026/07/nfl-offensive-line-rankings-2026-fantasy-football/",
    methodology: "Post-draft personnel, health, depth, and expected Week 1 roles.",
    rankings: FANTASY_PROS_RANKINGS,
  },
  {
    id: "sharp",
    label: "Sharp Football Analysis",
    shortLabel: "Sharp",
    publishedAt: "2026-06-30",
    url: "https://www.sharpfootballanalysis.com/analysis/best-nfl-offensive-line-rankings/",
    methodology: "Multi-analyst average using film, numbers, and projections for the upcoming season.",
    rankings: SHARP_RANKINGS,
  },
  {
    id: "fourForFour",
    label: "4for4",
    shortLabel: "4for4",
    publishedAt: "2026-06-22",
    updatedAt: "2026-06-30",
    url: "https://www.4for4.com/2026/preseason/2026-projected-offensive-line-rankings",
    methodology: "Projected top eight linemen, separate run/pass grades, and a rookie regression model.",
    rankings: FOUR_FOR_FOUR_RANKINGS,
  },
] as const;

export type OffensiveLineSourceAgreement = "Strong" | "Mixed" | "Low";

export interface OffensiveLineProjection2026 {
  id: OffensiveLineProjectionTeam;
  team: OffensiveLineProjectionTeam;
  teamName: string;
  consensusRank: number;
  averageRank: number;
  medianRank: number;
  bestSourceRank: number;
  worstSourceRank: number;
  rankSpread: number;
  sourceAgreement: OffensiveLineSourceAgreement;
  sourceAgreementScore: number;
  sourceRanks: Record<OffensiveLineProjectionSourceId, number>;
}

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  return (sorted[1]! + sorted[2]!) / 2;
}

function agreementForSpread(spread: number): OffensiveLineSourceAgreement {
  if (spread <= 5) return "Strong";
  if (spread <= 10) return "Mixed";
  return "Low";
}

/**
 * Builds a transparent preseason consensus from four public ordinal rankings.
 * It is a projection of the upcoming season, not a proprietary player grade.
 */
export function buildOffensiveLineProjection2026(): OffensiveLineProjection2026[] {
  const rows = TEAM_META.map(([team, teamName]) => {
    const sourceRanks = {
      fantasyAlarm: FANTASY_ALARM_RANKINGS[team],
      fantasyPros: FANTASY_PROS_RANKINGS[team],
      sharp: SHARP_RANKINGS[team],
      fourForFour: FOUR_FOR_FOUR_RANKINGS[team],
    };
    const ranks = Object.values(sourceRanks);
    const bestSourceRank = Math.min(...ranks);
    const worstSourceRank = Math.max(...ranks);
    const rankSpread = worstSourceRank - bestSourceRank;

    return {
      id: team,
      team,
      teamName,
      consensusRank: 0,
      averageRank: ranks.reduce((total, rank) => total + rank, 0) / ranks.length,
      medianRank: median(ranks),
      bestSourceRank,
      worstSourceRank,
      rankSpread,
      sourceAgreement: agreementForSpread(rankSpread),
      sourceAgreementScore: Math.round(100 - (rankSpread / 31) * 100),
      sourceRanks,
    } satisfies OffensiveLineProjection2026;
  });

  return rows
    .sort((left, right) =>
      left.averageRank - right.averageRank ||
      left.medianRank - right.medianRank ||
      left.team.localeCompare(right.team)
    )
    .map((row, index) => ({ ...row, consensusRank: index + 1 }));
}

export const OFFENSIVE_LINE_PROJECTION_2026 = buildOffensiveLineProjection2026();
