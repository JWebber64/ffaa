export const GOAT_WEIGHTS = {
  championships: 0.28,
  finals: 0.12,
  playoffWins: 0.12,
  regularSeasonWins: 0.18,
  scoring: 0.14,
  averageFinish: 0.1,
  longevity: 0.06,
} as const;

export const ELO_CONFIG = {
  initialRating: 1500,
  kFactor: 24,
} as const;

export type GoatComponent = keyof typeof GOAT_WEIGHTS;
