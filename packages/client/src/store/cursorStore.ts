import { create } from 'zustand';

export interface CursorData {
  x: number;
  y: number;
  playerName: string;
  color: string;
  lastSeen: number;
}

interface CursorState {
  cursors: Record<string, CursorData>;
  setCursor: (playerId: string, data: Omit<CursorData, 'lastSeen'>) => void;
  removeCursor: (playerId: string) => void;
  clearCursors: () => void;
  expireCursors: (maxAgeMs: number) => void;
}

/** Deterministic HSL color from playerId hash — same player always gets same color */
function playerColor(playerId: string, seatIndex: number, totalPlayers: number): string {
  const hue = (seatIndex * 360) / Math.max(totalPlayers, 1);
  return `hsl(${hue}, 70%, 55%)`;
}

export const useCursorStore = create<CursorState>((set) => ({
  cursors: {},
  setCursor: (playerId, data) =>
    set((state) => ({
      cursors: {
        ...state.cursors,
        [playerId]: { ...data, lastSeen: Date.now() },
      },
    })),
  removeCursor: (playerId) =>
    set((state) => {
      const next = { ...state.cursors };
      delete next[playerId];
      return { cursors: next };
    }),
  clearCursors: () => set({ cursors: {} }),
  expireCursors: (maxAgeMs) =>
    set((state) => {
      const now = Date.now();
      const next: Record<string, CursorData> = {};
      for (const [id, c] of Object.entries(state.cursors)) {
        if (now - c.lastSeen <= maxAgeMs) {
          next[id] = c;
        }
      }
      return { cursors: next };
    }),
}));

export { playerColor };
