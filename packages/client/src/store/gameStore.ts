import { create } from 'zustand';

// ─── Types (mirrored from server — kept minimal for client) ──────────────────

export interface ClientCard {
  id: string;
  name: string;
  imageUrl: string;
  cardType: string;
  subType: string;
  set: string;
  hp: number | null;
  atk: number | null;
  evasion: number | null;
  soulValue: number;
  rewardText: string;
  abilityText: string;
  threePlayerOnly: boolean;
  isEternal: boolean;
  /** 'in_print' | 'not_in_print' | 'never_printed' | 'planned' | 'unknown' */
  printStatus: string;
}

export interface CardInPlay {
  instanceId: string;
  cardId: string;
  charged: boolean;
  damageCounters: number;
  hpCounters: number;
  atkCounters: number;
  genericCounters: number;
  namedCounters: Record<string, number>;
}

export interface MonsterSlot {
  slotIndex: number;
  stack: CardInPlay[];
}

export interface ShopSlot {
  slotIndex: number;
  card: CardInPlay | null;
  cost?: number; // override default cost of 10
}

export interface BonusSoulState {
  cardId: string;
  instance: CardInPlay; // real tracked instance for counter support
  isGained: boolean;
  isDestroyed: boolean;
  gainedByPlayerId: string | null;
}

export interface StackItem {
  id: string;
  type: string;
  sourceCardInstanceId: string;
  sourcePlayerId: string;
  description: string;
  targets: string[];
  data: Record<string, unknown>;
  isCanceled: boolean;
}

export interface ClientPlayer {
  id: string;
  name: string;
  seatIndex: number;
  isSpectator: boolean;
  connected: boolean;
  characterInstanceId: string;
  characterCardId: string;
  startingItemInstanceId: string;
  coins: number;
  baseHp: number;
  baseAtk: number;
  currentDamage: number;
  hpCounters: number;
  atkCounters: number;
  handCardIds: string[]; // populated only for self or shared
  handCount: number;
  handSharedWith: string[];
  items: CardInPlay[];
  souls: CardInPlay[];
  curses: CardInPlay[];
  kills: CardInPlay[]; // monsters killed (trophies)
  isAlive: boolean;
  deathCount: number;
  effectiveHp: number;
  effectiveAtk: number;
}

export interface TurnState {
  activePlayerId: string;
  phase: 'start' | 'action' | 'end';
  lootPlaysRemaining: number;
  purchasesMade: number;
  attacksDeclared: number;
  attacksRequired: number;
  currentAttack: {
    attackerId: string;
    targetType: string;
    targetSlotIndex?: number;
    targetInstanceId?: string;
    targetPlayerId?: string;
    phase: string;
    rollResult: number | null;
    teamUpPlayerIds: string[];
    teamUpRolls: Record<string, number>;
  } | null;
  passedPriorityIds: string[];
}

export interface LogEntry {
  id: string;
  timestamp: number;
  type: string;
  message: string;
  playerId: string | null;
}

export interface GameState {
  roomId: string;
  hostPlayerId: string;
  phase: 'lobby' | 'eden_pick' | 'sad_vote' | 'active' | 'ended';
  activeSets: string[];
  winnerId: string | null;
  myPlayerId: string;

  turn: TurnState;
  priorityQueue: string[];
  stack: StackItem[];

  coinPool: number;

  treasureDeckCount: number;
  treasureDiscard: string[];
  lootDeckCount: number;
  lootDiscard: string[];
  monsterDeckCount: number;
  monsterDiscard: string[];
  roomDeckCount: number;
  roomDiscard: string[];
  eternalDeckCount: number;
  eternalDiscard: string[];

  shopSlots: ShopSlot[];
  monsterSlots: MonsterSlot[];
  roomSlots: CardInPlay[];
  bonusSouls: BonusSoulState[];

  characterCards: Record<string, CardInPlay>;
  startingItemCards: Record<string, CardInPlay>;

  players: ClientPlayer[];
  log: LogEntry[];

  // Eden starting-item pick phase
  edenPickQueue: string[]; // player IDs still waiting to pick (in order)
  edenPickOptions: string[]; // the 3 treasure card IDs offered to edenPickQueue[0] (empty for others)

  // Saddest character vote phase (before active)
  sadVotes: Record<string, string>; // voterId → targetPlayerId; fully public
}

export interface DiceResult {
  playerId: string;
  value: number;
  rollId: string;
  context: string;
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface GameStore {
  // Connection state
  connected: boolean;
  connecting: boolean;
  error: string | null;

  // Room state (pre-game)
  roomId: string | null;
  playerName: string | null;
  reconnectToken: string | null;

  // Game state
  game: GameState | null;

  // UI state
  selectedCardInstanceId: string | null;
  hoveredCard: ClientCard | null;
  modalCard: ClientCard | null;
  isCardSearchOpen: boolean;
  lastDiceResult: DiceResult | null;
  newLogEntries: LogEntry[];
  gameOverInfo: { winnerId: string; winnerName: string } | null;
  availableSets: string[];
  deckContents: Record<string, string[]>; // deckType → ordered cardIds (top first)

  // Actions
  setConnected: (connected: boolean) => void;
  setConnecting: (connecting: boolean) => void;
  setError: (error: string | null) => void;
  setRoomId: (roomId: string | null) => void;
  setPlayerName: (name: string | null) => void;
  setReconnectToken: (token: string | null) => void;
  setGameState: (state: GameState) => void;
  appendLog: (entries: LogEntry[]) => void;
  setDiceResult: (result: DiceResult) => void;
  clearDiceResult: () => void;
  setSelectedCard: (instanceId: string | null) => void;
  setHoveredCard: (card: ClientCard | null) => void;
  setModalCard: (card: ClientCard | null) => void;
  setCardSearchOpen: (open: boolean) => void;
  setGameOver: (info: { winnerId: string; winnerName: string } | null) => void;
  setAvailableSets: (sets: string[]) => void;
  clearNewLogEntries: () => void;
  setDeckContents: (deckType: string, cardIds: string[]) => void;
  reset: () => void;
}

const initialState = {
  connected: false,
  connecting: false,
  error: null,
  roomId: null,
  playerName: null,
  reconnectToken: null,
  game: null,
  selectedCardInstanceId: null,
  hoveredCard: null,
  modalCard: null,
  isCardSearchOpen: false,
  lastDiceResult: null,
  newLogEntries: [],
  gameOverInfo: null,
  availableSets: [],
  deckContents: {} as Record<string, string[]>,
};

export const useGameStore = create<GameStore>((set) => ({
  ...initialState,

  setConnected: (connected) => set({ connected }),
  setConnecting: (connecting) => set({ connecting }),
  setError: (error) => set({ error }),
  setRoomId: (roomId) => set({ roomId }),
  setPlayerName: (playerName) => set({ playerName }),
  setReconnectToken: (reconnectToken) => set({ reconnectToken }),

  setGameState: (state) =>
    set((prev) => {
      // Merge new log entries
      const prevLogIds = new Set((prev.game?.log ?? []).map((e) => e.id));
      const newEntries = state.log.filter((e) => !prevLogIds.has(e.id));
      return {
        game: state,
        newLogEntries: [...prev.newLogEntries, ...newEntries],
      };
    }),

  appendLog: (entries) =>
    set((prev) => ({
      game: prev.game ? { ...prev.game, log: [...prev.game.log, ...entries] } : prev.game,
      newLogEntries: [...prev.newLogEntries, ...entries],
    })),

  setDiceResult: (result) => set({ lastDiceResult: result }),
  clearDiceResult: () => set({ lastDiceResult: null }),

  setSelectedCard: (instanceId) => set({ selectedCardInstanceId: instanceId }),
  setHoveredCard: (card) => set({ hoveredCard: card }),
  setModalCard: (card) => set({ modalCard: card }),
  setCardSearchOpen: (open) => set({ isCardSearchOpen: open }),
  setGameOver: (info) => set({ gameOverInfo: info }),
  setAvailableSets: (sets) => set({ availableSets: sets }),
  clearNewLogEntries: () => set({ newLogEntries: [] }),
  setDeckContents: (deckType, cardIds) =>
    set((prev) => ({ deckContents: { ...prev.deckContents, [deckType]: cardIds } })),

  reset: () => set(initialState),
}));
