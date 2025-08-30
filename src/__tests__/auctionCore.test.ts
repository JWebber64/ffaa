import { describe, it, expect, vi, beforeEach } from 'vitest';
import { create } from 'zustand';
import type {
  DraftState as DraftStateType,
  DraftStore as DraftStoreType,
  Player,
  Position,
  Team,
  AuctionSettings,
  BidState,
  DraftRuntime,
  LogEvent,
} from '../types/draft';

/* --------------------------- helpers used by the tests --------------------------- */

const isFlexEligible = (pos: Position, includeTE = true) =>
  pos === 'RB' || pos === 'WR' || (includeTE && pos === 'TE');

const getValidSlots = (team: Team, player: Player, includeTEinFlex = true): Position[] => {
  const out: Position[] = [];
  const basePos = player.pos as Position;
  if (basePos !== 'FLEX' && basePos !== 'BENCH' && (team.roster[basePos] ?? 0) > 0) {
    out.push(basePos);
  }
  if (
    player.pos !== 'FLEX' &&
    player.pos !== 'BENCH' &&
    isFlexEligible(player.pos as Position, includeTEinFlex) &&
    (team.roster.FLEX ?? 0) > 0
  ) {
    out.push('FLEX');
  }
  return out;
};

/* ------------------------------ minimal mock store ------------------------------ */

const createMockStore = (initial: Partial<DraftStateType> = {}) => {
  const DEFAULT_AUCTION_SETTINGS: AuctionSettings = {
    countdownSeconds: 30,
    antiSnipeSeconds: 10,
    nominationOrderMode: 'regular',
    // reverseAtRound is optional and only used when nominationOrderMode is 'reverse'
  };

  const DEFAULT_BID_STATE: BidState = {
    isLive: false,
    highBid: 0,
    highBidder: null,
    startingBid: 1,
    round: 1
    // playerId and endsAt are optional and not needed in the default state
  };

  const DEFAULT_RUNTIME: DraftRuntime = {
    round: 1,
    currentNominatorTeamId: 1,
    nominationOrder: [1, 2],
    baseOrder: [1, 2],
  };

  type S = DraftStoreType;

  return create<S>((set, get) => ({
    selectors: {
      undraftedPlayers: () => [],
      topAvailable: () => [],
      topAvailableByPos: () => [],
      topAvailableByMultiPos: () => [],
      topAvailableForFlex: () => [],
    },
    // --- state (base) ---
    players: [],
    playersLoaded: false,
    adpLoaded: false,
    teams: [],
    assignmentHistory: [],
    logs: [],
    baseBudget: 200,
    teamCount: 2,
    templateRoster: {
      QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, K: 1, DEF: 1, BENCH: 6,
    } as Record<Position, number>,
    auctionSettings: DEFAULT_AUCTION_SETTINGS,
    runtime: DEFAULT_RUNTIME,
    bidState: DEFAULT_BID_STATE,
    nominationQueue: [],
    currentAuction: null,
    currentNominatedId: null,
    currentBidder: undefined,
    pendingAssignment: null,

    // --- mocked/unused actions ---
    setPlayers: vi.fn(),
    setTeams: vi.fn(),
    updateTeam: vi.fn(),
    setCurrentNominatedId: vi.fn(),
    setCurrentBidder: vi.fn(),
    applyAdp: vi.fn(),
    loadAdp: vi.fn(),
    setConfig: vi.fn(),
    setTeamNames: vi.fn(),
    nominate: vi.fn(),
    undoLastAssignment: vi.fn(),
    assignPlayer: vi.fn(),
    clearLogs: vi.fn(),
    resetDraft: vi.fn(),
    setAuctionSettings: vi.fn(),
    pushLog: vi.fn((event: Omit<LogEvent, 'id' | 'ts'>) => {
      set((s) => ({
        logs: [{ ...event, id: `log_${s.logs.length + 1}`, ts: Date.now() } as LogEvent, ...s.logs],
      }));
    }),

    // --- core we’re testing ---
    placeBid: vi.fn((playerId: string, byTeamId: number, amount: number) => {
      const s = get();
      const bs = s.bidState;
      if (!bs.isLive || bs.playerId !== playerId) return;
      if (amount <= (bs.highBid ?? 0)) return;

      const now = Date.now();
      const extend = bs.endsAt && bs.endsAt - now < s.auctionSettings.antiSnipeSeconds * 1000
        ? now + s.auctionSettings.antiSnipeSeconds * 1000
        : bs.endsAt;

      set({
        bidState: {
          ...bs,
          highBid: amount,
          highBidder: byTeamId,
          ...(extend !== undefined ? { endsAt: extend } : {}),
        },
      });
    }),

    settleAuctionIfExpired: vi.fn(() => {
      const s = get();
      const bs = s.bidState;
      if (!bs.isLive || !bs.endsAt) return;
      const now = Date.now();
      if (now < bs.endsAt) return;

      const { playerId, highBid, highBidder } = bs;
      if (!playerId) return;

      // reset live auction
      set({
        bidState: { ...DEFAULT_BID_STATE, round: s.runtime.round },
        currentAuction: null,
        currentNominatedId: null,
      });

      if (highBidder === null || !playerId) return;

      const state = get();
      const player = state.players.find((p) => p.id === playerId);
      if (highBidder === null) return;
      const team = state.teams.find((t) => t.id === highBidder);
      if (!player || !team) return;

      const valid = team ? getValidSlots(team, player, true) : [];

      if (team) {
        team.budget -= highBid;
      }

      if (valid.length === 1 && team) {
        const slot = valid[0] as Position;
        player.draftedBy = team.id;
        player.price = highBid;
        (player as any).slot = slot;
        team.roster[slot] = Math.max(0, (team.roster[slot] ?? 0) - 1);
      } else if (valid.length > 1 && team) {
        set({
          pendingAssignment: { teamId: team.id, playerId: player.id, validSlots: valid },
        });
      } else {
        player.draftedBy = team.id;
        player.price = highBid;
        delete (player as any).slot;
      }
    }),

    computeMaxBid: (teamId: number, playerPos?: Position) => {
      const state = get();
      const team = state.teams.find((t) => t.id === teamId);
      if (!team) return 0;

      const spent = state.players
        .filter((p) => p.draftedBy === teamId)
        .reduce((sum, p) => sum + (p.price ?? 0), 0);

      const remainingCash = team.budget - spent;
      if (remainingCash <= 0) return 0;

      const totalRemainingSpots = (Object.keys(team.roster) as Position[]).reduce(
        (acc, k) => acc + (team.roster[k] ?? 0),
        0
      );
      if (totalRemainingSpots <= 0) return 0;

      const reserveForOthers = Math.max(0, totalRemainingSpots - 1);
      const baselineMax = remainingCash - reserveForOthers;

      if (playerPos && !get().hasSlotFor(teamId, playerPos, true)) return 0;

      return Math.max(0, Math.floor(baselineMax));
    },

    hasSlotFor: (teamId: number, pos: Position, includeTeInFlex = false) => {
      const team = get().teams.find((t) => t.id === teamId);
      if (!team) return false;

      if ((team.roster[pos] ?? 0) > 0) return true;

      if (pos === 'FLEX') {
        return (
          (team.roster.RB ?? 0) > 0 ||
          (team.roster.WR ?? 0) > 0 ||
          (includeTeInFlex && (team.roster.TE ?? 0) > 0)
        );
      }

      if (pos === 'TE' && includeTeInFlex && (team.roster.FLEX ?? 0) > 0) {
        return true;
      }

      return false;
    },

    // allow targeted overrides per test
    ...initial,
  }));
};

/* --------------------------------- test data helpers --------------------------------- */

const mockTeam = (id: number, budget: number, roster: Partial<Record<Position, number>>): Team => ({
  id,
  name: `Team ${id}`,
  budget,
  roster: {
    QB: 0, RB: 0, WR: 0, TE: 0, FLEX: 0, K: 0, DEF: 0, BENCH: 0,
    ...roster,
  },
  players: [],
});

const mockPlayer = (id: string, pos: Position, name = `Player ${id}`): Player =>
  ({
    id,
    name,
    pos,
    nflTeam: 'FA',
    adp: 0,
    adpSource: 'mock',
    team: 'FA',
  } as unknown as Player);

/* ----------------------------------------- tests ----------------------------------------- */

describe('Auction Core Functions', () => {
  let store: ReturnType<typeof createMockStore>;

  beforeEach(() => {
    store = createMockStore({
      teams: [
        mockTeam(1, 200, { RB: 2, WR: 2, FLEX: 1, BENCH: 6 }),
        mockTeam(2, 150, { RB: 1, WR: 1, FLEX: 1, BENCH: 6 }),
      ],
      players: [],
      playersLoaded: false,
      adpLoaded: false,
      auctionSettings: {
        countdownSeconds: 30,
        antiSnipeSeconds: 10,
        nominationOrderMode: 'regular',
      } as AuctionSettings,
    });
  });

  describe('computeMaxBid', () => {
    it('returns 0 for non-existent team', () => {
      expect(store.getState().computeMaxBid(999, 'RB')).toBe(0);
    });

    it('returns 0 when team has no budget left', () => {
      store.setState({ teams: [mockTeam(1, 0, { RB: 1 })] });
      expect(store.getState().computeMaxBid(1, 'RB')).toBe(0);
    });

    it('returns 0 when team has no roster spots left', () => {
      store.setState({ teams: [mockTeam(1, 200, {})] }); // no open spots
      expect(store.getState().computeMaxBid(1, 'RB')).toBe(0);
    });

    it('calculates max bid from remaining cash minus $1 per future spot', () => {
      // Team 1: budget $200, open spots = 2 + 2 + 1 + 6 = 11
      // Reserve $1 for each *future* player (11 - 1 = 10) => 200 - 10 = 190
      expect(store.getState().computeMaxBid(1, 'RB')).toBe(190);
    });

    it('returns 0 when position is full and no flex slot available', () => {
      store.setState({ teams: [mockTeam(1, 200, { RB: 0 })] });
      expect(store.getState().computeMaxBid(1, 'RB')).toBe(0);
    });
  });

  describe('hasSlotFor', () => {
    it('returns false for non-existent team', () => {
      expect(store.getState().hasSlotFor(999, 'RB')).toBe(false);
    });

    it('returns true when position has available slots', () => {
      store.setState({ teams: [mockTeam(1, 200, { RB: 1 })] });
      expect(store.getState().hasSlotFor(1, 'RB')).toBe(true);
    });

    it('returns false when position is full', () => {
      store.setState({ teams: [mockTeam(1, 200, { RB: 0 })] });
      expect(store.getState().hasSlotFor(1, 'RB')).toBe(false);
    });

    it('checks FLEX position correctly', () => {
      store.setState({ teams: [mockTeam(1, 200, { FLEX: 1 })] });
      expect(store.getState().hasSlotFor(1, 'FLEX')).toBe(true);
      expect(store.getState().hasSlotFor(1, 'RB')).toBe(false); // RB slot is 0
    });
  });

  describe('placeBid', () => {
    it('does nothing if no live auction', () => {
      const playerId = 'p1';
      store.getState().placeBid(playerId, 1, 10);
      expect(store.getState().bidState.highBid).toBe(0);
    });

    it('updates high bid when higher', () => {
      const playerId = 'p1';
      store.setState({
        bidState: {
          isLive: true,
          playerId,
          highBid: 10,
          highBidder: 2,
          startingBid: 1,
          round: 1,
        },
      });
      store.getState().placeBid(playerId, 1, 15);
      expect(store.getState().bidState.highBid).toBe(15);
      expect(store.getState().bidState.highBidder).toBe(1);
    });

    it('extends timer with anti-snipe protection', () => {
      const playerId = 'p1';
      const now = Date.now();
      const endsAt = now + 5000; // 5s left

      store.setState({
        bidState: {
          isLive: true,
          playerId,
          highBid: 10,
          highBidder: 2,
          startingBid: 1,
          round: 1,
          endsAt,
        },
        auctionSettings: {
          countdownSeconds: 30,
          antiSnipeSeconds: 10,
          nominationOrderMode: 'regular',
        } as AuctionSettings,
      });

      const originalNow = Date.now;
      Date.now = vi.fn(() => now);

      store.getState().placeBid(playerId, 1, 15);

      expect(store.getState().bidState.endsAt).toBe(now + 10000);

      Date.now = originalNow;
    });
  });

  describe('settleAuctionIfExpired', () => {
    it('does nothing if auction is not live', () => {
      const playerId = 'p1';
      const player = mockPlayer(playerId, 'RB');

      store.setState({
        players: [player],
        bidState: {
          isLive: false,
          playerId,
          highBid: 10,
          highBidder: 1,
          startingBid: 1,
          round: 1,
        },
        currentAuction: {
          playerId,
          highBid: 10,
          highBidder: 1,
        },
      });

      store.getState().settleAuctionIfExpired();
      expect(store.getState().bidState.isLive).toBe(false);
      expect(store.getState().players[0]?.draftedBy).toBeUndefined();
    });

    it('assigns player to highest bidder when expired', () => {
      const playerId = 'p1';
      const player = mockPlayer(playerId, 'RB');
      const now = Date.now();

      store.setState({
        players: [player],
        teams: [mockTeam(1, 200, { RB: 1 })],
        bidState: {
          isLive: true,
          playerId,
          highBid: 10,
          highBidder: 1,
          startingBid: 1,
          round: 1,
          endsAt: now - 1000,  // Explicitly set to a number
        },
        currentAuction: {
          playerId,
          highBid: 10,
          highBidder: 1,
        },
      });

      store.getState().settleAuctionIfExpired();

      const state = store.getState();
      expect(state.bidState.isLive).toBe(false);
      expect(state.bidState.highBidder).toBeNull();

      expect(state.players[0]?.draftedBy).toBe(1);
      expect(state.players[0]?.price).toBe(10);

      expect(state.teams[0]?.budget).toBe(190);
      expect(state.teams[0]?.roster.RB).toBe(0);
    });

    it('handles expired auction with no bids', () => {
      const playerId = 'p1';
      const player = mockPlayer(playerId, 'RB');
      const now = Date.now();

      store.setState({
        players: [player],
        teams: [mockTeam(1, 200, { RB: 1 })],
        bidState: {
          isLive: true,
          playerId,
          highBid: 0,
          highBidder: null,
          startingBid: 1,
          round: 1,
          endsAt: now - 1000,
        },
        currentAuction: {
          playerId,
          highBid: 0,
          highBidder: null,
        },
      });

      store.getState().settleAuctionIfExpired();

      const state = store.getState();
      expect(state.bidState.isLive).toBe(false);
      expect(state.players[0]?.draftedBy).toBeUndefined();
      expect(state.teams[0]?.budget).toBe(200);
      expect(state.teams[0]?.roster.RB).toBe(1);
    });
  });
});
