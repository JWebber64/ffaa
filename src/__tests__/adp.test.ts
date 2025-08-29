// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { create } from 'zustand';
import type { DraftState, Player, Position } from '../store/draftStore.new';
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
  const store = create<DraftState>((set, get) => ({
    // Initial state
    players: [],
    playersLoaded: false,
    teams: [],
    nominationQueue: [],
    currentBidder: undefined,
    
    // Mock actions
    loadAdp: async (opts: { useCache?: boolean } = { useCache: true }) => {
      const ffcAdp = new FfcAdp();
      const data = await ffcAdp.load({
        year: 2023,
        teams: 12,
        scoring: 'ppr' as const
      });
      
      set({
        players: data.map(p => ({
          id: p.id,
          name: p.name || 'Unknown Player',
          pos: p.position as Position,
          nflTeam: p.team || 'FA',
          adp: p.adp || 999,
          adpSource: 'ffc',
          rank: (p as any).rank || 999,
          posRank: 1, // Will be calculated
          bye: 0,
          isDrafted: false,
          isKeeper: false,
          isDraftable: true,
          isRookie: false,
          isUndraftedFreeAgent: false,
          isInjured: false,
          isSuspended: false,
          isOnBye: false,
          isActive: true,
          isStarter: false,
          isBench: false,
          isIR: false,
          isTaxi: false,
          isOnBlock: false
        })),
        playersLoaded: true
      });
      
      return true;
    },
    
    // Mock other required actions
    setCurrentBidder: (teamId?: number) => {
      set({ currentBidder: teamId });
      return undefined;
    },
    
    // Add other required actions with default implementations
    addToNominationQueue: (playerId: string, teamId: number) => {},
    removeFromNominationQueue: (playerId: string) => {},
    updatePlayer: (playerId: string, updates: Partial<Player>) => {},
    updateTeam: (teamId: number, updates: any) => {},
    
    // Initialize with any provided state
    ...initialState,
    teamCount: 12,
    baseBudget: 200,
    templateRoster: {
      QB: 1, RB: 2, WR: 2, TE: 1, K: 1, DEF: 1, FLEX: 1, BENCH: 6
    },
    currentBid: null,
    currentWinningBid: null,
    currentWinningBidder: null,
    isPaused: false,
    isComplete: false,
    isMockDraft: false,
    
    // Mock actions
    setPlayers: (players: Player[]) => set({ players }),
    setTeams: (teams: any[]) => set({ teams }),
    setCurrentNominatedId: (id: string | null) => set({ currentNominatedId: id }),
    applyAdp: (updates: any) => {
      set(state => ({
        players: state.players.map(p => ({
          ...p,
          ...(updates[p.id] || {})
        }))
      }));
    },
    loadAdp: async (opts: { useCache?: boolean } = { useCache: true }) => {
      const ffc = new FfcAdp();
      const data = await ffc.load({
        year: 2023,
        teams: 12,
        scoring: 'ppr' as const
      });
      set({
        players: data.map((p: any) => ({
          id: p.id,
          name: p.name,
          pos: p.position as Position,
          nflTeam: p.team,
          rank: p.rank || 999,
          posRank: 1, // Will be calculated
          adp: p.adp,
          adpSource: 'ffc'
        })),
        playersLoaded: true
      });
      return true;
    },
    // Add other required actions with empty implementations
    setConfig: (config: any) => {},
    setTeamNames: (names: string[]) => {},
    nominate: (playerId: string, startingBid: number = 1) => {},
    placeBid: (playerId: string, byTeamId: number, amount: number) => {},
    assignPlayer: (playerId: string, teamId: number, price: number) => {},
    computeMaxBid: (teamId: number) => 0,
    hasSlotFor: (teamId: number, pos: Position) => true,
    resetDraft: () => {}
  }));

  // Add selectors to the store
  const storeWithSelectors = {
    ...store,
    getState: store.getState,
    selectors: {
      undraftedPlayers: (state: DraftState) => state.players.filter((p: Player) => !(p as any).isDrafted),
      topAvailable: (state: DraftState, limit = 100) => 
        [...state.players]
          .filter((p: Player) => (p as any).isDraftable !== false && !(p as any).isDrafted)
          .sort((a, b) => ((a as any).rank || 999) - ((b as any).rank || 999))
          .slice(0, limit),
      topAvailableByPos: (state: DraftState, pos: Position, limit = 100) => 
        [...state.players]
          .filter((p: Player) => p.pos === pos && (p as any).isDraftable !== false && !(p as any).isDrafted)
          .sort((a, b) => ((a as any).rank || 999) - ((b as any).rank || 999))
          .slice(0, limit),
      topAvailableForFlex: (state: DraftState, limit = 100, includeTE = false) => {
        const flexPositions = ['RB', 'WR', ...(includeTE ? ['TE'] : [])];
        return [...state.players]
          .filter((p: Player) => flexPositions.includes(p.pos) && (p as any).isDraftable !== false && !(p as any).isDrafted)
          .sort((a, b) => ((a as any).rank || 999) - ((b as any).rank || 999))
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
    mockImplementation: (fn: any) => void;
  };
  getCacheKey?: (opts: any) => string;
  loadFromCache?: (key: string) => any;
  saveToCache?: (key: string, data: any) => void;
  clearCache?: () => void;
  baseUrl?: string;
};

// Mock the FfcAdp module
vi.mock('../services/FfcAdp', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
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
    }))
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
      ]),
      getCacheKey: vi.fn().mockImplementation((opts) => `cache-key-${JSON.stringify(opts)}`),
      loadFromCache: vi.fn(),
      saveToCache: vi.fn(),
      clearCache: vi.fn(),
      baseUrl: 'https://api.example.com'
    };

    // Mock the FfcAdp constructor
    vi.mocked(FfcAdp).mockImplementation(() => mockFfc as unknown as FfcAdp);
  });

  beforeEach(() => {
    // Reset the mock implementation before each test
    (mockFfc.load as any).mockClear();
    if (mockFfc.loadFromCache) (mockFfc.loadFromCache as any).mockClear();
    if (mockFfc.saveToCache) (mockFfc.saveToCache as any).mockClear();
    
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
    
    // Mock cache implementation
    const cache: Record<string, any> = {};
    if (mockFfc.loadFromCache) {
      (mockFfc.loadFromCache as any).mockImplementation((key: string) => cache[key]);
    }
    if (mockFfc.saveToCache) {
      (mockFfc.saveToCache as any).mockImplementation((key: string, data: any) => {
        cache[key] = data;
      });
    }
    
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
