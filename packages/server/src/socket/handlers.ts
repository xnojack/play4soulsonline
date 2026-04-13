import { Server, Socket } from 'socket.io';
import { gameStore } from '../game/GameStore';
import { generateRoomCode } from '../game/RoomCode';
import { v4 as uuidv4 } from 'uuid';
import { clampInt } from '../game/utils';
import {
  ROOM_TIMEOUT_LOBBY_MS,
  ROOM_TIMEOUT_ACTIVE_MS,
  ROOM_TIMEOUT_ENDED_MS,
  ROOM_TIMEOUT_CREATED_MS,
} from '../config';
import {
  JoinPayload,
  StartGamePayload,
  PlayLootPayload,
  ActivateAbilityPayload,
  DeclareAttackPayload,
  RollDicePayload,
  ApplyDamagePayload,
  HealPayload,
  CoinChangePayload,
  DrawLootPayload,
  DiscardLootPayload,
  ShareHandPayload,
  RevokeHandSharePayload,
  CounterPayload,
  GainSoulPayload,
  DestroyCardPayload,
  CoverMonsterPayload,
  MoveItemPayload,
  CancelStackItemPayload,
  PurchasePayload,
  SetActiveSetsPayload,
  GainTreasurePayload,
  ReturnToDeckPayload,
  ResolveEventPayload,
  AddSlotPayload,
  TradeCardPayload,
  PlaceInRoomPayload,
  ReturnRoomCardPayload,
  EdenPickPayload,
  SadVotePayload,
} from '../game/types';
import {
  passPriority,
  allPassedPriority,
  resolveTopOfStack,
  cancelStackItem,
  pushStack,
  resetPriority,
} from '../game/stack';
import { endTurn, drawLoot, playLootCard, discardLoot, returnToDeck, rechargePlayerItems } from '../game/actions/turn';
import {
  declareAttack,
  rollAttackDice,
  resolveAttack,
  applyDamageToMonster,
  applyDamageToPlayer,
  healMonster,
  healPlayer,
  killMonster,
  refillMonsterSlot,
  resolveEventCard,
} from '../game/actions/monsters';
import {
  purchaseItem,
  gainTreasure,
  refillShopSlot,
} from '../game/actions/purchase';
import {
  chargeItem,
  deactivateItem,
  moveItem,
  destroyCard,
  gainSoul,
  shareHand,
  revokeHandShare,
  addCounter,
  removeCounter,
  changeCoins,
  coverMonster,
  discardRoom,
  discardRoomSlot,
  tradeCard,
  giveCurse,
} from '../game/actions/items';
import { drawFromDeck, createCardInPlay } from '../game/decks';
import { getCardById } from '../db/cards';
import { createLogEntry } from '../game/GameRoom';

// ─── Safe handler wrapper ─────────────────────────────────────────────────────
// Wraps every socket event callback in try/catch to prevent unhandled exceptions
// from crashing the server process.

function safeHandler<T>(
  socket: Socket,
  handler: (payload: T) => void
): (payload: T) => void {
  return (payload: T) => {
    try {
      handler(payload);
    } catch (err) {
      console.error(`[handlers] Unhandled error in socket ${socket.id}:`, err);
      sendError(socket, 'Internal server error');
    }
  };
}

// ─── Per-socket rate limiter ──────────────────────────────────────────────────
// Tracks event counts per socket in a sliding window. Returns true if the event
// should be rejected (rate exceeded).

const RATE_LIMIT_WINDOW_MS = 1000;  // 1 second window
const RATE_LIMIT_MAX_EVENTS = 30;   // max 30 events per second per socket

const socketEventCounts = new Map<string, { count: number; windowStart: number }>();

function isRateLimited(socketId: string): boolean {
  const now = Date.now();
  let entry = socketEventCounts.get(socketId);
  if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    entry = { count: 1, windowStart: now };
    socketEventCounts.set(socketId, entry);
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX_EVENTS;
}

function cleanupRateLimit(socketId: string): void {
  socketEventCounts.delete(socketId);
}

// ─── Payload validation helpers ───────────────────────────────────────────────

function isString(val: unknown): val is string {
  return typeof val === 'string';
}

function isNonEmptyString(val: unknown): val is string {
  return typeof val === 'string' && val.length > 0;
}

function isNumber(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val);
}

function isBoolean(val: unknown): val is boolean {
  return typeof val === 'boolean';
}

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function isStringArray(val: unknown): val is string[] {
  return Array.isArray(val) && val.every((v) => typeof v === 'string');
}

/** Validate a payload is an object and optionally check required string/number fields.
 *  Returns a type predicate that narrows to `any` so callers can cast freely
 *  after validation. Runtime checks guarantee the required fields exist. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function validatePayload(
  payload: unknown,
  requiredStrings: string[] = [],
  requiredNumbers: string[] = []
): payload is any {
  if (!isObject(payload)) return false;
  for (const key of requiredStrings) {
    if (!isString(payload[key])) return false;
  }
  for (const key of requiredNumbers) {
    if (!isNumber(payload[key])) return false;
  }
  return true;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Map from socket.id → { roomId, playerId }
const socketPlayerMap = new Map<string, { roomId: string; playerId: string }>();

function broadcastState(io: Server, roomId: string): void {
  const room = gameStore.get(roomId);
  if (!room) return;

  const state = room.getState();
  for (const player of state.players) {
    const sockets = [...io.sockets.sockets.values()].filter((s) => {
      const info = socketPlayerMap.get(s.id);
      return info?.roomId === roomId && info?.playerId === player.id;
    });
    const clientState = room.getClientState(player.id);
    for (const sock of sockets) {
      sock.emit('game:state', clientState);
    }
  }
}

function broadcastLog(io: Server, roomId: string, entries: { id: string; timestamp: number; type: string; message: string; playerId: string | null }[]): void {
  io.to(roomId).emit('game:log', entries);
}

function sendError(socket: Socket, message: string): void {
  socket.emit('game:error', { message });
}

/** Get the player context for a socket, or null if not in a room */
function getCtx(socket: Socket) {
  return socketPlayerMap.get(socket.id) ?? null;
}

/** Check if the calling player is a spectator. Returns true (and sends error) if spectator. */
function rejectIfSpectator(socket: Socket, ctx: { roomId: string; playerId: string }): boolean {
  const room = gameStore.get(ctx.roomId);
  if (!room) return true;
  const player = room.getState().players.find((p) => p.id === ctx.playerId);
  if (player?.isSpectator) {
    sendError(socket, 'Spectators cannot perform this action');
    return true;
  }
  return false;
}

// ─── Handler registration ─────────────────────────────────────────────────────

export function registerHandlers(io: Server, socket: Socket): void {
  // ─── Join / create room ─────────────────────────────────────────────────────

  socket.on('action:join', safeHandler<unknown>(socket, (raw) => {
    if (isRateLimited(socket.id)) return;
    if (!validatePayload(raw, ['roomId', 'name'])) return sendError(socket, 'Invalid payload');
    const payload = raw as JoinPayload;

    const roomId = (payload.roomId || '').toUpperCase().trim();
    const name = (payload.name || '').trim().slice(0, 32);
    if (!name) return sendError(socket, 'Name is required');

    const room = gameStore.get(roomId);
    if (!room) return sendError(socket, 'Room not found');

    const playerId = socket.id;
    const result = room.addPlayer(playerId, name, payload.asSpectator ?? false, payload.reconnectToken);
    if ('error' in result) return sendError(socket, result.error);

    socketPlayerMap.set(socket.id, { roomId, playerId });
    socket.join(roomId);

    room.setConnected(playerId, true);
    if (result.token) socket.emit('room:token', { token: result.token });

    // A player successfully joined — cancel any pending cleanup timer
    gameStore.cancelCleanup(roomId);

    broadcastState(io, roomId);
  }));

  socket.on('action:create_room', safeHandler<unknown>(socket, (raw) => {
    if (isRateLimited(socket.id)) return;
    const payload: { name?: string } = isObject(raw) ? raw as any : {};

    if (!gameStore.canCreate()) return sendError(socket, 'Server at capacity');
    const roomId = generateRoomCode();
    // Use socket.id as hostPlayerId so it matches when the host joins
    const room = gameStore.create(roomId, socket.id);

    // Schedule a cleanup in case nobody ever joins (host closes tab immediately)
    gameStore.scheduleCleanup(roomId, ROOM_TIMEOUT_CREATED_MS);

    // Auto-add the host as the first player if a name is provided
    const name = (typeof payload?.name === 'string' ? payload.name : '').trim().slice(0, 32);
    if (name) {
      const result = room.addPlayer(socket.id, name, false);
      if (!('error' in result)) {
        socketPlayerMap.set(socket.id, { roomId, playerId: socket.id });
        socket.join(roomId);
        room.setConnected(socket.id, true);
        if (result.token) socket.emit('room:token', { token: result.token });
        // Someone joined — cancel the creation-only timer; normal disconnect
        // logic will handle cleanup from here.
        gameStore.cancelCleanup(roomId);
      }
    }

    socket.emit('room:created', { roomId });
    if (name) broadcastState(io, roomId);
  }));

  // ─── Lobby ──────────────────────────────────────────────────────────────────

  socket.on('action:set_active_sets', safeHandler<unknown>(socket, (raw) => {
    if (isRateLimited(socket.id)) return;
    const ctx = getCtx(socket);
    if (!ctx) return sendError(socket, 'Not in a room');
    const room = gameStore.get(ctx.roomId);
    if (!room) return sendError(socket, 'Room not found');
    if (room.getState().hostPlayerId !== ctx.playerId)
      return sendError(socket, 'Only the host can change settings');
    const payload = isObject(raw) ? raw : {};
    const sets = isStringArray((payload as Record<string, unknown>).sets)
      ? ((payload as Record<string, unknown>).sets as string[]).slice(0, 50)
      : [];
    room.setActiveSets(sets);
    broadcastState(io, ctx.roomId);
  }));

  socket.on('action:start_game', safeHandler<unknown>(socket, (raw) => {
    if (isRateLimited(socket.id)) return;
    const ctx = getCtx(socket);
    if (!ctx) return;
    const room = gameStore.get(ctx.roomId);
    if (!room) return;
    if (room.getState().hostPlayerId !== ctx.playerId)
      return sendError(socket, 'Only the host can start the game');

    const payload: StartGamePayload = isObject(raw) ? raw as any : {} as any;
    const err = room.startGame({
      activeSets: isStringArray(payload.activeSets) ? payload.activeSets : [],
      includeBonusSouls: isBoolean(payload.includeBonusSouls) ? payload.includeBonusSouls : true,
      bonusSoulCount: isNumber(payload.bonusSoulCount) ? payload.bonusSoulCount : undefined,
      includeRooms: isBoolean(payload.includeRooms) ? payload.includeRooms : false,
      excludeNeverPrinted: isBoolean(payload.excludeNeverPrinted) ? payload.excludeNeverPrinted : true,
    });
    if (err) return sendError(socket, err);

    broadcastState(io, ctx.roomId);
  }));

  socket.on('action:restart_game', safeHandler<void>(socket, () => {
    if (isRateLimited(socket.id)) return;
    const ctx = getCtx(socket);
    if (!ctx) return;
    const room = gameStore.get(ctx.roomId);
    if (!room) return;
    if (room.getState().hostPlayerId !== ctx.playerId)
      return sendError(socket, 'Only the host can restart the game');

    room.resetToLobby();
    broadcastState(io, ctx.roomId);
  }));

  // ─── Eden starting-item pick ─────────────────────────────────────────────────

  socket.on('action:eden_pick', safeHandler<unknown>(socket, (raw) => {
    if (isRateLimited(socket.id)) return;
    if (!validatePayload(raw, ['cardId'])) return sendError(socket, 'Invalid payload');
    const payload = raw as EdenPickPayload;

    const ctx = getCtx(socket);
    if (!ctx) return;
    const room = gameStore.get(ctx.roomId);
    if (!room) return;

    let state = room.getState();

    if (state.phase !== 'eden_pick')
      return sendError(socket, 'Not in eden pick phase');
    if (state.edenPickQueue[0] !== ctx.playerId)
      return sendError(socket, 'Not your turn to pick');
    if (!state.edenPickOptions.includes(payload.cardId))
      return sendError(socket, 'Invalid card choice');

    const player = state.players.find((p) => p.id === ctx.playerId);
    if (!player) return sendError(socket, 'Player not found');

    // Remove chosen card from treasure deck
    const newTreasureDeck = state.treasureDeck.filter((id) => id !== payload.cardId);

    // Replace the placeholder starting item with the chosen card
    const newItemInstance = { ...state.startingItemCards[player.startingItemInstanceId] };
    const updatedStartingItemCards = {
      ...state.startingItemCards,
      [player.startingItemInstanceId]: { ...newItemInstance, cardId: payload.cardId },
    };

    const updatedPlayers = state.players.map((p) => {
      if (p.id !== ctx.playerId) return p;
      return {
        ...p,
        items: p.items.map((item) =>
          item.instanceId === p.startingItemInstanceId
            ? { ...item, cardId: payload.cardId }
            : item
        ),
      };
    });

    const logEntry = createLogEntry(
      'info',
      `${player.name} (Eden) picks their starting item`,
      ctx.playerId
    );

    // Advance the queue
    const newQueue = state.edenPickQueue.slice(1);

    if (newQueue.length === 0) {
      // All Edens have picked — go to sad_vote (or active if solo)
      state = {
        ...state,
        treasureDeck: newTreasureDeck,
        startingItemCards: updatedStartingItemCards,
        players: updatedPlayers,
        edenPickQueue: [],
        edenPickOptions: [],
        log: [...state.log, logEntry],
      };
      state = room.transitionToSadVote(state);
    } else {
      // More Edens to go — update options for the next picker
      const newOptions = newTreasureDeck.slice(-3);
      state = {
        ...state,
        treasureDeck: newTreasureDeck,
        startingItemCards: updatedStartingItemCards,
        players: updatedPlayers,
        edenPickQueue: newQueue,
        edenPickOptions: newOptions,
        log: [...state.log, logEntry],
      };
    }

    room.setState(state);
    broadcastState(io, ctx.roomId);
  }));

  // ─── Saddest character vote ──────────────────────────────────────────────────

  socket.on('action:sad_vote', safeHandler<unknown>(socket, (raw) => {
    if (isRateLimited(socket.id)) return;
    if (!validatePayload(raw, ['targetPlayerId'])) return sendError(socket, 'Invalid payload');
    const payload = raw as SadVotePayload;

    const ctx = getCtx(socket);
    if (!ctx) return;
    const room = gameStore.get(ctx.roomId);
    if (!room) return;

    let state = room.getState();

    if (state.phase !== 'sad_vote')
      return sendError(socket, 'Not in voting phase');

    const voter = state.players.find((p) => p.id === ctx.playerId);
    if (!voter || voter.isSpectator)
      return sendError(socket, 'Spectators cannot vote');

    const target = state.players.find((p) => p.id === payload.targetPlayerId && !p.isSpectator);
    if (!target)
      return sendError(socket, 'Invalid vote target');

    if (state.sadVotes[ctx.playerId])
      return sendError(socket, 'Already voted');

    // Record vote — immediately visible to all
    const log = createLogEntry(
      'info',
      `${voter.name} votes for ${target.name}'s character`,
      ctx.playerId
    );
    state = {
      ...state,
      sadVotes: { ...state.sadVotes, [ctx.playerId]: payload.targetPlayerId },
      log: [...state.log, log],
    };

    // Check if all non-spectators have voted
    const nonSpectators = state.players.filter((p) => !p.isSpectator);
    const allVoted = nonSpectators.every((p) => state.sadVotes[p.id]);

    if (allVoted) {
      state = room.resolveSadVote(state);
    }

    room.setState(state);
    broadcastState(io, ctx.roomId);
  }));

  socket.on('action:sad_vote_skip', safeHandler<void>(socket, () => {
    if (isRateLimited(socket.id)) return;
    const ctx = getCtx(socket);
    if (!ctx) return;
    const room = gameStore.get(ctx.roomId);
    if (!room) return;

    const state = room.getState();

    if (state.phase !== 'sad_vote')
      return sendError(socket, 'Not in voting phase');
    if (state.hostPlayerId !== ctx.playerId)
      return sendError(socket, 'Only the host can skip the vote');

    const log = createLogEntry('info', 'Host skipped the saddest character vote', ctx.playerId);
    const resolved = room.resolveSadVote({
      ...state,
      log: [...state.log, log],
    });
    room.setState(resolved);
    broadcastState(io, ctx.roomId);
  }));

  // ─── Priority / Stack ───────────────────────────────────────────────────────

  socket.on('action:pass_priority', safeHandler<void>(socket, () => {
    if (isRateLimited(socket.id)) return;
    const ctx = getCtx(socket);
    if (!ctx) return;
    if (rejectIfSpectator(socket, ctx)) return;
    const room = gameStore.get(ctx.roomId);
    if (!room) return;

    let state = room.getState();
    if (state.priorityQueue[0] !== ctx.playerId)
      return sendError(socket, "It's not your priority");

    state = passPriority(state, ctx.playerId);

    if (allPassedPriority(state) && state.stack.length > 0) {
      const { resolved, newState } = resolveTopOfStack(state);
      state = newState;
      // After resolution, reset priority
      state = resetPriority(state);
    } else if (allPassedPriority(state) && state.stack.length === 0) {
      // All passed with empty stack — nothing to do
    }

    room.setState(state);
    broadcastState(io, ctx.roomId);
  }));

  /** Active player forcibly resolves the top of the stack without waiting for all to pass */
  socket.on('action:resolve_top', safeHandler<void>(socket, () => {
    if (isRateLimited(socket.id)) return;
    const ctx = getCtx(socket);
    if (!ctx) return;
    if (rejectIfSpectator(socket, ctx)) return;
    const room = gameStore.get(ctx.roomId);
    if (!room) return;

    const state = room.getState();
    if (state.turn.activePlayerId !== ctx.playerId)
      return sendError(socket, 'Only the active player can force-resolve the stack');
    if (state.stack.length === 0)
      return sendError(socket, 'Stack is empty');

    const { newState } = resolveTopOfStack(state);
    room.setState(resetPriority(newState));
    broadcastState(io, ctx.roomId);
  }));

  socket.on('action:cancel_stack_item', safeHandler<unknown>(socket, (raw) => {
    if (isRateLimited(socket.id)) return;
    if (!validatePayload(raw, ['stackItemId'])) return sendError(socket, 'Invalid payload');
    const payload = raw as CancelStackItemPayload;

    const ctx = getCtx(socket);
    if (!ctx) return;
    if (rejectIfSpectator(socket, ctx)) return;
    const room = gameStore.get(ctx.roomId);
    if (!room) return;

    const newState = cancelStackItem(room.getState(), payload.stackItemId);
    room.setState(newState);
    broadcastState(io, ctx.roomId);
  }));

  // ─── Turn actions ────────────────────────────────────────────────────────────

  socket.on('action:end_turn', safeHandler<void>(socket, () => {
    if (isRateLimited(socket.id)) return;
    const ctx = getCtx(socket);
    if (!ctx) return;
    if (rejectIfSpectator(socket, ctx)) return;
    const room = gameStore.get(ctx.roomId);
    if (!room) return;

    const state = room.getState();
    if (state.turn.activePlayerId !== ctx.playerId)
      return sendError(socket, 'Not your turn');
    if (state.stack.length > 0)
      return sendError(socket, 'Cannot end turn with items on stack');

    room.setState(endTurn(state));
    broadcastState(io, ctx.roomId);
  }));

  // ─── Loot ────────────────────────────────────────────────────────────────────

  /** Grant the active player one additional loot play this turn */
  socket.on('action:grant_loot_play', safeHandler<void>(socket, () => {
    if (isRateLimited(socket.id)) return;
    const ctx = getCtx(socket);
    if (!ctx) return;
    if (rejectIfSpectator(socket, ctx)) return;
    const room = gameStore.get(ctx.roomId);
    if (!room) return;

    const state = room.getState();
    if (state.turn.activePlayerId !== ctx.playerId)
      return sendError(socket, 'Only the active player can grant extra loot plays');

    room.setState({
      ...state,
      turn: { ...state.turn, lootPlaysRemaining: state.turn.lootPlaysRemaining + 1 },
    });
    broadcastState(io, ctx.roomId);
  }));

  socket.on('action:play_loot', safeHandler<unknown>(socket, (raw) => {
    if (isRateLimited(socket.id)) return;
    if (!validatePayload(raw, ['cardId'])) return sendError(socket, 'Invalid payload');
    const payload = raw as PlayLootPayload;

    const ctx = getCtx(socket);
    if (!ctx) return;
    if (rejectIfSpectator(socket, ctx)) return;
    const room = gameStore.get(ctx.roomId);
    if (!room) return;

    const state = room.getState();
    // Allow loot play if player has priority OR is the active player
    const hasPriority = state.priorityQueue[0] === ctx.playerId;
    const isActivePlayer = state.turn.activePlayerId === ctx.playerId;
    if (!hasPriority && !isActivePlayer)
      return sendError(socket, "It's not your priority");

    const { newState, error } = playLootCard(
      state,
      ctx.playerId,
      payload.cardId,
      isStringArray(payload.targets) ? payload.targets : []
    );
    if (error) return sendError(socket, error);

    room.setState(newState);
    broadcastState(io, ctx.roomId);
  }));

  socket.on('action:draw_loot', safeHandler<unknown>(socket, (raw) => {
    if (isRateLimited(socket.id)) return;
    const payload: DrawLootPayload = isObject(raw) ? raw as any : {} as any;

    const ctx = getCtx(socket);
    if (!ctx) return;
    if (rejectIfSpectator(socket, ctx)) return;
    const room = gameStore.get(ctx.roomId);
    if (!room) return;

    room.setState(drawLoot(room.getState(), ctx.playerId, clampInt(payload.count, 1, 10, 1)));
    broadcastState(io, ctx.roomId);
  }));

  socket.on('action:discard_loot', safeHandler<unknown>(socket, (raw) => {
    if (isRateLimited(socket.id)) return;
    if (!validatePayload(raw, ['cardId'])) return sendError(socket, 'Invalid payload');
    const payload = raw as DiscardLootPayload;

    const ctx = getCtx(socket);
    if (!ctx) return;
    if (rejectIfSpectator(socket, ctx)) return;
    const room = gameStore.get(ctx.roomId);
    if (!room) return;

    room.setState(discardLoot(room.getState(), ctx.playerId, payload.cardId));
    broadcastState(io, ctx.roomId);
  }));

  socket.on('action:return_to_deck', safeHandler<unknown>(socket, (raw) => {
    if (isRateLimited(socket.id)) return;
    if (!validatePayload(raw, ['cardId', 'deckType', 'position'])) return sendError(socket, 'Invalid payload');
    const payload = raw as ReturnToDeckPayload;

    // Validate deckType and position values
    if (!['loot', 'treasure', 'monster'].includes(payload.deckType)) return sendError(socket, 'Invalid deck type');
    if (!['top', 'bottom'].includes(payload.position)) return sendError(socket, 'Invalid position');

    const ctx = getCtx(socket);
    if (!ctx) return;
    if (rejectIfSpectator(socket, ctx)) return;
    const room = gameStore.get(ctx.roomId);
    if (!room) return;

    room.setState(
      returnToDeck(
        room.getState(),
        ctx.playerId,
        payload.cardId,
        payload.deckType,
        payload.position,
        payload.fromHand ?? false
      )
    );
    broadcastState(io, ctx.roomId);
  }));

  // ─── Attacks ─────────────────────────────────────────────────────────────────

  socket.on('action:declare_attack', safeHandler<unknown>(socket, (raw) => {
    if (isRateLimited(socket.id)) return;
    const payload: DeclareAttackPayload = isObject(raw) ? raw as any : {} as any;

    const ctx = getCtx(socket);
    if (!ctx) return;
    if (rejectIfSpectator(socket, ctx)) return;
    const room = gameStore.get(ctx.roomId);
    if (!room) return;

    const { newState, error } = declareAttack(
      room.getState(),
      ctx.playerId,
      isNumber(payload.targetSlotIndex) ? payload.targetSlotIndex : 0
    );
    if (error) return sendError(socket, error);

    room.setState(newState);
    broadcastState(io, ctx.roomId);
  }));

  socket.on('action:roll_dice', safeHandler<unknown>(socket, (raw) => {
    if (isRateLimited(socket.id)) return;
    const payload: RollDicePayload = isObject(raw) ? raw as any : {} as any;
    if (!isString(payload.context) || !['attack', 'ability', 'manual'].includes(payload.context))
      return sendError(socket, 'Invalid dice context');
    if (!isString(payload.rollId)) return sendError(socket, 'Invalid rollId');

    const ctx = getCtx(socket);
    if (!ctx) return;
    if (rejectIfSpectator(socket, ctx)) return;
    const room = gameStore.get(ctx.roomId);
    if (!room) return;

    const state = room.getState();

    if (payload.context === 'attack') {
      // Block the roll if the attack declaration is still on the stack
      const declarationPending = state.stack.some(
        (item) => item.type === 'attack_declaration' && !item.isCanceled
      );
      if (declarationPending)
        return sendError(socket, 'Resolve the attack declaration on the stack first');

      const { newState, roll, error } = rollAttackDice(state, ctx.playerId);
      if (error) return sendError(socket, error);

      // Broadcast the dice result to all in room
      io.to(ctx.roomId).emit('dice:result', {
        playerId: ctx.playerId,
        value: roll,
        rollId: payload.rollId,
        context: payload.context,
      });

      // Resolve the attack
      const { newState: resolvedState, hit } = resolveAttack(newState);

      // setState first so checkWin reads the correct state (souls may have been gained)
      room.setState(resolvedState);
      const winnerId = room.checkWin();
      if (winnerId) {
        room.endGame(winnerId);
        io.to(ctx.roomId).emit('game:ended', {
          winnerId,
          winnerName: resolvedState.players.find((p) => p.id === winnerId)?.name,
        });
        gameStore.scheduleCleanup(ctx.roomId, ROOM_TIMEOUT_ENDED_MS);
      }
    } else {
      // Manual dice roll — push to stack so players can respond
      const roll = Math.floor(Math.random() * 6) + 1;
      const player = state.players.find((p) => p.id === ctx.playerId);
      const logEntry = createLogEntry(
        'dice',
        `${player?.name ?? ctx.playerId} rolled a ${roll} (${payload.context})`,
        ctx.playerId
      );
      let newState = { ...state, log: [...state.log, logEntry] };

      // Push a dice_roll entry to the stack so others can react
      newState = pushStack(newState, {
        type: 'dice_roll',
        sourceCardInstanceId: '',
        sourcePlayerId: ctx.playerId,
        description: `${player?.name ?? ctx.playerId} rolled a ${roll}`,
        targets: [],
        data: { roll, context: payload.context },
      });

      room.setState(newState);

      io.to(ctx.roomId).emit('dice:result', {
        playerId: ctx.playerId,
        value: roll,
        rollId: payload.rollId,
        context: payload.context,
      });
    }

    broadcastState(io, ctx.roomId);
  }));

  // ─── Purchases ───────────────────────────────────────────────────────────────

  socket.on('action:purchase', safeHandler<unknown>(socket, (raw) => {
    if (isRateLimited(socket.id)) return;
    if (!validatePayload(raw, [], ['slotIndex'])) return sendError(socket, 'Invalid payload');
    const payload = raw as PurchasePayload;

    const ctx = getCtx(socket);
    if (!ctx) return;
    if (rejectIfSpectator(socket, ctx)) return;
    const room = gameStore.get(ctx.roomId);
    if (!room) return;

    const { newState, error } = purchaseItem(
      room.getState(),
      ctx.playerId,
      payload.slotIndex
    );
    if (error) return sendError(socket, error);

    room.setState(newState);
    broadcastState(io, ctx.roomId);
  }));

  socket.on('action:gain_treasure', safeHandler<unknown>(socket, (raw) => {
    if (isRateLimited(socket.id)) return;
    const payload: GainTreasurePayload = isObject(raw) ? raw as any : {} as any;

    const ctx = getCtx(socket);
    if (!ctx) return;
    if (rejectIfSpectator(socket, ctx)) return;
    const room = gameStore.get(ctx.roomId);
    if (!room) return;

    room.setState(gainTreasure(room.getState(), ctx.playerId, clampInt(payload.count, 1, 10, 1)));
    broadcastState(io, ctx.roomId);
  }));

  /** Draw the top card of the eternal deck into a player's items */
  socket.on('action:gain_eternal', safeHandler<unknown>(socket, (raw) => {
    if (isRateLimited(socket.id)) return;
    if (!validatePayload(raw, ['playerId'])) return sendError(socket, 'Invalid payload');
    const payload = raw as { playerId: string };

    const ctx = getCtx(socket);
    if (!ctx) return;
    if (rejectIfSpectator(socket, ctx)) return;
    const room = gameStore.get(ctx.roomId);
    if (!room) return;

    const state = room.getState();
    if (state.eternalDeck.length === 0) return sendError(socket, 'Eternal deck is empty');

    const { drawn, newDeck, newDiscard } = drawFromDeck(state.eternalDeck, state.eternalDiscard, 1);
    if (!drawn[0]) return;

    const targetPlayer = state.players.find((p) => p.id === payload.playerId);
    if (!targetPlayer) return sendError(socket, 'Player not found');

    const newItem = createCardInPlay(drawn[0]);
    const card = getCardById(drawn[0]);
    const log = createLogEntry(
      'info',
      `${targetPlayer.name} gains eternal item ${card?.name ?? drawn[0]}`,
      ctx.playerId
    );

    room.setState({
      ...state,
      eternalDeck: newDeck,
      eternalDiscard: newDiscard,
      players: state.players.map((p) =>
        p.id === payload.playerId ? { ...p, items: [...p.items, newItem] } : p
      ),
      log: [...state.log, log],
    });
    broadcastState(io, ctx.roomId);
  }));

  // ─── Items ───────────────────────────────────────────────────────────────────

  socket.on('action:charge_item', safeHandler<unknown>(socket, (raw) => {
    if (isRateLimited(socket.id)) return;
    if (!validatePayload(raw, ['instanceId'])) return sendError(socket, 'Invalid payload');
    const payload = raw as { instanceId: string };

    const ctx = getCtx(socket);
    if (!ctx) return;
    if (rejectIfSpectator(socket, ctx)) return;
    const room = gameStore.get(ctx.roomId);
    if (!room) return;

    room.setState(chargeItem(room.getState(), ctx.playerId, payload.instanceId));
    broadcastState(io, ctx.roomId);
  }));

  socket.on('action:deactivate_item', safeHandler<unknown>(socket, (raw) => {
    if (isRateLimited(socket.id)) return;
    if (!validatePayload(raw, ['instanceId'])) return sendError(socket, 'Invalid payload');
    const payload = raw as { instanceId: string };

    const ctx = getCtx(socket);
    if (!ctx) return;
    if (rejectIfSpectator(socket, ctx)) return;
    const room = gameStore.get(ctx.roomId);
    if (!room) return;

    const state = room.getState();
    // Find the item being tapped
    const player = state.players.find((p) => p.id === ctx.playerId);
    const item = player?.items.find((i) => i.instanceId === payload.instanceId)
      ?? (state.characterCards[payload.instanceId] ? { ...state.characterCards[payload.instanceId], instanceId: payload.instanceId } : null);

    // Deactivate the item
    let newState = deactivateItem(state, ctx.playerId, payload.instanceId);

    // Push an "activated ability" entry to the stack so others can respond
    if (item) {
      const card = getCardById(item.cardId ?? payload.instanceId);
      newState = pushStack(newState, {
        type: 'activated_ability',
        sourceCardInstanceId: payload.instanceId,
        sourcePlayerId: ctx.playerId,
        description: `${player?.name ?? ctx.playerId} activates ${card?.name ?? 'item'}`,
        targets: [],
        data: { instanceId: payload.instanceId },
      });
    }

    room.setState(newState);
    broadcastState(io, ctx.roomId);
  }));

  socket.on('action:move_item', safeHandler<unknown>(socket, (raw) => {
    if (isRateLimited(socket.id)) return;
    if (!validatePayload(raw, ['instanceId'], ['toIndex'])) return sendError(socket, 'Invalid payload');
    const payload = raw as MoveItemPayload;

    const ctx = getCtx(socket);
    if (!ctx) return;
    if (rejectIfSpectator(socket, ctx)) return;
    const room = gameStore.get(ctx.roomId);
    if (!room) return;

    room.setState(moveItem(room.getState(), ctx.playerId, payload.instanceId, payload.toIndex));
    broadcastState(io, ctx.roomId);
  }));

  socket.on('action:destroy_card', safeHandler<unknown>(socket, (raw) => {
    if (isRateLimited(socket.id)) return;
    if (!validatePayload(raw, ['instanceId'])) return sendError(socket, 'Invalid payload');
    const payload = raw as DestroyCardPayload;

    const ctx = getCtx(socket);
    if (!ctx) return;
    if (rejectIfSpectator(socket, ctx)) return;
    const room = gameStore.get(ctx.roomId);
    if (!room) return;

    room.setState(destroyCard(room.getState(), payload.instanceId));
    broadcastState(io, ctx.roomId);
  }));

  socket.on('action:gain_soul', safeHandler<unknown>(socket, (raw) => {
    if (isRateLimited(socket.id)) return;
    if (!validatePayload(raw, ['instanceId', 'playerId'])) return sendError(socket, 'Invalid payload');
    const payload = raw as GainSoulPayload;

    const ctx = getCtx(socket);
    if (!ctx) return;
    if (rejectIfSpectator(socket, ctx)) return;
    const room = gameStore.get(ctx.roomId);
    if (!room) return;

    const newState = gainSoul(room.getState(), payload.instanceId, payload.playerId);
    room.setState(newState);

    // Check win condition
    const winnerId = room.checkWin();
    if (winnerId) {
      room.endGame(winnerId);
      io.to(ctx.roomId).emit('game:ended', {
        winnerId,
        winnerName: newState.players.find((p) => p.id === winnerId)?.name,
      });
      gameStore.scheduleCleanup(ctx.roomId, ROOM_TIMEOUT_ENDED_MS);
    }

    broadcastState(io, ctx.roomId);
  }));

  /** Claim an unclaimed bonus soul card */
  socket.on('action:gain_bonus_soul', safeHandler<unknown>(socket, (raw) => {
    if (isRateLimited(socket.id)) return;
    if (!validatePayload(raw, ['cardId', 'playerId'])) return sendError(socket, 'Invalid payload');
    const payload = raw as { cardId: string; playerId: string };

    const ctx = getCtx(socket);
    if (!ctx) return;
    if (rejectIfSpectator(socket, ctx)) return;
    const room = gameStore.get(ctx.roomId);
    if (!room) return;

    const state = room.getState();
    const bs = state.bonusSouls.find((b) => b.cardId === payload.cardId);
    if (!bs) return sendError(socket, 'Bonus soul not found');
    if (bs.isGained || bs.isDestroyed) return sendError(socket, 'Bonus soul already claimed');

    const player = state.players.find((p) => p.id === payload.playerId);
    if (!player) return sendError(socket, 'Player not found');

    const soulInstance = {
      instanceId: `bs-${payload.cardId}-${payload.playerId}`,
      cardId: payload.cardId,
      charged: true,
      damageCounters: 0,
      hpCounters: 0,
      atkCounters: 0,
      genericCounters: 0,
      namedCounters: {} as Record<string, number>,
    };

    const log = createLogEntry(
      'soul_gain',
      `${player.name} gains bonus soul: ${payload.cardId}`,
      payload.playerId
    );

    const newState = {
      ...state,
      bonusSouls: state.bonusSouls.map((b) =>
        b.cardId === payload.cardId
          ? { ...b, isGained: true, gainedByPlayerId: payload.playerId }
          : b
      ),
      players: state.players.map((p) =>
        p.id === payload.playerId
          ? { ...p, souls: [...p.souls, soulInstance] }
          : p
      ),
      log: [...state.log, log],
    };

    room.setState(newState);

    const winnerId = room.checkWin();
    if (winnerId) {
      room.endGame(winnerId);
      io.to(ctx.roomId).emit('game:ended', {
        winnerId,
        winnerName: newState.players.find((p) => p.id === winnerId)?.name,
      });
      gameStore.scheduleCleanup(ctx.roomId, ROOM_TIMEOUT_ENDED_MS);
    }

    broadcastState(io, ctx.roomId);
  }));

  /** Grant yourself a generic soul (worth 1 soul point, no backing card) */
  socket.on('action:gain_generic_soul', safeHandler<void>(socket, () => {
    if (isRateLimited(socket.id)) return;
    const ctx = getCtx(socket);
    if (!ctx) return;
    if (rejectIfSpectator(socket, ctx)) return;
    const room = gameStore.get(ctx.roomId);
    if (!room) return;

    const state = room.getState();
    const player = state.players.find((p) => p.id === ctx.playerId);
    if (!player) return sendError(socket, 'Cannot gain soul');

    const soulInstance = {
      instanceId: `generic-soul-${ctx.playerId}-${Date.now()}`,
      cardId: '',
      charged: true,
      damageCounters: 0,
      hpCounters: 0,
      atkCounters: 0,
      genericCounters: 0,
      namedCounters: {} as Record<string, number>,
    };

    const log = createLogEntry('soul_gain', `${player.name} gains a soul`, ctx.playerId);

    const newState = {
      ...state,
      players: state.players.map((p) =>
        p.id === ctx.playerId ? { ...p, souls: [...p.souls, soulInstance] } : p
      ),
      log: [...state.log, log],
    };

    room.setState(newState);
    const winnerId = room.checkWin();
    if (winnerId) {
      room.endGame(winnerId);
      io.to(ctx.roomId).emit('game:ended', {
        winnerId,
        winnerName: newState.players.find((p) => p.id === winnerId)?.name,
      });
      gameStore.scheduleCleanup(ctx.roomId, ROOM_TIMEOUT_ENDED_MS);
    }
    broadcastState(io, ctx.roomId);
  }));

  /** Remove a soul from your own souls array (misclick recovery) */
  socket.on('action:remove_soul', safeHandler<unknown>(socket, (raw) => {
    if (isRateLimited(socket.id)) return;
    if (!validatePayload(raw, ['instanceId'])) return sendError(socket, 'Invalid payload');
    const payload = raw as { instanceId: string };

    const ctx = getCtx(socket);
    if (!ctx) return;
    if (rejectIfSpectator(socket, ctx)) return;
    const room = gameStore.get(ctx.roomId);
    if (!room) return;

    const state = room.getState();
    const player = state.players.find((p) => p.id === ctx.playerId);
    if (!player) return sendError(socket, 'Player not found');

    const soul = player.souls.find((s) => s.instanceId === payload.instanceId);
    if (!soul) return sendError(socket, 'Soul not found');

    const log = createLogEntry('info', `${player.name} removes a soul`, ctx.playerId);

    room.setState({
      ...state,
      players: state.players.map((p) =>
        p.id === ctx.playerId
          ? { ...p, souls: p.souls.filter((s) => s.instanceId !== payload.instanceId) }
          : p
      ),
      log: [...state.log, log],
    });
    broadcastState(io, ctx.roomId);
  }));

  socket.on('action:cover_monster', safeHandler<unknown>(socket, (raw) => {
    if (isRateLimited(socket.id)) return;
    if (!validatePayload(raw, ['cardId'], ['slotIndex'])) return sendError(socket, 'Invalid payload');
    const payload = raw as CoverMonsterPayload;

    const ctx = getCtx(socket);
    if (!ctx) return;
    if (rejectIfSpectator(socket, ctx)) return;
    const room = gameStore.get(ctx.roomId);
    if (!room) return;

    const { newState, error } = coverMonster(
      room.getState(),
      payload.slotIndex,
      payload.cardId,
      ctx.playerId
    );
    if (error) return sendError(socket, error);

    room.setState(newState);
    broadcastState(io, ctx.roomId);
  }));

  // ─── Players ──────────────────────────────────────────────────────────────────

  socket.on('action:gain_coins', safeHandler<unknown>(socket, (raw) => {
    if (isRateLimited(socket.id)) return;
    if (!validatePayload(raw, ['playerId'], ['amount'])) return sendError(socket, 'Invalid payload');
    const payload = raw as CoinChangePayload;

    const ctx = getCtx(socket);
    if (!ctx) return;
    if (rejectIfSpectator(socket, ctx)) return;
    const room = gameStore.get(ctx.roomId);
    if (!room) return;

    room.setState(changeCoins(room.getState(), payload.playerId, clampInt(payload.amount, 1, 999, 1)));
    broadcastState(io, ctx.roomId);
  }));

  socket.on('action:spend_coins', safeHandler<unknown>(socket, (raw) => {
    if (isRateLimited(socket.id)) return;
    if (!validatePayload(raw, ['playerId'], ['amount'])) return sendError(socket, 'Invalid payload');
    const payload = raw as CoinChangePayload;

    const ctx = getCtx(socket);
    if (!ctx) return;
    if (rejectIfSpectator(socket, ctx)) return;
    const room = gameStore.get(ctx.roomId);
    if (!room) return;

    room.setState(changeCoins(room.getState(), payload.playerId, -clampInt(payload.amount, 1, 999, 1)));
    broadcastState(io, ctx.roomId);
  }));

  socket.on('action:set_base_hp', safeHandler<unknown>(socket, (raw) => {
    if (isRateLimited(socket.id)) return;
    if (!validatePayload(raw, ['playerId'], ['delta'])) return sendError(socket, 'Invalid payload');
    const payload = raw as { playerId: string; delta: number };

    const ctx = getCtx(socket);
    if (!ctx) return;
    if (rejectIfSpectator(socket, ctx)) return;
    const room = gameStore.get(ctx.roomId);
    if (!room) return;

    const delta = clampInt(payload.delta, -10, 10, 0);
    const state = room.getState();
    room.setState({
      ...state,
      players: state.players.map((p) =>
        p.id === payload.playerId
          ? { ...p, baseHp: Math.max(1, p.baseHp + delta) }
          : p
      ),
    });
    broadcastState(io, ctx.roomId);
  }));

  socket.on('action:set_base_atk', safeHandler<unknown>(socket, (raw) => {
    if (isRateLimited(socket.id)) return;
    if (!validatePayload(raw, ['playerId'], ['delta'])) return sendError(socket, 'Invalid payload');
    const payload = raw as { playerId: string; delta: number };

    const ctx = getCtx(socket);
    if (!ctx) return;
    if (rejectIfSpectator(socket, ctx)) return;
    const room = gameStore.get(ctx.roomId);
    if (!room) return;

    const delta = clampInt(payload.delta, -10, 10, 0);
    const state = room.getState();
    room.setState({
      ...state,
      players: state.players.map((p) =>
        p.id === payload.playerId
          ? { ...p, baseAtk: Math.max(0, p.baseAtk + delta) }
          : p
      ),
    });
    broadcastState(io, ctx.roomId);
  }));

  socket.on('action:apply_damage', safeHandler<unknown>(socket, (raw) => {
    if (isRateLimited(socket.id)) return;
    if (!isObject(raw)) return sendError(socket, 'Invalid payload');
    const payload = raw as any as ApplyDamagePayload;
    if (!isNumber(payload.amount)) return sendError(socket, 'Invalid amount');

    const ctx = getCtx(socket);
    if (!ctx) return;
    if (rejectIfSpectator(socket, ctx)) return;
    const room = gameStore.get(ctx.roomId);
    if (!room) return;

    let state = room.getState();
    const amount = clampInt(payload.amount, 1, 999, 1);
    if (isString(payload.targetPlayerId) && payload.targetPlayerId) {
      state = applyDamageToPlayer(state, payload.targetPlayerId, amount);
    } else if (isString(payload.targetInstanceId) && payload.targetInstanceId) {
      // Find which slot has this instance
      const slotIdx = state.monsterSlots.findIndex((s) =>
        s.stack.some((c) => c.instanceId === payload.targetInstanceId)
      );
      if (slotIdx >= 0) {
        state = applyDamageToMonster(state, slotIdx, amount, ctx.playerId);
      }
    }

    // setState first so checkWin reads the correct state (souls may have been gained)
    room.setState(state);
    const winnerId = room.checkWin();
    if (winnerId) {
      room.endGame(winnerId);
      io.to(ctx.roomId).emit('game:ended', {
        winnerId,
        winnerName: state.players.find((p) => p.id === winnerId)?.name,
      });
      gameStore.scheduleCleanup(ctx.roomId, ROOM_TIMEOUT_ENDED_MS);
    }

    broadcastState(io, ctx.roomId);
  }));

  socket.on('action:heal', safeHandler<unknown>(socket, (raw) => {
    if (isRateLimited(socket.id)) return;
    if (!isObject(raw)) return sendError(socket, 'Invalid payload');
    const payload = raw as any as HealPayload;
    if (!isNumber(payload.amount)) return sendError(socket, 'Invalid amount');

    const ctx = getCtx(socket);
    if (!ctx) return;
    if (rejectIfSpectator(socket, ctx)) return;
    const room = gameStore.get(ctx.roomId);
    if (!room) return;

    let state = room.getState();
    const amount = clampInt(payload.amount, 1, 999, 1);
    if (isString(payload.targetPlayerId) && payload.targetPlayerId) {
      state = healPlayer(state, payload.targetPlayerId, amount);
    } else if (isString(payload.targetInstanceId) && payload.targetInstanceId) {
      const slotIdx = state.monsterSlots.findIndex((s) =>
        s.stack.some((c) => c.instanceId === payload.targetInstanceId)
      );
      if (slotIdx >= 0) {
        state = healMonster(state, slotIdx, amount);
      }
    }

    room.setState(state);
    broadcastState(io, ctx.roomId);
  }));

  socket.on('action:share_hand', safeHandler<unknown>(socket, (raw) => {
    if (isRateLimited(socket.id)) return;
    if (!validatePayload(raw, ['withPlayerId'])) return sendError(socket, 'Invalid payload');
    const payload = raw as ShareHandPayload;

    const ctx = getCtx(socket);
    if (!ctx) return;
    if (rejectIfSpectator(socket, ctx)) return;
    const room = gameStore.get(ctx.roomId);
    if (!room) return;

    room.setState(shareHand(room.getState(), ctx.playerId, payload.withPlayerId));
    broadcastState(io, ctx.roomId);
  }));

  socket.on('action:revoke_hand_share', safeHandler<unknown>(socket, (raw) => {
    if (isRateLimited(socket.id)) return;
    if (!validatePayload(raw, ['withPlayerId'])) return sendError(socket, 'Invalid payload');
    const payload = raw as RevokeHandSharePayload;

    const ctx = getCtx(socket);
    if (!ctx) return;
    if (rejectIfSpectator(socket, ctx)) return;
    const room = gameStore.get(ctx.roomId);
    if (!room) return;

    room.setState(revokeHandShare(room.getState(), ctx.playerId, payload.withPlayerId));
    broadcastState(io, ctx.roomId);
  }));

  // ─── Counters ─────────────────────────────────────────────────────────────────

  socket.on('action:add_counter', safeHandler<unknown>(socket, (raw) => {
    if (isRateLimited(socket.id)) return;
    if (!validatePayload(raw, ['instanceId', 'counterType'], ['amount'])) return sendError(socket, 'Invalid payload');
    const payload = raw as CounterPayload;

    const ctx = getCtx(socket);
    if (!ctx) return;
    if (rejectIfSpectator(socket, ctx)) return;
    const room = gameStore.get(ctx.roomId);
    if (!room) return;

    room.setState(
      addCounter(room.getState(), payload.instanceId, payload.counterType, clampInt(payload.amount, 1, 999, 1))
    );
    broadcastState(io, ctx.roomId);
  }));

  socket.on('action:remove_counter', safeHandler<unknown>(socket, (raw) => {
    if (isRateLimited(socket.id)) return;
    if (!validatePayload(raw, ['instanceId', 'counterType'], ['amount'])) return sendError(socket, 'Invalid payload');
    const payload = raw as CounterPayload;

    const ctx = getCtx(socket);
    if (!ctx) return;
    if (rejectIfSpectator(socket, ctx)) return;
    const room = gameStore.get(ctx.roomId);
    if (!room) return;

    room.setState(
      removeCounter(room.getState(), payload.instanceId, payload.counterType, clampInt(payload.amount, 1, 999, 1))
    );
    broadcastState(io, ctx.roomId);
  }));

  // ─── Room ──────────────────────────────────────────────────────────────────────

  socket.on('action:discard_room', safeHandler<void>(socket, () => {
    if (isRateLimited(socket.id)) return;
    const ctx = getCtx(socket);
    if (!ctx) return;
    if (rejectIfSpectator(socket, ctx)) return;
    const room = gameStore.get(ctx.roomId);
    if (!room) return;

    room.setState(discardRoom(room.getState()));
    broadcastState(io, ctx.roomId);
  }));

  // ─── Deck browser ──────────────────────────────────────────────────────────────

  /** Give the player-curse card in a slot to a target player */
  socket.on('action:give_curse', safeHandler<unknown>(socket, (raw) => {
    if (isRateLimited(socket.id)) return;
    if (!validatePayload(raw, ['toPlayerId'], ['slotIndex'])) return sendError(socket, 'Invalid payload');
    const payload = raw as { slotIndex: number; toPlayerId: string };

    const ctx = getCtx(socket);
    if (!ctx) return;
    if (rejectIfSpectator(socket, ctx)) return;
    const room = gameStore.get(ctx.roomId);
    if (!room) return;

    const { newState, error } = giveCurse(room.getState(), payload.slotIndex, payload.toPlayerId);
    if (error) return sendError(socket, error);

    room.setState(newState);
    broadcastState(io, ctx.roomId);
  }));

  /** Resolve/discard an event or curse from the top of a monster slot */
  socket.on('action:resolve_event', safeHandler<unknown>(socket, (raw) => {
    if (isRateLimited(socket.id)) return;
    if (!validatePayload(raw, [], ['slotIndex'])) return sendError(socket, 'Invalid payload');
    const payload = raw as ResolveEventPayload;

    const ctx = getCtx(socket);
    if (!ctx) return;
    if (rejectIfSpectator(socket, ctx)) return;
    const room = gameStore.get(ctx.roomId);
    if (!room) return;

    const { newState, error } = resolveEventCard(room.getState(), payload.slotIndex, ctx.playerId);
    if (error) return sendError(socket, error);

    room.setState(newState);
    broadcastState(io, ctx.roomId);
  }));

  /** Add an extra monster or shop slot */
  socket.on('action:add_slot', safeHandler<unknown>(socket, (raw) => {
    if (isRateLimited(socket.id)) return;
    if (!validatePayload(raw, ['slotType'])) return sendError(socket, 'Invalid payload');
    const payload = raw as AddSlotPayload;
    if (!['monster', 'shop', 'room'].includes(payload.slotType)) return sendError(socket, 'Invalid slot type');

    const ctx = getCtx(socket);
    if (!ctx) return;
    if (rejectIfSpectator(socket, ctx)) return;
    const room = gameStore.get(ctx.roomId);
    if (!room) return;

    const state = room.getState();
    if (state.turn.activePlayerId !== ctx.playerId)
      return sendError(socket, 'Only the active player can expand slots');

    if (payload.slotType === 'monster') {
      const newSlotIndex = state.monsterSlots.length;
      const newSlots = [...state.monsterSlots, { slotIndex: newSlotIndex, stack: [] }];
      // Refill the new slot from monster deck
      let newState = { ...state, monsterSlots: newSlots };
      newState = refillMonsterSlot(newState, newSlotIndex);
      room.setState(newState);
    } else if (payload.slotType === 'shop') {
      const newSlotIndex = state.shopSlots.length;
      const { drawn, newDeck, newDiscard } = drawFromDeck(
        state.treasureDeck, state.treasureDiscard, 1
      );
      const newCard = drawn[0] ? createCardInPlay(drawn[0]) : null;
      room.setState({
        ...state,
        shopSlots: [...state.shopSlots, { slotIndex: newSlotIndex, card: newCard }],
        treasureDeck: newDeck,
        treasureDiscard: newDiscard,
      });
    } else {
      // room: draw a new room card and append it as a new slot
      if (state.roomDeck.length === 0) return sendError(socket, 'Room deck is empty');
      const { drawn, newDeck, newDiscard } = drawFromDeck(state.roomDeck, state.roomDiscard, 1);
      if (!drawn[0]) return sendError(socket, 'Room deck is empty');
      const newRoomCard = createCardInPlay(drawn[0]);
      room.setState({
        ...state,
        roomSlots: [...state.roomSlots, newRoomCard],
        roomDeck: newDeck,
        roomDiscard: newDiscard,
      });
    }

    broadcastState(io, ctx.roomId);
  }));

  /** Move an item (from player's items or shop) into the room area */
  socket.on('action:place_in_room', safeHandler<unknown>(socket, (raw) => {
    if (isRateLimited(socket.id)) return;
    if (!validatePayload(raw, ['instanceId'])) return sendError(socket, 'Invalid payload');
    const payload = raw as PlaceInRoomPayload;

    const ctx = getCtx(socket);
    if (!ctx) return;
    if (rejectIfSpectator(socket, ctx)) return;
    const room = gameStore.get(ctx.roomId);
    if (!room) return;

    const state = room.getState();
    const player = state.players.find((p) => p.id === ctx.playerId);
    if (!player) return;

    // Find the item in the player's items
    const itemIdx = player.items.findIndex((i) => i.instanceId === payload.instanceId);
    if (itemIdx === -1) return sendError(socket, 'Item not found in your items');

    const item = player.items[itemIdx];
    const newItems = player.items.filter((_, i) => i !== itemIdx);

    const log = createLogEntry(
      'info',
      `${player.name} places an item into the room area`,
      ctx.playerId
    );

    room.setState({
      ...state,
      players: state.players.map((p) =>
        p.id === ctx.playerId ? { ...p, items: newItems } : p
      ),
      roomSlots: [...state.roomSlots, item],
      log: [...state.log, log],
    });

    broadcastState(io, ctx.roomId);
  }));

  /** Return a card from the room area back to a player's items (active player only, no replacement draw) */
  socket.on('action:return_room_card', safeHandler<unknown>(socket, (raw) => {
    if (isRateLimited(socket.id)) return;
    if (!validatePayload(raw, ['instanceId', 'toPlayerId'])) return sendError(socket, 'Invalid payload');
    const payload = raw as ReturnRoomCardPayload;

    const ctx = getCtx(socket);
    if (!ctx) return;
    if (rejectIfSpectator(socket, ctx)) return;
    const room = gameStore.get(ctx.roomId);
    if (!room) return;

    const state = room.getState();
    if (state.turn.activePlayerId !== ctx.playerId)
      return sendError(socket, 'Only the active player can return room cards');

    const slot = state.roomSlots.find((s) => s.instanceId === payload.instanceId);
    if (!slot) return sendError(socket, 'Room card not found');

    const recipient = state.players.find((p) => p.id === payload.toPlayerId);
    if (!recipient) return sendError(socket, 'Player not found');

    const actingPlayer = state.players.find((p) => p.id === ctx.playerId);
    const log = createLogEntry(
      'info',
      `${actingPlayer?.name ?? ctx.playerId} returns a room card to ${recipient.name}'s items`,
      ctx.playerId
    );

    room.setState({
      ...state,
      roomSlots: state.roomSlots.filter((s) => s.instanceId !== payload.instanceId),
      players: state.players.map((p) =>
        p.id === payload.toPlayerId ? { ...p, items: [...p.items, slot] } : p
      ),
      log: [...state.log, log],
    });

    broadcastState(io, ctx.roomId);
  }));

  /** Remove a card from the room area (discard it) */
  socket.on('action:discard_room_slot', safeHandler<unknown>(socket, (raw) => {
    if (isRateLimited(socket.id)) return;
    if (!validatePayload(raw, ['instanceId'])) return sendError(socket, 'Invalid payload');
    const payload = raw as { instanceId: string };

    const ctx = getCtx(socket);
    if (!ctx) return;
    if (rejectIfSpectator(socket, ctx)) return;
    const room = gameStore.get(ctx.roomId);
    if (!room) return;

    const state = room.getState();
    if (!state.roomSlots.find((s) => s.instanceId === payload.instanceId)) {
      return sendError(socket, 'Room slot not found');
    }

    room.setState(discardRoomSlot(state, payload.instanceId));
    broadcastState(io, ctx.roomId);
  }));

  /** Attack the top of the monster deck — flips it into a slot */
  socket.on('action:attack_monster_deck', safeHandler<unknown>(socket, (raw) => {
    if (isRateLimited(socket.id)) return;
    const payload: { slotIndex: number } = isObject(raw) ? raw as any : { slotIndex: 0 };

    const ctx = getCtx(socket);
    if (!ctx) return;
    if (rejectIfSpectator(socket, ctx)) return;
    const room = gameStore.get(ctx.roomId);
    if (!room) return;

    const state = room.getState();
    if (state.turn.activePlayerId !== ctx.playerId)
      return sendError(socket, 'Not your turn');
    if (state.turn.currentAttack !== null)
      return sendError(socket, 'Attack already in progress');
    if (state.monsterDeck.length === 0)
      return sendError(socket, 'Monster deck is empty');

    const { drawn, newDeck, newDiscard } = drawFromDeck(state.monsterDeck, state.monsterDiscard, 1);
    if (!drawn[0]) return sendError(socket, 'Monster deck is empty');

    const newInstance = createCardInPlay(drawn[0]);
    const flippedCard = getCardById(drawn[0]);

    const slotIndex = isNumber(payload.slotIndex) ? payload.slotIndex : 0;
    const slot = state.monsterSlots[slotIndex] ?? state.monsterSlots[0];
    const resolvedSlotIndex = slot?.slotIndex ?? 0;

    const updatedSlots = state.monsterSlots.map((s) =>
      s.slotIndex === resolvedSlotIndex
        ? { ...s, stack: [...s.stack, newInstance] }
        : s
    );

    const player = state.players.find((p) => p.id === ctx.playerId);
    const log = createLogEntry(
      'attack',
      `${player?.name ?? ctx.playerId} flips ${flippedCard?.name ?? 'a monster'} from the deck into monster slot ${resolvedSlotIndex + 1}`,
      ctx.playerId
    );

    const newAttack = {
      attackerId: ctx.playerId,
      targetType: 'monster_slot' as const,
      targetSlotIndex: resolvedSlotIndex,
      phase: 'declared' as const,
      rollResult: null,
      teamUpPlayerIds: [],
      teamUpRolls: {},
    };

    // Push attack_declaration onto the stack so players can respond before the roll.
    // pushStack() handles priority reset from the attacker's seat position.
    const stateWithAttack = {
      ...state,
      monsterDeck: newDeck,
      monsterDiscard: newDiscard,
      monsterSlots: updatedSlots,
      turn: { ...state.turn, attacksDeclared: state.turn.attacksDeclared + 1, currentAttack: newAttack },
      log: [...state.log, log],
    };
    room.setState(pushStack(stateWithAttack, {
      type: 'attack_declaration',
      sourceCardInstanceId: newInstance.instanceId,
      sourcePlayerId: ctx.playerId,
      description: `${player?.name ?? ctx.playerId} attacks ${flippedCard?.name ?? 'monster'} (flipped from deck)`,
      targets: [newInstance.instanceId],
      data: { slotIndex: resolvedSlotIndex, monsterId: drawn[0] },
    }));

    broadcastState(io, ctx.roomId);
  }));

  /** Buy the top card of the treasure deck (blind purchase) */
  socket.on('action:buy_top_treasure', safeHandler<void>(socket, () => {
    if (isRateLimited(socket.id)) return;
    const ctx = getCtx(socket);
    if (!ctx) return;
    if (rejectIfSpectator(socket, ctx)) return;
    const room = gameStore.get(ctx.roomId);
    if (!room) return;

    const state = room.getState();
    if (state.turn.activePlayerId !== ctx.playerId)
      return sendError(socket, 'Not your turn');

    const player = state.players.find((p: { id: string }) => p.id === ctx.playerId);
    if (!player) return sendError(socket, 'Player not found');

    // Cost is base 10 — shop slot discount system not applicable here; just fixed 10
    const cost = 10;

    if (state.treasureDeck.length === 0)
      return sendError(socket, 'Treasure deck is empty');

    const { drawn, newDeck, newDiscard } = drawFromDeck(state.treasureDeck, state.treasureDiscard, 1);
    if (!drawn[0]) return sendError(socket, 'Treasure deck is empty');

    const card = getCardById(drawn[0]);
    const newInstance = createCardInPlay(drawn[0]);

    const log = createLogEntry(
      'purchase',
      `${player.name} buys ${card?.name ?? 'a card'} from the top of the treasure deck`,
      ctx.playerId
    );

    const newState = {
      ...state,
      treasureDeck: newDeck,
      treasureDiscard: newDiscard,
      players: state.players.map((p) =>
        p.id === ctx.playerId
          ? { ...p, items: [...p.items, newInstance] }
          : p
      ),
      log: [...state.log, log],
    };

    room.setState(newState);
    broadcastState(io, ctx.roomId);
  }));

  /** Update the cost of a shop slot (for discounts) */
  socket.on('action:set_shop_cost', safeHandler<unknown>(socket, (raw) => {
    if (isRateLimited(socket.id)) return;
    if (!validatePayload(raw, [], ['slotIndex', 'cost'])) return sendError(socket, 'Invalid payload');
    const payload = raw as { slotIndex: number; cost: number };

    const ctx = getCtx(socket);
    if (!ctx) return;
    if (rejectIfSpectator(socket, ctx)) return;
    const room = gameStore.get(ctx.roomId);
    if (!room) return;

    const state = room.getState();
    const updatedSlots = state.shopSlots.map((s) =>
      s.slotIndex === payload.slotIndex
        ? { ...s, cost: Math.max(0, payload.cost) }
        : s
    );
    room.setState({ ...state, shopSlots: updatedSlots });
    broadcastState(io, ctx.roomId);
  }));

  /** Send the full ordered deck contents to the requesting player only */
  socket.on('action:peek_deck', safeHandler<unknown>(socket, (raw) => {
    if (isRateLimited(socket.id)) return;
    if (!validatePayload(raw, ['deckType'])) return sendError(socket, 'Invalid payload');
    const payload = raw as { deckType: string; count?: number };

    const validDeckTypes = [
      'loot', 'treasure', 'monster', 'room', 'eternal',
      'discard_loot', 'discard_treasure', 'discard_monster', 'discard_room', 'discard_eternal',
    ];
    if (!validDeckTypes.includes(payload.deckType)) return sendError(socket, 'Invalid deck type');

    const ctx = getCtx(socket);
    if (!ctx) return;
    if (rejectIfSpectator(socket, ctx)) return;
    const room = gameStore.get(ctx.roomId);
    if (!room) return;

    const state = room.getState();
    let cardIds: string[] = [];
    switch (payload.deckType) {
      case 'loot':              cardIds = [...state.lootDeck].reverse(); break;      // top first
      case 'treasure':          cardIds = [...state.treasureDeck].reverse(); break;
      case 'monster':           cardIds = [...state.monsterDeck].reverse(); break;
      case 'room':              cardIds = [...state.roomDeck].reverse(); break;
      case 'eternal':           cardIds = [...state.eternalDeck].reverse(); break;
      case 'discard_loot':      cardIds = [...state.lootDiscard].reverse(); break;
      case 'discard_treasure':  cardIds = [...state.treasureDiscard].reverse(); break;
      case 'discard_monster':   cardIds = [...state.monsterDiscard].reverse(); break;
      case 'discard_room':      cardIds = [...state.roomDiscard].reverse(); break;
      case 'discard_eternal':   cardIds = [...state.eternalDiscard].reverse(); break;
    }

    // If a count limit is specified, only return that many (top X cards)
    const limit = isNumber(payload.count) && payload.count > 0 ? payload.count : undefined;
    const limited = limit ? cardIds.slice(0, limit) : cardIds;

    // Log the peek action (for non-discard peeks with a count limit)
    const isDiscard = payload.deckType.startsWith('discard_');
    if (!isDiscard && limit) {
      const player = state.players.find((p) => p.id === ctx.playerId);
      const logEntry = createLogEntry(
        'info',
        `${player?.name ?? 'Someone'} looks at the top ${limit} card${limit !== 1 ? 's' : ''} of the ${payload.deckType} deck`,
        ctx.playerId
      );
      room.setState({ ...state, log: [...state.log, logEntry] });
      // Broadcast the log update
      broadcastState(io, ctx.roomId);
    }

    socket.emit('deck:contents', { deckType: payload.deckType, cardIds: limited });
  }));

  /** Move a card within a deck or from discard back to deck */
  socket.on('action:reorder_deck', safeHandler<unknown>(socket, (raw) => {
    if (isRateLimited(socket.id)) return;
    if (!validatePayload(raw, ['deckType', 'cardId', 'position'])) return sendError(socket, 'Invalid payload');
    const payload = raw as { deckType: string; cardId: string; position: string };

    if (!['loot', 'treasure', 'monster'].includes(payload.deckType)) return sendError(socket, 'Invalid deck type');
    if (!['top', 'bottom'].includes(payload.position)) return sendError(socket, 'Invalid position');

    const ctx = getCtx(socket);
    if (!ctx) return;
    if (rejectIfSpectator(socket, ctx)) return;
    const room = gameStore.get(ctx.roomId);
    if (!room) return;

    const state = room.getState();
    const { deckType, cardId, position } = payload;

    type DeckKey = 'lootDeck' | 'treasureDeck' | 'monsterDeck';
    const deckKey: DeckKey = deckType === 'loot' ? 'lootDeck' : deckType === 'treasure' ? 'treasureDeck' : 'monsterDeck';

    const deck = state[deckKey];
    // Remove card from wherever it is in the deck
    const withoutCard = deck.filter((id) => id !== cardId);
    // Re-insert at position (top = last element, bottom = first element)
    const newDeck = position === 'top'
      ? [...withoutCard, cardId]
      : [cardId, ...withoutCard];

    room.setState({ ...state, [deckKey]: newDeck });
    broadcastState(io, ctx.roomId);
  }));

  /** Trade a card (item or hand card) to another player */
  socket.on('action:trade_card', safeHandler<unknown>(socket, (raw) => {
    if (isRateLimited(socket.id)) return;
    if (!validatePayload(raw, ['toPlayerId'])) return sendError(socket, 'Invalid payload');
    const payload = raw as TradeCardPayload;
    // instanceId or cardId must be present
    if (!isString(payload.instanceId) && !isString(payload.cardId))
      return sendError(socket, 'Must provide instanceId or cardId');

    const ctx = getCtx(socket);
    if (!ctx) return;
    if (rejectIfSpectator(socket, ctx)) return;
    const room = gameStore.get(ctx.roomId);
    if (!room) return;

    const { newState, error } = tradeCard(
      room.getState(),
      ctx.playerId,
      payload.toPlayerId,
      payload.instanceId,
      payload.cardId,
      payload.fromHand ?? false
    );
    if (error) return sendError(socket, error);

    room.setState(newState);
    broadcastState(io, ctx.roomId);
  }));

  // ─── Disconnect ────────────────────────────────────────────────────────────────

  socket.on('disconnect', () => {
    const ctx = socketPlayerMap.get(socket.id);
    cleanupRateLimit(socket.id);

    if (!ctx) return;

    const room = gameStore.get(ctx.roomId);
    if (room) {
      room.setConnected(ctx.playerId, false);
      broadcastState(io, ctx.roomId);

      // If all non-spectator players are now disconnected, schedule cleanup
      if (room.allDisconnected) {
        const phase = room.gamePhase;
        const delay = phase === 'lobby'  ? ROOM_TIMEOUT_LOBBY_MS
                    : phase === 'ended'  ? ROOM_TIMEOUT_ENDED_MS
                    : ROOM_TIMEOUT_ACTIVE_MS;
        gameStore.scheduleCleanup(ctx.roomId, delay);
      }
    }

    socketPlayerMap.delete(socket.id);
  });
}
