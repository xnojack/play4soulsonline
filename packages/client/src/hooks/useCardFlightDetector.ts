import { useEffect, useRef } from 'react';
import { useGameStore, GameState } from '../store/gameStore';
import { useCardFlightStore } from '../store/cardFlightStore';

/**
 * Subscribes to game state mutations and detects card-movement events,
 * enqueueing FLIP-style flight animations for each.
 *
 * Detected events (best-effort, not exhaustive):
 *   - Loot drawn       → loot deck → recipient hand/items
 *   - Treasure gained  → treasure deck → player items
 *   - Shop purchased   → shop slot   → player items
 *   - Stack item added → source area → the stack
 *   - Monster damaged  → attacker character → monster slot (only on damage delta)
 *
 * Implementation notes:
 *   - We compare *previous* snapshot to *new* snapshot whenever `game` changes.
 *   - To avoid spurious flights on initial mount, the very first snapshot is
 *     stored without producing animations.
 *   - Player.handCount is used (not handCardIds — those are private to viewer).
 */
export function useCardFlightDetector() {
  const game = useGameStore((s) => s.game);
  const enqueue = useCardFlightStore((s) => s.enqueue);
  const prevRef = useRef<GameState | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = game;
    if (!game) return;
    if (!prev) return; // first snapshot — no animations
    if (prev.roomId !== game.roomId) return; // different game/room

    // ── Stack item additions ────────────────────────────────────────────────
    const prevStackIds = new Set(prev.stack.map((s) => s.id));
    const newStackItems = game.stack.filter((s) => !prevStackIds.has(s.id));
    for (const item of newStackItems) {
      // Try to figure out where the source card is — look up across players
      const fromZone = findCardOriginZone(prev, game, item.sourceCardInstanceId, item.sourcePlayerId);
      const cardId = item.type === 'loot' || item.type === 'dice_roll'
        ? item.sourceCardInstanceId
        : null;
      enqueue({
        fromZone,
        toZone: 'the-stack',
        cardId,
        backType: 'loot',
      });
    }

    // ── Per-player diffs ────────────────────────────────────────────────────
    for (const newP of game.players) {
      const oldP = prev.players.find((p) => p.id === newP.id);
      if (!oldP) continue;

      // Items gained (treasure / shop purchase)
      const oldItemIds = new Set(oldP.items.map((i) => i.instanceId));
      const newItems = newP.items.filter((i) => !oldItemIds.has(i.instanceId));
      for (const item of newItems) {
        // Heuristic: if a shop slot's cardId matches and is now empty, came from shop
        let fromZone = 'treasure-deck';
        const matchingShop = prev.shopSlots.find(
          (s) => s.card?.cardId === item.cardId &&
                 !game.shopSlots.find((s2) => s2.slotIndex === s.slotIndex)?.card,
        );
        if (matchingShop) fromZone = `shop-${matchingShop.slotIndex}`;
        enqueue({
          fromZone,
          toZone: `items-${newP.id}`,
          cardId: item.cardId,
          backType: 'treasure',
        });
      }

      // Hand size growth → loot draw (only animate, can't show real card to others)
      const handGrowth = newP.handCount - oldP.handCount;
      if (handGrowth > 0) {
        // Cap the visual flurry at 4 cards
        const animCount = Math.min(handGrowth, 4);
        for (let i = 0; i < animCount; i++) {
          // Only the recipient knows the actual cardId; non-recipients see the back
          const isRecipient = newP.id === game.myPlayerId;
          const cardId = isRecipient && newP.handCardIds[oldP.handCardIds.length + i]
            ? newP.handCardIds[oldP.handCardIds.length + i]
            : null;
          enqueue({
            fromZone: 'loot-deck',
            toZone: newP.id === game.myPlayerId ? 'my-hand' : `player-${newP.id}`,
            cardId,
            backType: 'loot',
            durationMs: 600 + i * 80,
          });
        }
      }

      // Soul gained
      const oldSoulIds = new Set(oldP.souls.map((s) => s.instanceId));
      const newSouls = newP.souls.filter((s) => !oldSoulIds.has(s.instanceId));
      for (const soul of newSouls) {
        enqueue({
          fromZone: 'monster-deck',
          toZone: `player-${newP.id}`,
          cardId: soul.cardId || null,
          backType: 'monster',
        });
      }
    }

    // ── Shop slot refills (treasure deck → shop slot) ───────────────────────
    for (const newSlot of game.shopSlots) {
      const oldSlot = prev.shopSlots.find((s) => s.slotIndex === newSlot.slotIndex);
      if (!oldSlot) continue;
      const wasEmpty = !oldSlot.card;
      const nowFilled = !!newSlot.card;
      if (wasEmpty && nowFilled && newSlot.card) {
        enqueue({
          fromZone: 'treasure-deck',
          toZone: `shop-${newSlot.slotIndex}`,
          cardId: newSlot.card.cardId,
          backType: 'treasure',
        });
      }
    }

    // ── Monster slots: new monster drawn (deck → slot) ──────────────────────
    for (const newSlot of game.monsterSlots) {
      const oldSlot = prev.monsterSlots.find((s) => s.slotIndex === newSlot.slotIndex);
      if (!oldSlot) continue;
      // New top card not present before
      const newTop = newSlot.stack[newSlot.stack.length - 1];
      const oldTopIds = new Set(oldSlot.stack.map((c) => c.instanceId));
      if (newTop && !oldTopIds.has(newTop.instanceId)) {
        enqueue({
          fromZone: 'monster-deck',
          toZone: `monster-${newSlot.slotIndex}`,
          cardId: newTop.cardId,
          backType: 'monster',
        });
      }
    }
  }, [game, enqueue]);
}

/**
 * Best-effort lookup of where a stack source card lives currently or lived
 * before. Returns a data-zone selector. Falls back to the source player's zone.
 */
function findCardOriginZone(
  prev: GameState,
  next: GameState,
  sourceCardInstanceId: string,
  sourcePlayerId: string,
): string {
  // Character cards
  if (prev.characterCards[sourceCardInstanceId] || next.characterCards[sourceCardInstanceId]) {
    return `player-${sourcePlayerId}`;
  }
  // Items
  for (const player of [...prev.players, ...next.players]) {
    if (player.items.find((i) => i.instanceId === sourceCardInstanceId)) {
      return `items-${player.id}`;
    }
  }
  // Loot from hand (instanceId may not match anything tracked — fallback to player zone)
  if (sourcePlayerId === next.myPlayerId) return 'my-hand';
  return `player-${sourcePlayerId}`;
}
