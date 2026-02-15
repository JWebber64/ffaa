import { exportDraftState, importDraftState } from '../store/draftStore';
import type { DraftState } from '../types/draft';

export const MULTIPLAYER_ENABLED = import.meta.env.VITE_MULTIPLAYER_ENABLED === 'true';

export interface MultiplayerUtils {
  exportDraftState: (state: DraftState) => string;
  importDraftState: (exportedState: string) => DraftState;
  isEnabled: boolean;
}

export function createMultiplayerUtils(): MultiplayerUtils {
  return {
    exportDraftState,
    importDraftState,
    isEnabled: MULTIPLAYER_ENABLED,
  };
}

// Export singleton instance
export const multiplayerUtils = createMultiplayerUtils();

// Helper function to check if multiplayer is enabled
export function isMultiplayerEnabled(): boolean {
  return MULTIPLAYER_ENABLED;
}

// Helper to generate room codes
export function generateRoomCode(length: number = 6): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Helper to validate room codes
export function isValidRoomCode(code: string): boolean {
  return /^[A-Z0-9]{6,8}$/.test(code.toUpperCase());
}
