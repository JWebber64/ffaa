import { describe, it, expect } from 'vitest';
import { exportDraftState, importDraftState } from '../store/draftStore';
import type { DraftState } from '../types/draft';
import { generateRoomCode, isValidRoomCode } from '../lib/multiplayer';

describe('Multiplayer Export/Import', () => {
  it('should export and import draft state correctly', () => {
    // Create a mock draft state
    const mockState: Partial<DraftState> = {
      players: [
        {
          id: 'player1',
          name: 'John Doe',
          pos: 'QB',
          nflTeam: 'NYG',
          rank: 1,
        },
        {
          id: 'player2', 
          name: 'Jane Smith',
          pos: 'RB',
          nflTeam: 'DAL',
          rank: 2,
        }
      ],
      teams: [
        {
          id: 1,
          name: 'Team 1',
          players: [],
          budget: 200,
          roster: {
            QB: 1,
            RB: 2,
            WR: 3,
            TE: 1,
            K: 0,
            DEF: 0,
            FLEX: 1,
            BENCH: 4,
          },
        }
      ],
      draftId: 'TEST123',
      hostUserId: 'user123',
      status: 'lobby',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastMutationId: 1,
      lastMutationAt: Date.now(),
      playersLoaded: true,
      adpLoaded: false,
      assignmentHistory: [],
      auctionSettings: {
        countdownSeconds: 30,
        antiSnipeSeconds: 10,
        nominationOrderMode: 'regular',
      },
      bidState: {
        isLive: false,
        highBid: 0,
        highBidder: null,
        startingBid: 1,
        round: 1,
      },
      runtime: {
        currentNominatorTeamId: null,
        nominationOrder: [1],
        baseOrder: [1],
        round: 1,
      },
      nominationQueue: [],
      currentAuction: null,
      currentNominatedId: null,
      currentBidder: undefined,
      baseBudget: 200,
      teamCount: 12,
      templateRoster: {
        QB: 1,
        RB: 2,
        WR: 3,
        TE: 1,
        K: 0,
        DEF: 0,
        FLEX: 1,
        BENCH: 4,
      },
      pendingAssignment: null,
      logs: [],
    } as DraftState;

    // Export the state
    const exported = exportDraftState(mockState as DraftState);
    expect(exported).toBeDefined();
    expect(typeof exported).toBe('string');

    // Parse and verify export format
    const parsed = JSON.parse(exported);
    expect(parsed.__type).toBe('ffaa_draft_export');
    expect(parsed.version).toBe('1.0.0');
    expect(parsed.state).toBeDefined();
    expect(parsed.state.draftId).toBe('TEST123');
    expect(parsed.state.hostUserId).toBe('user123');
    expect(parsed.state.status).toBe('lobby');

    // Import the state
    const imported = importDraftState(exported);
    expect(imported).toBeDefined();
    expect(imported.players).toHaveLength(2);
    expect(imported.players[0]?.name).toBe('John Doe');
    expect(imported.players[1]?.name).toBe('Jane Smith');
    expect(imported.teams).toHaveLength(1);
    expect(imported.teams[0]?.name).toBe('Team 1');
    expect(imported.draftId).toBe('TEST123');
    expect(imported.hostUserId).toBe('user123');
    expect(imported.status).toBe('lobby');
  });

  it('should handle invalid import data gracefully', () => {
    expect(() => importDraftState('invalid json')).toThrow();
    expect(() => importDraftState('{}')).toThrow();
    expect(() => importDraftState('{"__type": "invalid"}')).toThrow();
  });

  it('should provide defaults for missing fields', () => {
    const minimalState = {
      players: [],
      teams: [],
    } as unknown as DraftState;

    const exported = exportDraftState(minimalState);
    const imported = importDraftState(exported);

    expect(imported.status).toBe('lobby');
    expect(imported.baseBudget).toBe(200);
    expect(imported.teamCount).toBe(12);
    expect(imported.lastMutationId).toBe(0);
    expect(imported.playersLoaded).toBe(false);
    expect(imported.adpLoaded).toBe(false);
  });
});

describe('Room Code Utilities', () => {
  it('should generate valid room codes', () => {
    const code1 = generateRoomCode();
    const code2 = generateRoomCode();
    
    expect(code1).toMatch(/^[A-Z0-9]{6}$/);
    expect(code2).toMatch(/^[A-Z0-9]{6}$/);
    expect(code1).not.toBe(code2); // Should be different
  });

  it('should generate room codes of specified length', () => {
    const code6 = generateRoomCode(6);
    const code8 = generateRoomCode(8);
    
    expect(code6).toHaveLength(6);
    expect(code8).toHaveLength(8);
    expect(isValidRoomCode(code6)).toBe(true);
    expect(isValidRoomCode(code8)).toBe(true);
  });

  it('should validate room codes correctly', () => {
    expect(isValidRoomCode('ABC123')).toBe(true);
    expect(isValidRoomCode('AB12')).toBe(false); // Too short
    expect(isValidRoomCode('ABCDEFGHI')).toBe(false); // Too long
    expect(isValidRoomCode('abc123')).toBe(true); // Lower case should work
    expect(isValidRoomCode('ABC-123')).toBe(false); // Invalid characters
  });
});
