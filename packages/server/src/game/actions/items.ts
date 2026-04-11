import { GameState, CardInPlay } from '../types';
import { createLogEntry } from '../GameRoom';
import { getCardById } from '../../db/cards';
import { createCardInPlay, drawFromDeck } from '../decks';

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

/** Destroy a card (remove from play and send to appropriate discard) */
export function destroyCard(state: GameState, instanceId: string): GameState {
  // Search players' items, souls, curses, kills
  let destroyed: CardInPlay | undefined;
  let sourceType: 'item' | 'soul' | 'curse' | 'kill' | null = null;
  let sourcePlayerId: string | null = null;

  let players = state.players.map((p) => {
    // Check items
    const itemIdx = p.items.findIndex((i) => i.instanceId === instanceId);
    if (itemIdx !== -1) {
      const card = getCardById(p.items[itemIdx].cardId);
      if (card?.isEternal) return p; // Eternal items can't be destroyed
      destroyed = p.items[itemIdx] as CardInPlay;
      sourceType = 'item';
      sourcePlayerId = p.id;
      return { ...p, items: p.items.filter((i) => i.instanceId !== instanceId) };
    }
    // Check souls
    const soulIdx = p.souls.findIndex((i) => i.instanceId === instanceId);
    if (soulIdx !== -1) {
      destroyed = p.souls[soulIdx] as CardInPlay;
      sourceType = 'soul';
      sourcePlayerId = p.id;
      return { ...p, souls: p.souls.filter((i) => i.instanceId !== instanceId) };
    }
    // Check curses
    const curseIdx = p.curses.findIndex((i) => i.instanceId === instanceId);
    if (curseIdx !== -1) {
      destroyed = p.curses[curseIdx] as CardInPlay;
      sourceType = 'curse';
      sourcePlayerId = p.id;
      return { ...p, curses: p.curses.filter((i) => i.instanceId !== instanceId) };
    }
    // Check kills — Curse subtype kills cannot be removed
    const killIdx = p.kills.findIndex((i) => i.instanceId === instanceId);
    if (killIdx !== -1) {
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

/** Place an ambush/trinket loot card on top of a monster slot */
export function coverMonster(
  state: GameState,
  slotIndex: number,
  cardId: string,
  playerId: string
): { newState: GameState; error: string | null } {
  const slot = state.monsterSlots[slotIndex];
  if (!slot) return { newState: state, error: 'Invalid slot' };

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return { newState: state, error: 'Player not found' };

  // Remove from hand
  if (!player.handCardIds.includes(cardId))
    return { newState: state, error: 'Card not in hand' };

  const newInstance = createCardInPlay(cardId);
  const card = getCardById(cardId);

  const updatedSlots = state.monsterSlots.map((s) =>
    s.slotIndex === slotIndex ? { ...s, stack: [...s.stack, newInstance] } : s
  );

  const players = state.players.map((p) =>
    p.id === playerId
      ? { ...p, handCardIds: p.handCardIds.filter((id) => id !== cardId) }
      : p
  );

  const log = createLogEntry(
    'card_play',
    `${player.name} places ${card?.name ?? 'a card'} on the monster`,
    playerId
  );

  return {
    newState: { ...state, players, monsterSlots: updatedSlots, log: [...state.log, log] },
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

/** Trade a card (item or hand card) from one player to another */
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
