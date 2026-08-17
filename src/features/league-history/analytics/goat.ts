import type { LeagueHistorySnapshot, ManagerCareerStats } from "../domain/types";
import { GOAT_WEIGHTS, type GoatComponent } from "./config";
import { calculateAllManagerCareers } from "./career";

export interface GoatRanking {
  rank: number;
  managerId: string;
  score: number;
  components: Record<GoatComponent, number>;
  career: ManagerCareerStats;
}

function normalized(value: number, values: number[], invert = false) {
  if (!values.length) return 0;
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const result = maximum === minimum ? (maximum ? 100 : 0) : ((value - minimum) / (maximum - minimum)) * 100;
  return invert ? 100 - result : result;
}

export function calculateGoatRankings(snapshot: LeagueHistorySnapshot): GoatRanking[] {
  const careers = calculateAllManagerCareers(snapshot);
  const values = {
    championships: careers.map((career) => career.championships),
    finals: careers.map((career) => career.championshipAppearances),
    playoffWins: careers.map((career) => career.playoffWins),
    regularSeasonWins: careers.map((career) => career.wins),
    scoring: careers.map((career) => career.seasonsPlayed ? career.pointsFor / career.seasonsPlayed : 0),
    averageFinish: careers.map((career) => career.averageFinish ?? Number.MAX_SAFE_INTEGER),
    longevity: careers.map((career) => career.seasonsPlayed),
  };
  const rows = careers.map((career) => {
    const components: Record<GoatComponent, number> = {
      championships: normalized(career.championships, values.championships),
      finals: normalized(career.championshipAppearances, values.finals),
      playoffWins: normalized(career.playoffWins, values.playoffWins),
      regularSeasonWins: normalized(career.wins, values.regularSeasonWins),
      scoring: normalized(career.seasonsPlayed ? career.pointsFor / career.seasonsPlayed : 0, values.scoring),
      averageFinish: normalized(career.averageFinish ?? Math.max(...values.averageFinish), values.averageFinish, true),
      longevity: normalized(career.seasonsPlayed, values.longevity),
    };
    const score = (Object.keys(GOAT_WEIGHTS) as GoatComponent[])
      .reduce((sum, component) => sum + components[component] * GOAT_WEIGHTS[component], 0);
    return { rank: 0, managerId: career.manager.id, score, components, career };
  });
  return rows
    .sort((left, right) => right.score - left.score || right.career.championships - left.career.championships || right.career.wins - left.career.wins)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}
