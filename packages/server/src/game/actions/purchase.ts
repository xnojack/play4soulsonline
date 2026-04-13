import { GameState, CardInPlay } from '../types';
import { createLogEntry } from '../GameRoom';
import { drawFromDeck, createCardInPlay } from '../decks';
import { getCardById } from '../../db/cards';
import { DEFAULT_SHOP_SLOTS } from '../../config';

/** Purchase a shop item */
export function purchaseItem(
  state: GameState,
  playerId: string,
  slotIndex: number
): { newState: GameState; error: string | null } {
  if (state.turn.activePlayerId !== playerId)
    return { newState: state, error: 'Not your turn' };

  const slot = state.shopSlots[slotIndex];
  if (!slot || !slot.card)
    return { newState: state, error: 'No item in that shop slot' };

  const card = getCardById(slot.card.cardId);
  // Use per-slot cost override; default is 10¢ (but coins are not enforced — manual game)
  const cost = slot.cost ?? 10;

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return { newState: state, error: 'Player not found' };

  const purchasedCard = { ...slot.card };
  // Reset cost override when slot is refilled
  const newShopSlots = state.shopSlots.map((s) =>
    s.slotIndex === slotIndex ? { ...s, card: null, cost: undefined } : s
  );

  const label = cost === 0
    ? `${player.name} takes ${card?.name ?? 'an item'} for free`
    : `${player.name} takes ${card?.name ?? 'an item'} (cost: ${cost}¢ — apply manually)`;

  const log = createLogEntry('purchase', label, playerId);

  const players = state.players.map((p) =>
    p.id === playerId
      ? { ...p, items: [...p.items, purchasedCard] }
      : p
  );

  const newState = {
    ...state,
    players,
    shopSlots: newShopSlots,
    log: [...state.log, log],
    turn: { ...state.turn, purchasesMade: state.turn.purchasesMade + 1 },
  };

  // Refill the slot
  return { newState: refillShopSlot(newState, slotIndex), error: null };
}

/** Draw a treasure card from the deck and place it in a shop slot */
export function refillShopSlot(state: GameState, slotIndex: number): GameState {
  const { drawn, newDeck, newDiscard } = drawFromDeck(
    state.treasureDeck,
    state.treasureDiscard,
    1
  );

  if (!drawn[0]) return state;

  const newCard = createCardInPlay(drawn[0]);
  const card = getCardById(drawn[0]);

  const updatedSlots = state.shopSlots.map((s) =>
    s.slotIndex === slotIndex ? { ...s, card: newCard, cost: undefined } : s
  );

  const log = createLogEntry(
    'info',
    `${card?.name ?? 'A new item'} appears in the shop`,
    null
  );

  return {
    ...state,
    treasureDeck: newDeck,
    treasureDiscard: newDiscard,
    shopSlots: updatedSlots,
    log: [...state.log, log],
  };
}

/** Gain a treasure card directly (not from shop) */
export function gainTreasure(
  state: GameState,
  playerId: string,
  count: number
): GameState {
  const { drawn, newDeck, newDiscard } = drawFromDeck(
    state.treasureDeck,
    state.treasureDiscard,
    count
  );

  if (drawn.length === 0) return state;

  const player = state.players.find((p) => p.id === playerId);
  const newItems = drawn.map((id) => createCardInPlay(id));
  const cardNames = drawn.map((id) => getCardById(id)?.name ?? id).join(', ');

  const players = state.players.map((p) =>
    p.id === playerId ? { ...p, items: [...p.items, ...newItems] } : p
  );

  const log = createLogEntry(
    'info',
    `${player?.name ?? playerId} gains ${cardNames}`,
    playerId
  );

  return {
    ...state,
    players,
    treasureDeck: newDeck,
    treasureDiscard: newDiscard,
    log: [...state.log, log],
  };
}
