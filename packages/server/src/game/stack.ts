import { v4 as uuidv4 } from 'uuid';
import { GameState, StackItem, StackItemType, LogEntry } from './types';
import { createLogEntry } from './GameRoom';
import { getCardById } from '../db/cards';
import { createCardInPlay } from './decks';
import { applyDeathPenalty } from './actions/monsters';

/** Push a new item onto the top of the stack */
export function pushStack(
  state: GameState,
  item: Omit<StackItem, 'id' | 'isCanceled'>
): GameState {
  const newItem: StackItem = { ...item, id: uuidv4(), isCanceled: false };

  // When something is pushed, priority resets to the player who pushed it
  const pusherIndex = state.players
    .filter((p) => !p.isSpectator && p.isAlive)
    .findIndex((p) => p.id === item.sourcePlayerId);

  const alivePlayers = state.players.filter((p) => !p.isSpectator && p.isAlive);
  const newQueue: string[] =
    pusherIndex >= 0
      ? [
          ...alivePlayers.slice(pusherIndex).map((p) => p.id),
          ...alivePlayers.slice(0, pusherIndex).map((p) => p.id),
        ]
      : alivePlayers.map((p) => p.id);

  // Reset passed-priority tracking
  const newTurn = {
    ...state.turn,
    passedPriority: new Set<string>(),
  };

  const log = createLogEntry('stack', `${item.description} added to stack`, item.sourcePlayerId);

  const resultState: GameState = {
    ...state,
    stack: [...state.stack, newItem],
    priorityQueue: newQueue,
    turn: newTurn,
    log: [...state.log, log],
  };

  // Start a timeout for the player who now has priority (skip active player)
  return startPriorityTimeout(resultState, newQueue[0]);
}

/** Push a player's death onto the stack.
 *  Death goes on the stack when a player reaches 0 HP.
 *  Returns { newState, deathStackItemId } or null if death already on stack or player already dead this turn. */
export function pushDeathToStack(state: GameState, dyingPlayerId: string): {
  newState: GameState;
  deathStackItemId: string;
} | null {
  const player = state.players.find((p) => p.id === dyingPlayerId);
  if (!player) return null;

  // Can't die twice on the same turn
  if (player.deadThisTurn) return null;

  // Death already on the stack for this player
  if (state.stack.some((s) => s.type === 'death' && !s.isCanceled && s.data.playerId === dyingPlayerId)) {
    return null;
  }

  const deathItem: StackItem = {
    id: uuidv4(),
    type: 'death',
    sourceCardInstanceId: dyingPlayerId,
    sourcePlayerId: dyingPlayerId,
    description: `${player.name}'s death`,
    targets: [dyingPlayerId],
    data: { playerId: dyingPlayerId },
    isCanceled: false,
  };

  // Priority: start from the dying player so others can respond
  const alivePlayers = state.players.filter((p) => !p.isSpectator && p.isAlive);
  const dyingIdx = alivePlayers.findIndex((p) => p.id === dyingPlayerId);
  const newQueue: string[] =
    dyingIdx >= 0
      ? [
          ...alivePlayers.slice(dyingIdx).map((p) => p.id),
          ...alivePlayers.slice(0, dyingIdx).map((p) => p.id),
        ]
      : alivePlayers.map((p) => p.id);

  const log = createLogEntry(
    'death',
    `${player.name} has 0 HP — death added to stack`,
    dyingPlayerId
  );

  const newState: GameState = {
    ...state,
    stack: [...state.stack, deathItem],
    priorityQueue: newQueue,
    turn: {
      ...state.turn,
      passedPriority: new Set<string>(),
    },
    log: [...state.log, log],
  };

  return {
    newState: startPriorityTimeout(newState, newQueue[0]),
    deathStackItemId: deathItem.id,
  };
}

/** Cancel a specific stack item by ID */
export function cancelStackItem(state: GameState, stackItemId: string): GameState {
  const targetItem = state.stack.find((item) => item.id === stackItemId);
  let newState: GameState;

  if (targetItem && targetItem.type === 'loot') {
    const cardId = targetItem.data.cardId as string | undefined;
    if (cardId) {
      const sourcePlayerId = targetItem.sourcePlayerId;
      newState = {
        ...state,
        stack: state.stack.map((item) =>
          item.id === stackItemId ? { ...item, isCanceled: true } : item
        ),
        players: state.players.map((p) =>
          p.id === sourcePlayerId
            ? { ...p, handCardIds: [...p.handCardIds, cardId] }
            : p
        ),
      };
      const log = createLogEntry(
        'card_play',
        `${state.players.find((p) => p.id === sourcePlayerId)?.name ?? 'Player'}'s loot card returns to their hand`,
        sourcePlayerId
      );
      return { ...newState, log: [...newState.log, log] };
    }
  }

  if (targetItem && targetItem.type === 'death') {
    const dyingPlayerId = targetItem.data.playerId as string;
    const dyingPlayer = state.players.find((p) => p.id === dyingPlayerId);
    if (dyingPlayer) {
      // Canceling death: heal to 1 HP
      const newDamage = dyingPlayer.baseHp + dyingPlayer.hpCounters - 1;
      newState = {
        ...state,
        stack: state.stack.map((item) =>
          item.id === stackItemId ? { ...item, isCanceled: true } : item
        ),
        players: state.players.map((p) =>
          p.id === dyingPlayerId
            ? { ...p, currentDamage: newDamage, isAlive: true }
            : p
        ),
      };
      const log = createLogEntry(
        'death',
        `${dyingPlayer.name}'s death was prevented — healed to 1 HP`,
        dyingPlayerId
      );
      return { ...newState, log: [...newState.log, log] };
    }
  }

  const updated = state.stack.map((item) =>
    item.id === stackItemId ? { ...item, isCanceled: true } : item
  );
  const log = createLogEntry('stack', `Stack item canceled`, null);
  return { ...state, stack: updated, log: [...state.log, log] };
}

/** Resolve the top (last) non-canceled stack item.
 *  Returns the resolved item + new state (with item removed from stack). */
export function resolveTopOfStack(state: GameState): {
  resolved: StackItem | null;
  newState: GameState;
} {
  // Find top non-canceled item (last in array)
  let topIndex = -1;
  for (let i = state.stack.length - 1; i >= 0; i--) {
    if (!state.stack[i].isCanceled) {
      topIndex = i;
      break;
    }
  }

  if (topIndex === -1) {
    // No resolvable items; clear canceled items
    return { resolved: null, newState: { ...state, stack: [] } };
  }

  const resolved = state.stack[topIndex];
  const newStack = state.stack.filter((_, i) => i !== topIndex);

  const log = createLogEntry(
    'stack',
    `Resolved: ${resolved.description}`,
    resolved.sourcePlayerId
  );

  let newState: GameState = { ...state, stack: newStack, log: [...state.log, log] };

  // Handle loot card resolution — if canceled, return to the player's hand;
  // otherwise trinkets go to the player's items, other loot goes to discard
  if (resolved.type === 'loot') {
    const cardId = resolved.data.cardId as string | undefined;
    if (cardId) {
      if (resolved.isCanceled) {
        // Canceled: give the card back to the player's hand
        const returnLog = createLogEntry(
          'card_play',
          `${state.players.find((p) => p.id === resolved.sourcePlayerId)?.name ?? 'Player'}'s loot card returns to their hand`,
          resolved.sourcePlayerId
        );
        newState = {
          ...newState,
          players: newState.players.map((p) =>
            p.id === resolved.sourcePlayerId
              ? { ...p, handCardIds: [...p.handCardIds, cardId] }
              : p
          ),
          log: [...newState.log, returnLog],
        };
      } else {
        const card = getCardById(cardId);
        if (card?.subType === 'Trinket') {
          const newItem = createCardInPlay(cardId);
          const trinketLog = createLogEntry(
            'card_play',
            `${card.name} goes to ${state.players.find((p) => p.id === resolved.sourcePlayerId)?.name ?? 'player'}'s items`,
            resolved.sourcePlayerId
          );
          newState = {
            ...newState,
            players: newState.players.map((p) =>
              p.id === resolved.sourcePlayerId
                ? { ...p, items: [...p.items, newItem] }
                : p
            ),
            log: [...newState.log, trinketLog],
          };
        } else {
          newState = { ...newState, lootDiscard: [...newState.lootDiscard, cardId] };
        }
      }
    }
  }

  // If the attack declaration was canceled, void the attack
  if (resolved.type === 'attack_declaration' && resolved.isCanceled) {
    const cancelLog = createLogEntry('attack', 'Attack was canceled', resolved.sourcePlayerId);
    newState = {
      ...newState,
      turn: { ...newState.turn, currentAttack: null },
      log: [...newState.log, cancelLog],
    };
  }

  // Handle death resolution
  if (resolved.type === 'death' && !resolved.isCanceled) {
    const dyingPlayerId = resolved.data.playerId as string;
    const dyingPlayer = newState.players.find((p) => p.id === dyingPlayerId);

    if (dyingPlayer) {
      // Cancel any active attack involving this player
      if (newState.turn.currentAttack) {
        const attackLog = createLogEntry(
          'attack',
          `Attack canceled due to ${dyingPlayer.name}'s death`,
          dyingPlayerId
        );
        newState = {
          ...newState,
          turn: { ...newState.turn, currentAttack: null },
          log: [...newState.log, attackLog],
        };
      }

      // Mark player as dead
      newState = {
        ...newState,
        players: newState.players.map((p) =>
          p.id === dyingPlayerId
            ? {
                ...p,
                isAlive: false,
                deathCount: p.deathCount + 1,
                currentDamage: 0,
                deadThisTurn: true,
              }
            : p
        ),
      };

      const deathLog = createLogEntry(
        'death',
        `${dyingPlayer.name} has died!`,
        dyingPlayerId
      );
      newState = { ...newState, log: [...newState.log, deathLog] };

      // D8 death tick
      if (newState.d8Timer !== null) {
        newState = {
          ...newState,
          d8Timer: Math.max(0, newState.d8Timer - 1),
        };
      }

      // If active player: set deathPenaltyPending so player can choose item
      if (newState.turn.activePlayerId === dyingPlayerId) {
        newState = {
          ...newState,
          turn: { ...newState.turn, deathPenaltyPending: dyingPlayerId },
        };
      } else {
        // Non-active player: auto-apply death penalty
        newState = applyDeathPenalty(newState, dyingPlayerId);
      }
    }
  }

  return {
    resolved,
    newState,
  };
}

/** Check if all active players have passed priority (stack top ready to resolve) */
export function allPassedPriority(state: GameState): boolean {
  const alivePlayers = state.players.filter((p) => !p.isSpectator && p.isAlive);
  return alivePlayers.every((p) => state.turn.passedPriority.has(p.id));
}

/** Mark a player as passing priority; return next player who has priority */
export function passPriority(state: GameState, playerId: string): GameState {
  // Clear any active timeout first
  let s = clearPriorityTimeout(state);

  const newPassed = new Set(s.turn.passedPriority);
  newPassed.add(playerId);

  const alivePlayers = s.players.filter((p) => !p.isSpectator && p.isAlive);

  // Advance the priority queue
  const currentIdx = s.priorityQueue.indexOf(playerId);
  let newQueue = [...s.priorityQueue];
  if (currentIdx >= 0) {
    // Rotate: move this player to the end
    newQueue = [...newQueue.slice(currentIdx + 1), ...newQueue.slice(0, currentIdx + 1)];
  }

  // If new front of queue has already passed, keep rotating until we find someone who hasn't
  // (or we've gone all the way around — then all passed)
  let rotations = 0;
  while (
    newQueue.length > 0 &&
    newPassed.has(newQueue[0]) &&
    rotations < alivePlayers.length
  ) {
    newQueue = [...newQueue.slice(1), newQueue[0]];
    rotations++;
  }

  s = {
    ...s,
    priorityQueue: newQueue,
    turn: { ...s.turn, passedPriority: newPassed },
  };

  // Start a timeout for the next player in queue (skip if it's the active player or all passed)
  if (newQueue.length > 0 && !newPassed.has(newQueue[0])) {
    s = startPriorityTimeout(s, newQueue[0]);
  }

  return s;
}

/** Reset priority to the active player (start of turn, after resolution) */
export function resetPriority(state: GameState): GameState {
  // Clear any active timeout
  let s = clearPriorityTimeout(state);

  const alivePlayers = s.players.filter((p) => !p.isSpectator && p.isAlive);
  const activeIdx = alivePlayers.findIndex((p) => p.id === s.turn.activePlayerId);
  const queue =
    activeIdx >= 0
      ? [
          ...alivePlayers.slice(activeIdx).map((p) => p.id),
          ...alivePlayers.slice(0, activeIdx).map((p) => p.id),
        ]
      : alivePlayers.map((p) => p.id);

  return {
    ...s,
    priorityQueue: queue,
    turn: { ...s.turn, passedPriority: new Set<string>() },
  };
}

/** Get which player currently has priority */
export function currentPriorityPlayerId(state: GameState): string | null {
  return state.priorityQueue[0] ?? null;
}

// ─── Priority timeout helpers ─────────────────────────────────────────────────

/** Start a priority timeout for a specific player.
 *  No-op if timeout is disabled (priorityTimeoutMs <= 0) or if it's the active player. */
export function startPriorityTimeout(state: GameState, playerId: string): GameState {
  if (state.priorityTimeoutMs <= 0) return state;
  // Active player never has a timeout
  if (playerId === state.turn.activePlayerId) return state;
  return {
    ...state,
    turn: {
      ...state.turn,
      priorityTimeoutPlayerId: playerId,
      priorityTimeoutDeadline: Date.now() + state.priorityTimeoutMs,
    },
  };
}

/** Clear any active priority timeout. */
export function clearPriorityTimeout(state: GameState): GameState {
  if (!state.turn.priorityTimeoutPlayerId && !state.turn.priorityTimeoutDeadline) return state;
  return {
    ...state,
    turn: {
      ...state.turn,
      priorityTimeoutPlayerId: undefined,
      priorityTimeoutDeadline: undefined,
    },
  };
}
