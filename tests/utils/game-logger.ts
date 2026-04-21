import { TestPlayer } from './playwright-helpers';
import { TestSocket } from './socket-helpers';

/**
 * Comprehensive game log entry
 */
export interface GameLogEntry {
  id: string;
  timestamp: number;
  type: LogEntryType;
  message: string;
  playerId: string | null;
  phase?: string;
  turn?: number;
}

export type LogEntryType = 
  | 'attack'
  | 'death'
  | 'card_play'
  | 'purchase'
  | 'dice'
  | 'soul_gain'
  | 'stack'
  | 'phase'
  | 'info';

/**
 * Game state at a specific point in time
 */
export interface GameStateSnapshot {
  phase: string;
  activePlayerId: string;
  turn: number;
  coinPool: number;
  treasureDeckCount: number;
  lootDeckCount: number;
  monsterDeckCount: number;
  roomDeckCount: number;
  players: PlayerSnapshot[];
}

export interface PlayerSnapshot {
  id: string;
  name: string;
  hp: number;
  atk: number;
  coins: number;
  soulValue: number;
  handCount: number;
  isAlive: boolean;
}

/**
 * Game logger that aggregates events from multiple sources
 */
export class GameLogger {
  private entries: GameLogEntry[] = [];
  private startTime: number;
  private turnCount: number = 0;

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * Log a game event
   */
  log(
    type: LogEntryType,
    message: string,
    playerId: string | null,
    extra?: { phase?: string; turn?: number }
  ): void {
    const entry: GameLogEntry = {
      id: this.generateId(),
      timestamp: Date.now() - this.startTime,
      type,
      message,
      playerId,
      phase: extra?.phase,
      turn: extra?.turn ?? this.turnCount
    };
    
    this.entries.push(entry);
  }

  /**
   * Log a phase transition
   */
  logPhase(phase: string, playerId: string | null): void {
    this.log('phase', `Phase changed to ${phase}`, playerId, { phase });
  }

  /**
   * Log an attack
   */
  logAttack(
    attacker: string,
    target: string,
    hit: boolean,
    playerId: string | null
  ): void {
    const message = hit 
      ? `${attacker} hits ${target}`
      : `${attacker} misses ${target}`;
    this.log('attack', message, playerId);
  }

  /**
   * Log a card play
   */
  logCardPlay(player: string, cardName: string, playerId: string | null): void {
    this.log('card_play', `${player} plays ${cardName}`, playerId);
  }

  /**
   * Log a purchase
   */
  logPurchase(player: string, item: string, cost: number, playerId: string | null): void {
    this.log('purchase', `${player} purchases ${item} for ${cost}¢`, playerId);
  }

  /**
   * Log a dice roll
   */
  logDice(player: string, result: number, context: string, playerId: string | null): void {
    this.log('dice', `${player} rolled ${result} (${context})`, playerId);
  }

  /**
   * Log soul gain
   */
  logSoulGain(player: string, soul: string, value: number, playerId: string | null): void {
    this.log('soul_gain', `${player} gains ${soul} (${value} souls)`, playerId);
  }

  /**
   * Log stack operation
   */
  logStack(action: string, playerId: string | null): void {
    this.log('stack', action, playerId);
  }

  /**
   * Log info message
   */
  logInfo(message: string, playerId: string | null): void {
    this.log('info', message, playerId);
  }

  /**
   * Advance turn counter
   */
  nextTurn(): void {
    this.turnCount++;
  }

  /**
   * Get all log entries
   */
  getEntries(): GameLogEntry[] {
    return [...this.entries];
  }

  /**
   * Get log entries by type
   */
  getEntriesByType(type: LogEntryType): GameLogEntry[] {
    return this.entries.filter(entry => entry.type === type);
  }

  /**
   * Get log entries for a specific player
   */
  getEntriesByPlayer(playerId: string | null): GameLogEntry[] {
    return this.entries.filter(entry => entry.playerId === playerId);
  }

  /**
   * Get log entries for a phase
   */
  getEntriesByPhase(phase: string): GameLogEntry[] {
    return this.entries.filter(entry => entry.phase === phase);
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    totalEntries: number;
    byType: Record<string, number>;
    byPlayer: Record<string, number>;
    durationMs: number;
  } {
    const byType: Record<string, number> = {};
    const byPlayer: Record<string, number> = {};

    for (const entry of this.entries) {
      byType[entry.type] = (byType[entry.type] || 0) + 1;
      
      const playerId = entry.playerId || 'system';
      byPlayer[playerId] = (byPlayer[playerId] || 0) + 1;
    }

    return {
      totalEntries: this.entries.length,
      byType,
      byPlayer,
      durationMs: Date.now() - this.startTime
    };
  }

  /**
   * Clear all log entries
   */
  clear(): void {
    this.entries = [];
    this.turnCount = 0;
  }

  /**
   * Generate unique ID for log entry
   */
  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}

/**
 * Validation helpers
 */

export function validateGameState(
  state: GameStateSnapshot,
  expected: Partial<GameStateSnapshot>
): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (expected.phase && state.phase !== expected.phase) {
    errors.push(`Expected phase ${expected.phase}, got ${state.phase}`);
  }

  if (expected.coinPool !== undefined && state.coinPool !== expected.coinPool) {
    errors.push(`Expected coinPool ${expected.coinPool}, got ${state.coinPool}`);
  }

  if (expected.treasureDeckCount !== undefined && 
      state.treasureDeckCount !== expected.treasureDeckCount) {
    errors.push(`Expected treasureDeckCount ${expected.treasureDeckCount}, got ${state.treasureDeckCount}`);
  }

  if (expected.lootDeckCount !== undefined && 
      state.lootDeckCount !== expected.lootDeckCount) {
    errors.push(`Expected lootDeckCount ${expected.lootDeckCount}, got ${state.lootDeckCount}`);
  }

  if (expected.monsterDeckCount !== undefined && 
      state.monsterDeckCount !== expected.monsterDeckCount) {
    errors.push(`Expected monsterDeckCount ${expected.monsterDeckCount}, got ${state.monsterDeckCount}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function validatePlayerState(
  player: PlayerSnapshot,
  expected: Partial<PlayerSnapshot>
): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (expected.hp !== undefined && player.hp !== expected.hp) {
    errors.push(`Expected HP ${expected.hp}, got ${player.hp}`);
  }

  if (expected.atk !== undefined && player.atk !== expected.atk) {
    errors.push(`Expected ATK ${expected.atk}, got ${player.atk}`);
  }

  if (expected.coins !== undefined && player.coins !== expected.coins) {
    errors.push(`Expected coins ${expected.coins}, got ${player.coins}`);
  }

  if (expected.soulValue !== undefined && player.soulValue !== expected.soulValue) {
    errors.push(`Expected soulValue ${expected.soulValue}, got ${player.soulValue}`);
  }

  if (expected.isAlive !== undefined && player.isAlive !== expected.isAlive) {
    errors.push(`Expected isAlive ${expected.isAlive}, got ${player.isAlive}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Card effect validator
 */
export class CardEffectValidator {
  private log: GameLogger;

  constructor(gameLogger: GameLogger) {
    this.log = gameLogger;
  }

  /**
   * Validate card draw effect
   */
  validateCardDraw(
    player: string,
    cardsDrawn: number,
    deckBefore: number,
    deckAfter: number
  ): boolean {
    const expectedDeckReduction = cardsDrawn;
    const actualReduction = deckBefore - deckAfter;
    
    const valid = actualReduction === expectedDeckReduction;
    
    if (!valid) {
      this.log.logInfo(
        `Card draw validation failed: expected ${expectedDeckReduction} cards drawn, ` +
        `deck reduced by ${actualReduction}`,
        null
      );
    }
    
    return valid;
  }

  /**
   * Validate damage effect
   */
  validateDamage(
    target: string,
    damageDealt: number,
    hpBefore: number,
    hpAfter: number
  ): boolean {
    const expectedHp = hpBefore - damageDealt;
    const valid = hpAfter === Math.max(0, expectedHp);
    
    if (!valid) {
      this.log.logInfo(
        `Damage validation failed for ${target}: expected HP ${expectedHp}, got ${hpAfter}`,
        null
      );
    }
    
    return valid;
  }

  /**
   * Validate soul gain effect
   */
  validateSoulGain(
    player: string,
    soulsBefore: number,
    soulsAfter: number,
    expectedValue: number
  ): boolean {
    const valid = soulsAfter === soulsBefore + expectedValue;
    
    if (!valid) {
      this.log.logInfo(
        `Soul gain validation failed for ${player}: expected ${soulsBefore + expectedValue}, got ${soulsAfter}`,
        null
      );
    }
    
    return valid;
  }

  /**
   * Validate coin transaction
   */
  validateCoinTransaction(
    player: string,
    coinsBefore: number,
    coinsAfter: number,
    expectedChange: number
  ): boolean {
    const valid = coinsAfter === coinsBefore + expectedChange;
    
    if (!valid) {
      this.log.logInfo(
        `Coin transaction validation failed for ${player}: expected ${coinsBefore + expectedChange}, got ${coinsAfter}`,
        null
      );
    }
    
    return valid;
  }

  /**
   * Validate phase transition
   */
  validatePhaseTransition(
    phaseBefore: string,
    phaseAfter: string,
    expectedTransitions: string[]
  ): boolean {
    const valid = expectedTransitions.includes(phaseAfter);
    
    if (!valid) {
      this.log.logInfo(
        `Phase transition validation failed: ${phaseBefore} → ${phaseAfter} (expected: ${expectedTransitions.join(', ')})`,
        null
      );
    }
    
    return valid;
  }
}
