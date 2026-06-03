import { useEffect, useMemo } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useCursorStore, playerColor, type CursorData } from '../../store/cursorStore';
import { useBoardScale } from '../../context/BoardScaleContext';

const EXPIRE_MS = 2000;

/** Renders remote player cursors as colored dots inside the board's scaled container. */
export function RemoteCursors() {
  const game = useGameStore((s) => s.game);
  const cursors = useCursorStore((s) => s.cursors);
  const expire = useCursorStore((s) => s.expireCursors);
  const { totalScale, panX, panY } = useBoardScale();

  // Expire stale cursors every second
  useEffect(() => {
    const interval = setInterval(() => expire(EXPIRE_MS), 1000);
    return () => clearInterval(interval);
  }, [expire]);

  // Build my playerId so we don't render our own cursor
  const myPlayerId = game?.myPlayerId;

  // Build player seatIndex map for color computation
  const playerMap = useMemo(() => {
    const map = new Map<string, { seatIndex: number; totalPlayers: number }>();
    if (game) {
      const totalPlayers = game.players.filter((p) => !p.isSpectator).length;
      for (const p of game.players) {
        if (!p.isSpectator) {
          map.set(p.id, { seatIndex: p.seatIndex, totalPlayers });
        }
      }
    }
    return map;
  }, [game]);

  // Get canvas rect for viewport-to-board conversion
  const canvasEl = document.querySelector('[data-board-canvas]') as HTMLElement | null;
  const canvasRect = canvasEl?.getBoundingClientRect();

  // Convert viewport coords to board-local coords (inside scaled container)
  const toBoardLocal = (vx: number, vy: number) => {
    if (!canvasRect) return { x: vx, y: vy };
    return {
      x: (vx - canvasRect.x - panX) / totalScale,
      y: (vy - canvasRect.y - panY) / totalScale,
    };
  };

  const cursorEntries = Object.entries(cursors) as [string, CursorData][];
  const filtered = cursorEntries.filter(([id]) => id !== myPlayerId);

  if (filtered.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {filtered.map(([playerId, cursor]) => {
        const info = playerMap.get(playerId);
        const color = info
          ? playerColor(playerId, info.seatIndex, info.totalPlayers)
          : '#888';
        const initial = cursor.playerName.charAt(0).toUpperCase();
        const local = toBoardLocal(cursor.x, cursor.y);

        return (
          <div
            key={playerId}
            style={{
              position: 'absolute',
              left: local.x,
              top: local.y,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div
              className="relative flex items-center justify-center rounded-full w-5 h-5 text-white text-[10px] font-bold shadow-lg cursor-default"
              style={{ backgroundColor: color }}
            >
              {initial}
              <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap px-1.5 py-0.5 rounded bg-black/80 text-white text-[10px] font-medium opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
                {cursor.playerName}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
