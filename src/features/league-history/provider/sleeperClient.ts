import type {
  SleeperBracketMatch,
  SleeperDraft,
  SleeperDraftPick,
  SleeperHistoryBundle,
  SleeperLeague,
  SleeperMatchupRow,
  SleeperRoster,
  SleeperSeasonBundle,
  SleeperState,
  SleeperTradedPick,
  SleeperTransaction,
  SleeperUser,
} from "./sleeperTypes";

const SLEEPER_API = "https://api.sleeper.app/v1";
const MAX_CHAIN_LENGTH = 50;

export interface SleeperClientOptions {
  fetcher?: typeof fetch;
  signal?: AbortSignal;
  now?: Date;
  maxChainLength?: number;
}

function numberValue(value: unknown) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

export class SleeperApiClient {
  private readonly fetcher: typeof fetch;
  private readonly signal: AbortSignal | undefined;
  private readonly maxChainLength: number;

  constructor(options: SleeperClientOptions = {}) {
    this.fetcher = options.fetcher ?? fetch;
    this.signal = options.signal;
    this.maxChainLength = Math.min(MAX_CHAIN_LENGTH, Math.max(1, options.maxChainLength ?? MAX_CHAIN_LENGTH));
  }

  async get<T>(path: string): Promise<T> {
    const response = await this.fetcher(`${SLEEPER_API}${path}`, this.signal ? { signal: this.signal } : undefined);
    if (!response.ok) throw new Error(`Sleeper returned ${response.status} for ${path}.`);
    return response.json() as Promise<T>;
  }

  private matchupWeekCount(league: SleeperLeague, state: SleeperState) {
    const playoffStart = numberValue(league.settings.playoff_week_start);
    if (league.status === "complete") return Math.min(18, Math.max(1, playoffStart ? playoffStart + 2 : 18));
    if (league.status === "pre_draft") return 0;
    return Math.min(18, Math.max(1, numberValue(state.display_week) || numberValue(state.week) || 1));
  }

  private async loadSeason(league: SleeperLeague, state: SleeperState): Promise<SleeperSeasonBundle> {
    const leagueId = league.league_id;
    const [users, rosters, winnersBracket, losersBracket, draftRows, tradedPicks] = await Promise.all([
      this.get<SleeperUser[]>(`/league/${leagueId}/users`),
      this.get<SleeperRoster[]>(`/league/${leagueId}/rosters`),
      this.get<SleeperBracketMatch[]>(`/league/${leagueId}/winners_bracket`),
      this.get<SleeperBracketMatch[]>(`/league/${leagueId}/losers_bracket`),
      this.get<SleeperDraft[]>(`/league/${leagueId}/drafts`),
      this.get<SleeperTradedPick[]>(`/league/${leagueId}/traded_picks`),
    ]);
    const weekCount = this.matchupWeekCount(league, state);
    const matchupWeeks = Array.from({ length: weekCount }, (_, index) => index + 1);
    const transactionWeeks = Array.from({ length: Math.max(weekCount, 18) + 1 }, (_, index) => index);
    const [matchups, transactionGroups, drafts] = await Promise.all([
      Promise.all(matchupWeeks.map(async (week) => ({
        week,
        rows: await this.get<SleeperMatchupRow[]>(`/league/${leagueId}/matchups/${week}`),
      }))),
      Promise.all(transactionWeeks.map((week) => this.get<SleeperTransaction[]>(`/league/${leagueId}/transactions/${week}`))),
      Promise.all(draftRows.map(async (draft) => {
        const [picks, draftTradedPicks] = await Promise.all([
          this.get<SleeperDraftPick[]>(`/draft/${draft.draft_id}/picks`),
          this.get<SleeperTradedPick[]>(`/draft/${draft.draft_id}/traded_picks`),
        ]);
        return { draft, picks, tradedPicks: draftTradedPicks };
      })),
    ]);
    const transactions = [...new Map(transactionGroups.flat().map((transaction) => [transaction.transaction_id, transaction])).values()];
    return { league, users, rosters, winnersBracket, losersBracket, tradedPicks, matchups, transactions, drafts };
  }

  async loadHistory(currentLeagueId: string, options: Pick<SleeperClientOptions, "now"> = {}): Promise<SleeperHistoryBundle> {
    const requestedLeagueId = currentLeagueId.trim();
    if (!/^\d{10,}$/.test(requestedLeagueId)) throw new Error("Enter a numeric Sleeper league ID.");
    const state = await this.get<SleeperState>("/state/nfl");
    const seen = new Set<string>();
    const seasons: SleeperSeasonBundle[] = [];
    let nextLeagueId = requestedLeagueId;
    while (nextLeagueId && !seen.has(nextLeagueId) && seasons.length < this.maxChainLength) {
      seen.add(nextLeagueId);
      const league = await this.get<SleeperLeague>(`/league/${nextLeagueId}`);
      seasons.push(await this.loadSeason(league, state));
      nextLeagueId = typeof league.previous_league_id === "string" ? league.previous_league_id : "";
    }
    if (!seasons.length) throw new Error("Sleeper did not return a league for that ID.");
    return {
      requestedLeagueId,
      state,
      seasons,
      fetchedAt: (options.now ?? new Date()).toISOString(),
    };
  }
}
