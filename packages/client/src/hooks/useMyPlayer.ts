import { useGameStore } from '../store/gameStore';

export function useMyPlayer() {
  const game = useGameStore((s) => s.game);
  if (!game) return null;
  return game.players.find((p) => p.id === game.myPlayerId) ?? null;
}

export function useIsMyTurn() {
  const game = useGameStore((s) => s.game);
  if (!game) return false;
  return game.turn.activePlayerId === game.myPlayerId;
}

export function useHasPriority() {
  const game = useGameStore((s) => s.game);
  if (!game) return false;
  return game.priorityQueue[0] === game.myPlayerId;
}

export function useIsHost() {
  const game = useGameStore((s) => s.game);
  if (!game) return false;
  return game.hostPlayerId === game.myPlayerId;
}
