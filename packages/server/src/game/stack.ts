import { v4 as uuidv4 } from 'uuid';
import { GameState, StackItem, StackItemType, LogEntry } from './types';
import { createLogEntry } from './GameRoom';
import { getCardById } from '../db/cards';
import { createCardInPlay } from './decks';

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

  return {
    ...state,
    stack: [...state.stack, newItem],
    priorityQueue: newQueue,
    turn: newTurn,
    log: [...state.log, log],
  };
}

/** Cancel a specific stack item by ID */
export function cancelStackItem(state: GameState, stackItemId: string): GameState {
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
  const newPassed = new Set(state.turn.passedPriority);
  newPassed.add(playerId);

  const alivePlayers = state.players.filter((p) => !p.isSpectator && p.isAlive);

  // Advance the priority queue
  const currentIdx = state.priorityQueue.indexOf(playerId);
  let newQueue = [...state.priorityQueue];
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

  return {
    ...state,
    priorityQueue: newQueue,
    turn: { ...state.turn, passedPriority: newPassed },
  };
}

/** Reset priority to the active player (start of turn, after resolution) */
export function resetPriority(state: GameState): GameState {
  const alivePlayers = state.players.filter((p) => !p.isSpectator && p.isAlive);
  const activeIdx = alivePlayers.findIndex((p) => p.id === state.turn.activePlayerId);
  const queue =
    activeIdx >= 0
      ? [
          ...alivePlayers.slice(activeIdx).map((p) => p.id),
          ...alivePlayers.slice(0, activeIdx).map((p) => p.id),
        ]
      : alivePlayers.map((p) => p.id);

  return {
    ...state,
    priorityQueue: queue,
    turn: { ...state.turn, passedPriority: new Set<string>() },
  };
}

/** Get which player currently has priority */
export function currentPriorityPlayerId(state: GameState): string | null {
  return state.priorityQueue[0] ?? null;
}
