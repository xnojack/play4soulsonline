// ============================================================
// Card Types (from SQLite / scraper)
// ============================================================

export type CardType =
  | 'Character'
  | 'Treasure'
  | 'Monster'
  | 'Loot'
  | 'Room'
  | 'BonusSoul'
  | 'Challenge'
  | 'Outside'
  | 'Unknown';

export interface Card {
  id: string;
  name: string;
  imageUrl: string; // URL served by the server e.g. /cards/b2-isaac.png
  localImagePath: string;
  cardType: CardType;
  subType: string; // Boss, Active, Passive, Trinket, Curse, etc.
  set: string;
  hp: number | null;
  atk: number | null;
  evasion: number | null;
  soulValue: number;
  rewardText: string;
  abilityText: string;
  threePlayerOnly: boolean;
  isEternal: boolean;
  origin: string;
  /** 'in_print' | 'not_in_print' | 'never_printed' | 'planned' | 'unknown' */
  printStatus: string;
  /**
   * For Character cards: the card ID of their eternal starting item scraped from
   * foursouls.com's #CharitemBox. null = character picks from treasure deck (Eden).
   * undefined / null for non-character cards.
   */
  startingItemId: string | null;
  /** URL of the back-face image (for dual-sided / flip cards). null = not a flip card. */
  backImageUrl: string | null;
  /** Name of the back face (e.g. "amginE ehT"). null = not a flip card. */
  flipSideName: string | null;
  /** Number of physical copies of this card in the game box (e.g. 6 for A Penny!). */
  quantity: number;
  /** Coin value in cents for ratio-based deck building (1, 2, 3, 4, 5, 10). 0 for non-coin cards. */
  coinValue: number;
}

// ============================================================
// In-play card instances
// ============================================================

export interface CardInPlay {
  instanceId: string; // unique per instance in a game
  cardId: string; // references Card.id
  charged: boolean; // true = upright (charged), false = deactivated/spent
  damageCounters: number; // damage taken (for monsters & some items)
  hpCounters: number; // HP counter type (each = +1 max HP)
  atkCounters: number; // ATK counter type (each = +1 ATK)
  genericCounters: number;
  namedCounters: Record<string, number>; // named counter type → count
  flipped: boolean; // true = showing back face (flip cards only)
}

// ============================================================
// Slots
// ============================================================

// Monster slots use LIFO stacking: last element = top (in-play), others = covered-in-slot
export interface MonsterSlot {
  slotIndex: number;
  stack: CardInPlay[]; // [0] = deepest covered, [last] = in-play top
}

// Shop slots hold a single treasure card (no stacking)
export interface ShopSlot {
  slotIndex: number;
  card: CardInPlay | null;
  cost?: number; // override default cost of 10; undefined = default
}

// ============================================================
// Bonus souls
// ============================================================

export interface BonusSoulState {
  cardId: string;
  instance: CardInPlay; // real tracked instance — used for counter support
  isGained: boolean;
  isDestroyed: boolean;
  gainedByPlayerId: string | null;
}

// ============================================================
// Stack
// ============================================================

export type StackItemType =
  | 'loot'
  | 'activated_ability'
  | 'triggered_ability'
  | 'dice_roll'
  | 'attack_roll'
  | 'attack_declaration'
  | 'death';

export interface StackItem {
  id: string;
  type: StackItemType;
  sourceCardInstanceId: string;
  sourcePlayerId: string;
  description: string; // human-readable for log/display
  targets: string[]; // instanceIds of cards/players chosen at stack time
  data: Record<string, unknown>; // type-specific payload
  isCanceled: boolean;
}

// ============================================================
// Priority
// ============================================================

// priorityQueue[0] = player who currently has priority
export type PriorityQueue = string[]; // ordered player IDs

// ============================================================
// Turn State
// ============================================================

export type TurnPhase = 'start' | 'action' | 'end';

export interface AttackState {
  attackerId: string;
  targetType: 'monster_slot' | 'item' | 'player';
  targetSlotIndex?: number; // for monster_slot
  targetInstanceId?: string; // for item or familiar
  targetPlayerId?: string; // for player attack
  phase: 'declared' | 'rolling' | 'resolving' | 'done';
  rollResult: number | null;
  // for Team Up: additional rollers
  teamUpPlayerIds: string[];
  teamUpRolls: Record<string, number>;
}

export interface TurnState {
  activePlayerId: string;
  phase: TurnPhase;
  lootDrawn: boolean;           // true once the active player has drawn their starting loot
  lootPlaysRemaining: number;   // starts at 1
  purchasesMade: number;        // max 1 normally
  attacksDeclared: number;
  attacksRequired: number;      // 1 normally; ambush etc. can increase
  currentAttack: AttackState | null;
  // Track which players have passed priority since last stack push
  passedPriority: Set<string>;
  // Priority timeout tracking (server-side only)
  priorityTimeoutPlayerId?: string;  // which player's timeout is active
  priorityTimeoutDeadline?: number;  // Unix ms when their time expires
  // Death penalty item choice is pending for this player
  deathPenaltyPending?: string | null;
}

// ============================================================
// Player
// ============================================================

export interface Player {
  id: string;
  name: string;
  seatIndex: number;
  isSpectator: boolean;
  connected: boolean;

  /** Secret token issued at join time; required to reclaim a disconnected slot */
  reconnectToken: string;

  characterInstanceId: string; // references CardInPlay in items-like storage
  characterCardId: string;    // the actual card ID (for direct lookup)
  startingItemInstanceId: string;

  coins: number;

  // Stats (base from character card; modifiers tracked here)
  baseHp: number;
  baseAtk: number;
  currentDamage: number; // damage taken; effective HP = baseHp + hpCounters - currentDamage
  hpCounters: number; // HP counters on character
  atkCounters: number; // ATK counters on character

  handCardIds: string[]; // loot card IDs in hand (hidden)
  handSharedWith: string[]; // player IDs who can see this hand

  items: CardInPlay[]; // ordered; player arranges as they please
  souls: CardInPlay[];
  curses: CardInPlay[];
  kills: CardInPlay[]; // monsters killed by this player (trophies)

  isAlive: boolean;
  deathCount: number;
  deadThisTurn: boolean; // once-per-turn death guard
  solitairePartnerId: string | null; // other character's player ID in solitaire mode
  isReady: boolean; // player readiness in lobby
  selectedCharacterId: string | null; // player's lobby character pick (null = random)
}

// ============================================================
// Log
// ============================================================

export type LogEntryType =
  | 'attack'
  | 'death'
  | 'card_play'
  | 'purchase'
  | 'dice'
  | 'soul_gain'
  | 'stack'
  | 'phase'
  | 'info'
  | 'chat';

export interface LogEntry {
  id: string;
  timestamp: number;
  type: LogEntryType;
  message: string;
  playerId: string | null;
}

// ============================================================
// Full Game State
// ============================================================

export type GamePhase = 'lobby' | 'eden_pick' | 'sad_vote' | 'active' | 'ended';

export type GameMode = 'competitive' | 'solitaire' | 'coop';

export interface GameState {
  roomId: string;
  hostPlayerId: string;
  phase: GamePhase;
  activeSets: string[]; // which card sets are enabled
  winnerId: string | null;
  gameMode: GameMode;
  d8Timer: number | null; // null = competitive; countdown for solitaire/coop
  d8RoundStartPlayerId: string | null; // player whose turn starts a new D8 round

  turn: TurnState;
  priorityQueue: string[]; // player IDs; [0] = has priority
  stack: StackItem[];

  coinPool: number;
  sharedCoinPool: boolean; // true for Greed's Gamble — all coins go to shared pool

  // Decks — arrays of card IDs (shuffled). Top of deck = last element.
  treasureDeck: string[];
  treasureDiscard: string[];
  lootDeck: string[];
  lootDiscard: string[];
  monsterDeck: string[];
  monsterDiscard: string[];
  roomDeck: string[];
  roomDiscard: string[];
  eternalDeck: string[];    // eternal items not assigned at game start
  eternalDiscard: string[];

  // Slots
  shopSlots: ShopSlot[]; // 2 slots
  monsterSlots: MonsterSlot[]; // 2+ slots (expands with Indomitable)
  roomSlots: CardInPlay[]; // 0+ room/item cards in play as rooms
  bonusSouls: BonusSoulState[];
  challengeSlot: CardInPlay | null; // 1 challenge reference card, fixed for the game
  finalBossSlot: CardInPlay | null; // final boss card (Outside or Challenge mode)
  minionSlots: CardInPlay[]; // temporary minion slots for challenges
  outsideCards: CardInPlay[]; // outside cards (e.g. The Harbingers), face-up, never move
  challengeName: string | null; // name of active challenge (e.g. "Resurrection Day")
  challengeDifficulty: 'normal' | 'hard' | 'ultra' | null; // difficulty of active challenge

  // All CardInPlay instances for characters + starting items
  // (kept separate so they persist through player.items changes)
  characterCards: Record<string, CardInPlay>; // instanceId → CardInPlay
  startingItemCards: Record<string, CardInPlay>; // instanceId → CardInPlay

  players: Player[];
  log: LogEntry[];
  lobbyChat: LogEntry[];

  // Eden starting-item pick phase
  edenPickQueue: string[]; // player IDs still waiting to pick (in order); empty when not in eden_pick phase
  edenPickOptions: string[]; // the 3 treasure card IDs being offered to edenPickQueue[0]

  // Saddest character vote phase (before active)
  sadVotes: Record<string, string>; // voterId → targetPlayerId; fully public

  // Priority timeout (ms); 0 or negative = disabled
  priorityTimeoutMs: number;

  // When true, privileged override actions (move_to_hand, place_in_shop, move_to_items) are allowed.
  // Host can disable in lobby to enforce coded game rules only.
  allowPrivilegedActions: boolean;
}

// ============================================================
// Client-visible state (filtered per player)
// ============================================================

export interface ClientPlayer extends Omit<Player, 'handCardIds' | 'reconnectToken'> {
  handCardIds: string[]; // empty array if not this player or shared hand
  handCount: number; // always visible (public info)
  effectiveHp: number; // derived: baseHp + hpCounters - currentDamage
  effectiveAtk: number; // derived: baseAtk + atkCounters + item ATK bonuses
  solitairePartnerId: string | null;
}

export interface ClientGameState extends Omit<GameState, 'players' | 'turn'> {
  players: ClientPlayer[];
  turn: Omit<TurnState, 'passedPriority'> & { passedPriorityIds: string[] };
  myPlayerId: string;
  gameMode: GameMode;
  d8Timer: number | null;
  // Deck counts only (no contents)
  treasureDeckCount: number;
  lootDeckCount: number;
  monsterDeckCount: number;
  roomDeckCount: number;
  eternalDeckCount: number;
  challengeSlot: CardInPlay | null;
  finalBossSlot: CardInPlay | null;
  minionSlots: CardInPlay[];
  outsideCards: CardInPlay[];
  challengeName: string | null;
  challengeDifficulty: 'normal' | 'hard' | 'ultra' | null;
  // Eden pick: options only visible to the current picker
  edenPickOptions: string[]; // empty for everyone except edenPickQueue[0]
  // Seconds remaining on the current player's priority timeout (0 = no timeout or expired)
  priorityTimeoutRemaining: number;
  // Whether privileged override actions are enabled for this game
  allowPrivilegedActions: boolean;
}

// ============================================================
// Socket event payloads
// ============================================================

export interface JoinPayload {
  roomId: string;
  name: string;
  asSpectator?: boolean;
  reconnectToken?: string;
}

export type DeckMode = 'balanced' | 'all' | 'custom';

export interface StartGamePayload {
  deckMode?: DeckMode; // default: 'sets'
  activeSets: string[];
  includeBonusSouls: boolean;
  bonusSoulCount?: number; // how many bonus souls to lay out (default 3)
  includeRooms: boolean;
  excludeNeverPrinted?: boolean; // if true, filter out never_printed cards from all decks
  priorityTimeoutMs?: number; // ms per player priority window; 0 = disabled (default 30000)
  allowPrivilegedActions?: boolean; // default true; host can disable to enforce coded rules only
  gameMode?: GameMode; // 'competitive' | 'solitaire' | 'coop'
  customRatios?: {
    loot: Record<string, number>;
    monster: Record<string, number>;
    treasure: Record<string, number>;
  };
  allowDuplicates?: boolean; // when true, duplicate cards to meet custom ratio targets
  includeChallenges?: boolean; // when true, draw 1 challenge card at game start
  includeOutside?: boolean; // when true, place outside cards face-up
  challengeName?: string | null; // name of challenge to use (e.g. "Resurrection Day")
  challengeDifficulty?: 'normal' | 'hard' | 'ultra' | null; // difficulty of challenge
}

export interface PlayLootPayload {
  cardId: string; // card ID from hand
  targets: string[]; // instanceIds chosen at stack time
}

export interface ActivateAbilityPayload {
  instanceId: string;
  abilityTag: string; // 'tap' | 'paid'
  targets: string[];
}

export interface DeclareAttackPayload {
  targetType: 'monster_slot' | 'item' | 'player';
  targetSlotIndex?: number;
  targetInstanceId?: string;
  targetPlayerId?: string;
}

export interface RollDicePayload {
  context: 'attack' | 'ability' | 'manual';
  rollId: string;
}

export interface ApplyDamagePayload {
  targetInstanceId?: string; // card instanceId (for monsters/items)
  targetPlayerId?: string; // player ID (for player damage)
  amount: number;
}

export interface HealPayload {
  targetInstanceId?: string;
  targetPlayerId?: string;
  amount: number;
}

export interface CoinChangePayload {
  playerId: string;
  amount: number;
}

export interface DrawLootPayload {
  playerId: string;
  count: number;
}

export interface DiscardLootPayload {
  cardId: string;
}

export interface ShareHandPayload {
  withPlayerId: string;
}

export interface RevokeHandSharePayload {
  withPlayerId: string;
}

export interface CounterPayload {
  instanceId: string;
  counterType: 'generic' | 'hp' | 'atk' | string; // named = any other string
  amount: number;
}

export interface GainSoulPayload {
  instanceId: string; // the card being gained as a soul
  playerId: string;
}

export interface DestroyCardPayload {
  instanceId: string;
}

export interface CoverMonsterPayload {
  slotIndex: number;
  cardId: string; // card being placed as a cover
  instanceId?: string; // if set, move existing CardInPlay from its zone (preserves counters)
  stackItemId?: string; // if set, also remove this item from the stack atomically
}

export interface MoveItemPayload {
  instanceId: string;
  toIndex: number;
}

export interface CancelStackItemPayload {
  stackItemId: string;
}

export interface PurchasePayload {
  slotIndex: number;
}

export interface SetActiveSetsPayload {
  sets: string[];
}

export interface GainTreasurePayload {
  playerId: string;
  count: number;
}

export interface ReturnToDeckPayload {
  cardId: string;
  deckType: 'loot' | 'treasure' | 'monster' | 'room';
  position: 'top' | 'bottom' | 'random';
  fromHand?: boolean;
  fromDiscard?: boolean;
  fromInstanceId?: string;
  stackItemId?: string;
  offset?: number;
}

export interface ResolveEventPayload {
  slotIndex: number;
}

export interface AddSlotPayload {
  slotType: 'monster' | 'shop' | 'room';
  cardId?: string; // monster only: place this specific card instead of drawing from deck top
  instanceId?: string; // paired with cardId to identify the exact CardInPlay instance
}

export interface PlaceInRoomPayload {
  instanceId?: string; // CardInPlay instanceId (items, shop, monster, room zones)
  cardId?: string;     // cardId for hand cards (no instanceId yet)
  deckType?: 'loot' | 'treasure' | 'monster' | 'room'; // if set, pop from that discard pile
  stackItemId?: string; // if set, also remove this item from the stack atomically
}

export interface ReplaceRoomSlotPayload {
  newInstanceId?: string; // instanceId of card being moved in (or newCardId for hand)
  newCardId?: string;     // cardId when source is hand or discard
  deckType?: 'loot' | 'treasure' | 'monster' | 'room'; // if set, pop newCardId from that discard
  replaceInstanceId: string; // room slot instanceId to discard and replace
}

export interface ReturnRoomCardPayload {
  instanceId: string;   // room slot instanceId to return
  toPlayerId: string;   // player who receives the card back into their items
}

export interface AttackMonsterDeckPayload {
  slotIndex: number; // which slot the flipped card lands in
}

export interface TradeCardPayload {
  instanceId: string;   // item instanceId  OR  use cardId for hand cards
  cardId?: string;      // hand card id (if trading from hand)
  toPlayerId: string;   // recipient
  fromHand?: boolean;   // true = loot hand card, false = item
}

export interface EdenPickPayload {
  cardId: string; // the treasure card ID chosen by the Eden player
}

export interface SadVotePayload {
  targetPlayerId: string; // the player ID being voted as the saddest character
}

export interface FlipCardPayload {
  instanceId: string; // the CardInPlay instanceId to flip
}

export interface MoveToHandPayload {
  cardId: string;
  instanceId?: string;   // if set, move existing CardInPlay (preserves nothing — hand holds cardIds only)
  targetPlayerId: string;
  deckType?: 'loot' | 'treasure' | 'monster' | 'room';  // if set, remove from that discard pile
  stackItemId?: string;  // if set, also remove this item from the stack atomically
}

export interface PlaceInShopPayload {
  cardId: string;
  instanceId?: string;   // if set, move existing CardInPlay (counters preserved)
  slotIndex: number;
  deckType?: 'loot' | 'treasure' | 'monster' | 'room';  // if set, remove from that discard pile
  stackItemId?: string;  // if set, also remove this item from the stack atomically
}

export interface MoveToItemsPayload {
  cardId: string;
  instanceId?: string;   // if set, move existing CardInPlay (counters preserved)
  targetPlayerId: string;
  deckType?: 'loot' | 'treasure' | 'monster' | 'room';  // if set, remove from that discard pile
  stackItemId?: string;  // if set, also remove this item from the stack atomically
}
