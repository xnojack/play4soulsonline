import { useEffect, useRef } from 'react';
import { getSocket } from '../socket/client';
import { useGameStore } from '../store/gameStore';

const THROTTLE_MS = 50;

/** Broadcasts mouse position to the room. Only active when in a game (not lobby). */
export function useCursorBroadcast() {
  const game = useGameStore((s) => s.game);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const inGame = !!game && game.phase !== 'lobby';
    if (!inGame) return;

    const socket = getSocket();

    const onMouseMove = (e: MouseEvent) => {
      if (timerRef.current !== null) return; // throttle guard

      socket.emit('action:cursor_move', { x: e.clientX, y: e.clientY });

      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
      }, THROTTLE_MS);
    };

    document.addEventListener('mousemove', onMouseMove);

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [game?.phase]);
}
