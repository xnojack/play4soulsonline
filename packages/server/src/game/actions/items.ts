import { GameState, CardInPlay } from '../types';
import { createLogEntry } from '../GameRoom';
import { getCardById } from '../../db/cards';
import { createCardInPlay, drawFromDeck } from '../decks';
import { refillShopSlot } from './purchase';
import { refillMonsterSlot } from './monsters';

/** Charge (ready) an item */
export function chargeItem(
  state: GameState,
  playerId: string,
  instanceId: string
): GameState {
  return updateItemCharged(state, playerId, instanceId, true);
}

/** Deactivate (spend/tap) an item */
export function deactivateItem(
  state: GameState,
  playerId: string,
  instanceId: string
): GameState {
  return updateItemCharged(state, playerId, instanceId, false);
}

function updateItemCharged(
  state: GameState,
  playerId: string,
  instanceId: string,
  charged: boolean
): GameState {
  // Check player items first
  const players = state.players.map((p) => {
    if (p.id !== playerId) return p;
    return {
      ...p,
      items: p.items.map((item) =>
        item.instanceId === instanceId ? { ...item, charged } : item
      ),
    };
  });

  // Also check characterCards (character card tap)
  const characterCards = { ...state.characterCards };
  if (characterCards[instanceId]) {
    characterCards[instanceId] = { ...characterCards[instanceId], charged };
  }

  return { ...state, players, characterCards };
}

/** Move an item to a new index in the player's item area */
export function moveItem(
  state: GameState,
  playerId: string,
  instanceId: string,
  toIndex: number
): GameState {
  const players = state.players.map((p) => {
    if (p.id !== playerId) return p;
    const items = [...p.items];
    const fromIndex = items.findIndex((i) => i.instanceId === instanceId);
    if (fromIndex === -1) return p;
    const [item] = items.splice(fromIndex, 1);
    const clampedTo = Math.max(0, Math.min(toIndex, items.length));
    items.splice(clampedTo, 0, item);
    return { ...p, items };
  });
  return { ...state, players };
}

/** Destroy a card (remove from play and send to appropriate discard).
 *  actorPlayerId is required to permission-check shop/monster slot discards
 *  (only the active player may discard from those zones). */
export function destroyCard(state: GameState, instanceId: string, actorPlayerId?: string): GameState {
  // --- Shop slot ---
  {
    const slotIdx = state.shopSlots.findIndex(
      (s) => s.card?.instanceId === instanceId
    );
    if (slotIdx !== -1) {
      // Only the active player may discard shop cards
      if (actorPlayerId && actorPlayerId !== state.turn.activePlayerId) return state;

      const slot = state.shopSlots[slotIdx];
      const card = getCardById(slot.card!.cardId);
      const cardName = card?.name ?? slot.card!.cardId;

      // Remove card from slot and add to treasure discard
      const withoutCard: GameState = {
        ...state,
        shopSlots: state.shopSlots.map((s, i) =>
          i === slotIdx ? { ...s, card: null } : s
        ),
        treasureDiscard: [...state.treasureDiscard, slot.card!.cardId],
        log: [
          ...state.log,
          createLogEntry('info', `${cardName} discarded from the shop`, actorPlayerId ?? null),
        ],
      };

      // Refill the slot from the treasure deck
      return refillShopSlot(withoutCard, slot.slotIndex);
    }
  }

  // --- Monster slot (top card only) ---
  {
    const slotIdx = state.monsterSlots.findIndex((s) => {
      const top = s.stack[s.stack.length - 1];
      return top?.instanceId === instanceId;
    });
    if (slotIdx !== -1) {
      // Only the active player may discard monster cards
      if (actorPlayerId && actorPlayerId !== state.turn.activePlayerId) return state;

      const slot = state.monsterSlots[slotIdx];
      const topCard = slot.stack[slot.stack.length - 1];
      const card = getCardById(topCard.cardId);
      const cardName = card?.name ?? topCard.cardId;
      const newStack = slot.stack.slice(0, -1);

      const withoutCard: GameState = {
        ...state,
        monsterSlots: state.monsterSlots.map((s, i) =>
          i === slotIdx ? { ...s, stack: newStack } : s
        ),
        monsterDiscard: [...state.monsterDiscard, topCard.cardId],
        log: [
          ...state.log,
          createLogEntry('info', `${cardName} discarded from the monster zone`, actorPlayerId ?? null),
        ],
      };

      // Refill the slot if the stack is now empty
      if (newStack.length === 0) {
        return refillMonsterSlot(withoutCard, slot.slotIndex);
      }
      return withoutCard;
    }
  }

  // Search players' items, souls, curses, kills
  let destroyed: CardInPlay | undefined;
  let sourceType: 'item' | 'soul' | 'curse' | 'kill' | null = null;
  let sourcePlayerId: string | null = null;

  let players = state.players.map((p) => {
    // Check items — only owner can destroy
    const itemIdx = p.items.findIndex((i) => i.instanceId === instanceId);
    if (itemIdx !== -1) {
      if (actorPlayerId && actorPlayerId !== p.id) return p; // Not owner
      const card = getCardById(p.items[itemIdx].cardId);
      if (card?.isEternal) return p; // Eternal items can't be destroyed
      destroyed = p.items[itemIdx] as CardInPlay;
      sourceType = 'item';
      sourcePlayerId = p.id;
      return { ...p, items: p.items.filter((i) => i.instanceId !== instanceId) };
    }
    // Check souls — only owner can destroy
    const soulIdx = p.souls.findIndex((i) => i.instanceId === instanceId);
    if (soulIdx !== -1) {
      if (actorPlayerId && actorPlayerId !== p.id) return p; // Not owner
      destroyed = p.souls[soulIdx] as CardInPlay;
      sourceType = 'soul';
      sourcePlayerId = p.id;
      return { ...p, souls: p.souls.filter((i) => i.instanceId !== instanceId) };
    }
    // Check curses — only owner can destroy
    const curseIdx = p.curses.findIndex((i) => i.instanceId === instanceId);
    if (curseIdx !== -1) {
      if (actorPlayerId && actorPlayerId !== p.id) return p; // Not owner
      destroyed = p.curses[curseIdx] as CardInPlay;
      sourceType = 'curse';
      sourcePlayerId = p.id;
      return { ...p, curses: p.curses.filter((i) => i.instanceId !== instanceId) };
    }
    // Check kills — only owner can destroy, Curse subtype kills cannot be removed
    const killIdx = p.kills.findIndex((i) => i.instanceId === instanceId);
    if (killIdx !== -1) {
      if (actorPlayerId && actorPlayerId !== p.id) return p; // Not owner
      const card = getCardById(p.kills[killIdx].cardId);
      if (card?.subType === 'Curse') return p; // true curse cards are permanent
      destroyed = p.kills[killIdx] as CardInPlay;
      sourceType = 'kill';
      sourcePlayerId = p.id;
      return { ...p, kills: p.kills.filter((i) => i.instanceId !== instanceId) };
    }
    return p;
  });

  if (!destroyed) return state;

  const card = getCardById((destroyed as CardInPlay).cardId);
  const cardName = card?.name ?? (destroyed as CardInPlay).cardId;

  // Put cardId in correct discard
  let newState = { ...state, players };
  if (card?.cardType === 'Treasure' || sourceType === 'item') {
    newState = {
      ...newState,
      treasureDiscard: [...newState.treasureDiscard, (destroyed as CardInPlay).cardId],
    };
  } else if (card?.cardType === 'Monster' || sourceType === 'soul' || sourceType === 'curse' || sourceType === 'kill') {
    newState = {
      ...newState,
      monsterDiscard: [...newState.monsterDiscard, (destroyed as CardInPlay).cardId],
    };
  }

  const log = createLogEntry('info', `${cardName} is destroyed`, sourcePlayerId);
  return { ...newState, log: [...newState.log, log] };
}

/** Gain a card as a soul */
export function gainSoul(
  state: GameState,
  instanceId: string,
  playerId: string
): GameState {
  // Find the card instance — could be from a monster slot or shop
  let soulInstance: CardInPlay | null = null;

  // Check monster slots
  let newMonsterSlots = state.monsterSlots.map((slot) => {
    const topIdx = slot.stack.length - 1;
    if (topIdx >= 0 && slot.stack[topIdx].instanceId === instanceId) {
      soulInstance = slot.stack[topIdx];
      return { ...slot, stack: slot.stack.slice(0, topIdx) };
    }
    return slot;
  });

  if (!soulInstance) return state;

  const card = getCardById((soulInstance as CardInPlay).cardId);
  const player = state.players.find((p) => p.id === playerId);

  const players = state.players.map((p) =>
    p.id === playerId
      ? { ...p, souls: [...p.souls, soulInstance as CardInPlay] }
      : p
  );

  const soulValue = card?.soulValue ?? 1;
  const log = createLogEntry(
    'soul_gain',
    `${player?.name ?? playerId} gains ${card?.name ?? 'a soul'} as a soul (value: ${soulValue})`,
    playerId
  );

  return {
    ...state,
    players,
    monsterSlots: newMonsterSlots,
    log: [...state.log, log],
  };
}

/** Share your hand with another player */
export function shareHand(
  state: GameState,
  fromPlayerId: string,
  withPlayerId: string
): GameState {
  const fromPlayer = state.players.find((p) => p.id === fromPlayerId);
  const withPlayer = state.players.find((p) => p.id === withPlayerId);
  if (!fromPlayer || !withPlayer) return state;

  if (fromPlayer.handSharedWith.includes(withPlayerId)) return state; // already shared

  const players = state.players.map((p) =>
    p.id === fromPlayerId
      ? { ...p, handSharedWith: [...p.handSharedWith, withPlayerId] }
      : p
  );

  return { ...state, players };
}

/** Revoke hand share */
export function revokeHandShare(
  state: GameState,
  fromPlayerId: string,
  withPlayerId: string
): GameState {
  const players = state.players.map((p) =>
    p.id === fromPlayerId
      ? { ...p, handSharedWith: p.handSharedWith.filter((id) => id !== withPlayerId) }
      : p
  );
  return { ...state, players };
}

/** Add counters to a card instance */
export function addCounter(
  state: GameState,
  instanceId: string,
  counterType: string,
  amount: number
): GameState {
  const updater = (instance: CardInPlay): CardInPlay => {
    if (counterType === 'generic') {
      return { ...instance, genericCounters: instance.genericCounters + amount };
    } else if (counterType === 'hp') {
      return { ...instance, hpCounters: instance.hpCounters + amount };
    } else if (counterType === 'atk') {
      return { ...instance, atkCounters: instance.atkCounters + amount };
    } else {
      const named = { ...instance.namedCounters };
      named[counterType] = (named[counterType] ?? 0) + amount;
      return { ...instance, namedCounters: named };
    }
  };

  // Try to update in players' items
  let found = false;
  const players = state.players.map((p) => {
    const itemIdx = p.items.findIndex((i) => i.instanceId === instanceId);
    if (itemIdx !== -1) {
      found = true;
      const newItems = [...p.items];
      newItems[itemIdx] = updater(newItems[itemIdx]);
      return { ...p, items: newItems };
    }
    return p;
  });

  if (found) return { ...state, players };

  // Try monster slots (any card in the stack)
  let monsterFound = false;
  const monsterSlots = state.monsterSlots.map((slot) => {
    const idx = slot.stack.findIndex((c) => c.instanceId === instanceId);
    if (idx !== -1) {
      monsterFound = true;
      const newStack = [...slot.stack];
      newStack[idx] = updater(newStack[idx]);
      return { ...slot, stack: newStack };
    }
    return slot;
  });
  if (monsterFound) return { ...state, players, monsterSlots };

  // Try shop slots
  const shopSlots = state.shopSlots.map((slot) => {
    if (slot.card && slot.card.instanceId === instanceId) {
      return { ...slot, card: updater(slot.card) };
    }
    return slot;
  });
  const shopFound = shopSlots.some((s, i) => s.card !== state.shopSlots[i].card);
  if (shopFound) return { ...state, players, monsterSlots, shopSlots };

  // Try room slots
  const roomSlots = state.roomSlots.map((c) =>
    c.instanceId === instanceId ? updater(c) : c
  );
  const roomFound = roomSlots.some((c, i) => c !== state.roomSlots[i]);
  if (roomFound) return { ...state, players, monsterSlots, shopSlots, roomSlots };

  // Try bonus soul instances
  const bonusSouls = state.bonusSouls.map((bs) =>
    bs.instance.instanceId === instanceId
      ? { ...bs, instance: updater(bs.instance) }
      : bs
  );
  const bsFound = bonusSouls.some((bs, i) => bs !== state.bonusSouls[i]);
  if (bsFound) return { ...state, players, monsterSlots, shopSlots, roomSlots, bonusSouls };

  // Try character cards and starting item cards
  const charEntry = Object.entries(state.characterCards).find(([id]) => id === instanceId);
  if (charEntry) {
    return {
      ...state, players, monsterSlots, shopSlots, roomSlots, bonusSouls,
      characterCards: { ...state.characterCards, [instanceId]: updater(state.characterCards[instanceId]) },
    };
  }
  const siEntry = Object.entries(state.startingItemCards).find(([id]) => id === instanceId);
  if (siEntry) {
    return {
      ...state, players, monsterSlots, shopSlots, roomSlots, bonusSouls,
      startingItemCards: { ...state.startingItemCards, [instanceId]: updater(state.startingItemCards[instanceId]) },
    };
  }

  return { ...state, players, monsterSlots, shopSlots, roomSlots, bonusSouls };
}

/** Remove counters from a card instance */
export function removeCounter(
  state: GameState,
  instanceId: string,
  counterType: string,
  amount: number
): GameState {
  const updater = (instance: CardInPlay): CardInPlay => {
    if (counterType === 'generic') {
      return { ...instance, genericCounters: Math.max(0, instance.genericCounters - amount) };
    } else if (counterType === 'hp') {
      return { ...instance, hpCounters: Math.max(0, instance.hpCounters - amount) };
    } else if (counterType === 'atk') {
      return { ...instance, atkCounters: Math.max(0, instance.atkCounters - amount) };
    } else {
      const named = { ...instance.namedCounters };
      named[counterType] = Math.max(0, (named[counterType] ?? 0) - amount);
      return { ...instance, namedCounters: named };
    }
  };

  const players = state.players.map((p) => {
    const itemIdx = p.items.findIndex((i) => i.instanceId === instanceId);
    if (itemIdx !== -1) {
      const newItems = [...p.items];
      newItems[itemIdx] = updater(newItems[itemIdx]);
      return { ...p, items: newItems };
    }
    return p;
  });
  const found2 = players.some((p, i) => p !== state.players[i]);
  if (found2) return { ...state, players };

  // Try monster slots (any card in the stack)
  let monsterFound2 = false;
  const monsterSlots = state.monsterSlots.map((slot) => {
    const idx = slot.stack.findIndex((c) => c.instanceId === instanceId);
    if (idx !== -1) {
      monsterFound2 = true;
      const newStack = [...slot.stack];
      newStack[idx] = updater(newStack[idx]);
      return { ...slot, stack: newStack };
    }
    return slot;
  });
  if (monsterFound2) return { ...state, players, monsterSlots };

  // Try shop slots
  const shopSlots = state.shopSlots.map((slot) => {
    if (slot.card && slot.card.instanceId === instanceId) {
      return { ...slot, card: updater(slot.card) };
    }
    return slot;
  });
  const shopFound2 = shopSlots.some((s, i) => s.card !== state.shopSlots[i].card);
  if (shopFound2) return { ...state, players, monsterSlots, shopSlots };

  // Try room slots
  const roomSlots = state.roomSlots.map((c) =>
    c.instanceId === instanceId ? updater(c) : c
  );
  const roomFound2 = roomSlots.some((c, i) => c !== state.roomSlots[i]);
  if (roomFound2) return { ...state, players, monsterSlots, shopSlots, roomSlots };

  // Try bonus soul instances
  const bonusSouls = state.bonusSouls.map((bs) =>
    bs.instance.instanceId === instanceId
      ? { ...bs, instance: updater(bs.instance) }
      : bs
  );
  const bsFound2 = bonusSouls.some((bs, i) => bs !== state.bonusSouls[i]);
  if (bsFound2) return { ...state, players, monsterSlots, shopSlots, roomSlots, bonusSouls };

  // Try character cards and starting item cards
  const charEntry2 = Object.entries(state.characterCards).find(([id]) => id === instanceId);
  if (charEntry2) {
    return {
      ...state, players, monsterSlots, shopSlots, roomSlots, bonusSouls,
      characterCards: { ...state.characterCards, [instanceId]: updater(state.characterCards[instanceId]) },
    };
  }
  const siEntry2 = Object.entries(state.startingItemCards).find(([id]) => id === instanceId);
  if (siEntry2) {
    return {
      ...state, players, monsterSlots, shopSlots, roomSlots, bonusSouls,
      startingItemCards: { ...state.startingItemCards, [instanceId]: updater(state.startingItemCards[instanceId]) },
    };
  }

  return { ...state, players, monsterSlots, shopSlots, roomSlots, bonusSouls };
}

/** Modify a player's coin count */
export function changeCoins(
  state: GameState,
  playerId: string,
  amount: number
): GameState {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return state;

  const newCoins = Math.max(0, player.coins + amount);
  const delta = newCoins - player.coins;

  // Move coins to/from pool
  const newPool = state.coinPool - delta;

  const players = state.players.map((p) =>
    p.id === playerId ? { ...p, coins: newCoins } : p
  );

  const sign = delta >= 0 ? '+' : '';
  const log = createLogEntry(
    'info',
    `${player.name} ${delta >= 0 ? 'gains' : 'spends'} ${Math.abs(delta)}¢ (now ${newCoins}¢)`,
    playerId
  );

  return { ...state, players, coinPool: Math.max(0, newPool), log: [...state.log, log] };
}

/**
 * Find a card in any zone and remove it, returning the mutated state and the
 * CardInPlay instance. Lookup order: player items → shop slots → monster slot
 * top card → room slots → hand (creates a fresh instance).
 * If instanceId is provided it is used to disambiguate; otherwise first match
 * by cardId is used.
 */
export function findAndRemoveCardInstance(
  state: GameState,
  cardId: string,
  instanceId?: string,
): { newState: GameState; instance: CardInPlay | null } {
  // 1. Player items (any player)
  for (const p of state.players) {
    const idx = instanceId
      ? p.items.findIndex((i) => i.instanceId === instanceId)
      : p.items.findIndex((i) => i.cardId === cardId);
    if (idx !== -1) {
      const instance = p.items[idx];
      const newState: GameState = {
        ...state,
        players: state.players.map((pl) =>
          pl.id === p.id ? { ...pl, items: pl.items.filter((_, i) => i !== idx) } : pl
        ),
      };
      return { newState, instance };
    }
  }

  // 2. Shop slots
  for (const slot of state.shopSlots) {
    if (!slot.card) continue;
    const match = instanceId
      ? slot.card.instanceId === instanceId
      : slot.card.cardId === cardId;
    if (match) {
      const instance = slot.card;
      let newState: GameState = {
        ...state,
        shopSlots: state.shopSlots.map((s) =>
          s.slotIndex === slot.slotIndex ? { ...s, card: null } : s
        ),
      };
      newState = refillShopSlot(newState, slot.slotIndex);
      return { newState, instance };
    }
  }

  // 3. Monster slot top cards
  for (const slot of state.monsterSlots) {
    if (slot.stack.length === 0) continue;
    const top = slot.stack[slot.stack.length - 1];
    const match = instanceId ? top.instanceId === instanceId : top.cardId === cardId;
    if (match) {
      const instance = top;
      const newStack = slot.stack.slice(0, -1);
      let newState: GameState = {
        ...state,
        monsterSlots: state.monsterSlots.map((s) =>
          s.slotIndex === slot.slotIndex ? { ...s, stack: newStack } : s
        ),
      };
      if (newStack.length === 0) {
        newState = refillMonsterSlot(newState, slot.slotIndex);
      }
      return { newState, instance };
    }
  }

  // 4. Room slots
  for (const room of state.roomSlots) {
    const match = instanceId ? room.instanceId === instanceId : room.cardId === cardId;
    if (match) {
      const instance = room;
      const newState: GameState = {
        ...state,
        roomSlots: state.roomSlots.filter((r) => r.instanceId !== room.instanceId),
      };
      return { newState, instance };
    }
  }

  // 5. Hand — find any player holding cardId and create a fresh instance
  for (const p of state.players) {
    if (!p.handCardIds.includes(cardId)) continue;
    const instance = createCardInPlay(cardId);
    const newState: GameState = {
      ...state,
      players: state.players.map((pl) =>
        pl.id === p.id
          ? { ...pl, handCardIds: pl.handCardIds.filter((id) => id !== cardId) }
          : pl
      ),
    };
    return { newState, instance };
  }

  return { newState: state, instance: null };
}

/** Place a card on top of a monster slot.
 *  When instanceId is provided the existing CardInPlay is moved (counters preserved).
 *  When only cardId is provided the card is taken from the acting player's hand. */
export function coverMonster(
  state: GameState,
  slotIndex: number,
  cardId: string,
  playerId: string,
  instanceId?: string,
): { newState: GameState; error: string | null } {
  const slot = state.monsterSlots[slotIndex];
  if (!slot) return { newState: state, error: 'Invalid slot' };

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return { newState: state, error: 'Player not found' };

  let instance: CardInPlay;
  let baseState = state;

  if (instanceId) {
    // Multi-zone source: find and remove the existing CardInPlay
    // Verify ownership: card must belong to the acting player
    const ownerPlayer = state.players.find((p) =>
      p.items.some((i) => i.instanceId === instanceId) ||
      p.handCardIds.includes(cardId)
    );
    if (ownerPlayer && ownerPlayer.id !== playerId) {
      return { newState: state, error: 'You do not own this card' };
    }
    const wasRoomSlot = state.roomSlots.some((s) => s.instanceId === instanceId);
    const { newState: afterRemove, instance: found } = findAndRemoveCardInstance(state, cardId, instanceId);
    if (!found) return { newState: state, error: 'Card instance not found in any zone' };
    instance = found;
    baseState = wasRoomSlot ? drawRoomReplacement(afterRemove) : afterRemove;
  } else if (player.handCardIds.includes(cardId)) {
    // Hand-only fallback (original behaviour)
    instance = createCardInPlay(cardId);
    baseState = {
      ...state,
      players: state.players.map((p) =>
        p.id === playerId
          ? { ...p, handCardIds: p.handCardIds.filter((id) => id !== cardId) }
          : p
      ),
    };
  } else {
    // Stack-sourced card (no instanceId, not in hand) — create fresh instance; handler strips stack atomically
    instance = createCardInPlay(cardId);
  }

  const card = getCardById(cardId);
  const updatedSlots = baseState.monsterSlots.map((s) =>
    s.slotIndex === slotIndex ? { ...s, stack: [...s.stack, instance] } : s
  );

  const log = createLogEntry(
    'card_play',
    `${player.name} places ${card?.name ?? 'a card'} on the monster`,
    playerId
  );

  return {
    newState: { ...baseState, monsterSlots: updatedSlots, log: [...baseState.log, log] },
    error: null,
  };
}

/** Give a player-curse card from a monster slot to a target player's curses pile */
export function giveCurse(
  state: GameState,
  slotIndex: number,
  toPlayerId: string
): { newState: GameState; error: string | null } {
  const slot = state.monsterSlots[slotIndex];
  if (!slot || slot.stack.length === 0)
    return { newState: state, error: 'No card in that slot' };

  const topInstance = slot.stack[slot.stack.length - 1];
  const topCard = getCardById(topInstance.cardId);

  if (topCard?.subType !== 'Curse' || topCard?.hp !== null)
    return { newState: state, error: 'Card is not a player curse' };

  const toPlayer = state.players.find((p) => p.id === toPlayerId);
  if (!toPlayer) return { newState: state, error: 'Target player not found' };

  // Remove from slot
  const newStack = slot.stack.slice(0, -1);
  const updatedSlots = state.monsterSlots.map((s) =>
    s.slotIndex === slotIndex ? { ...s, stack: newStack } : s
  );

  // Give to player
  const players = state.players.map((p) =>
    p.id === toPlayerId ? { ...p, curses: [...p.curses, topInstance] } : p
  );

  const log = createLogEntry(
    'info',
    `${toPlayer.name} receives curse: ${topCard?.name ?? 'curse'}`,
    toPlayerId
  );

  let newState = {
    ...state,
    monsterSlots: updatedSlots,
    players,
    log: [...state.log, log],
  };

  // Refill the slot if now empty
  if (newStack.length === 0) {
    const { drawn, newDeck, newDiscard } = drawFromDeck(newState.monsterDeck, newState.monsterDiscard, 1);
    if (drawn[0]) {
      const newInstance = createCardInPlay(drawn[0]);
      newState = {
        ...newState,
        monsterDeck: newDeck,
        monsterDiscard: newDiscard,
        monsterSlots: newState.monsterSlots.map((s) =>
          s.slotIndex === slotIndex ? { ...s, stack: [newInstance] } : s
        ),
      };
    }
  }

  return { newState, error: null };
}

/** Discard the last room in roomSlots and optionally draw a new one */
export function discardRoom(state: GameState): GameState {
  if (state.roomSlots.length === 0) return state;

  const last = state.roomSlots[state.roomSlots.length - 1];
  const card = getCardById(last.cardId);
  const log = createLogEntry('info', `Room ${card?.name ?? 'card'} discarded`, null);

  const withoutLast = {
    ...state,
    roomSlots: state.roomSlots.slice(0, -1),
    roomDiscard: [...state.roomDiscard, last.cardId],
    log: [...state.log, log],
  };

  // Draw new room to replace it
  if (withoutLast.roomDeck.length > 0) {
    const { drawn, newDeck, newDiscard } = drawFromDeck(
      withoutLast.roomDeck,
      withoutLast.roomDiscard,
      1
    );
    if (drawn[0]) {
      const newRoom = createCardInPlay(drawn[0]);
      const newCard = getCardById(drawn[0]);
      const roomLog = createLogEntry('info', `${newCard?.name ?? 'A new room'} enters play`, null);
      return {
        ...withoutLast,
        roomDeck: newDeck,
        roomDiscard: newDiscard,
        roomSlots: [...withoutLast.roomSlots, newRoom],
        log: [...withoutLast.log, roomLog],
      };
    }
  }

  return withoutLast;
}

/** Discard a specific room slot by instanceId and optionally draw a replacement */
export function discardRoomSlot(state: GameState, instanceId: string): GameState {
  const slot = state.roomSlots.find((s) => s.instanceId === instanceId);
  if (!slot) return state;

  const card = getCardById(slot.cardId);
  const log = createLogEntry('info', `Room ${card?.name ?? 'card'} discarded`, null);

  const withoutSlot: GameState = {
    ...state,
    roomSlots: state.roomSlots.filter((s) => s.instanceId !== instanceId),
    roomDiscard: [...state.roomDiscard, slot.cardId],
    log: [...state.log, log],
  };

  // Draw new room to replace it
  if (withoutSlot.roomDeck.length > 0) {
    const { drawn, newDeck, newDiscard } = drawFromDeck(
      withoutSlot.roomDeck,
      withoutSlot.roomDiscard,
      1
    );
    if (drawn[0]) {
      const newRoom = createCardInPlay(drawn[0]);
      const newCard = getCardById(drawn[0]);
      const roomLog = createLogEntry('info', `${newCard?.name ?? 'A new room'} enters play`, null);
      return {
        ...withoutSlot,
        roomDeck: newDeck,
        roomDiscard: newDiscard,
        roomSlots: [...withoutSlot.roomSlots, newRoom],
        log: [...withoutSlot.log, roomLog],
      };
    }
  }

  return withoutSlot;
}

/**
 * If the room deck is non-empty, draw one card and add it to roomSlots.
 * Call this after any operation that removes a room slot card.
 */
export function drawRoomReplacement(state: GameState): GameState {
  if (state.roomDeck.length === 0) return state;
  const { drawn, newDeck, newDiscard } = drawFromDeck(state.roomDeck, state.roomDiscard, 1);
  if (!drawn[0]) return state;
  const newRoom = createCardInPlay(drawn[0]);
  const newCard = getCardById(drawn[0]);
  const log = createLogEntry('info', `${newCard?.name ?? 'A new room'} enters play`, null);
  return {
    ...state,
    roomDeck: newDeck,
    roomDiscard: newDiscard,
    roomSlots: [...state.roomSlots, newRoom],
    log: [...state.log, log],
  };
}

/**
 * Replace an existing room slot card with a new one.
 * The replaced card is discarded to roomDiscard.
 * The new card is pulled from wherever it currently lives (items, hand, shop, etc.)
 * No replacement draw — the incoming card itself fills the slot.
 */
export function replaceRoomSlot(
  state: GameState,
  replaceInstanceId: string,
  newInstanceId?: string,
  newCardId?: string,
  deckType?: 'loot' | 'treasure' | 'monster' | 'room',
): GameState {
  const oldSlot = state.roomSlots.find((s) => s.instanceId === replaceInstanceId);
  if (!oldSlot) return state;

  // Discard the old slot card
  let s: GameState = {
    ...state,
    roomSlots: state.roomSlots.filter((r) => r.instanceId !== replaceInstanceId),
    roomDiscard: [...state.roomDiscard, oldSlot.cardId],
  };

  let newInstance: CardInPlay;

  if (newInstanceId) {
    const { newState: afterRemove, instance } = findAndRemoveCardInstance(s, newCardId ?? '', newInstanceId);
    if (!instance) return state;
    s = afterRemove;
    newInstance = instance;
  } else if (newCardId) {
    if (deckType) {
      // Discard pile source — pop from the discard array
      const discardKey = `${deckType}Discard` as keyof GameState;
      const discard = s[discardKey] as string[];
      const idx = discard.lastIndexOf(newCardId);
      if (idx === -1) return state;
      const newDiscard = [...discard];
      newDiscard.splice(idx, 1);
      s = { ...s, [discardKey]: newDiscard };
      newInstance = createCardInPlay(newCardId);
    } else {
      // Hand card — remove from hand and create a fresh CardInPlay
      let found = false;
      for (const p of s.players) {
        if (p.handCardIds.includes(newCardId)) {
          s = {
            ...s,
            players: s.players.map((pl) =>
              pl.id === p.id
                ? { ...pl, handCardIds: pl.handCardIds.filter((id) => id !== newCardId) }
                : pl
            ),
          };
          found = true;
          break;
        }
      }
      if (!found) return state;
      newInstance = createCardInPlay(newCardId);
    }
  } else {
    return state;
  }

  const oldCard = getCardById(oldSlot.cardId);
  const newCard = getCardById(newInstance.cardId);
  const log = createLogEntry(
    'info',
    `${oldCard?.name ?? oldSlot.cardId} replaced by ${newCard?.name ?? newInstance.cardId} in room`,
    null,
  );

  return {
    ...s,
    roomSlots: [...s.roomSlots, newInstance],
    log: [...s.log, log],
  };
}


export function tradeCard(
  state: GameState,
  fromPlayerId: string,
  toPlayerId: string,
  instanceId: string | undefined,
  cardId: string | undefined,
  fromHand: boolean
): { newState: GameState; error: string | null } {
  const fromPlayer = state.players.find((p) => p.id === fromPlayerId);
  const toPlayer = state.players.find((p) => p.id === toPlayerId);
  if (!fromPlayer) return { newState: state, error: 'From-player not found' };
  if (!toPlayer) return { newState: state, error: 'Target player not found' };

  let newState = state;

  if (fromHand && cardId) {
    // Trade a loot hand card
    if (!fromPlayer.handCardIds.includes(cardId))
      return { newState: state, error: 'Card not in hand' };

    const card = getCardById(cardId);
    const log = createLogEntry(
      'info',
      `${fromPlayer.name} gives ${card?.name ?? cardId} (hand) to ${toPlayer.name}`,
      fromPlayerId
    );

    newState = {
      ...state,
      players: state.players.map((p) => {
        if (p.id === fromPlayerId)
          return { ...p, handCardIds: p.handCardIds.filter((id) => id !== cardId) };
        if (p.id === toPlayerId)
          return { ...p, handCardIds: [...p.handCardIds, cardId] };
        return p;
      }),
      log: [...state.log, log],
    };
  } else if (instanceId) {
    // Trade an item — check it's not a Curse kill
    const itemInstance = fromPlayer.items.find((i) => i.instanceId === instanceId);
    if (!itemInstance) return { newState: state, error: 'Item not found in player items' };

    const card = getCardById(itemInstance.cardId);
    if (card?.subType === 'Curse') return { newState: state, error: 'Curse cards cannot be traded' };
    const log = createLogEntry(
      'info',
      `${fromPlayer.name} gives ${card?.name ?? itemInstance.cardId} to ${toPlayer.name}`,
      fromPlayerId
    );

    newState = {
      ...state,
      players: state.players.map((p) => {
        if (p.id === fromPlayerId)
          return { ...p, items: p.items.filter((i) => i.instanceId !== instanceId) };
        if (p.id === toPlayerId)
          return { ...p, items: [...p.items, itemInstance] };
        return p;
      }),
      log: [...state.log, log],
    };
  } else {
    return { newState: state, error: 'No card specified for trade' };
  }

  return { newState, error: null };
}

// ─── Privileged override actions ─────────────────────────────────────────────
// These bypass normal game-rule validation. They are gated behind
// GameState.allowPrivilegedActions and logged with an [OVERRIDE] prefix so the
// game history remains auditable.

/**
 * Move any card (by instanceId or cardId) to a player's hand.
 * Source zone is detected and the card is removed automatically.
 * Hand holds cardIds only — counters are not preserved (hand cards have no counters).
 */
export function moveToHand(
  state: GameState,
  actorPlayerId: string,
  cardId: string,
  instanceId: string | undefined,
  targetPlayerId: string,
  deckType?: 'loot' | 'treasure' | 'monster' | 'room',
): GameState {
  const targetPlayer = state.players.find((p) => p.id === targetPlayerId);
  if (!targetPlayer) return state;

  const actor = state.players.find((p) => p.id === actorPlayerId);
  const card = getCardById(cardId);

  let newState: GameState;

  if (deckType && !instanceId) {
    const discardKey = `${deckType}Discard` as keyof GameState;
    const discard = state[discardKey] as string[];
    const idx = discard.lastIndexOf(cardId);
    if (idx === -1) return state;
    const newDiscard = [...discard];
    newDiscard.splice(idx, 1);
    newState = { ...state, [discardKey]: newDiscard };
  } else {
    const wasRoomSlot = instanceId ? state.roomSlots.some((s) => s.instanceId === instanceId) : false;
    const result = findAndRemoveCardInstance(state, cardId, instanceId);
    // If not found in any zone, the card may exist only on the stack (e.g. a played loot card).
    // The handler will strip it from the stack atomically — just proceed with current state.
    newState = result.instance
      ? (wasRoomSlot ? drawRoomReplacement(result.newState) : result.newState)
      : state;
  }

  const log = createLogEntry(
    'info',
    `[OVERRIDE] ${actor?.name ?? actorPlayerId} moves ${card?.name ?? cardId} to ${targetPlayer.name}'s hand`,
    actorPlayerId,
  );

  return {
    ...newState,
    players: newState.players.map((p) =>
      p.id === targetPlayerId ? { ...p, handCardIds: [...p.handCardIds, cardId] } : p
    ),
    log: [...newState.log, log],
  };
}

/**
 * Place any card (by instanceId or cardId) directly into a shop slot.
 * Preserves counters on the CardInPlay instance.
 * If the slot is already occupied the displaced card is sent to treasureDiscard.
 */
export function placeInShop(
  state: GameState,
  actorPlayerId: string,
  cardId: string,
  instanceId: string | undefined,
  slotIndex: number,
  deckType?: 'loot' | 'treasure' | 'monster' | 'room',
): GameState {
  const slot = state.shopSlots[slotIndex];
  if (!slot) return state;

  const actor = state.players.find((p) => p.id === actorPlayerId);
  const card = getCardById(cardId);

  let afterRemove: GameState;
  let instance: CardInPlay;

  if (deckType && !instanceId) {
    const discardKey = `${deckType}Discard` as keyof GameState;
    const discard = state[discardKey] as string[];
    const idx = discard.lastIndexOf(cardId);
    if (idx === -1) return state;
    const newDiscard = [...discard];
    newDiscard.splice(idx, 1);
    afterRemove = { ...state, [discardKey]: newDiscard };
    instance = createCardInPlay(cardId);
  } else {
    const wasRoomSlot = instanceId ? state.roomSlots.some((s) => s.instanceId === instanceId) : false;
    const result = findAndRemoveCardInstance(state, cardId, instanceId);
    // If not found, card may exist only on the stack; proceed — handler strips it atomically.
    afterRemove = result.instance
      ? (wasRoomSlot ? drawRoomReplacement(result.newState) : result.newState)
      : state;
    instance = result.instance ?? createCardInPlay(cardId);
  }

  // If the slot is occupied, discard the displaced card
  let baseState = afterRemove;
  if (slot.card) {
    baseState = {
      ...baseState,
      treasureDiscard: [...baseState.treasureDiscard, slot.card.cardId],
    };
  }

  const log = createLogEntry(
    'info',
    `[OVERRIDE] ${actor?.name ?? actorPlayerId} places ${card?.name ?? cardId} in shop slot ${slotIndex + 1}`,
    actorPlayerId,
  );

  return {
    ...baseState,
    shopSlots: baseState.shopSlots.map((s) =>
      s.slotIndex === slotIndex ? { ...s, card: instance } : s
    ),
    log: [...baseState.log, log],
  };
}

/**
 * Move any card (by instanceId or cardId) directly into a player's items.
 * Preserves counters on the CardInPlay instance.
 */
export function moveToItems(
  state: GameState,
  actorPlayerId: string,
  cardId: string,
  instanceId: string | undefined,
  targetPlayerId: string,
  deckType?: 'loot' | 'treasure' | 'monster' | 'room',
): GameState {
  const targetPlayer = state.players.find((p) => p.id === targetPlayerId);
  if (!targetPlayer) return state;

  const actor = state.players.find((p) => p.id === actorPlayerId);
  const card = getCardById(cardId);

  let afterRemove: GameState;
  let instance: CardInPlay;

  if (deckType && !instanceId) {
    const discardKey = `${deckType}Discard` as keyof GameState;
    const discard = state[discardKey] as string[];
    const idx = discard.lastIndexOf(cardId);
    if (idx === -1) return state;
    const newDiscard = [...discard];
    newDiscard.splice(idx, 1);
    afterRemove = { ...state, [discardKey]: newDiscard };
    instance = createCardInPlay(cardId);
  } else {
    const wasRoomSlot = instanceId ? state.roomSlots.some((s) => s.instanceId === instanceId) : false;
    const result = findAndRemoveCardInstance(state, cardId, instanceId);
    // If not found, card may exist only on the stack; proceed — handler strips it atomically.
    afterRemove = result.instance
      ? (wasRoomSlot ? drawRoomReplacement(result.newState) : result.newState)
      : state;
    instance = result.instance ?? createCardInPlay(cardId);
  }

  const log = createLogEntry(
    'info',
    `[OVERRIDE] ${actor?.name ?? actorPlayerId} moves ${card?.name ?? cardId} to ${targetPlayer.name}'s items`,
    actorPlayerId,
  );

  return {
    ...afterRemove,
    players: afterRemove.players.map((p) =>
      p.id === targetPlayerId ? { ...p, items: [...p.items, instance] } : p
    ),
    log: [...afterRemove.log, log],
  };
}
