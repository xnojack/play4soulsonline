import { GameState, TurnState, LogEntry } from '../types';
import { createLogEntry } from '../GameRoom';
import { resetPriority, allPassedPriority, resolveTopOfStack, pushStack } from '../stack';
import { drawFromDeck, putOnTopOfDeck, putOnBottomOfDeck } from '../decks';
import { getCardById } from '../../db/cards';

/** Start the action phase (called after start-of-turn triggered abilities resolve) */
export function beginActionPhase(state: GameState): GameState {
  const newTurn: TurnState = {
    ...state.turn,
    phase: 'action',
    lootDrawn: false,
    lootPlaysRemaining: 1,
    purchasesMade: 0,
    attacksDeclared: 0,
    attacksRequired: 1,
    currentAttack: null,
    passedPriority: new Set<string>(),
  };
  const log = createLogEntry('phase', `Action phase begins`, state.turn.activePlayerId);
  return resetPriority({ ...state, turn: newTurn, log: [...state.log, log] });
}

/** End the active player's turn and advance to the next player */
export function endTurn(state: GameState): GameState {
  if (state.stack.length > 0) return state; // can't end turn with items on stack

  // Revive any player whose HP has been restored above 0 (e.g. healed by a card effect)
  const revivedState = {
    ...state,
    players: state.players.map((p) => {
      if (!p.isAlive && p.baseHp + p.hpCounters - p.currentDamage > 0) {
        return { ...p, isAlive: true };
      }
      return p;
    }),
  };

  const alivePlayers = revivedState.players.filter((p) => !p.isSpectator && p.isAlive);
  if (alivePlayers.length === 0) return revivedState;

  const currentIdx = alivePlayers.findIndex((p) => p.id === revivedState.turn.activePlayerId);
  const nextIdx = (currentIdx + 1) % alivePlayers.length;
  const nextPlayer = alivePlayers[nextIdx];

  // Recharge all items (including character card) for the incoming player at the start of their turn
  const recharged = rechargePlayerItems(revivedState, nextPlayer.id);

  const log = createLogEntry(
    'phase',
    `${nextPlayer.name}'s turn begins`,
    nextPlayer.id
  );

  const newTurn: TurnState = {
    activePlayerId: nextPlayer.id,
    phase: 'start',
    lootDrawn: false,
    lootPlaysRemaining: 1,
    purchasesMade: 0,
    attacksDeclared: 0,
    attacksRequired: 1,
    currentAttack: null,
    passedPriority: new Set<string>(),
  };

  const newState = resetPriority({
    ...recharged,
    turn: newTurn,
    log: [...recharged.log, log],
  });

  // Immediately transition to action phase (start phase triggers are manual)
  return beginActionPhase(newState);
}

/** Recharge all items controlled by a player */
export function rechargePlayerItems(state: GameState, playerId: string): GameState {
  const players = state.players.map((p) => {
    if (p.id !== playerId) return p;
    return {
      ...p,
      items: p.items.map((item) => ({ ...item, charged: true })),
    };
  });

  // Also recharge character card
  const player = players.find((p) => p.id === playerId);
  const charInstance = player
    ? state.characterCards[player.characterInstanceId]
    : null;
  const newCharCards = charInstance
    ? {
        ...state.characterCards,
        [charInstance.instanceId]: { ...charInstance, charged: true },
      }
    : state.characterCards;

  return { ...state, players, characterCards: newCharCards };
}

/** Player draws N loot cards */
export function drawLoot(
  state: GameState,
  playerId: string,
  count: number
): GameState {
  const { drawn, newDeck, newDiscard } = drawFromDeck(
    state.lootDeck,
    state.lootDiscard,
    count
  );

  if (drawn.length === 0) return state;

  const player = state.players.find((p) => p.id === playerId);
  const playerName = player?.name ?? playerId;

  const players = state.players.map((p) =>
    p.id === playerId
      ? { ...p, handCardIds: [...p.handCardIds, ...drawn] }
      : p
  );

  // Mark the turn's loot draw as done when the active player draws
  const isActivePlayer = state.turn.activePlayerId === playerId;
  const newTurn = isActivePlayer && !state.turn.lootDrawn
    ? { ...state.turn, lootDrawn: true }
    : state.turn;

  const log = createLogEntry(
    'card_play',
    `${playerName} looted ${drawn.length} card${drawn.length !== 1 ? 's' : ''}`,
    playerId
  );

  return {
    ...state,
    players,
    turn: newTurn,
    lootDeck: newDeck,
    lootDiscard: newDiscard,
    log: [...state.log, log],
  };
}

/** Play a loot card from hand (puts it on the stack) */
export function playLootCard(
  state: GameState,
  playerId: string,
  cardId: string,
  targets: string[]
): { newState: GameState; error: string | null } {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return { newState: state, error: 'Player not found' };

  const isActivePlayer = state.turn.activePlayerId === playerId;
  // Non-active players are gated by lootPlaysRemaining; the active player
  // can always play loot while they have priority (counter tracks net plays,
  // can go negative if they've spent more than their base allotment via abilities).
  if (!isActivePlayer && state.turn.lootPlaysRemaining <= 0)
    return { newState: state, error: 'No loot plays remaining' };

  if (!player.handCardIds.includes(cardId))
    return { newState: state, error: 'Card not in hand' };

  // Remove from hand
  const newHandCardIds = player.handCardIds.filter((id) => id !== cardId);
  const players = state.players.map((p) =>
    p.id === playerId ? { ...p, handCardIds: newHandCardIds } : p
  );

  // Decrement loot plays
  const newTurn = {
    ...state.turn,
    lootPlaysRemaining: state.turn.lootPlaysRemaining - 1,
  };

  const card = getCardById(cardId);
  const cardName = card?.name ?? cardId;
  const playerName = player.name;

  // Put loot on stack
  const stateWithPlayers = { ...state, players, turn: newTurn };

  const log = createLogEntry('card_play', `${playerName} plays ${cardName}`, playerId);

  const newState = pushStack(
    { ...stateWithPlayers, log: [...stateWithPlayers.log, log] },
    {
      type: 'loot' as const,
      sourceCardInstanceId: cardId,
      sourcePlayerId: playerId,
      description: `${playerName} plays ${cardName}`,
      targets,
      data: { cardId, toDiscard: true },
    }
  );

  return { newState, error: null };
}

/** Discard a loot card from hand */
export function discardLoot(
  state: GameState,
  playerId: string,
  cardId: string
): GameState {
  const player = state.players.find((p) => p.id === playerId);
  if (!player || !player.handCardIds.includes(cardId)) return state;

  const players = state.players.map((p) =>
    p.id === playerId
      ? { ...p, handCardIds: p.handCardIds.filter((id) => id !== cardId) }
      : p
  );

  const card = getCardById(cardId);
  const log = createLogEntry(
    'card_play',
    `${player.name} discards ${card?.name ?? cardId}`,
    playerId
  );

  return {
    ...state,
    players,
    lootDiscard: [...state.lootDiscard, cardId],
    log: [...state.log, log],
  };
}

/** Return a card from hand (or discard) back to a deck */
export function returnToDeck(
  state: GameState,
  playerId: string,
  cardId: string,
  deckType: 'loot' | 'treasure' | 'monster',
  position: 'top' | 'bottom',
  fromHand: boolean
): GameState {
  let newState = state;

  // Remove from hand if requested
  if (fromHand) {
    const player = state.players.find((p) => p.id === playerId);
    if (!player || !player.handCardIds.includes(cardId)) return state;
    newState = {
      ...newState,
      players: newState.players.map((p) =>
        p.id === playerId
          ? { ...p, handCardIds: p.handCardIds.filter((id) => id !== cardId) }
          : p
      ),
    };
  }

  const placeOnDeck = position === 'top' ? putOnTopOfDeck : putOnBottomOfDeck;
  const card = getCardById(cardId);
  const player = state.players.find((p) => p.id === playerId);
  const log = createLogEntry(
    'card_play',
    `${player?.name ?? 'Someone'} puts ${card?.name ?? cardId} on the ${position} of the ${deckType} deck`,
    playerId
  );

  switch (deckType) {
    case 'loot':
      return {
        ...newState,
        lootDeck: placeOnDeck(newState.lootDeck, cardId),
        log: [...newState.log, log],
      };
    case 'treasure':
      return {
        ...newState,
        treasureDeck: placeOnDeck(newState.treasureDeck, cardId),
        log: [...newState.log, log],
      };
    case 'monster':
      return {
        ...newState,
        monsterDeck: placeOnDeck(newState.monsterDeck, cardId),
        log: [...newState.log, log],
      };
    default:
      return state;
  }
}
