import { io, Socket } from 'socket.io-client';

/**
 * Socket event types for game actions
 */
export type SocketEventName = 
  | 'connect'
  | 'disconnect'
  | 'game:state'
  | 'action:join'
  | 'action:start_game'
  | 'action:play_loot'
  | 'action:declare_attack'
  | 'action:roll_dice'
  | 'action:pass_priority'
  | 'action:purchase'
  | 'action:activate_ability'
  | 'action:select_eden_pick'
  | 'action:sad_vote'
  | 'action:select_saddest'
  | 'error';

/**
 * Socket connection wrapper for testing
 */
export class TestSocket {
  readonly playerId: string;
  private socket: Socket | null = null;
  private eventListeners: Map<SocketEventName, Array<(data?: unknown) => void>> = new Map();
  
  constructor(playerId: string) {
    this.playerId = playerId;
  }

  /**
   * Connect to the game server
   */
  async connect(url: string = 'http://localhost:3001'): Promise<void> {
    this.socket = io(url, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    return new Promise((resolve, reject) => {
      this.socket!.on('connect', () => {
        resolve();
      });
      
      this.socket!.on('connect_error', (error) => {
        reject(error);
      });
      
      this.socket!.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Disconnect from the server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Subscribe to socket events
   */
  on(event: SocketEventName, callback: (data?: unknown) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
    
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  /**
   * Unsubscribe from socket events
   */
  off(event: SocketEventName, callback: (data?: unknown) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
    
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  /**
   * Emit an action event
   */
  emit(event: SocketEventName, payload?: unknown): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Not connected'));
        return;
      }

      this.socket.emit(event, payload, (error: unknown) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Emit join action
   */
  async join(roomId: string, name: string, reconnectToken?: string): Promise<void> {
    await this.emit('action:join', {
      roomId,
      name,
      reconnectToken
    });
  }

  /**
   * Emit start game action
   */
  async startGame(activeSets: string[], options?: {
    includeBonusSouls?: boolean;
    bonusSoulCount?: number;
    includeRooms?: boolean;
    priorityTimeoutMs?: number;
  }): Promise<void> {
    await this.emit('action:start_game', {
      activeSets,
      ...options
    });
  }

  /**
   * Emit play loot action
   */
  async playLoot(cardId: string, targets: string[] = []): Promise<void> {
    await this.emit('action:play_loot', { cardId, targets });
  }

  /**
   * Emit declare attack action
   */
  async declareAttack(
    targetType: 'monster_slot' | 'item' | 'player',
    targetSlotIndex?: number,
    targetInstanceId?: string,
    targetPlayerId?: string
  ): Promise<void> {
    await this.emit('action:declare_attack', {
      targetType,
      targetSlotIndex,
      targetInstanceId,
      targetPlayerId
    });
  }

  /**
   * Emit roll dice action
   */
  async rollDice(context: 'attack' | 'ability' | 'manual', rollId: string): Promise<void> {
    await this.emit('action:roll_dice', { context, rollId });
  }

  /**
   * Emit pass priority action
   */
  async passPriority(): Promise<void> {
    await this.emit('action:pass_priority');
  }

  /**
   * Emit purchase action
   */
  async purchase(slotIndex: number): Promise<void> {
    await this.emit('action:purchase', { slotIndex });
  }

  /**
   * Emit activate ability action
   */
  async activateAbility(
    instanceId: string,
    abilityTag: 'tap' | 'paid',
    targets: string[] = []
  ): Promise<void> {
    await this.emit('action:activate_ability', { instanceId, abilityTag, targets });
  }

  /**
   * Emit eden pick selection
   */
  async selectEdenPick(cardId: string): Promise<void> {
    await this.emit('action:select_eden_pick', { cardId });
  }

  /**
   * Emit sad vote
   */
  async sadVote(targetPlayerId: string): Promise<void> {
    await this.emit('action:sad_vote', { targetPlayerId });
  }

  /**
   * Wait for a game state update
   */
  waitForGameState(timeout: number = 10000): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Not connected'));
        return;
      }

      const timeoutId = setTimeout(() => {
        reject(new Error('Timeout waiting for game state'));
      }, timeout);

      const handler = (data: unknown) => {
        clearTimeout(timeoutId);
        this.off('game:state', handler);
        resolve(data);
      };

      this.on('game:state', handler);
    });
  }

  /**
   * Wait for specific state condition
   */
  async waitForState(
    condition: (state: unknown) => boolean,
    timeout: number = 10000
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Not connected'));
        return;
      }

      const checkState = (data: unknown) => {
        if (condition(data)) {
          this.off('game:state', checkState);
          resolve(data);
        }
      };

      this.on('game:state', checkState);

      setTimeout(() => {
        this.off('game:state', checkState);
        reject(new Error('Timeout waiting for state condition'));
      }, timeout);
    });
  }
}

/**
 * Create multiple socket connections for testing multiplayer games
 */
export async function createMultipleSockets(
  playerIds: string[],
  url: string = 'http://localhost:3001'
): Promise<Map<string, TestSocket>> {
  const sockets = new Map<string, TestSocket>();
  
  for (const playerId of playerIds) {
    const socket = new TestSocket(playerId);
    await socket.connect(url);
    sockets.set(playerId, socket);
  }
  
  return sockets;
}

/**
 * Join all sockets to a room
 */
export async function joinAllToRoom(
  sockets: Map<string, TestSocket>,
  roomId: string,
  names: Map<string, string>
): Promise<void> {
  const promises = Array.from(sockets.entries()).map(async ([playerId, socket]) => {
    const name = names.get(playerId) || playerId;
    await socket.join(roomId, name);
  });
  
  await Promise.all(promises);
}
