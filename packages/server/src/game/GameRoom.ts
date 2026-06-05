import { v4 as uuidv4 } from 'uuid';
import {
  ClientGameState,
  ClientPlayer,
  CardInPlay,
  DeckMode,
  GameMode,
  GameState,
  Player,
  StartGamePayload,
  TurnState,
  BonusSoulState,
  Card,
  LogEntryType,
  LogEntry,
  ShopSlot,
  MonsterSlot,
} from './types';
import { buildBalancedDeck, buildAllCardsDeck, buildCustomDeck, LOOT_RATIOS, MONSTER_RATIOS, TREASURE_RATIOS } from './deckbuilder';
import { shuffle, drawFromDeck, createCardInPlay } from './decks';
import { resetPriority } from './stack';
import { rechargePlayerItems } from './actions/turn';
import {
  getCardsByTypeAndSets,
  getCardsByType,
  getCardById,
  getChallengeCards,
  getChallengeRelatedCards,
  getChallengeBossCard,
  getChallengeCardByNameAndDifficulty,
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
      gameMode: 'competitive',
      d8Timer: null,
      d8RoundStartPlayerId: null,
      turn: emptyTurn,
      priorityQueue: [],
      stack: [],
      coinPool: DEFAULT_COIN_POOL,
      sharedCoinPool: false,
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
      challengeSlot: null,
      finalBossSlot: null,
      minionSlots: [],
      outsideCards: [],
      challengeName: null,
      challengeDifficulty: null,
      characterCards: {},
      startingItemCards: {},
      players: [],
      log: [],
      lobbyChat: [],
      edenPickQueue: [],
      edenPickOptions: [],
      sadVotes: {},
      priorityTimeoutMs: 30000,
      allowPrivilegedActions: true,
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
      // Priority timeout: seconds remaining for this viewer (0 if not their turn or disabled)
      priorityTimeoutRemaining:
        s.turn.priorityTimeoutDeadline != null && s.turn.priorityTimeoutPlayerId === viewerId
          ? Math.max(0, Math.ceil((s.turn.priorityTimeoutDeadline - Date.now()) / 1000))
          : 0,
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
      deadThisTurn: false,
      solitairePartnerId: null,
      isReady: false,
      selectedCharacterId: null,
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
    deckMode?: DeckMode;
    activeSets: string[];
    includeBonusSouls: boolean;
    bonusSoulCount?: number;
    includeRooms: boolean;
    excludeNeverPrinted?: boolean;
    priorityTimeoutMs?: number;
    allowPrivilegedActions?: boolean;
    gameMode?: GameMode;
    customRatios?: {
      loot: Record<string, number>;
      monster: Record<string, number>;
      treasure: Record<string, number>;
    };
    allowDuplicates?: boolean;
    includeChallenges?: boolean;
    includeOutside?: boolean;
    challengeName?: string | null;
    challengeDifficulty?: 'normal' | 'hard' | 'ultra' | null;
  }): string | null {
    if (this.state.phase !== 'lobby') return 'Game already started';
    const gameMode = options.gameMode ?? 'competitive';
    let nonSpectators = this.state.players.filter((p) => !p.isSpectator);

    // Solitaire: create ghost player for second character
    if (gameMode === 'solitaire' && nonSpectators.length === 1) {
      const human = nonSpectators[0];
      const ghostId = uuidv4();
      const ghost: Player = {
        ...human,
        id: ghostId,
        seatIndex: 1,
        reconnectToken: '',
        handCardIds: [],
        handSharedWith: [],
        items: [],
        souls: [],
        curses: [],
        kills: [],
        coins: 0,
        characterInstanceId: '',
        characterCardId: '',
        startingItemInstanceId: '',
        currentDamage: 0,
        hpCounters: 0,
        atkCounters: 0,
        solitairePartnerId: human.id,
        selectedCharacterId: null,
      };
      this.state = {
        ...this.state,
        players: this.state.players.map((p) =>
          p.id === human.id ? { ...p, solitairePartnerId: ghostId } : p
        ).concat(ghost),
      };
      nonSpectators = this.state.players.filter((p) => !p.isSpectator);
    }

    // Validate player count for mode
    if (gameMode === 'solitaire' && nonSpectators.length !== 2)
      return 'Solitaire mode requires exactly 1 player';
    if (gameMode === 'coop' && nonSpectators.length !== 2)
      return 'Co-op mode requires exactly 2 players';
    if (nonSpectators.length < 1) return 'Need at least 1 player';

    this.state = { ...this.state, activeSets: options.activeSets };

    // Build decks from DB
    const deckMode = options.deckMode ?? 'balanced';
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
    const bonusSoulCards = (options.includeBonusSouls && gameMode === 'competitive')
      ? sets
        ? getCardsByTypeAndSets('BonusSoul', sets)
        : getCardsByType('BonusSoul')
      : [];

    // Filter: 3+ player only cards if < 3 players (disabled for balanced mode)
    const playerCount = nonSpectators.length;
    const filter3p = deckMode !== 'balanced' && playerCount < 3;
    const filterCards = (cards: Card[]) => {
      let filtered = filter3p ? cards.filter((c) => !c.threePlayerOnly) : cards;
      if (options.excludeNeverPrinted) {
        filtered = filtered.filter((c) => c.printStatus !== 'never_printed');
      }
      return filtered;
    };

    // Exclude filter for balanced/all modes (never_printed only, no 3+ filter)
    const excludeFilter = (c: Card) => {
      if (options.excludeNeverPrinted && c.printStatus === 'never_printed') return true;
      return false;
    };

   // Split eternal cards out of treasure and loot — they form their own deck.
    // Exception: Keeper's Sack stays in treasure; Tick stays in loot.
    const filteredTreasure = treasureCards.filter((c) => !excludeFilter(c));
    const eternalTreasure = filteredTreasure.filter(
      (c) => c.isEternal && !ETERNAL_IN_TREASURE_DECK.has(c.id)
    );
    const nonEternalTreasure = filteredTreasure.filter(
      (c) => !c.isEternal || ETERNAL_IN_TREASURE_DECK.has(c.id)
    );

    const filteredLoot = lootCards.filter((c) => !excludeFilter(c));
    const eternalLoot = filteredLoot.filter(
      (c) => c.isEternal && !ETERNAL_IN_LOOT_DECK.has(c.id)
    );
    const nonEternalLoot = filteredLoot.filter(
      (c) => !c.isEternal || ETERNAL_IN_LOOT_DECK.has(c.id)
    );

    // Assemble decks based on deck mode
    let eternalDeck: string[];
    let treasureDeck: string[];
    let lootDeck: string[];
    let monsterDeck: string[];
    let roomDeck: string[];

    if (deckMode === 'balanced') {
      // Balanced mode: use official ratios
      treasureDeck = buildBalancedDeck(nonEternalTreasure, TREASURE_RATIOS, excludeFilter);
      lootDeck = buildBalancedDeck(nonEternalLoot, LOOT_RATIOS, excludeFilter);
      monsterDeck = buildBalancedDeck(monsterCards, MONSTER_RATIOS, excludeFilter);
      roomDeck = options.includeRooms ? buildAllCardsDeck(roomCards, excludeFilter) : [];
      eternalDeck = shuffle([...eternalTreasure, ...eternalLoot].flatMap((c) => Array(c.quantity).fill(c.id)));
    } else if (deckMode === 'all') {
      // All cards mode: every available card
      treasureDeck = buildAllCardsDeck(nonEternalTreasure, excludeFilter);
      lootDeck = buildAllCardsDeck(nonEternalLoot, excludeFilter);
      monsterDeck = buildAllCardsDeck(monsterCards, excludeFilter);
      roomDeck = options.includeRooms ? buildAllCardsDeck(roomCards, excludeFilter) : [];
      eternalDeck = shuffle([...eternalTreasure, ...eternalLoot].flatMap((c) => Array(c.quantity).fill(c.id)));
    } else if (deckMode === 'custom') {
      // Custom mode: user-defined ratios
      const allowDuplicates = options.allowDuplicates ?? false;
      const ratios = options.customRatios;
      if (!ratios) {
        // Fallback to balanced if no custom ratios provided
        treasureDeck = buildBalancedDeck(nonEternalTreasure, TREASURE_RATIOS, excludeFilter);
        lootDeck = buildBalancedDeck(nonEternalLoot, LOOT_RATIOS, excludeFilter);
        monsterDeck = buildBalancedDeck(monsterCards, MONSTER_RATIOS, excludeFilter);
      } else {
        treasureDeck = buildCustomDeck(nonEternalTreasure, ratios.treasure, excludeFilter, allowDuplicates);
        lootDeck = buildCustomDeck(nonEternalLoot, ratios.loot, excludeFilter, allowDuplicates);
        monsterDeck = buildCustomDeck(monsterCards, ratios.monster, excludeFilter, allowDuplicates);
      }
      roomDeck = options.includeRooms ? buildAllCardsDeck(roomCards, excludeFilter) : [];
      eternalDeck = shuffle([...eternalTreasure, ...eternalLoot].flatMap((c) => Array(c.quantity).fill(c.id)));
    } else {
      // Default: balanced mode
      treasureDeck = buildBalancedDeck(nonEternalTreasure, TREASURE_RATIOS, excludeFilter);
      lootDeck = buildBalancedDeck(nonEternalLoot, LOOT_RATIOS, excludeFilter);
      monsterDeck = buildBalancedDeck(monsterCards, MONSTER_RATIOS, excludeFilter);
      roomDeck = options.includeRooms ? buildAllCardsDeck(roomCards, excludeFilter) : [];
      eternalDeck = shuffle([...eternalTreasure, ...eternalLoot].flatMap((c) => Array(c.quantity).fill(c.id)));
    }

    // Assign characters — respect player selections, handle conflicts by seat order
    const sortedPlayers = [...nonSpectators].sort((a, b) => a.seatIndex - b.seatIndex);
    const usedCharIds = new Set<string>();
    const assignedChars: (Card | null)[] = new Array(sortedPlayers.length).fill(null);

    // First pass: honor selections in seat order; later players with the same pick are bumped
    for (let i = 0; i < sortedPlayers.length; i++) {
      const player = sortedPlayers[i];
      if (player.selectedCharacterId) {
        const char = characterCards.find((c) => c.id === player.selectedCharacterId);
        if (char && !usedCharIds.has(char.id)) {
          assignedChars[i] = char;
          usedCharIds.add(char.id);
        }
        // If duplicate or invalid, leave null for random assignment below
      }
    }

    // Second pass: fill remaining slots randomly from available characters
    const availableChars = shuffle(characterCards.filter((c) => !usedCharIds.has(c.id)));
    let availIdx = 0;
    for (let i = 0; i < sortedPlayers.length; i++) {
      if (assignedChars[i] === null) {
        if (availIdx < availableChars.length) {
          assignedChars[i] = availableChars[availIdx++];
        } else {
          // Cycle back if we've exhausted unique characters
          assignedChars[i] = shuffle(characterCards)[availIdx % characterCards.length];
        }
      }
    }

    // Solitaire: ensure exactly 2 unique characters (no duplicates)
    if (gameMode === 'solitaire' && assignedChars.length === 2 && assignedChars[0]?.id === assignedChars[1]?.id) {
      const other = characterCards.find((c) => c.id !== assignedChars[0]?.id);
      if (other) assignedChars[1] = other;
    }
    const charMap: Record<string, CardInPlay> = {};
    const startingItemMap: Record<string, CardInPlay> = {};

    let currentLootDeck = lootDeck;
    let currentLootDiscard: string[] = [];
    let currentTreasureDeck = treasureDeck;

    // Collect all starting item IDs that will be assigned to players so we can
    // remove them from the treasure deck (they shouldn't be buyable in the shop)
    const assignedStartingItemIds = new Set<string>();

    // Pre-compute starting item IDs for all players before dealing.
    // getStartingItemId returns:
    //   string    — known item ID (assign it)
    //   null      — explicitly Eden (must pick from treasure deck)
    //   undefined — character not in map (treat as no starting item, not Eden)
    const resolvedStartingItems: (string | null | undefined)[] = assignedChars.slice(0, sortedPlayers.length).map((char) => {
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
    const currentEternalDeck = eternalDeck.filter((id) => !assignedStartingItemIds.has(id));

    // Track which players are Eden (need to pick their starting item)
    const edenPlayerIds: string[] = [];

    // Build lookup maps from player id → assigned char and starting item
    const charByPlayerId = new Map<string, Card | null>();
    const resolvedItemByPlayerId = new Map<string, string | null | undefined>();
    for (let i = 0; i < sortedPlayers.length; i++) {
      charByPlayerId.set(sortedPlayers[i].id, assignedChars[i]);
      resolvedItemByPlayerId.set(sortedPlayers[i].id, resolvedStartingItems[i]);
    }

    const players = nonSpectators.map((p) => {
      const char = charByPlayerId.get(p.id);
      const charInstance = createCardInPlay(char?.id ?? 'unknown', false); // all start tapped
      charMap[charInstance.instanceId] = charInstance;

      // resolvedItemId:
      //   string    → known item, assign it
      //   null      → Eden, must pick from treasure deck
      //   undefined → unknown character, no starting item (not Eden)
      const resolvedItemId = resolvedItemByPlayerId.get(p.id);
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
        coins: options.challengeName === "Greed's Gamble" ? 0 : DEFAULT_STARTING_COINS,
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

    // Fill monster slots
    let currentMonsterDeck = monsterDeck;
    const monsterSlots: MonsterSlot[] = [];
    for (let i = 0; i < DEFAULT_MONSTER_SLOTS; i++) {
      const { drawn, newDeck } = drawFromDeck(currentMonsterDeck, [], 1);
      currentMonsterDeck = newDeck;
      monsterSlots.push({
        slotIndex: i,
        stack: drawn[0] ? [createCardInPlay(drawn[0])] : [],
      });
    }

    // Room slots — start with one card if rooms enabled
    const roomSlots: CardInPlay[] = [];
    if (options.includeRooms && roomDeck.length > 0) {
      const { drawn, newDeck: newRoomDeck } = drawFromDeck(roomDeck, [], 1);
      if (drawn[0]) {
        roomSlots.push(createCardInPlay(drawn[0]));
        roomDeck.splice(0, roomDeck.length, ...newRoomDeck);
      }
    }

    // Challenge card — draw 1 from all challenge variants, add related monsters to deck
    let challengeSlot: CardInPlay | null = null;
    let finalBossSlot: CardInPlay | null = null;
    const minionSlots: CardInPlay[] = [];
    let challengeName: string | null = null;
    let challengeDifficulty: 'normal' | 'hard' | 'ultra' | null = null;

    if (options.includeChallenges || (options.challengeName && options.challengeName.length > 0)) {
      // Challenge mode: use specified challenge or random
      const allChallenges = getChallengeCards();
      const challengeDeck = shuffle(allChallenges.flatMap((c) => Array(c.quantity).fill(c.id)));
      if (challengeDeck.length > 0) {
        let drawnChallengeId: string;
        let drawnBossId: string | null = null;

        if (options.challengeName && options.challengeDifficulty) {
          // Use specific challenge + difficulty
          const challengeCard = getChallengeCardByNameAndDifficulty(options.challengeName, options.challengeDifficulty);
          const bossCard = getChallengeBossCard(options.challengeName, options.challengeDifficulty);
          drawnChallengeId = challengeCard?.id ?? challengeDeck[Math.floor(Math.random() * challengeDeck.length)];
          drawnBossId = bossCard?.id ?? null;
          challengeName = options.challengeName;
          challengeDifficulty = options.challengeDifficulty;
        } else {
          // Random challenge
          drawnChallengeId = challengeDeck[Math.floor(Math.random() * challengeDeck.length)];
          const card = allChallenges.find((c) => c.id === drawnChallengeId);
          if (card) {
            const baseName = card.name.replace(/[\u2019\u2018\u201B]/g, "'").replace(/\s*\(.*\)$/, '').trim() || card.name;
            // Detect difficulty from the drawn card's ID
            let diff: 'normal' | 'hard' | 'ultra' = 'normal';
            if (card.id.includes('-hard') || card.id.includes('_hard')) diff = 'hard';
            else if (card.id.includes('-ultra') || card.id.includes('_ultra')) diff = 'ultra';
            const boss = getChallengeBossCard(baseName, diff);
            drawnBossId = boss?.id ?? null;
            challengeName = baseName;
            challengeDifficulty = diff;
          }
        }

        // Challenge slot = challenge reference card (e.g. "Greed's Gamble (Hard)")
        challengeSlot = createCardInPlay(drawnChallengeId);

        // Final boss slot = boss monster card (e.g. "Avaricious Greed (Hard)")
        if (drawnBossId) {
          finalBossSlot = createCardInPlay(drawnBossId);
        }

        // Use challenge name to look up related cards for the monster deck
        if (challengeName) {
          const relatedCards = getChallengeRelatedCards(challengeName);
          if (relatedCards.length > 0) {
            const relatedIds = relatedCards.flatMap((c) => Array(c.quantity).fill(c.id));
            monsterDeck = shuffle([...monsterDeck, ...relatedIds]);
          }
        }
      }
    }

    // Outside cards — place Harbingers in final boss slot (Beast side up)
    const outsideCards: CardInPlay[] = [];
    if (options.includeOutside) {
      const outsideCardList = getCardsByType('Outside');
      for (const c of outsideCardList) {
        const inst = createCardInPlay(c.id);
        inst.flipped = true; // Start with Beast side up
        outsideCards.push(inst);
        finalBossSlot = inst; // Also place in final boss slot
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
      gameMode,
      d8Timer: (gameMode === 'solitaire' || gameMode === 'coop') ? 8 : null,
      d8RoundStartPlayerId: null,
      priorityTimeoutMs: typeof options.priorityTimeoutMs === 'number' ? options.priorityTimeoutMs : 30000,
      allowPrivilegedActions: options.allowPrivilegedActions !== false,
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
        priorityTimeoutPlayerId: undefined,
        priorityTimeoutDeadline: undefined,
      },
      stack: [],
      coinPool: options.challengeName === "Greed's Gamble"
        ? DEFAULT_COIN_POOL
        : DEFAULT_COIN_POOL - players.length * DEFAULT_STARTING_COINS,
      sharedCoinPool: options.challengeName === "Greed's Gamble",
      treasureDeck: currentTreasureDeck,
      treasureDiscard: currentTreasureDiscard,
      lootDeck: currentLootDeck,
      lootDiscard: currentLootDiscard,
      monsterDeck: currentMonsterDeck,
      monsterDiscard: [],
      roomDeck,
      roomDiscard: [],
      eternalDeck: currentEternalDeck,
      eternalDiscard: [],
      shopSlots,
      monsterSlots,
      roomSlots,
      bonusSouls,
      challengeSlot,
      finalBossSlot,
      minionSlots,
      outsideCards,
      challengeName,
      challengeDifficulty,
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

  /** Transition to sad_vote phase, or skip directly to active if only 1 non-spectator or co-op mode */
  transitionToSadVote(state: GameState): GameState {
    const nonSpectators = state.players.filter((p) => !p.isSpectator);
    if (nonSpectators.length <= 1 || state.gameMode === 'coop' || state.gameMode === 'solitaire') {
      // Solo or co-op — skip the vote
      const first = nonSpectators[0] ?? state.players[0];
      let s = resetPriority({
        ...state,
        phase: 'active',
        sadVotes: {},
        d8RoundStartPlayerId: (state.gameMode === 'solitaire' || state.gameMode === 'coop') && first ? first.id : null,
        turn: { ...state.turn, activePlayerId: first?.id ?? '' },
      });
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
      d8RoundStartPlayerId: (state.gameMode === 'solitaire' || state.gameMode === 'coop') ? winnerId : null,
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
    const nonSpectators = this.state.players.filter((p) => !p.isSpectator);

    // Co-op/solitaire: combined soul pool — any player reaching threshold wins for the team
    if (this.state.gameMode === 'coop' || this.state.gameMode === 'solitaire') {
      let combinedSouls = 0;
      for (const player of nonSpectators) {
        combinedSouls += player.souls.reduce((sum, soul) => {
          const card = getCardById(soul.cardId);
          return sum + (card?.soulValue ?? 1);
        }, 0);
      }
      if (combinedSouls >= WINNING_SOUL_VALUE) {
        return nonSpectators[0]?.id ?? null;
      }
      return null;
    }

    // Competitive: individual player check
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

  checkD8Loss(): boolean {
    if (this.state.d8Timer !== null && this.state.d8Timer <= 0) {
      this.endGame(null);
      return true;
    }
    return false;
  }

  endGame(winnerId: string | null): void {
    if (this.state.phase === 'ended') return; // already ended
    const winner = winnerId ? this.state.players.find((p) => p.id === winnerId) : null;
    const logMsg = winnerId
      ? `${winner?.name ?? 'Unknown'} wins with ${WINNING_SOUL_VALUE}+ souls!`
      : 'Time\'s up! The D8 reached 0 — you lose.';
    this.state = {
      ...this.state,
      phase: 'ended',
      winnerId,
      log: [
        ...this.state.log,
        createLogEntry(
          'info',
          logMsg,
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
      deadThisTurn: false,
      solitairePartnerId: null,
      isReady: false,
      selectedCharacterId: null,
    }));

    this.state = {
      roomId: this.state.roomId,
      hostPlayerId: this.state.hostPlayerId,
      phase: 'lobby',
      activeSets: this.state.activeSets,
      winnerId: null,
      gameMode: 'competitive',
      d8Timer: null,
      d8RoundStartPlayerId: null,
      turn: emptyTurn,
      priorityQueue: [],
      stack: [],
      coinPool: DEFAULT_COIN_POOL,
      sharedCoinPool: false,
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
      challengeSlot: null,
      finalBossSlot: null,
      minionSlots: [],
      outsideCards: [],
      challengeName: null,
      challengeDifficulty: null,
      characterCards: {},
      startingItemCards: {},
      players: resetPlayers,
      log: [createLogEntry('info', 'Game reset to lobby by host', this.state.hostPlayerId)],
      lobbyChat: [],
      edenPickQueue: [],
      edenPickOptions: [],
      sadVotes: {},
      priorityTimeoutMs: 30000,
      allowPrivilegedActions: true,
    };
  }
}
