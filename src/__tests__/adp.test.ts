// @vitest-environment jsdom
// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { create } from 'zustand';
import type { DraftState, Player, Position } from '../types/draft';
import FfcAdp from '../services/FfcAdp';

type ViType = typeof vi;

// Vitest types are globally available, no need to declare them

// Import the setup file
import './setup';

// Define the store type with selectors
type StoreWithSelectors<T> = T & {
  getState: () => T;
  selectors: {
    undraftedPlayers: (state: T) => Player[];
    topAvailable: (state: T, limit?: number) => Player[];
    topAvailableByPos: (state: T, pos: Position, limit?: number) => Player[];
    topAvailableForFlex: (state: T, limit?: number, includeTE?: boolean) => Player[];
  };
};

// Create a test store that doesn't use React hooks
const createTestStore = (initialState: Partial<DraftState> = {}) => {
  const adpCache = new Map<string, Player[]>();

  const normalizePlayers = (data: FfcPlayer[]) => {
    const positionCounts = new Map<string, number>();

    return data.map((player) => {
      const normalizedPosition = (player.position === 'DST' ? 'DEF' : player.position) as Position;
      const nextPosRank = (positionCounts.get(normalizedPosition) ?? 0) + 1;
      positionCounts.set(normalizedPosition, nextPosRank);

      return {
        id: player.id,
        name: player.name || 'Unknown Player',
        pos: normalizedPosition,
        nflTeam: player.team || 'FA',
        adp: player.adp || 999,
        adpSource: 'ffc',
        rank: player.rank || 999,
        posRank: nextPosRank,
        isDrafted: false,
        isDraftable: true,
      };
    });
  };

  const store = create<DraftState>((set) => ({
    players: [],
    playersLoaded: false,
    teams: [],
    nominationQueue: [],
    currentBidder: undefined,

    ...initialState,
    teamCount: 12,
    baseBudget: 200,
    templateRoster: {
      QB: 1, RB: 2, WR: 2, TE: 1, K: 1, DEF: 1, FLEX: 1, BENCH: 6, IR: 0
    },
    currentBid: null,
    currentWinningBid: null,
    currentWinningBidder: null,
    isPaused: false,
    isComplete: false,
    isMockDraft: false,

    setPlayers: (players: Player[]) => set({ players }),
    setTeams: (teams: { id: number; name: string; players: string[]; budget: number; roster: Record<string, number> }[]) => set({ teams }),
    setCurrentNominatedId: (id: string | null) => set({ currentNominatedId: id }),
    setCurrentBidder: (teamId?: number) => {
      set({ currentBidder: teamId });
      return undefined;
    },
    applyAdp: (updates: Record<string, { adp?: number; adpSource?: string }>) => {
      set(state => ({
        players: state.players.map(p => ({
          ...p,
          ...(updates[p.id] || {})
        }))
      }));
    },
    loadAdp: async (opts: { useCache?: boolean } = { useCache: true }) => {
      const cacheKey = JSON.stringify({ year: 2023, teams: 12, scoring: 'ppr' });

      if (opts.useCache !== false && adpCache.has(cacheKey)) {
        set({
          players: adpCache.get(cacheKey) ?? [],
          playersLoaded: true
        });
        return true;
      }

      const ffc = new FfcAdp();
      const data = await ffc.load({
        year: 2023,
        teams: 12,
        scoring: 'ppr' as const,
        useCache: opts.useCache
      });

      const normalizedPlayers = normalizePlayers(data as FfcPlayer[]);
      if (opts.useCache !== false) {
        adpCache.set(cacheKey, normalizedPlayers);
      }

      set({
        players: normalizedPlayers,
        playersLoaded: true
      });

      return true;
    },
    addToNominationQueue: (_playerId: string, _teamId: number) => {},
    removeFromNominationQueue: (_playerId: string) => {},
    updatePlayer: (_playerId: string, _updates: Partial<Player>) => {},
    updateTeam: (_teamId: number, _updates: Partial<{ name: string; players: string[]; budget: number; roster: Record<string, number> }>) => {},
    setConfig: (_config: { teamCount: number; baseBudget: number; templateRoster: Record<string, number> }) => {},
    setTeamNames: (_names: string[]) => {},
    nominate: (_playerId: string, _startingBid: number = 1) => {},
    placeBid: (_playerId: string, _byTeamId: number, _amount: number) => {},
    assignPlayer: (_playerId: string, _teamId: number, _price: number) => {},
    computeMaxBid: (_teamId: number) => 0,
    hasSlotFor: (_teamId: number, _pos: Position) => true,
    resetDraft: () => {}
  }));

  // Add selectors to the store
  const storeWithSelectors = {
    ...store,
    getState: store.getState,
    selectors: {
      undraftedPlayers: (state: DraftState) => state.players.filter(p => !p.isDrafted),
      topAvailable: (state: DraftState, limit = 100) => 
        [...state.players]
          .filter(p => p.isDraftable !== false && !p.isDrafted)
          .sort((a, b) => (a.rank || 999) - (b.rank || 999))
          .slice(0, limit),
      topAvailableByPos: (state: DraftState, pos: Position, limit = 100) => 
        [...state.players]
          .filter((p: Player) => p.pos === pos && p.isDraftable !== false && !p.isDrafted)
          .sort((a, b) => (a.rank || 999) - (b.rank || 999))
          .slice(0, limit),
      topAvailableForFlex: (state: DraftState, limit = 100, includeTE = false) => {
        const flexPositions = ['RB', 'WR', ...(includeTE ? ['TE'] : [])];
        return [...state.players]
          .filter((p: Player) => flexPositions.includes(p.pos) && p.isDraftable !== false && !p.isDrafted)
          .sort((a, b) => (a.rank || 999) - (b.rank || 999))
          .slice(0, limit);
      }
    }
  } as unknown as StoreWithSelectors<DraftState>;

  return storeWithSelectors;
};

type TestStore = ReturnType<typeof createTestStore>;

// Define FFC Player interface
type FfcPlayer = {
  id: string;
  name: string;
  position: string;
  team: string;
  adp: number;
  averagePick: number;
  minPick: number;
  maxPick: number;
  percentDrafted: number;
  rank?: number;
};

// Mock the FfcAdp class type
type MockFfcAdp = {
  load: vi.Mock<Promise<FfcPlayer[]>> & {
    mockClear: () => void;
    mockImplementation: (fn: (opts: { year?: number; teams?: number; scoring?: string }) => Promise<FfcPlayer[]>) => void;
  };
};

// Mock the FfcAdp module
vi.mock('../services/FfcAdp', () => {
  return {
    default: vi.fn(function MockFfcAdp() {
      return {
      load: vi.fn().mockResolvedValue([
        {
          id: '1',
          name: 'Christian McCaffrey',
          position: 'RB',
          team: 'SF',
          adp: 1.2,
          averagePick: 1.2,
          minPick: 1,
          maxPick: 3,
          percentDrafted: 100
        },
        {
          id: '2',
          name: 'Justin Jefferson',
          position: 'WR',
          team: 'MIN',
          adp: 2.5,
          averagePick: 2.5,
          minPick: 1,
          maxPick: 5,
          percentDrafted: 100
        },
        {
          id: '3',
          name: 'Ja\'Marr Chase',
          position: 'WR',
          team: 'CIN',
          adp: 3.1,
          averagePick: 3.1,
          minPick: 2,
          maxPick: 5,
          percentDrafted: 100
        },
        {
          id: '4',
          name: 'San Francisco 49ers',
          position: 'DST',
          team: 'SF',
          adp: 120.5,
          averagePick: 120.5,
          minPick: 100,
          maxPick: 140,
          percentDrafted: 100
        }
      ])
      };
    })
  };
});

describe('ADP Integration', () => {
  let store: TestStore;

  let mockFfc: MockFfcAdp;

  beforeAll(() => {
    // Create a mock FfcAdp instance
    mockFfc = {
      load: vi.fn().mockResolvedValue([
        {
          id: '1',
          name: 'Christian McCaffrey',
          position: 'RB',
          team: 'SF',
          adp: 1.2,
          averagePick: 1.2,
          minPick: 1,
          maxPick: 3,
          percentDrafted: 100,
          rank: 1
        },
        {
          id: '2',
          name: 'Justin Jefferson',
          position: 'WR',
          team: 'MIN',
          adp: 2.5,
          averagePick: 2.5,
          minPick: 1,
          maxPick: 5,
          percentDrafted: 100,
          rank: 2
        },
        {
          id: '3',
          name: 'Ja\'Marr Chase',
          position: 'WR',
          team: 'CIN',
          adp: 3.1,
          averagePick: 3.1,
          minPick: 2,
          maxPick: 5,
          percentDrafted: 100,
          rank: 3
        },
        {
          id: '4',
          name: 'San Francisco 49ers',
          position: 'DEF',
          team: 'SF',
          adp: 120.5,
          averagePick: 120.5,
          minPick: 100,
          maxPick: 140,
          percentDrafted: 100,
          rank: 120
        }
      ])
    };

    // Mock the FfcAdp constructor
    vi.mocked(FfcAdp).mockImplementation(function MockedFfcAdp() {
      return mockFfc as unknown as FfcAdp;
    } as unknown as typeof FfcAdp);
  });

  beforeEach(() => {
    // Reset the mock implementation before each test
    (mockFfc.load as any).mockClear();

    // Create a new store for each test
    store = createTestStore();
  });

  it('should load and apply ADP data', async () => {
    // Load ADP data
    const loadAdp = store.getState().loadAdp;
    if (!loadAdp) throw new Error('loadAdp is not defined');
    
    const result = await loadAdp();
    expect(result).toBe(true);
    
    // Verify players were loaded
    const players = store.getState().players;
    expect(players.length).toBeGreaterThan(0);
    
    // Check that position ranks were calculated
    const rbs = players.filter(p => p.pos === 'RB');
    const wrs = players.filter(p => p.pos === 'WR');
    const dst = players.find(p => p.pos === 'DEF');
    
    expect(rbs[0].posRank).toBe(1);
    expect(wrs[0].posRank).toBe(1);
    expect(wrs[1].posRank).toBe(2);
    
    // Check D/ST team name normalization
    expect(dst?.nflTeam).toBe('SF');
  });

  it('should sort players by rank and ADP', async () => {
    const loadAdp = store.getState().loadAdp;
    if (!loadAdp) throw new Error('loadAdp is not defined');
    
    await loadAdp();
    
    const state = store.getState();
    const topPlayers = store.selectors.topAvailable(state, 3);
    
    // Should be sorted by rank/ADP
    expect(topPlayers[0].name).toBe('Christian McCaffrey');
    expect(topPlayers[1].name).toBe('Justin Jefferson');
    expect(topPlayers[2].name).toBe('Ja\'Marr Chase');
  });

  it('should filter players by position', async () => {
    const loadAdp = store.getState().loadAdp;
    if (!loadAdp) throw new Error('loadAdp is not defined');
    
    await loadAdp();
    
    const state = store.getState();
    const wrs = store.selectors.topAvailableByPos(state, 'WR', 10);
    
    expect(wrs.length).toBe(2);
    expect(wrs[0].name).toBe('Justin Jefferson');
    expect(wrs[1].name).toBe('Ja\'Marr Chase');
  });

  it('should handle FLEX positions', async () => {
    const loadAdp = store.getState().loadAdp;
    if (!loadAdp) throw new Error('loadAdp is not defined');
    
    await loadAdp();
    
    const state = store.getState();
    const flexPlayers = store.selectors.topAvailableForFlex(state, 10, false); // RB/WR only
    
    expect(flexPlayers.length).toBe(3); // CMC + 2 WRs
    expect(flexPlayers[0].pos).toBe('RB'); // RB should be first in FLEX
    expect(flexPlayers[1].pos).toBe('WR');
    expect(flexPlayers[2].pos).toBe('WR');
  });

  it('should handle caching', async () => {
    const loadAdp = store.getState().loadAdp;
    if (!loadAdp) throw new Error('loadAdp is not defined');

    // First call - should call the API
    await loadAdp({ useCache: true });
    expect((mockFfc.load as any).mock.calls.length).toBe(1);
    
    // Reset the mock call count
    (mockFfc.load as any).mockClear();
    
    // Second call with cache - should use cache
    await loadAdp({ useCache: true });
    expect((mockFfc.load as any).mock.calls.length).toBe(0); // Should not call the API again
    
    // Reset the mock call count
    (mockFfc.load as any).mockClear();
    
    // Third call without cache - should call API again
    await loadAdp({ useCache: false });
    expect((mockFfc.load as any).mock.calls.length).toBe(1); // Should call the API again
  });
});
