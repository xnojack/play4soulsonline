import { GameRoom } from './GameRoom';
import { MAX_ROOMS } from '../config';
import {
  clearPriorityTimeout,
  passPriority,
} from './stack';

class GameStore {
  private rooms = new Map<string, GameRoom>();
  private cleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private timeoutCheckTimer?: ReturnType<typeof setInterval>;
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

  /**
   * Start the periodic priority-timeout checker.
   * Call this once after the Socket.IO server is ready.
   * Runs every 500ms; auto-passes priority for any player whose deadline has elapsed.
   * `broadcastFn` should broadcast the updated state for the given roomId.
   */
  startTimeoutChecker(broadcastFn: (roomId: string) => void): void {
    if (this.timeoutCheckTimer) return; // already running

    this.timeoutCheckTimer = setInterval(() => {
      const now = Date.now();
      for (const [roomId, room] of this.rooms) {
        const state = room.getState();
        if (state.phase !== 'active') continue;
        if (
          state.turn.priorityTimeoutDeadline == null ||
          state.turn.priorityTimeoutPlayerId == null
        ) continue;
        if (now < state.turn.priorityTimeoutDeadline) continue;

        // Deadline elapsed — auto-pass for this player
        const timedOutPlayerId = state.turn.priorityTimeoutPlayerId;
        let s = clearPriorityTimeout(state);
        s = passPriority(s, timedOutPlayerId);

        // Stack never auto-resolves; the active player must call
        // action:resolve_top explicitly.

        room.setState(s);
        broadcastFn(roomId);
      }
    }, 500);
  }
}

export const gameStore = new GameStore(MAX_ROOMS);
