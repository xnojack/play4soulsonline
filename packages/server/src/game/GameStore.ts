import { GameRoom } from './GameRoom';
import { MAX_ROOMS } from '../config';

class GameStore {
  private rooms = new Map<string, GameRoom>();
  private cleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private maxRooms: number;

  constructor(maxRooms: number) {
    this.maxRooms = maxRooms;
  }

  canCreate(): boolean {
    return this.rooms.size < this.maxRooms;
  }

  create(roomId: string, hostPlayerId: string): GameRoom {
    const room = new GameRoom(roomId, hostPlayerId);
    this.rooms.set(roomId, room);
    return room;
  }

  get(roomId: string): GameRoom | undefined {
    return this.rooms.get(roomId);
  }

  delete(roomId: string): void {
    this.cancelCleanup(roomId);
    this.rooms.delete(roomId);
  }

  /** Schedule automatic deletion of a room after `delayMs` milliseconds.
   *  Resets any existing pending timer for this room. */
  scheduleCleanup(roomId: string, delayMs: number): void {
    this.cancelCleanup(roomId);
    const timer = setTimeout(() => {
      this.rooms.delete(roomId);
      this.cleanupTimers.delete(roomId);
      console.log(`[GameStore] Room ${roomId} cleaned up after ${Math.round(delayMs / 60000)} min timeout`);
    }, delayMs);
    this.cleanupTimers.set(roomId, timer);
  }

  /** Cancel a pending cleanup timer for this room (e.g. a player reconnected). */
  cancelCleanup(roomId: string): void {
    const timer = this.cleanupTimers.get(roomId);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.cleanupTimers.delete(roomId);
    }
  }

  list(): { roomId: string; phase: string; playerCount: number }[] {
    return Array.from(this.rooms.values()).map((r) => ({
      roomId: r.roomId,
      phase: r.gamePhase,
      playerCount: r.playerCount,
    }));
  }

  get size(): number {
    return this.rooms.size;
  }
}

export const gameStore = new GameStore(MAX_ROOMS);
