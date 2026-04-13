import { v4 as uuidv4 } from 'uuid';
import {
  GameState,
  Player,
  CardInPlay,
  MonsterSlot,
  ShopSlot,
  BonusSoulState,
  TurnState,
  LogEntry,
  LogEntryType,
  ClientGameState,
  ClientPlayer,
  Card,
} from './types';
import { shuffle, drawFromDeck, createCardInPlay } from './decks';
import { resetPriority } from './stack';
import { rechargePlayerItems } from './actions/turn';
import {
  getCardsByTypeAndSets,
  getCardsByType,
  getCardById,
} from '../db/cards';
import { getStartingItemId } from './startingItems';
import {
  DEFAULT_SHOP_SLOTS,
  DEFAULT_MONSTER_SLOTS,
  DEFAULT_COIN_POOL,
  DEFAULT_STARTING_COINS,
  DEFAULT_STARTING_LOOT,
  WINNING_SOUL_VALUE,
} from '../config';

// ─── Log helper (exported so stack.ts can use it) ─────────────────────────────
export function createLogEntry(
  type: LogEntryType,
  message: string,
  playerId: string | null
): LogEntry {
  return { id: uuidv4(), timestamp: Date.now(), type, message, playerId };
}

// ─── Eternal deck exceptions ───────────────────────────────────────────────────
// These cards have isEternal=true but belong in the regular decks, not the
// eternal pool. Keeper's Sack is a buyable treasure; Tick is a loot trinket.
const ETERNAL_IN_TREASURE_DECK = new Set([
  'b2-keepers_sack',
  'keepers_sack',
]);
const ETERNAL_IN_LOOT_DECK = new Set([
  'b2-tick',
  'tick',
]);

// ─── GameRoom ─────────────────────────────────────────────────────────────────

export class GameRoom {
  private state: GameState;

  constructor(roomId: string, hostPlayerId: string) {
    const emptyTurn: TurnState = {
      activePlayerId: '',
      phase: 'start',
      lootDrawn: false,
      lootPlaysRemaining: 1,
      purchasesMade: 0,
      attacksDeclared: 0,
      attacksRequired: 1,
      currentAttack: null,
      passedPriority: new Set<string>(),
    };

    this.state = {
      roomId,
      hostPlayerId,
      phase: 'lobby',
      activeSets: [],
      winnerId: null,
      turn: emptyTurn,
      priorityQueue: [],
      stack: [],
      coinPool: DEFAULT_COIN_POOL,
      treasureDeck: [],
      treasureDiscard: [],
      lootDeck: [],
      lootDiscard: [],
      monsterDeck: [],
      monsterDiscard: [],
      roomDeck: [],
      roomDiscard: [],
      eternalDeck: [],
      eternalDiscard: [],
      shopSlots: Array.from({ length: DEFAULT_SHOP_SLOTS }, (_, i) => ({
        slotIndex: i,
        card: null,
      })),
      monsterSlots: Array.from({ length: DEFAULT_MONSTER_SLOTS }, (_, i) => ({
        slotIndex: i,
        stack: [],
      })),
      roomSlots: [],
      bonusSouls: [],
      characterCards: {},
      startingItemCards: {},
      players: [],
      log: [],
      edenPickQueue: [],
      edenPickOptions: [],
      sadVotes: {},
    };
  }

  // ─── Getters ───────────────────────────────────────────────────────────────

  get roomId() {
    return this.state.roomId;
  }

  get gamePhase() {
    return this.state.phase;
  }

  get playerCount() {
    return this.state.players.filter((p) => !p.isSpectator).length;
  }

  /** True when every non-spectator player is currently disconnected. */
  get allDisconnected(): boolean {
    const nonSpectators = this.state.players.filter((p) => !p.isSpectator);
    return nonSpectators.length === 0 || nonSpectators.every((p) => !p.connected);
  }

  getState(): GameState {
    return this.state;
  }

  /** Returns a client-safe view filtered for the given player */
  getClientState(viewerId: string): ClientGameState {
    const s = this.state;

    const clientPlayers: ClientPlayer[] = s.players.map((p) => {
      const isViewer = p.id === viewerId;
      const isShared = p.handSharedWith.includes(viewerId);
      const canSeeHand = isViewer || isShared;

      const effectiveHp = p.baseHp + p.hpCounters - p.currentDamage;
      const effectiveAtk = p.baseAtk + p.atkCounters;

      // Destructure to exclude reconnectToken at runtime (Omit is compile-time only)
      const { reconnectToken: _token, ...safePlayer } = p;

      return {
        ...safePlayer,
        handCardIds: canSeeHand ? p.handCardIds : [],
        handCount: p.handCardIds.length,
        effectiveHp,
        effectiveAtk,
      };
    });

    return {
      ...s,
      players: clientPlayers,
      myPlayerId: viewerId,
      turn: {
        ...s.turn,
        passedPriorityIds: Array.from(s.turn.passedPriority),
      },
      // Strip deck contents — only send counts so clients cannot see deck order
      treasureDeck: [],
      lootDeck: [],
      monsterDeck: [],
      roomDeck: [],
      eternalDeck: [],
      treasureDeckCount: s.treasureDeck.length,
      lootDeckCount: s.lootDeck.length,
      monsterDeckCount: s.monsterDeck.length,
      roomDeckCount: s.roomDeck.length,
      eternalDeckCount: s.eternalDeck.length,
      // Eden pick options only visible to the current picker
      edenPickOptions: s.edenPickQueue[0] === viewerId ? s.edenPickOptions : [],
    };
  }

  // ─── Player management ─────────────────────────────────────────────────────

  /**
   * Add or reconnect a player.
   * Returns `{ error }` on failure, or `{ token }` on success.
   * For reconnects, `reconnectToken` must match the stored token.
   */
  addPlayer(id: string, name: string, isSpectator = false, reconnectToken?: string): { error: string } | { token: string } {
    if (this.state.players.find((p) => p.id === id)) return { token: '' }; // already joined (same socket)

    // Reconnect: if a disconnected player with the same name exists, verify token and re-map their id
    const existing = this.state.players.find(
      (p) => p.name.toLowerCase() === name.toLowerCase() && !p.connected && !p.isSpectator
    );
    if (existing) {
      // If a token was stored and the supplied token doesn't match, reject
      if (existing.reconnectToken && reconnectToken !== existing.reconnectToken) {
        return { error: 'Invalid reconnect token' };
      }
      const oldId = existing.id;
      this.state = {
        ...this.state,
        players: this.state.players.map((p) =>
          p.id === oldId ? { ...p, id, connected: true } : p
        ),
        // Remap stale socket IDs in the priority queue and turn state
        priorityQueue: this.state.priorityQueue.map((pid) => pid === oldId ? id : pid),
        turn: {
          ...this.state.turn,
          activePlayerId: this.state.turn.activePlayerId === oldId ? id : this.state.turn.activePlayerId,
        },
        log: [
          ...this.state.log,
          createLogEntry('info', `${name} reconnected`, id),
        ],
      };
      return { token: existing.reconnectToken };
    }

    // During an active game, only spectators may join
    if (this.state.phase === 'active' && !isSpectator) {
      return { error: 'Game already started — join as spectator instead' };
    }
    if (this.state.phase === 'ended') {
      return { error: 'Game has ended' };
    }

    const token = uuidv4();
    const player: Player = {
      id,
      name,
      seatIndex: this.state.players.filter((p) => !p.isSpectator).length,
      isSpectator,
      connected: true,
      reconnectToken: token,
      characterInstanceId: '',
      characterCardId: '',
      startingItemInstanceId: '',
      coins: 0,
      baseHp: 2,
      baseAtk: 1,
      currentDamage: 0,
      hpCounters: 0,
      atkCounters: 0,
      handCardIds: [],
      handSharedWith: [],
      items: [],
      souls: [],
      curses: [],
      kills: [],
      isAlive: true,
      deathCount: 0,
    };

    this.state = {
      ...this.state,
      players: [...this.state.players, player],
      log: [
        ...this.state.log,
        createLogEntry('info', `${name} joined the game`, id),
      ],
    };
    return { token };
  }

  setConnected(playerId: string, connected: boolean): void {
    this.state = {
      ...this.state,
      players: this.state.players.map((p) =>
        p.id === playerId ? { ...p, connected } : p
      ),
    };
  }

  setActiveSets(sets: string[]): void {
    if (this.state.phase !== 'lobby') return;
    this.state = { ...this.state, activeSets: sets };
  }

  // ─── Game start ────────────────────────────────────────────────────────────

  startGame(options: {
    activeSets: string[];
    includeBonusSouls: boolean;
    bonusSoulCount?: number;
    includeRooms: boolean;
    excludeNeverPrinted?: boolean;
  }): string | null {
    if (this.state.phase !== 'lobby') return 'Game already started';
    const nonSpectators = this.state.players.filter((p) => !p.isSpectator);
    if (nonSpectators.length < 1) return 'Need at least 1 player';

    this.state = { ...this.state, activeSets: options.activeSets };

    // Build decks from DB
    const sets = options.activeSets.length > 0 ? options.activeSets : undefined;

    const treasureCards = sets
      ? getCardsByTypeAndSets('Treasure', sets)
      : getCardsByType('Treasure');
    const lootCards = sets
      ? getCardsByTypeAndSets('Loot', sets)
      : getCardsByType('Loot');
    const monsterCards = sets
      ? getCardsByTypeAndSets('Monster', sets)
      : getCardsByType('Monster');
    const characterCards = sets
      ? getCardsByTypeAndSets('Character', sets)
      : getCardsByType('Character');
    const roomCards = options.includeRooms
      ? sets
        ? getCardsByTypeAndSets('Room', sets)
        : getCardsByType('Room')
      : [];
    const bonusSoulCards = options.includeBonusSouls
      ? sets
        ? getCardsByTypeAndSets('BonusSoul', sets)
        : getCardsByType('BonusSoul')
      : [];

    // Filter 3+ player only cards if < 3 players
    const playerCount = nonSpectators.length;
    const filter3p = playerCount < 3;
    const filterCards = (cards: Card[]) => {
      let filtered = filter3p ? cards.filter((c) => !c.threePlayerOnly) : cards;
      if (options.excludeNeverPrinted) {
        filtered = filtered.filter((c) => c.printStatus !== 'never_printed');
      }
      return filtered;
    };

    // Split eternal cards out of treasure and loot — they form their own deck.
    // Exception: Keeper's Sack stays in treasure; Tick stays in loot.
    const filteredTreasure = filterCards(treasureCards);
    const eternalTreasure = filteredTreasure.filter(
      (c) => c.isEternal && !ETERNAL_IN_TREASURE_DECK.has(c.id)
    );
    const nonEternalTreasure = filteredTreasure.filter(
      (c) => !c.isEternal || ETERNAL_IN_TREASURE_DECK.has(c.id)
    );

    const filteredLoot = filterCards(lootCards);
    const eternalLoot = filteredLoot.filter(
      (c) => c.isEternal && !ETERNAL_IN_LOOT_DECK.has(c.id)
    );
    const nonEternalLoot = filteredLoot.filter(
      (c) => !c.isEternal || ETERNAL_IN_LOOT_DECK.has(c.id)
    );

    // Eternal deck = all eternal treasure + eternal loot cards (shuffled together)
    const shuffledEternal = shuffle([...eternalTreasure, ...eternalLoot].flatMap((c) => Array(c.quantity).fill(c.id)));

    const shuffledTreasure = shuffle(nonEternalTreasure.flatMap((c) => Array(c.quantity).fill(c.id)));
    const shuffledLoot = shuffle(nonEternalLoot.flatMap((c) => Array(c.quantity).fill(c.id)));
    const shuffledMonster = shuffle(filterCards(monsterCards).flatMap((c) => Array(c.quantity).fill(c.id)));
    const shuffledRoom = shuffle(filterCards(roomCards).flatMap((c) => Array(c.quantity).fill(c.id)));

    // Assign characters randomly — each player gets a unique character
    // If there are more players than characters, cycle with offset so no two share
    // Pad if needed: repeat the deck until we have enough unique assignments
    const charPool: typeof characterCards = [];
    while (charPool.length < nonSpectators.length) {
      charPool.push(...shuffle([...characterCards]));
    }
    const assignedChars = charPool.slice(0, nonSpectators.length);
    const charMap: Record<string, CardInPlay> = {};
    const startingItemMap: Record<string, CardInPlay> = {};

    let currentLootDeck = shuffledLoot;
    let currentLootDiscard: string[] = [];
    let currentTreasureDeck = shuffledTreasure;

    // Collect all starting item IDs that will be assigned to players so we can
    // remove them from the treasure deck (they shouldn't be buyable in the shop)
    const assignedStartingItemIds = new Set<string>();

    // Pre-compute starting item IDs for all players before dealing.
    // getStartingItemId returns:
    //   string    — known item ID (assign it)
    //   null      — explicitly Eden (must pick from treasure deck)
    //   undefined — character not in map (treat as no starting item, not Eden)
    const resolvedStartingItems: (string | null | undefined)[] = assignedChars.slice(0, nonSpectators.length).map((char) => {
      const startingItemId = getStartingItemId(char?.id ?? '');
      if (startingItemId === null) return null; // Eden-type — will pick later
      if (startingItemId !== undefined) {
        const itemCard = getCardById(startingItemId);
        if (itemCard) {
          assignedStartingItemIds.add(startingItemId);
          return startingItemId;
        }
        // Item ID is in map but not in DB — warn and skip
        console.warn(`[GameRoom] Starting item "${startingItemId}" for "${char?.id}" not found in DB — skipping`);
      }
      // undefined = character not in startingItems map — no starting item, not Eden
      return undefined;
    });

    // Remove pre-known starting item IDs from treasure deck upfront
    currentTreasureDeck = currentTreasureDeck.filter((id) => !assignedStartingItemIds.has(id));
    // Also remove from eternal deck (starting items might be eternal)
    const currentEternalDeck = shuffledEternal.filter((id) => !assignedStartingItemIds.has(id));

    // Track which players are Eden (need to pick their starting item)
    const edenPlayerIds: string[] = [];

    const players = nonSpectators.map((p, i) => {
      const char = assignedChars[i];
      const charInstance = createCardInPlay(char?.id ?? 'unknown', false); // all start tapped
      charMap[charInstance.instanceId] = charInstance;

      // resolvedStartingItems[i]:
      //   string    → known item, assign it
      //   null      → Eden, must pick from treasure deck
      //   undefined → unknown character, no starting item (not Eden)
      const resolvedItemId = resolvedStartingItems[i];
      const isEden = resolvedItemId === null;

      if (isEden) {
        edenPlayerIds.push(p.id);
      }

      // Eden players get a placeholder for now; unknown chars get no item
      const siInstance = (typeof resolvedItemId === 'string')
        ? createCardInPlay(resolvedItemId, false) // known item, start tapped
        : createCardInPlay('placeholder-starting-item', false); // Eden or unknown
      startingItemMap[siInstance.instanceId] = siInstance;

      // Deal starting loot
      const { drawn, newDeck, newDiscard } = drawFromDeck(
        currentLootDeck,
        currentLootDiscard,
        DEFAULT_STARTING_LOOT
      );
      currentLootDeck = newDeck;
      currentLootDiscard = newDiscard;

      return {
        ...p,
        characterInstanceId: charInstance.instanceId,
        characterCardId: char?.id ?? '',
        startingItemInstanceId: siInstance.instanceId,
        coins: DEFAULT_STARTING_COINS,
        baseHp: char?.hp ?? 2,
        baseAtk: char?.atk ?? 1,
        handCardIds: drawn,
        items: [siInstance],
      };
    });

    // Spectators remain unchanged
    const spectators = this.state.players.filter((p) => p.isSpectator);

    // Fill shop slots
    let currentTreasureDiscard: string[] = [];
    const shopSlots: ShopSlot[] = [];
    for (let i = 0; i < DEFAULT_SHOP_SLOTS; i++) {
      const { drawn, newDeck, newDiscard } = drawFromDeck(
        currentTreasureDeck,
        currentTreasureDiscard,
        1
      );
      currentTreasureDeck = newDeck;
      currentTreasureDiscard = newDiscard;
      shopSlots.push({
        slotIndex: i,
        card: drawn[0] ? createCardInPlay(drawn[0]) : null,
      });
    }

    // Fill monster slots (skip events during setup)
    let currentMonsterDeck = shuffledMonster;
    let currentMonsterDiscard: string[] = [];
    const monsterSlots: MonsterSlot[] = [];
    for (let i = 0; i < DEFAULT_MONSTER_SLOTS; i++) {
      // Find a non-event monster for the slot
      let monsterCard: string | null = null;
      let attempts = 0;
      while (!monsterCard && attempts < 20) {
        const { drawn, newDeck, newDiscard } = drawFromDeck(
          currentMonsterDeck,
          currentMonsterDiscard,
          1
        );
        currentMonsterDeck = newDeck;
        currentMonsterDiscard = newDiscard;
        if (!drawn[0]) break;
        const card = getCardById(drawn[0]);
        if (card && card.subType !== 'Event' && card.subType !== 'Curse') {
          monsterCard = drawn[0];
        } else if (drawn[0]) {
          // Put events on bottom
          currentMonsterDeck = [drawn[0], ...currentMonsterDeck];
        }
        attempts++;
      }
      monsterSlots.push({
        slotIndex: i,
        stack: monsterCard ? [createCardInPlay(monsterCard)] : [],
      });
    }

    // Room slots — start with one card if rooms enabled
    const roomSlots: CardInPlay[] = [];
    if (options.includeRooms && shuffledRoom.length > 0) {
      const { drawn, newDeck: newRoomDeck } = drawFromDeck(shuffledRoom, [], 1);
      if (drawn[0]) {
        roomSlots.push(createCardInPlay(drawn[0]));
        shuffledRoom.splice(0, shuffledRoom.length, ...newRoomDeck);
      }
    }

    // Bonus souls (pick configurable count, default 3)
    const bonusSoulLimit = options.bonusSoulCount ?? 3;
    const bonusSouls: BonusSoulState[] = shuffle([...bonusSoulCards])
      .slice(0, bonusSoulLimit)
      .map((c) => ({
        cardId: c.id,
        instance: createCardInPlay(c.id),
        isGained: false,
        isDestroyed: false,
        gainedByPlayerId: null,
      }));

    // Determine first player (random among non-spectators)
    const firstPlayerIndex = Math.floor(Math.random() * players.length);
    const firstPlayer = players[firstPlayerIndex];

    const initialState: GameState = {
      ...this.state,
      phase: 'active',
      activeSets: options.activeSets,
      turn: {
        activePlayerId: firstPlayer.id,
        phase: 'start',
        lootDrawn: false,
        lootPlaysRemaining: 1,
        purchasesMade: 0,
        attacksDeclared: 0,
        attacksRequired: 1,
        currentAttack: null,
        passedPriority: new Set<string>(),
      },
      stack: [],
      coinPool: DEFAULT_COIN_POOL - players.length * DEFAULT_STARTING_COINS,
      treasureDeck: currentTreasureDeck,
      treasureDiscard: currentTreasureDiscard,
      lootDeck: currentLootDeck,
      lootDiscard: currentLootDiscard,
      monsterDeck: currentMonsterDeck,
      monsterDiscard: currentMonsterDiscard,
      roomDeck: shuffledRoom,
      roomDiscard: [],
      eternalDeck: currentEternalDeck,
      eternalDiscard: [],
      shopSlots,
      monsterSlots,
      roomSlots,
      bonusSouls,
      characterCards: charMap,
      startingItemCards: startingItemMap,
      players: [...players, ...spectators],
      log: [
        ...this.state.log,
        createLogEntry('info', 'Game started!', null),
        createLogEntry('phase', `${firstPlayer.name}'s turn begins`, firstPlayer.id),
      ],
      edenPickQueue: [],
      edenPickOptions: [],
      sadVotes: {},
    };

    if (edenPlayerIds.length > 0) {
      // Eden pick phase: queue picks in seat order, offer top 3 of treasure deck
      this.state = {
        ...initialState,
        phase: 'eden_pick',
        edenPickQueue: edenPlayerIds,
        edenPickOptions: initialState.treasureDeck.slice(-3),
      };
    } else {
      // No Edens — go to sad_vote (or active if solo)
      this.state = this.transitionToSadVote(initialState);
    }
    return null;
  }

  /** Transition to sad_vote phase, or skip directly to active if only 1 non-spectator */
  transitionToSadVote(state: GameState): GameState {
    const nonSpectators = state.players.filter((p) => !p.isSpectator);
    if (nonSpectators.length <= 1) {
      // Solo game — skip the vote
      let s = resetPriority({ ...state, phase: 'active', sadVotes: {} });
      const first = nonSpectators[0] ?? state.players[0];
      if (first) s = rechargePlayerItems(s, first.id);
      return s;
    }
    return { ...state, phase: 'sad_vote', sadVotes: {} };
  }

  /** Tally sadVotes and transition to active. Used by both all-voted and host-skip paths. */
  resolveSadVote(state: GameState): GameState {
    const nonSpectators = state.players.filter((p) => !p.isSpectator);
    let winnerId: string;

    const tally: Record<string, number> = {};
    for (const targetId of Object.values(state.sadVotes)) {
      tally[targetId] = (tally[targetId] ?? 0) + 1;
    }

    if (Object.keys(tally).length === 0) {
      // No votes at all — pick randomly
      const idx = Math.floor(Math.random() * nonSpectators.length);
      winnerId = nonSpectators[idx].id;
    } else {
      const maxVotes = Math.max(...Object.values(tally));
      const winners = Object.entries(tally)
        .filter(([, count]) => count === maxVotes)
        .map(([id]) => id);
      winnerId = winners[Math.floor(Math.random() * winners.length)];
    }

    const winner = state.players.find((p) => p.id === winnerId);
    const log = createLogEntry(
      'phase',
      `${winner?.name ?? 'Unknown'} goes first (saddest character)`,
      winnerId
    );

    let s = resetPriority({
      ...state,
      phase: 'active',
      sadVotes: {},
      turn: { ...state.turn, activePlayerId: winnerId },
      log: [...state.log, log],
    });
    s = rechargePlayerItems(s, winnerId);
    return s;
  }

  // ─── Mutate state (used by action handlers) ────────────────────────────────

  setState(newState: GameState): void {
    // Cap the log at 200 entries to prevent unbounded memory growth
    const log = newState.log.length > 200
      ? newState.log.slice(newState.log.length - 200)
      : newState.log;
    this.state = { ...newState, log };
  }

  addLog(type: LogEntryType, message: string, playerId: string | null): void {
    const entry = createLogEntry(type, message, playerId);
    this.state = { ...this.state, log: [...this.state.log, entry] };
  }

  // ─── Win check ────────────────────────────────────────────────────────────

  checkWin(): string | null {
    for (const player of this.state.players) {
      if (player.isSpectator) continue;
      const totalSoulValue = player.souls.reduce((sum, soul) => {
        const card = getCardById(soul.cardId);
        return sum + (card?.soulValue ?? 1);
      }, 0);
      if (totalSoulValue >= WINNING_SOUL_VALUE) {
        return player.id;
      }
    }
    return null;
  }

  endGame(winnerId: string): void {
    const winner = this.state.players.find((p) => p.id === winnerId);
    this.state = {
      ...this.state,
      phase: 'ended',
      winnerId,
      log: [
        ...this.state.log,
        createLogEntry(
          'info',
          `${winner?.name ?? 'Unknown'} wins with ${WINNING_SOUL_VALUE}+ souls!`,
          winnerId
        ),
      ],
    };
  }

  /** Reset to lobby so the host can start a new game with the same players */
  resetToLobby(): void {
    const emptyTurn: TurnState = {
      activePlayerId: '',
      phase: 'start',
      lootDrawn: false,
      lootPlaysRemaining: 1,
      purchasesMade: 0,
      attacksDeclared: 0,
      attacksRequired: 1,
      currentAttack: null,
      passedPriority: new Set<string>(),
    };

    // Keep the current players but reset all game state.
    // Spectators who joined during the game become full players in the lobby.
    let seatCounter = 0;
    const resetPlayers = this.state.players.map((p) => ({
      ...p,
      isSpectator: false, // all players get a seat in the new lobby
      seatIndex: seatCounter++,
      characterInstanceId: '',
      characterCardId: '',
      startingItemInstanceId: '',
      coins: 0,
      baseHp: 2,
      baseAtk: 1,
      currentDamage: 0,
      hpCounters: 0,
      atkCounters: 0,
      handCardIds: [],
      handSharedWith: [],
      items: [],
      souls: [],
      curses: [],
      kills: [],
      isAlive: true,
      deathCount: 0,
    }));

    this.state = {
      roomId: this.state.roomId,
      hostPlayerId: this.state.hostPlayerId,
      phase: 'lobby',
      activeSets: this.state.activeSets,
      winnerId: null,
      turn: emptyTurn,
      priorityQueue: [],
      stack: [],
      coinPool: DEFAULT_COIN_POOL,
      treasureDeck: [],
      treasureDiscard: [],
      lootDeck: [],
      lootDiscard: [],
      monsterDeck: [],
      monsterDiscard: [],
      roomDeck: [],
      roomDiscard: [],
      eternalDeck: [],
      eternalDiscard: [],
      shopSlots: Array.from({ length: DEFAULT_SHOP_SLOTS }, (_, i) => ({
        slotIndex: i,
        card: null,
      })),
      monsterSlots: Array.from({ length: DEFAULT_MONSTER_SLOTS }, (_, i) => ({
        slotIndex: i,
        stack: [],
      })),
      roomSlots: [],
      bonusSouls: [],
      characterCards: {},
      startingItemCards: {},
      players: resetPlayers,
      log: [createLogEntry('info', 'Game reset to lobby by host', this.state.hostPlayerId)],
      edenPickQueue: [],
      edenPickOptions: [],
      sadVotes: {},
    };
  }
}
