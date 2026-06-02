import { GameState } from '../../store/gameStore';
import { getCardFromCache } from './CardResolver';
import { getSocket } from '../../socket/client';

export interface UniversalDrag {
  cardId: string;
  instanceId?: string;
  sourceZone: string;
  sourceZoneId?: string;
}

export interface UniversalDrop {
  targetZone: string;
  targetZoneId?: string;
}

export interface DropAction {
  action: string;
  payload: Record<string, unknown>;
  label: string;
  /** When present, called instead of socket.emit(action, payload) */
  onClick?: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Infer the matching deck type for a card based on its cardType */
function inferDeckType(cardId: string): 'loot' | 'treasure' | 'monster' | 'room' | null {
  const card = getCardFromCache(cardId);
  if (!card) return null;
  switch (card.cardType) {
    case 'Loot': return 'loot';
    case 'Treasure': return 'treasure';
    case 'Monster': return 'monster';
    case 'Room': return 'room';
    default: return null;
  }
}

/** Validate that a card can go into the given deck type */
function cardMatchesDeck(cardId: string, deckType: 'loot' | 'treasure' | 'monster' | 'room'): boolean {
  const card = getCardFromCache(cardId);
  if (!card) return true; // unknown card — allow, server will validate
  const ct = card.cardType;
  switch (deckType) {
    case 'loot':     return ct === 'Loot';
    case 'treasure': return ct === 'Treasure' || (card as any).isEternal === true;
    case 'monster':  return ct === 'Monster';
    case 'room':     return ct === 'Room';
  }
}

/**
 * Build 5 return-to-deck actions (Top, Top+offset, Bottom, Bottom+offset, Random).
 * Type-guard: if the card is known and doesn't match the deck, returns [].
 */
function returnToDeckActions(
  cardId: string,
  deckType: 'loot' | 'treasure' | 'monster' | 'room',
  opts: { fromHand?: boolean; fromDiscard?: boolean; fromInstanceId?: string; stackItemId?: string },
): DropAction[] {
  if (!cardMatchesDeck(cardId, deckType)) return [];
  const base = { cardId, deckType, ...opts };
  return [
    { action: 'action:return_to_deck', payload: { ...base, position: 'top' }, label: 'Top of Deck' },
    {
      action: 'action:return_to_deck',
      payload: {},
      label: 'Top, offset…',
      onClick: () => {
        const raw = window.prompt('How many from the top? (1 = just under top)');
        if (raw === null) return;
        const offset = parseInt(raw, 10);
        if (isNaN(offset) || offset < 1) return;
        getSocket().emit('action:return_to_deck', { ...base, position: 'top', offset });
      },
    },
    { action: 'action:return_to_deck', payload: { ...base, position: 'bottom' }, label: 'Bottom of Deck' },
    {
      action: 'action:return_to_deck',
      payload: {},
      label: 'Bottom, offset…',
      onClick: () => {
        const raw = window.prompt('How many from the bottom? (1 = just above bottom)');
        if (raw === null) return;
        const offset = parseInt(raw, 10);
        if (isNaN(offset) || offset < 1) return;
        getSocket().emit('action:return_to_deck', { ...base, position: 'bottom', offset });
      },
    },
    { action: 'action:return_to_deck', payload: { ...base, position: 'random' }, label: 'Random' },
  ];
}

/** Deck sentinel — dragging a deck face emits a draw action for the local player */
export const DECK_TOP_SENTINEL = '__deck_top__';

function deckDragToHandActions(sourceZoneId: string, myId: string): DropAction[] {
  switch (sourceZoneId) {
    case 'loot':
      return [{ action: 'action:draw_loot', payload: { playerId: myId, count: 1 }, label: 'Draw Loot' }];
    case 'treasure':
      return [{ action: 'action:gain_treasure', payload: { count: 1 }, label: 'Gain Treasure' }];
    case 'eternal':
      return [{ action: 'action:gain_eternal', payload: { playerId: myId }, label: 'Gain Eternal Item' }];
    case 'monster':
      return [{ action: 'action:draw_from_deck', payload: { deckType: 'monster' }, label: 'Draw Monster to Hand' }];
    case 'room':
      return [{ action: 'action:draw_from_deck', payload: { deckType: 'room' }, label: 'Draw Room to Hand' }];
    default:
      return [];
  }
}

// ── Main resolver ─────────────────────────────────────────────────────────────

export function resolveDropActions(
  drag: UniversalDrag,
  drop: UniversalDrop,
  game: GameState | null,
): DropAction[] {
  if (!game) return [];

  const actions: DropAction[] = [];
  const myId = game.myPlayerId;
  const targetPlayerId = drop.targetZoneId;
  const isOwnPlayer = targetPlayerId === myId;
  const priv = game.allowPrivilegedActions;

  // ── Helpers scoped to this resolution ──

  const addPrivileged = (
    action: string,
    payload: Record<string, unknown>,
    label: string,
  ) => {
    if (priv) actions.push({ action, payload, label: `${label} [Override]` });
  };

  /**
   * Add room drop actions for a card being moved into the room area.
   * - Dropped on empty area (no targetZoneId): single "Place in Room" → auto-executes
   * - Dropped on occupied slot (targetZoneId = slot instanceId): "Add to Room" + "Replace [card]"
   * instanceId = CardInPlay instanceId (non-hand sources); cardId = for hand source
   */
  const addRoomDrop = (instanceId?: string, cardId?: string) => {
    const replaceInstanceId = drop.targetZoneId;
    const placePayload: Record<string, unknown> = {};
    if (instanceId) placePayload.instanceId = instanceId;
    else if (cardId) placePayload.cardId = cardId;

    actions.push({ action: 'action:place_in_room', payload: placePayload, label: 'Add to Room' });

    if (replaceInstanceId) {
      const existingSlot = game.roomSlots.find((s) => s.instanceId === replaceInstanceId);
      const existingName = existingSlot ? (getCardFromCache(existingSlot.cardId)?.name ?? 'card') : 'card';
      const replacePayload: Record<string, unknown> = { replaceInstanceId };
      if (instanceId) replacePayload.newInstanceId = instanceId;
      else if (cardId) replacePayload.newCardId = cardId;
      actions.push({ action: 'action:replace_room_slot', payload: replacePayload, label: `Replace ${existingName}` });
    }
  };

  // ── Hand card drops ──────────────────────────────────────────────────────────
  if (drag.sourceZone === 'hand') {
    if (drop.targetZone === 'stack') {
      actions.push({ action: 'action:play_loot', payload: { cardId: drag.cardId, targets: [] }, label: 'Play' });
    }
    if (drop.targetZone === 'items') {
      const tp = game.players.find((p) => p.id === targetPlayerId);
      actions.push({ action: 'action:move_to_items', payload: { cardId: drag.cardId, targetPlayerId }, label: `Move to ${tp?.name ?? '?'}'s Items` });
    }
    if (drop.targetZone === 'discard') {
      actions.push({ action: 'action:discard_loot', payload: { cardId: drag.cardId }, label: 'Discard' });
    }
    if (drop.targetZone === 'player' && !isOwnPlayer) {
      const target = game.players.find((p) => p.id === targetPlayerId);
      actions.push({ action: 'action:trade_card', payload: { cardId: drag.cardId, toPlayerId: targetPlayerId, fromHand: true }, label: `Give to ${target?.name ?? '?'}` });
    }
    if (drop.targetZone === 'monster') {
      const slotIndex = parseInt(drop.targetZoneId ?? '', 10);
      if (!isNaN(slotIndex)) {
        actions.push({ action: 'action:cover_monster', payload: { cardId: drag.cardId, slotIndex }, label: 'Cover Monster' });
      }
    }
    if (drop.targetZone === 'deck') {
      const deckType = inferDeckType(drag.cardId) ?? 'loot';
      actions.push(...returnToDeckActions(drag.cardId, deckType, { fromHand: true }));
    }
    if (drop.targetZone === 'shop') {
      const slotIndex = parseInt(drop.targetZoneId ?? '', 10);
      addPrivileged('action:place_in_shop', { cardId: drag.cardId, slotIndex }, `Place in Shop Slot ${slotIndex + 1}`);
    }
    if (drop.targetZone === 'hand') {
      const target = game.players.find((p) => p.id === targetPlayerId);
      if (!isOwnPlayer) {
        actions.push({ action: 'action:trade_card', payload: { cardId: drag.cardId, toPlayerId: targetPlayerId, fromHand: true }, label: `Give to ${target?.name ?? '?'}` });
      }
      addPrivileged('action:move_to_hand', { cardId: drag.cardId, targetPlayerId }, `Move to ${target?.name ?? '?'}'s Hand`);
    }
    if (drop.targetZone === 'room') {
      addRoomDrop(undefined, drag.cardId);
    }
  }

  // ── Item card drops ──────────────────────────────────────────────────────────
  if (drag.sourceZone === 'items' && drag.instanceId) {
    if (drop.targetZone === 'player' && !isOwnPlayer) {
      const target = game.players.find((p) => p.id === targetPlayerId);
      actions.push({ action: 'action:trade_card', payload: { instanceId: drag.instanceId, toPlayerId: targetPlayerId, fromHand: false }, label: `Give to ${target?.name ?? '?'}` });
    }
    if (drop.targetZone === 'stack') {
      actions.push({ action: 'action:charge_item', payload: { instanceId: drag.instanceId }, label: 'Activate' });
    }
    if (drop.targetZone === 'room') {
      addRoomDrop(drag.instanceId);
    }
    if (drop.targetZone === 'discard') {
      actions.push({ action: 'action:destroy_card', payload: { instanceId: drag.instanceId }, label: 'Destroy' });
    }
    if (drop.targetZone === 'monster') {
      const slotIndex = parseInt(drop.targetZoneId ?? '', 10);
      if (!isNaN(slotIndex)) {
        actions.push({ action: 'action:cover_monster', payload: { cardId: drag.cardId, instanceId: drag.instanceId, slotIndex }, label: 'Cover Monster' });
      }
    }
    if (drop.targetZone === 'deck') {
      const deckType = inferDeckType(drag.cardId) ?? 'treasure';
      actions.push(...returnToDeckActions(drag.cardId, deckType, { fromInstanceId: drag.instanceId }));
    }
    if (drop.targetZone === 'shop') {
      const slotIndex = parseInt(drop.targetZoneId ?? '', 10);
      actions.push({ action: 'action:destroy_card', payload: { instanceId: drag.instanceId }, label: 'Discard to Treasure' });
      addPrivileged('action:place_in_shop', { cardId: drag.cardId, instanceId: drag.instanceId, slotIndex }, `Place in Shop Slot ${slotIndex + 1}`);
    }
    if (drop.targetZone === 'items') {
      const tp = game.players.find((p) => p.id === targetPlayerId);
      if (!isOwnPlayer) {
        // Semantic: trade_card (blocks curses server-side)
        actions.push({ action: 'action:trade_card', payload: { instanceId: drag.instanceId, toPlayerId: targetPlayerId, fromHand: false }, label: `Give to ${tp?.name ?? '?'}` });
        // Also offer Give Curse for curse cards
        const cardData = getCardFromCache(drag.cardId);
        if (cardData?.subType === 'Curse') {
          actions.push({ action: 'action:trade_card', payload: { instanceId: drag.instanceId, toPlayerId: targetPlayerId, fromHand: false }, label: `Give Curse to ${tp?.name ?? '?'}` });
        }
      }
      addPrivileged('action:move_to_items', { cardId: drag.cardId, instanceId: drag.instanceId, targetPlayerId }, `Force to ${tp?.name ?? '?'}'s Items`);
    }
    if (drop.targetZone === 'hand') {
      const target = game.players.find((p) => p.id === targetPlayerId);
      addPrivileged('action:move_to_hand', { cardId: drag.cardId, instanceId: drag.instanceId, targetPlayerId }, `Move to ${target?.name ?? '?'}'s Hand`);
    }
  }

  // ── Character card drops ─────────────────────────────────────────────────────
  if (drag.sourceZone === 'character' && drag.instanceId) {
    if (drop.targetZone === 'monster') {
      const slotIndex = parseInt(targetPlayerId ?? '', 10);
      if (!isNaN(slotIndex)) {
        actions.push({ action: 'action:declare_attack', payload: { targetType: 'monster_slot', targetSlotIndex: slotIndex }, label: 'Attack' });
      }
    }
    if (drop.targetZone === 'stack') {
      for (const slot of game.monsterSlots) {
        if (slot.stack.length > 0) {
          actions.push({ action: 'action:declare_attack', payload: { targetType: 'monster_slot', targetSlotIndex: slot.slotIndex }, label: `Attack Slot ${slot.slotIndex + 1}` });
        } else {
          actions.push({ action: 'action:attack_monster_deck', payload: { slotIndex: slot.slotIndex }, label: `Flip & Attack Slot ${slot.slotIndex + 1}` });
        }
      }
    }
    if (drop.targetZone === 'discard') {
      addPrivileged('action:destroy_card', { instanceId: drag.instanceId }, 'Destroy Character');
    }
    if (drop.targetZone === 'deck') {
      const deckType = inferDeckType(drag.cardId) ?? 'treasure';
      if (priv) actions.push(...returnToDeckActions(drag.cardId, deckType, { fromInstanceId: drag.instanceId }).map((a) => ({ ...a, label: `${a.label} [Override]` })));
    }
    if (drop.targetZone === 'hand') {
      const target = game.players.find((p) => p.id === targetPlayerId);
      addPrivileged('action:move_to_hand', { cardId: drag.cardId, instanceId: drag.instanceId, targetPlayerId }, `Move to ${target?.name ?? '?'}'s Hand`);
    }
   if (drop.targetZone === 'items') {
      const tp = game.players.find((p) => p.id === targetPlayerId);
      if (isOwnPlayer) {
        actions.push({ action: 'action:purchase', payload: { slotIndex: parseInt(drag.sourceZoneId ?? '', 10) }, label: 'Purchase' });
      }
      addPrivileged('action:move_to_items', { cardId: drag.cardId, instanceId: drag.instanceId, targetPlayerId }, `Move to ${tp?.name ?? '?'}'s Items`);
    }
    if (drop.targetZone === 'hand') {
      const target = game.players.find((p) => p.id === targetPlayerId);
      if (isOwnPlayer) {
        actions.push({ action: 'action:purchase', payload: { slotIndex: parseInt(drag.sourceZoneId ?? '', 10) }, label: 'Purchase' });
      }
      addPrivileged('action:move_to_hand', { cardId: drag.cardId, instanceId: drag.instanceId, targetPlayerId }, `Move to ${target?.name ?? '?'}'s Hand`);
    }
    if (drop.targetZone === 'shop') {
      const slotIndex = parseInt(drop.targetZoneId ?? '', 10);
      addPrivileged('action:place_in_shop', { cardId: drag.cardId, instanceId: drag.instanceId, slotIndex }, `Place in Shop Slot ${slotIndex + 1}`);
    }
    if (drop.targetZone === 'room') {
      addRoomDrop(drag.instanceId);
    }
  }

  // ── Soul card drops ──────────────────────────────────────────────────────────
  if (drag.sourceZone === 'soul' && drag.instanceId) {
    if (drop.targetZone === 'monster') {
      const slotIndex = parseInt(targetPlayerId ?? '', 10);
      if (!isNaN(slotIndex)) {
        actions.push({ action: 'action:declare_attack', payload: { targetType: 'monster_slot', targetSlotIndex: slotIndex }, label: 'Attack' });
      }
    }
    if (drop.targetZone === 'stack') {
      for (const slot of game.monsterSlots) {
        if (slot.stack.length > 0) {
          actions.push({ action: 'action:declare_attack', payload: { targetType: 'monster_slot', targetSlotIndex: slot.slotIndex }, label: `Attack Slot ${slot.slotIndex + 1}` });
        } else {
          actions.push({ action: 'action:attack_monster_deck', payload: { slotIndex: slot.slotIndex }, label: `Flip & Attack Slot ${slot.slotIndex + 1}` });
        }
      }
    }
    if (drop.targetZone === 'discard') {
      actions.push({ action: 'action:destroy_card', payload: { instanceId: drag.instanceId }, label: 'Remove Soul' });
    }
    if (drop.targetZone === 'deck') {
      actions.push(...returnToDeckActions(drag.cardId, 'monster', { fromInstanceId: drag.instanceId }));
    }
    if (drop.targetZone === 'items') {
      const tp = game.players.find((p) => p.id === targetPlayerId);
      addPrivileged('action:move_to_items', { cardId: drag.cardId, instanceId: drag.instanceId, targetPlayerId }, `Move to ${tp?.name ?? '?'}'s Items`);
    }
    if (drop.targetZone === 'hand') {
      const target = game.players.find((p) => p.id === targetPlayerId);
      addPrivileged('action:move_to_hand', { cardId: drag.cardId, instanceId: drag.instanceId, targetPlayerId }, `Move to ${target?.name ?? '?'}'s Hand`);
    }
    if (drop.targetZone === 'shop') {
      const slotIndex = parseInt(drop.targetZoneId ?? '', 10);
      addPrivileged('action:place_in_shop', { cardId: drag.cardId, instanceId: drag.instanceId, slotIndex }, `Place in Shop Slot ${slotIndex + 1}`);
    }
    if (drop.targetZone === 'monster') {
      const slotIndex = parseInt(drop.targetZoneId ?? '', 10);
      if (!isNaN(slotIndex)) {
        addPrivileged('action:cover_monster', { cardId: drag.cardId, instanceId: drag.instanceId, slotIndex }, 'Place on Monster');
      }
    }
    if (drop.targetZone === 'room') {
      addRoomDrop(drag.instanceId);
    }
  }

  // ── Curse card drops ─────────────────────────────────────────────────────────
  if (drag.sourceZone === 'curse' && drag.instanceId) {
    if (drop.targetZone === 'discard' || drop.targetZone === 'stack') {
      actions.push({ action: 'action:destroy_card', payload: { instanceId: drag.instanceId }, label: 'Remove Curse' });
    }
    if (drop.targetZone === 'deck') {
      actions.push(...returnToDeckActions(drag.cardId, 'monster', { fromInstanceId: drag.instanceId }));
    }
    if (drop.targetZone === 'monster') {
      const slotIndex = parseInt(drop.targetZoneId ?? '', 10);
      if (!isNaN(slotIndex)) {
        addPrivileged('action:cover_monster', { cardId: drag.cardId, instanceId: drag.instanceId, slotIndex }, 'Place on Monster');
      }
    }
    if (drop.targetZone === 'items') {
      const tp = game.players.find((p) => p.id === targetPlayerId);
      addPrivileged('action:move_to_items', { cardId: drag.cardId, instanceId: drag.instanceId, targetPlayerId }, `Move to ${tp?.name ?? '?'}'s Items`);
    }
    if (drop.targetZone === 'hand') {
      const target = game.players.find((p) => p.id === targetPlayerId);
      addPrivileged('action:move_to_hand', { cardId: drag.cardId, instanceId: drag.instanceId, targetPlayerId }, `Move to ${target?.name ?? '?'}'s Hand`);
    }
    if (drop.targetZone === 'shop') {
      const slotIndex = parseInt(drop.targetZoneId ?? '', 10);
      addPrivileged('action:place_in_shop', { cardId: drag.cardId, instanceId: drag.instanceId, slotIndex }, `Place in Shop Slot ${slotIndex + 1}`);
    }
    if (drop.targetZone === 'player') {
      const target = game.players.find((p) => p.id === targetPlayerId);
      addPrivileged('action:move_to_items', { cardId: drag.cardId, instanceId: drag.instanceId, targetPlayerId }, `Move to ${target?.name ?? '?'}'s Items`);
    }
    if (drop.targetZone === 'room') {
      addRoomDrop(drag.instanceId);
    }
  }

  // ── Kill trophy drops ────────────────────────────────────────────────────────
  if (drag.sourceZone === 'kill' && drag.instanceId) {
    if (drop.targetZone === 'discard') {
      actions.push({ action: 'action:destroy_card', payload: { instanceId: drag.instanceId }, label: 'Discard Kill Trophy' });
    }
    if (drop.targetZone === 'deck') {
      actions.push(...returnToDeckActions(drag.cardId, 'monster', { fromInstanceId: drag.instanceId }));
    }
    if (drop.targetZone === 'monster') {
      const slotIndex = parseInt(drop.targetZoneId ?? '', 10);
      if (!isNaN(slotIndex)) {
        actions.push({ action: 'action:cover_monster', payload: { cardId: drag.cardId, instanceId: drag.instanceId, slotIndex }, label: 'Place on Monster' });
      }
    }
    if (drop.targetZone === 'items') {
      const tp = game.players.find((p) => p.id === targetPlayerId);
      addPrivileged('action:move_to_items', { cardId: drag.cardId, instanceId: drag.instanceId, targetPlayerId }, `Move to ${tp?.name ?? '?'}'s Items`);
    }
    if (drop.targetZone === 'hand') {
      const target = game.players.find((p) => p.id === targetPlayerId);
      addPrivileged('action:move_to_hand', { cardId: drag.cardId, instanceId: drag.instanceId, targetPlayerId }, `Move to ${target?.name ?? '?'}'s Hand`);
    }
    if (drop.targetZone === 'shop') {
      const slotIndex = parseInt(drop.targetZoneId ?? '', 10);
      addPrivileged('action:place_in_shop', { cardId: drag.cardId, instanceId: drag.instanceId, slotIndex }, `Place in Shop Slot ${slotIndex + 1}`);
    }
    if (drop.targetZone === 'player') {
      const target = game.players.find((p) => p.id === targetPlayerId);
      addPrivileged('action:move_to_items', { cardId: drag.cardId, instanceId: drag.instanceId, targetPlayerId }, `Move to ${target?.name ?? '?'}'s Items`);
    }
    if (drop.targetZone === 'room') {
      addRoomDrop(drag.instanceId);
    }
  }

  // ── Monster slot card drops ──────────────────────────────────────────────────
  if (drag.sourceZone === 'monster' && drag.instanceId) {
    if (drop.targetZone === 'discard') {
      actions.push({ action: 'action:destroy_card', payload: { instanceId: drag.instanceId }, label: 'Destroy' });
    }
    if (drop.targetZone === 'stack') {
      actions.push({ action: 'action:destroy_card', payload: { instanceId: drag.instanceId }, label: 'Discard' });
      const cardData = getCardFromCache(drag.cardId);
      if (cardData && (cardData.soulValue ?? 0) > 0) {
        actions.push({ action: 'action:gain_soul', payload: { instanceId: drag.instanceId, playerId: myId }, label: 'Gain Soul (self)' });
      }
    }
    if (drop.targetZone === 'player') {
      const target = game.players.find((p) => p.id === targetPlayerId);
      const cardData = getCardFromCache(drag.cardId);
      if (cardData && (cardData.soulValue ?? 0) > 0) {
        actions.push({ action: 'action:gain_soul', payload: { instanceId: drag.instanceId, playerId: targetPlayerId }, label: `Soul to ${target?.name ?? '?'}` });
      }
      addPrivileged('action:move_to_items', { cardId: drag.cardId, instanceId: drag.instanceId, targetPlayerId }, `Move to ${target?.name ?? '?'}'s Items`);
    }
    if (drop.targetZone === 'monster') {
      const slotIndex = parseInt(drop.targetZoneId ?? '', 10);
      const dragSlotIndex = parseInt(drag.sourceZoneId ?? '', 10);
      if (!isNaN(slotIndex) && !isNaN(dragSlotIndex) && slotIndex !== dragSlotIndex) {
        actions.push({ action: 'action:cover_monster', payload: { cardId: drag.cardId, instanceId: drag.instanceId, slotIndex }, label: 'Move to Slot' });
      }
    }
    if (drop.targetZone === 'shop') {
      const slotIndex = parseInt(drop.targetZoneId ?? '', 10);
      actions.push({ action: 'action:destroy_card', payload: { instanceId: drag.instanceId }, label: 'Discard to Treasure' });
      addPrivileged('action:place_in_shop', { cardId: drag.cardId, instanceId: drag.instanceId, slotIndex }, `Place in Shop Slot ${slotIndex + 1}`);
    }
    if (drop.targetZone === 'deck') {
      actions.push(...returnToDeckActions(drag.cardId, 'monster', { fromInstanceId: drag.instanceId }));
    }
    if (drop.targetZone === 'items') {
      const tp = game.players.find((p) => p.id === targetPlayerId);
      addPrivileged('action:move_to_items', { cardId: drag.cardId, instanceId: drag.instanceId, targetPlayerId }, `Move to ${tp?.name ?? '?'}'s Items`);
    }
    if (drop.targetZone === 'hand') {
      const target = game.players.find((p) => p.id === targetPlayerId);
      addPrivileged('action:move_to_hand', { cardId: drag.cardId, instanceId: drag.instanceId, targetPlayerId }, `Move to ${target?.name ?? '?'}'s Hand`);
    }
    if (drop.targetZone === 'room') {
      addRoomDrop(drag.instanceId);
    }
  }

  // ── Bonus soul drops ─────────────────────────────────────────────────────
  if (drag.sourceZone === 'bonus_soul') {
    if (drop.targetZone === 'stack') {
      actions.push({
        action: 'action:gain_bonus_soul',
        payload: { cardId: drag.cardId, playerId: myId },
        label: 'Gain Soul',
      });
    }
    if (drop.targetZone === 'player' && targetPlayerId === myId) {
      actions.push({
        action: 'action:gain_bonus_soul',
        payload: { cardId: drag.cardId, playerId: myId },
        label: 'Gain Soul',
      });
    }
  }

  // ── Shop slot card drops ─────────────────────────────────────────────────────
  if (drag.sourceZone === 'shop' && drag.instanceId) {
    if (drop.targetZone === 'discard') {
      actions.push({ action: 'action:destroy_card', payload: { instanceId: drag.instanceId }, label: 'Destroy' });
    }
    if (drop.targetZone === 'player') {
      const target = game.players.find((p) => p.id === targetPlayerId);
      actions.push({ action: 'action:trade_card', payload: { instanceId: drag.instanceId, toPlayerId: targetPlayerId, fromHand: false }, label: `Give to ${target?.name ?? '?'}` });
    }
    if (drop.targetZone === 'monster') {
      const slotIndex = parseInt(drop.targetZoneId ?? '', 10);
      if (!isNaN(slotIndex)) {
        actions.push({ action: 'action:cover_monster', payload: { cardId: drag.cardId, instanceId: drag.instanceId, slotIndex }, label: 'Cover Monster' });
      }
    }
    if (drop.targetZone === 'deck') {
      const deckType = inferDeckType(drag.cardId) ?? 'treasure';
      actions.push(...returnToDeckActions(drag.cardId, deckType, { fromInstanceId: drag.instanceId }));
    }
    if (drop.targetZone === 'items') {
      const tp = game.players.find((p) => p.id === targetPlayerId);
      addPrivileged('action:move_to_items', { cardId: drag.cardId, instanceId: drag.instanceId, targetPlayerId }, `Move to ${tp?.name ?? '?'}'s Items`);
    }
    if (drop.targetZone === 'hand') {
      const target = game.players.find((p) => p.id === targetPlayerId);
      addPrivileged('action:move_to_hand', { cardId: drag.cardId, instanceId: drag.instanceId, targetPlayerId }, `Move to ${target?.name ?? '?'}'s Hand`);
    }
    if (drop.targetZone === 'shop') {
      const targetSlotIndex = parseInt(drop.targetZoneId ?? '', 10);
      const sourceSlotIndex = parseInt(drag.sourceZoneId ?? '', 10);
      if (!isNaN(targetSlotIndex) && targetSlotIndex !== sourceSlotIndex) {
        addPrivileged('action:place_in_shop', { cardId: drag.cardId, instanceId: drag.instanceId, slotIndex: targetSlotIndex }, `Place in Shop Slot ${targetSlotIndex + 1}`);
      }
    }
    if (drop.targetZone === 'room') {
      addRoomDrop(drag.instanceId);
    }
  }

  // ── Room card drops ──────────────────────────────────────────────────────────
  if (drag.sourceZone === 'room' && drag.instanceId) {
    if (drop.targetZone === 'discard') {
      actions.push({ action: 'action:discard_room_slot', payload: { instanceId: drag.instanceId }, label: 'Discard' });
    }
    if (drop.targetZone === 'player') {
      const target = game.players.find((p) => p.id === targetPlayerId);
      actions.push({ action: 'action:return_room_card', payload: { instanceId: drag.instanceId, toPlayerId: targetPlayerId }, label: `Return to ${target?.name ?? '?'}` });
    }
    if (drop.targetZone === 'monster') {
      const slotIndex = parseInt(drop.targetZoneId ?? '', 10);
      if (!isNaN(slotIndex)) {
        actions.push({ action: 'action:cover_monster', payload: { cardId: drag.cardId, instanceId: drag.instanceId, slotIndex }, label: 'Cover Monster' });
      }
    }
    if (drop.targetZone === 'deck') {
      const deckType = inferDeckType(drag.cardId) ?? 'room';
      actions.push(...returnToDeckActions(drag.cardId, deckType, { fromInstanceId: drag.instanceId }));
    }
    if (drop.targetZone === 'items') {
      const tp = game.players.find((p) => p.id === targetPlayerId);
      // return_room_card is the semantic path when moving to own items
      actions.push({ action: 'action:return_room_card', payload: { instanceId: drag.instanceId, toPlayerId: targetPlayerId }, label: `Return to ${tp?.name ?? '?'}'s Items` });
      addPrivileged('action:move_to_items', { cardId: drag.cardId, instanceId: drag.instanceId, targetPlayerId }, `Force to ${tp?.name ?? '?'}'s Items`);
    }
    if (drop.targetZone === 'hand') {
      const target = game.players.find((p) => p.id === targetPlayerId);
      addPrivileged('action:move_to_hand', { cardId: drag.cardId, instanceId: drag.instanceId, targetPlayerId }, `Move to ${target?.name ?? '?'}'s Hand`);
    }
    if (drop.targetZone === 'shop') {
      const slotIndex = parseInt(drop.targetZoneId ?? '', 10);
      addPrivileged('action:place_in_shop', { cardId: drag.cardId, instanceId: drag.instanceId, slotIndex }, `Place in Shop Slot ${slotIndex + 1}`);
    }
    if (drop.targetZone === 'room' && drop.targetZoneId !== drag.instanceId) {
      // Drop on empty room area or a different slot
      addRoomDrop(drag.instanceId);
    }
  }

  // ── Stack item drops ─────────────────────────────────────────────────────────
  if (drag.sourceZone === 'stack' && drag.instanceId) {
    // For loot cards on the stack, sourceZoneId === cardId (no CardInPlay instance exists).
    // For ability/item-sourced stack items, sourceZoneId is a real CardInPlay instanceId.
    const stackItemId = drag.instanceId;
    const instanceId = drag.sourceZoneId !== drag.cardId ? drag.sourceZoneId : undefined;

    if (drop.targetZone === 'discard') {
      actions.push({ action: 'action:cancel_stack_item', payload: { stackItemId }, label: 'Cancel' });
    }
    if (drop.targetZone === 'items' && drag.cardId) {
      const tp = game.players.find((p) => p.id === targetPlayerId);
      addPrivileged('action:move_to_items', { cardId: drag.cardId, instanceId, targetPlayerId, stackItemId }, `Move to ${tp?.name ?? '?'}'s Items`);
    }
    if (drop.targetZone === 'hand' && drag.cardId) {
      const target = game.players.find((p) => p.id === targetPlayerId);
      addPrivileged('action:move_to_hand', { cardId: drag.cardId, instanceId, targetPlayerId, stackItemId }, `Move to ${target?.name ?? '?'}'s Hand`);
    }
    if (drop.targetZone === 'room' && drag.cardId) {
      // addRoomDrop is scoped — we need to inline stackItemId into its payloads
      const replaceInstanceId = drop.targetZoneId;
      const placePayload: Record<string, unknown> = { stackItemId };
      if (instanceId) placePayload.instanceId = instanceId;
      else placePayload.cardId = drag.cardId;
      actions.push({ action: 'action:place_in_room', payload: placePayload, label: 'Add to Room' });
      if (replaceInstanceId) {
        const existingSlot = game.roomSlots.find((s) => s.instanceId === replaceInstanceId);
        const existingName = existingSlot ? (getCardFromCache(existingSlot.cardId)?.name ?? 'card') : 'card';
        const replacePayload: Record<string, unknown> = { replaceInstanceId, stackItemId };
        if (instanceId) replacePayload.newInstanceId = instanceId;
        else replacePayload.newCardId = drag.cardId;
        actions.push({ action: 'action:replace_room_slot', payload: replacePayload, label: `Replace ${existingName}` });
      }
    }
    if (drop.targetZone === 'shop' && drag.cardId) {
      const slotIndex = parseInt(drop.targetZoneId ?? '', 10);
      addPrivileged('action:place_in_shop', { cardId: drag.cardId, instanceId, slotIndex, stackItemId }, `Place in Shop Slot ${slotIndex + 1}`);
    }
    if (drop.targetZone === 'monster' && drag.cardId) {
      const slotIndex = parseInt(drop.targetZoneId ?? '', 10);
      if (!isNaN(slotIndex)) {
        actions.push({ action: 'action:cover_monster', payload: { cardId: drag.cardId, instanceId, slotIndex, stackItemId }, label: 'Cover Monster' });
      }
    }
    if (drop.targetZone === 'deck' && drag.cardId) {
      const deckType = inferDeckType(drag.cardId) ?? 'treasure';
      actions.push(...returnToDeckActions(drag.cardId, deckType, { fromInstanceId: instanceId, stackItemId }));
    }
  }

  // ── Discard pile top card drops ──────────────────────────────────────────────
  if (drag.sourceZone === 'discard' && drag.sourceZoneId) {
    const deckType = drag.sourceZoneId as 'loot' | 'treasure' | 'monster' | 'room';
    if (drop.targetZone === 'deck') {
      actions.push(...returnToDeckActions(drag.cardId, deckType, { fromDiscard: true }));
    }
    if (drop.targetZone === 'monster') {
      const slotIndex = parseInt(drop.targetZoneId ?? '', 10);
      if (!isNaN(slotIndex)) {
        actions.push({ action: 'action:cover_monster', payload: { cardId: drag.cardId, instanceId: drag.instanceId, slotIndex }, label: 'Cover Monster' });
      }
    }
    if (drop.targetZone === 'items') {
      const tp = game.players.find((p) => p.id === targetPlayerId);
      actions.push({ action: 'action:move_to_items', payload: { cardId: drag.cardId, instanceId: drag.instanceId, targetPlayerId, deckType }, label: `Move to ${tp?.name ?? '?'}'s Items` });
    }
    if (drop.targetZone === 'hand') {
      const target = game.players.find((p) => p.id === targetPlayerId);
      actions.push({ action: 'action:move_to_hand', payload: { cardId: drag.cardId, instanceId: drag.instanceId, targetPlayerId, deckType }, label: `Move to ${target?.name ?? '?'}'s Hand` });
    }
   if (drop.targetZone === 'shop') {
      const targetSlotIndex = parseInt(drop.targetZoneId ?? '', 10);
      const sourceSlotIndex = parseInt(drag.sourceZoneId ?? '', 10);
      if (!isNaN(targetSlotIndex) && targetSlotIndex !== sourceSlotIndex) {
        addPrivileged('action:place_in_shop', { cardId: drag.cardId, instanceId: drag.instanceId, slotIndex: targetSlotIndex }, `Place in Shop Slot ${targetSlotIndex + 1}`);
      }
    }
    if (drop.targetZone === 'room') {
      const replaceInstanceId = drop.targetZoneId;
      actions.push({ action: 'action:place_in_room', payload: { cardId: drag.cardId, deckType }, label: 'Add to Room' });
      if (replaceInstanceId) {
        const existingSlot = game.roomSlots.find((s) => s.instanceId === replaceInstanceId);
        const existingName = existingSlot ? (getCardFromCache(existingSlot.cardId)?.name ?? 'card') : 'card';
        actions.push({ action: 'action:replace_room_slot', payload: { newCardId: drag.cardId, deckType, replaceInstanceId }, label: `Replace ${existingName}` });
      }
    }
  }

  // ── Deck sentinel (drag a deck face to draw a card) ─────────────────────────
  if (drag.sourceZone === 'deck' && drag.cardId === DECK_TOP_SENTINEL && drag.sourceZoneId) {
    if (drop.targetZone === 'hand') {
      if (drag.sourceZoneId === 'treasure') {
        // Explicit hand drop — draw to hand, not items
        actions.push({ action: 'action:draw_from_deck', payload: { deckType: 'treasure' }, label: 'Draw Treasure to Hand' });
      } else {
        actions.push(...deckDragToHandActions(drag.sourceZoneId, myId));
      }
    }
    // Treasure deck dragged to items zone → gain_treasure (goes to items, normal flow)
    if (drop.targetZone === 'items' && drag.sourceZoneId === 'treasure') {
      actions.push({ action: 'action:gain_treasure', payload: { count: 1 }, label: 'Gain Treasure' });
    }
    // Loot deck dragged to items zone → draw_loot (same as hand drop)
    if (drop.targetZone === 'items' && drag.sourceZoneId === 'loot') {
      actions.push(...deckDragToHandActions('loot', myId));
    }
  }

  // ── add_slot drop zone (drag any card onto a +slot target) ───────────────────
  if (drop.targetZone === 'add_slot' && drop.targetZoneId && drag.cardId !== DECK_TOP_SENTINEL) {
    const slotType = drop.targetZoneId as 'shop' | 'monster' | 'room';
    const instanceId = drag.sourceZone !== 'hand' ? drag.instanceId : undefined;
    actions.push({
      action: 'action:add_slot',
      payload: { slotType, cardId: drag.cardId, ...(instanceId ? { instanceId } : {}) },
      label: `Add to new ${slotType} slot`,
    });
  }

  return actions;
}

// ── All available actions (fallback when drop zone unknown) ───────────────────

export function getAllAvailableActions(
  drag: UniversalDrag,
  game: GameState,
): DropAction[] {
  const actions: DropAction[] = [];
  const myId = game.myPlayerId;
  const otherPlayers = game.players.filter((p) => p.id !== myId && !p.isSpectator);
  const allPlayers = game.players.filter((p) => !p.isSpectator);
  const priv = game.allowPrivilegedActions;

  const addPrivileged = (action: string, payload: Record<string, unknown>, label: string) => {
    if (priv) actions.push({ action, payload, label: `${label} [Override]` });
  };

  if (drag.sourceZone === 'hand') {
    actions.push({ action: 'action:play_loot', payload: { cardId: drag.cardId, targets: [] }, label: 'Play to Stack' });
    actions.push({ action: 'action:discard_loot', payload: { cardId: drag.cardId }, label: 'Discard' });
    for (const p of otherPlayers) {
      actions.push({ action: 'action:trade_card', payload: { cardId: drag.cardId, toPlayerId: p.id, fromHand: true }, label: `Give to ${p.name}` });
    }
    for (const slot of game.monsterSlots) {
      actions.push({ action: 'action:cover_monster', payload: { cardId: drag.cardId, slotIndex: slot.slotIndex }, label: `Cover Monster Slot ${slot.slotIndex + 1}` });
    }
    actions.push(...returnToDeckActions(drag.cardId, inferDeckType(drag.cardId) ?? 'loot', { fromHand: true }));
    for (const p of allPlayers) {
      addPrivileged('action:move_to_hand', { cardId: drag.cardId, targetPlayerId: p.id }, `Move to ${p.name}'s Hand`);
    }
  }

  if (drag.sourceZone === 'items' && drag.instanceId) {
    actions.push({ action: 'action:charge_item', payload: { instanceId: drag.instanceId }, label: 'Activate' });
    actions.push({ action: 'action:place_in_room', payload: { instanceId: drag.instanceId }, label: 'Place in Room' });
    actions.push({ action: 'action:destroy_card', payload: { instanceId: drag.instanceId }, label: 'Destroy' });
    for (const p of otherPlayers) {
      actions.push({ action: 'action:trade_card', payload: { instanceId: drag.instanceId, toPlayerId: p.id, fromHand: false }, label: `Give to ${p.name}` });
    }
    for (const slot of game.monsterSlots) {
      actions.push({ action: 'action:cover_monster', payload: { cardId: drag.cardId, instanceId: drag.instanceId, slotIndex: slot.slotIndex }, label: `Cover Monster Slot ${slot.slotIndex + 1}` });
    }
    const deckType = inferDeckType(drag.cardId) ?? 'treasure';
    actions.push(...returnToDeckActions(drag.cardId, deckType, { fromInstanceId: drag.instanceId }));
    for (const p of allPlayers) {
      addPrivileged('action:move_to_items', { cardId: drag.cardId, instanceId: drag.instanceId, targetPlayerId: p.id }, `Force to ${p.name}'s Items`);
      addPrivileged('action:move_to_hand', { cardId: drag.cardId, instanceId: drag.instanceId, targetPlayerId: p.id }, `Move to ${p.name}'s Hand`);
    }
    for (const slot of game.shopSlots) {
      addPrivileged('action:place_in_shop', { cardId: drag.cardId, instanceId: drag.instanceId, slotIndex: slot.slotIndex }, `Place in Shop Slot ${slot.slotIndex + 1}`);
    }
  }

  if (drag.sourceZone === 'bonus_soul') {
    actions.push({
      action: 'action:gain_bonus_soul',
      payload: { cardId: drag.cardId, playerId: myId },
      label: 'Gain Soul',
    });
  }

  if ((drag.sourceZone === 'character' || drag.sourceZone === 'soul') && drag.instanceId) {
    for (const slot of game.monsterSlots) {
      if (slot.stack.length > 0) {
        actions.push({ action: 'action:declare_attack', payload: { targetType: 'monster_slot', targetSlotIndex: slot.slotIndex }, label: `Attack Slot ${slot.slotIndex + 1}` });
      } else {
        actions.push({ action: 'action:attack_monster_deck', payload: { slotIndex: slot.slotIndex }, label: `Flip & Attack Slot ${slot.slotIndex + 1}` });
      }
    }
    for (const p of allPlayers) {
      addPrivileged('action:move_to_items', { cardId: drag.cardId, instanceId: drag.instanceId, targetPlayerId: p.id }, `Move to ${p.name}'s Items`);
      addPrivileged('action:move_to_hand', { cardId: drag.cardId, instanceId: drag.instanceId, targetPlayerId: p.id }, `Move to ${p.name}'s Hand`);
    }
  }

  if (drag.sourceZone === 'monster' && drag.instanceId) {
    actions.push({ action: 'action:destroy_card', payload: { instanceId: drag.instanceId }, label: 'Destroy' });
    const cardData = getCardFromCache(drag.cardId);
    if (cardData && (cardData.soulValue ?? 0) > 0) {
      actions.push({ action: 'action:gain_soul', payload: { instanceId: drag.instanceId, playerId: myId }, label: 'Gain Soul (self)' });
    }
    const dragSlotIndex = parseInt(drag.sourceZoneId ?? '', 10);
    for (const slot of game.monsterSlots) {
      if (slot.slotIndex !== dragSlotIndex) {
        actions.push({ action: 'action:cover_monster', payload: { cardId: drag.cardId, instanceId: drag.instanceId, slotIndex: slot.slotIndex }, label: `Move to Slot ${slot.slotIndex + 1}` });
      }
    }
    actions.push(...returnToDeckActions(drag.cardId, 'monster', { fromInstanceId: drag.instanceId }));
    for (const p of allPlayers) {
      addPrivileged('action:move_to_items', { cardId: drag.cardId, instanceId: drag.instanceId, targetPlayerId: p.id }, `Move to ${p.name}'s Items`);
      addPrivileged('action:move_to_hand', { cardId: drag.cardId, instanceId: drag.instanceId, targetPlayerId: p.id }, `Move to ${p.name}'s Hand`);
    }
    for (const slot of game.shopSlots) {
      addPrivileged('action:place_in_shop', { cardId: drag.cardId, instanceId: drag.instanceId, slotIndex: slot.slotIndex }, `Place in Shop Slot ${slot.slotIndex + 1}`);
    }
  }

  if (drag.sourceZone === 'shop' && drag.instanceId) {
    actions.push({ action: 'action:destroy_card', payload: { instanceId: drag.instanceId }, label: 'Destroy' });
    for (const p of otherPlayers) {
      actions.push({ action: 'action:trade_card', payload: { instanceId: drag.instanceId, toPlayerId: p.id, fromHand: false }, label: `Give to ${p.name}` });
    }
    for (const slot of game.monsterSlots) {
      actions.push({ action: 'action:cover_monster', payload: { cardId: drag.cardId, instanceId: drag.instanceId, slotIndex: slot.slotIndex }, label: `Cover Monster Slot ${slot.slotIndex + 1}` });
    }
    const deckType = inferDeckType(drag.cardId) ?? 'treasure';
    actions.push(...returnToDeckActions(drag.cardId, deckType, { fromInstanceId: drag.instanceId }));
    for (const p of allPlayers) {
      addPrivileged('action:move_to_items', { cardId: drag.cardId, instanceId: drag.instanceId, targetPlayerId: p.id }, `Move to ${p.name}'s Items`);
      addPrivileged('action:move_to_hand', { cardId: drag.cardId, instanceId: drag.instanceId, targetPlayerId: p.id }, `Move to ${p.name}'s Hand`);
    }
  }

  if (drag.sourceZone === 'room' && drag.instanceId) {
    actions.push({ action: 'action:discard_room_slot', payload: { instanceId: drag.instanceId }, label: 'Discard' });
    for (const p of allPlayers) {
      actions.push({ action: 'action:return_room_card', payload: { instanceId: drag.instanceId, toPlayerId: p.id }, label: `Return to ${p.name}` });
      addPrivileged('action:move_to_items', { cardId: drag.cardId, instanceId: drag.instanceId, targetPlayerId: p.id }, `Force to ${p.name}'s Items`);
      addPrivileged('action:move_to_hand', { cardId: drag.cardId, instanceId: drag.instanceId, targetPlayerId: p.id }, `Move to ${p.name}'s Hand`);
    }
    for (const slot of game.monsterSlots) {
      actions.push({ action: 'action:cover_monster', payload: { cardId: drag.cardId, instanceId: drag.instanceId, slotIndex: slot.slotIndex }, label: `Cover Monster Slot ${slot.slotIndex + 1}` });
    }
    const deckType = inferDeckType(drag.cardId) ?? 'room';
    actions.push(...returnToDeckActions(drag.cardId, deckType, { fromInstanceId: drag.instanceId }));
  }

  if (drag.sourceZone === 'curse' && drag.instanceId) {
    actions.push({ action: 'action:destroy_card', payload: { instanceId: drag.instanceId }, label: 'Remove Curse' });
    actions.push(...returnToDeckActions(drag.cardId, 'monster', { fromInstanceId: drag.instanceId }));
    for (const p of allPlayers) {
      addPrivileged('action:move_to_items', { cardId: drag.cardId, instanceId: drag.instanceId, targetPlayerId: p.id }, `Move to ${p.name}'s Items`);
      addPrivileged('action:move_to_hand', { cardId: drag.cardId, instanceId: drag.instanceId, targetPlayerId: p.id }, `Move to ${p.name}'s Hand`);
    }
  }

  if (drag.sourceZone === 'kill' && drag.instanceId) {
    actions.push({ action: 'action:destroy_card', payload: { instanceId: drag.instanceId }, label: 'Discard Kill Trophy' });
    actions.push(...returnToDeckActions(drag.cardId, 'monster', { fromInstanceId: drag.instanceId }));
    for (const slot of game.monsterSlots) {
      actions.push({ action: 'action:cover_monster', payload: { cardId: drag.cardId, instanceId: drag.instanceId, slotIndex: slot.slotIndex }, label: `Place on Monster Slot ${slot.slotIndex + 1}` });
    }
    for (const p of allPlayers) {
      addPrivileged('action:move_to_items', { cardId: drag.cardId, instanceId: drag.instanceId, targetPlayerId: p.id }, `Move to ${p.name}'s Items`);
      addPrivileged('action:move_to_hand', { cardId: drag.cardId, instanceId: drag.instanceId, targetPlayerId: p.id }, `Move to ${p.name}'s Hand`);
    }
  }

  if (drag.sourceZone === 'discard' && drag.sourceZoneId) {
    const deckType = drag.sourceZoneId as 'loot' | 'treasure' | 'monster' | 'room';
    actions.push(...returnToDeckActions(drag.cardId, deckType, { fromDiscard: true }));
    for (const slot of game.monsterSlots) {
      addPrivileged('action:cover_monster', { cardId: drag.cardId, slotIndex: slot.slotIndex }, `Cover Monster Slot ${slot.slotIndex + 1}`);
    }
    for (const p of allPlayers) {
      addPrivileged('action:move_to_items', { cardId: drag.cardId, targetPlayerId: p.id }, `Move to ${p.name}'s Items`);
      addPrivileged('action:move_to_hand', { cardId: drag.cardId, targetPlayerId: p.id }, `Move to ${p.name}'s Hand`);
    }
    for (const slot of game.shopSlots) {
      addPrivileged('action:place_in_shop', { cardId: drag.cardId, slotIndex: slot.slotIndex }, `Place in Shop Slot ${slot.slotIndex + 1}`);
    }
  }

  return actions;
}
