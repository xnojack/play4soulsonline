import { GameState, CardInPlay, MonsterSlot } from '../types';
import { createLogEntry } from '../GameRoom';
import { drawFromDeck, createCardInPlay } from '../decks';
import { getCardById } from '../../db/cards';
import { resetPriority, pushStack } from '../stack';

/** Declare an attack on a monster slot */
export function declareAttack(
  state: GameState,
  attackerId: string,
  slotIndex: number
): { newState: GameState; error: string | null } {
  if (state.turn.activePlayerId !== attackerId)
    return { newState: state, error: 'Not your turn' };
  if (state.turn.currentAttack !== null)
    return { newState: state, error: 'Attack already in progress' };

  const slot = state.monsterSlots[slotIndex];
  if (!slot || slot.stack.length === 0)
    return { newState: state, error: 'No monster in that slot' };

  const player = state.players.find((p) => p.id === attackerId);
  const monsterInstance = slot.stack[slot.stack.length - 1]; // top of stack
  const monster = getCardById(monsterInstance.cardId);

  const log = createLogEntry(
    'attack',
    `${player?.name ?? attackerId} declares an attack on ${monster?.name ?? 'monster'}`,
    attackerId
  );

  const newTurn = {
    ...state.turn,
    attacksDeclared: state.turn.attacksDeclared + 1,
    currentAttack: {
      attackerId,
      targetType: 'monster_slot' as const,
      targetSlotIndex: slotIndex,
      phase: 'declared' as const,
      rollResult: null,
      teamUpPlayerIds: [],
      teamUpRolls: {},
    },
  };

  // Push attack_declaration onto the stack so players can respond before the roll.
  // pushStack() handles priority reset from the attacker's seat position.
  const stateWithAttack = { ...state, turn: newTurn, log: [...state.log, log] };
  const newState = pushStack(stateWithAttack, {
    type: 'attack_declaration',
    sourceCardInstanceId: monsterInstance.instanceId,
    sourcePlayerId: attackerId,
    description: `${player?.name ?? attackerId} attacks ${monster?.name ?? 'monster'}`,
    targets: [monsterInstance.instanceId],
    data: { slotIndex, monsterId: monsterInstance.cardId },
  });

  return { newState, error: null };
}

/** Roll a d6 for the current attack */
export function rollAttackDice(
  state: GameState,
  playerId: string
): { newState: GameState; roll: number; error: string | null } {
  const attack = state.turn.currentAttack;
  if (!attack) return { newState: state, roll: 0, error: 'No attack in progress' };
  if (attack.phase !== 'declared' && attack.phase !== 'rolling')
    return { newState: state, roll: 0, error: 'Invalid attack phase for rolling' };

  const roll = Math.floor(Math.random() * 6) + 1;
  const player = state.players.find((p) => p.id === playerId);

  const log = createLogEntry(
    'dice',
    `${player?.name ?? playerId} rolled a ${roll}`,
    playerId
  );

  const newAttack = {
    ...attack,
    phase: 'resolving' as const,
    rollResult: roll,
  };

  return {
    newState: { ...state, turn: { ...state.turn, currentAttack: newAttack }, log: [...state.log, log] },
    roll,
    error: null,
  };
}

/** Resolve the current attack roll against monster evasion */
export function resolveAttack(
  state: GameState
): { newState: GameState; hit: boolean; error: string | null } {
  const attack = state.turn.currentAttack;
  if (!attack || attack.rollResult === null)
    return { newState: state, hit: false, error: 'No resolved roll to apply' };
  if (attack.targetType !== 'monster_slot' || attack.targetSlotIndex === undefined)
    return { newState: state, hit: false, error: 'Invalid attack target' };

  const slot = state.monsterSlots[attack.targetSlotIndex];
  if (!slot || slot.stack.length === 0)
    return { newState: state, hit: false, error: 'Monster slot empty' };

  const monsterInstance = slot.stack[slot.stack.length - 1];
  const monster = getCardById(monsterInstance.cardId);
  const evasion = monster?.evasion ?? 1;

  const hit = attack.rollResult >= evasion;

  const player = state.players.find((p) => p.id === attack.attackerId);
  const log = createLogEntry(
    'attack',
    hit
      ? `${player?.name ?? attack.attackerId} hits ${monster?.name ?? 'monster'} (rolled ${attack.rollResult}, needed ${evasion})`
      : `${player?.name ?? attack.attackerId} misses ${monster?.name ?? 'monster'} (rolled ${attack.rollResult}, needed ${evasion})`,
    attack.attackerId
  );

  if (hit) {
    // Apply player's attack damage
    const player = state.players.find((p) => p.id === attack.attackerId);
    const dmg = (player?.baseAtk ?? 1) + (player?.atkCounters ?? 0);
    const newState = applyDamageToMonster(
      { ...state, turn: { ...state.turn, currentAttack: { ...attack, phase: 'done' as const } }, log: [...state.log, log] },
      attack.targetSlotIndex,
      dmg,
      attack.attackerId
    );
    return { newState, hit: true, error: null };
  }

  const newTurn = { ...state.turn, currentAttack: { ...attack, phase: 'done' as const } };
  return {
    newState: { ...state, turn: newTurn, log: [...state.log, log] },
    hit: false,
    error: null,
  };
}

/** Apply damage to a monster in a slot; handle death */
export function applyDamageToMonster(
  state: GameState,
  slotIndex: number,
  amount: number,
  attackerId: string
): GameState {
  const slot = state.monsterSlots[slotIndex];
  if (!slot || slot.stack.length === 0) return state;

  const topIdx = slot.stack.length - 1;
  const monsterInstance = slot.stack[topIdx];
  const monster = getCardById(monsterInstance.cardId);

  const newDamage = monsterInstance.damageCounters + amount;
  const maxHp = (monster?.hp ?? 1) + monsterInstance.hpCounters;

  if (newDamage >= maxHp) {
    // Monster dies
    return killMonster(state, slotIndex, attackerId);
  }

  // Update damage counters
  const updatedInstance = { ...monsterInstance, damageCounters: newDamage };
  const updatedStack = [...slot.stack];
  updatedStack[topIdx] = updatedInstance;

  const updatedSlots = state.monsterSlots.map((s) =>
    s.slotIndex === slotIndex ? { ...s, stack: updatedStack } : s
  );

  const player = state.players.find((p) => p.id === attackerId);
  const log = createLogEntry(
    'attack',
    `${monster?.name ?? 'Monster'} takes ${amount} damage (${newDamage}/${maxHp} HP)`,
    attackerId
  );

  return { ...state, monsterSlots: updatedSlots, log: [...state.log, log] };
}

/** Heal a monster in a slot */
export function healMonster(
  state: GameState,
  slotIndex: number,
  amount: number
): GameState {
  const slot = state.monsterSlots[slotIndex];
  if (!slot || slot.stack.length === 0) return state;

  const topIdx = slot.stack.length - 1;
  const monsterInstance = slot.stack[topIdx];
  const newDamage = Math.max(0, monsterInstance.damageCounters - amount);
  const updatedInstance = { ...monsterInstance, damageCounters: newDamage };

  const updatedStack = [...slot.stack];
  updatedStack[topIdx] = updatedInstance;

  const updatedSlots = state.monsterSlots.map((s) =>
    s.slotIndex === slotIndex ? { ...s, stack: updatedStack } : s
  );

  return { ...state, monsterSlots: updatedSlots };
}

/** Kill the top monster in a slot; uncovered card becomes in-play */
export function killMonster(
  state: GameState,
  slotIndex: number,
  activePlayerId: string
): GameState {
  const slot = state.monsterSlots[slotIndex];
  if (!slot || slot.stack.length === 0) return state;

  const deadInstance = slot.stack[slot.stack.length - 1];
  const deadCard = getCardById(deadInstance.cardId);

  // Pop dead monster; remaining stack has uncovered cards
  const newStack = slot.stack.slice(0, -1);

  // Reset damage on newly uncovered top (if any)
  if (newStack.length > 0) {
    newStack[newStack.length - 1] = {
      ...newStack[newStack.length - 1],
      damageCounters: 0,
    };
  }

  const updatedSlots = state.monsterSlots.map((s) =>
    s.slotIndex === slotIndex ? { ...s, stack: newStack } : s
  );

  const player = state.players.find((p) => p.id === activePlayerId);
  const isCurseMonster = deadCard?.subType === 'Curse';
  const hasSoulValue = (deadCard?.soulValue ?? 0) > 0;

  const logs: ReturnType<typeof createLogEntry>[] = [
    createLogEntry(
      'death',
      `${deadCard?.name ?? 'Monster'} was killed by ${player?.name ?? activePlayerId}`,
      activePlayerId
    ),
  ];

  let newState = { ...state, monsterSlots: updatedSlots, log: [...state.log, ...logs] };

  // Route the dead card to the correct player pile:
  //   Curse subtype WITH hp (e.g. Cursed Psy Horf) = attackable curse monster → kills (trophy)
  //   Curse subtype WITHOUT hp (e.g. Curse of Amnesia) = player curse → curses
  //     (in practice these should be given via action:give_curse, not killed; but handle defensively)
  //   soul_value > 0 = boss/mini-boss → souls
  //   everything else = normal monster → kills
  const isPlayerCurse = isCurseMonster && deadCard?.hp === null;
  const isCurseMonsterWithHP = isCurseMonster && deadCard?.hp !== null;

  if (isPlayerCurse) {
    newState = {
      ...newState,
      players: newState.players.map((p) =>
        p.id === activePlayerId
          ? { ...p, curses: [...p.curses, deadInstance] }
          : p
      ),
      log: [
        ...newState.log,
        createLogEntry(
          'info',
          `${player?.name ?? activePlayerId} is cursed by ${deadCard?.name ?? 'a curse'}!`,
          activePlayerId
        ),
      ],
    };
  } else if (hasSoulValue) {
    newState = {
      ...newState,
      players: newState.players.map((p) =>
        p.id === activePlayerId
          ? { ...p, souls: [...p.souls, deadInstance] }
          : p
      ),
      log: [
        ...newState.log,
        createLogEntry(
          'soul_gain',
          `${player?.name ?? activePlayerId} gains ${deadCard?.name ?? 'monster'} as a soul (worth ${deadCard?.soulValue} soul pt${deadCard?.soulValue !== 1 ? 's' : ''})`,
          activePlayerId
        ),
      ],
    };
  } else {
    // Curse monsters with HP and normal monsters go to monster discard
    newState = {
      ...newState,
      monsterDiscard: [...newState.monsterDiscard, deadInstance.cardId],
    };
  }

  // Grant reward text log (applies to all kills)
  if (deadCard?.rewardText) {
    newState = {
      ...newState,
      log: [
        ...newState.log,
        createLogEntry(
          'info',
          `Reward for ${player?.name ?? activePlayerId}: ${deadCard.rewardText}`,
          activePlayerId
        ),
      ],
    };
  }

  // Refill the slot if empty
  if (newStack.length === 0) {
    newState = refillMonsterSlot(newState, slotIndex);
  }

  // Clear the attack
  newState = {
    ...newState,
    turn: { ...newState.turn, currentAttack: null },
  };

  return newState;
}

/** Resolve/discard an event card from the top of a monster slot and refill */
export function resolveEventCard(
  state: GameState,
  slotIndex: number,
  playerId: string
): { newState: GameState; error: string | null } {
  const slot = state.monsterSlots[slotIndex];
  if (!slot || slot.stack.length === 0)
    return { newState: state, error: 'No card in that slot' };

  const topInstance = slot.stack[slot.stack.length - 1];
  const topCard = getCardById(topInstance.cardId);

  // Only Events should be resolved this way
  if (topCard && topCard.subType !== 'Event')
    return { newState: state, error: 'Card is not an event — attack it instead' };

  // Remove from slot
  const newStack = slot.stack.slice(0, -1);
  const updatedSlots = state.monsterSlots.map((s) =>
    s.slotIndex === slotIndex ? { ...s, stack: newStack } : s
  );

  const player = state.players.find((p) => p.id === playerId);
  const log = createLogEntry(
    'info',
    `${player?.name ?? 'Someone'} resolves ${topCard?.name ?? 'card'} — sent to discard`,
    playerId
  );

  let newState = {
    ...state,
    monsterSlots: updatedSlots,
    monsterDiscard: [...state.monsterDiscard, topInstance.cardId],
    log: [...state.log, log],
  };

  // If slot is now empty, refill it
  if (newStack.length === 0) {
    newState = refillMonsterSlot(newState, slotIndex);
  }

  return { newState, error: null };
}
export function refillMonsterSlot(state: GameState, slotIndex: number): GameState {
  const { drawn, newDeck, newDiscard } = drawFromDeck(
    state.monsterDeck,
    state.monsterDiscard,
    1
  );

  if (!drawn[0]) return state;

  const card = getCardById(drawn[0]);
  const newInstance = createCardInPlay(drawn[0]);

  // If it's an event, it goes into the slot and its abilities trigger
  // (manual for now — just place it)
  const updatedSlots = state.monsterSlots.map((s) =>
    s.slotIndex === slotIndex ? { ...s, stack: [newInstance] } : s
  );

  const log = createLogEntry(
    'info',
    `${card?.name ?? 'A new monster'} appears in the monster slot`,
    null
  );

  return {
    ...state,
    monsterDeck: newDeck,
    monsterDiscard: newDiscard,
    monsterSlots: updatedSlots,
    log: [...state.log, log],
  };
}

/** Manually apply damage to a player */
export function applyDamageToPlayer(
  state: GameState,
  targetPlayerId: string,
  amount: number
): GameState {
  const player = state.players.find((p) => p.id === targetPlayerId);
  if (!player) return state;

  const newDamage = player.currentDamage + amount;
  const effectiveHp = player.baseHp + player.hpCounters - newDamage;

  let newState = {
    ...state,
    players: state.players.map((p) =>
      p.id === targetPlayerId ? { ...p, currentDamage: newDamage } : p
    ),
    log: [
      ...state.log,
      createLogEntry(
        'attack',
        `${player.name} takes ${amount} damage (HP: ${Math.max(0, effectiveHp)}/${player.baseHp + player.hpCounters})`,
        targetPlayerId
      ),
    ],
  };

  if (effectiveHp <= 0) {
    // Death is deferred to the stack — handler will push it after state update
  }

  return newState;
}

/** Heal a player */
export function healPlayer(
  state: GameState,
  targetPlayerId: string,
  amount: number
): GameState {
  const player = state.players.find((p) => p.id === targetPlayerId);
  if (!player) return state;

  // Can't heal while death is on the stack
  const deathOnStack = state.stack.some(
    (s) => s.type === 'death' && !s.isCanceled && s.data.playerId === targetPlayerId
  );
  if (deathOnStack) return state;

  const maxHp = player.baseHp + player.hpCounters;
  const newDamage = Math.max(0, player.currentDamage - amount);
  const newHp = maxHp - newDamage;
  // Revive if HP restored above 0
  const isAlive = newHp > 0;

  return {
    ...state,
    players: state.players.map((p) =>
      p.id === targetPlayerId ? { ...p, currentDamage: newDamage, isAlive } : p
    ),
    log: [
      ...state.log,
      createLogEntry('info', `${player.name} heals ${amount} HP (HP: ${newHp}/${maxHp})`, targetPlayerId),
    ],
  };
}

/** Apply death penalty to a player.
 *  Destroy one non-eternal item (chosen by caller via itemId, or first available),
 *  discard one loot card, lose 1¢, deactivate all ↷ items.
 *  Each step is optional — if the player can't pay a part, it's skipped. */
export function applyDeathPenalty(
  state: GameState,
  playerId: string,
  itemIdToDestroy?: string
): GameState {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return state;

  let s = state;
  const logs: ReturnType<typeof createLogEntry>[] = [];

  // 1. Destroy a non-eternal item (player's choice, or first available)
  const nonEternalItems = player.items.filter((item) => {
    const card = getCardById(item.cardId);
    return !card?.isEternal;
  });

  if (nonEternalItems.length > 0) {
    let chosenItem: CardInPlay | null = null;
    if (itemIdToDestroy) {
      chosenItem = nonEternalItems.find((i) => i.instanceId === itemIdToDestroy) || null;
    }
    if (!chosenItem) {
      chosenItem = nonEternalItems[0];
    }

    if (chosenItem) {
      const card = getCardById(chosenItem.cardId);
      s = {
        ...s,
        players: s.players.map((p) =>
          p.id === playerId
            ? { ...p, items: p.items.filter((i) => i.instanceId !== chosenItem!.instanceId) }
            : p
        ),
        treasureDiscard: [...s.treasureDiscard, chosenItem.cardId],
      };
      logs.push(createLogEntry(
        'death',
        `${player.name} destroys ${card?.name ?? 'an item'} as death penalty`,
        playerId
      ));
    }
  }

  // 2. Discard one loot card from hand
  if (s.players.find((p) => p.id === playerId)!.handCardIds.length > 0) {
    const discardedCardId = s.players.find((p) => p.id === playerId)!.handCardIds[0];
    s = {
      ...s,
      players: s.players.map((p) =>
        p.id === playerId
          ? { ...p, handCardIds: p.handCardIds.filter((id) => id !== discardedCardId) }
          : p
      ),
      lootDiscard: [...s.lootDiscard, discardedCardId],
    };
    const card = getCardById(discardedCardId);
    logs.push(createLogEntry(
      'death',
      `${player.name} discards ${card?.name ?? 'a loot card'} as death penalty`,
      playerId
    ));
  }

  // 3. Lose 1¢
  const currentPlayer = s.players.find((p) => p.id === playerId)!;
  if (currentPlayer.coins > 0) {
    s = {
      ...s,
      players: s.players.map((p) =>
        p.id === playerId ? { ...p, coins: p.coins - 1 } : p
      ),
    };
    logs.push(createLogEntry(
      'death',
      `${player.name} loses 1¢ as death penalty`,
      playerId
    ));
  }

  // 4. Deactivate all ↷ items (items with activated abilities)
  const deactivatedItems = s.players.find((p) => p.id === playerId)!.items.map((item) => {
    const card = getCardById(item.cardId);
    // Deactivate if the card has an activated ability (gold border / active item)
    // We check if the ability text contains ↷ or $ tags
    const hasActivatedAbility = card?.abilityText?.match(/↷|\$/);
    return hasActivatedAbility ? { ...item, charged: false } : item;
  });
  s = {
    ...s,
    players: s.players.map((p) =>
      p.id === playerId ? { ...p, items: deactivatedItems } : p
    ),
  };

  // Clear curses → monster discard
  const curses = s.players.find((p) => p.id === playerId)!.curses;
  if (curses.length > 0) {
    const curseIds = curses.map((c) => c.cardId);
    s = {
      ...s,
      players: s.players.map((p) =>
        p.id === playerId ? { ...p, curses: [] } : p
      ),
      monsterDiscard: [...s.monsterDiscard, ...curseIds],
    };
  }

  return {
    ...s,
    log: [...s.log, ...logs],
  };
}
