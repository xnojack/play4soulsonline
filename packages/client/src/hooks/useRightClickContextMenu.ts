import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { getSocket } from '../socket/client';
import { playSound } from '../components/audio/SoundManager';

function inferDeckType(cardType: string): 'loot' | 'treasure' | 'monster' | 'room' | null {
  switch (cardType) {
    case 'Loot': return 'loot';
    case 'Treasure': return 'treasure';
    case 'Monster': return 'monster';
    case 'Room': return 'room';
    default: return null;
  }
}

export function useRightClickContextMenu() {
  const game = useGameStore((s) => s.game);
  const hoveredCard = useGameStore((s) => s.hoveredCard);
  const hoveredCardInstance = useGameStore((s) => s.hoveredCardInstance);
  const hoveredDeck = useGameStore((s) => s.hoveredDeck);
  const setContextMenu = useGameStore((s) => s.setContextMenu);

  useEffect(() => {
    if (!game) return;

    const handler = (e: MouseEvent) => {
      // Only fire inside the board canvas
      if (!(e.target as HTMLElement).closest('[data-board-canvas]')) return;

      e.preventDefault();

      const myHand = game.players.find((p) => p.id === game.myPlayerId)?.handCardIds ?? [];
      const isHandCard = hoveredCardInstance && !hoveredCardInstance.instanceId.startsWith('hand-') ? false : hoveredCardInstance !== null && myHand.includes(hoveredCardInstance.cardId);
      const isInPlay = hoveredCardInstance && !isHandCard;
      const hasInstance = isInPlay && hoveredCardInstance !== null;

      if (isInPlay && hasInstance) {
        const actions = [];
        const instanceId = hoveredCardInstance.instanceId;

        // Tap/Ready — toggle charge state
        const myPlayer = game.players.find((p) => p.id === game.myPlayerId);
        const item = myPlayer?.items.find((i) => i.instanceId === instanceId);
        const charCard = game.characterCards[instanceId];
        const startItem = game.startingItemCards[instanceId];
        const charged = item?.charged ?? charCard?.charged ?? startItem?.charged ?? true;
        actions.push({
          action: charged ? 'action:deactivate_item' : 'action:charge_item',
          payload: { instanceId },
          label: charged ? 'Tap' : 'Ready',
          onClick: () => { playSound('cardSlide'); },
        });

        // Add counter
        actions.push({
          action: 'action:add_counter',
          payload: { instanceId, counterType: 'generic', amount: 1 },
          label: 'Add Counter',
          onClick: () => { playSound('cardSlide'); },
        });

        // Remove counter
        actions.push({
          action: 'action:remove_counter',
          payload: { instanceId, counterType: 'generic', amount: 1 },
          label: 'Remove Counter',
          onClick: () => { playSound('cardSlide'); },
        });

        // Flip — only for dual-sided cards
        if (hoveredCard && (hoveredCard.backImageUrl || hoveredCard.flipSideName)) {
          const cardInstance = game.characterCards[instanceId]
            || game.startingItemCards[instanceId]
            || game.shopSlots.find((s) => s.card?.instanceId === instanceId)?.card
            || game.monsterSlots.flatMap((s) => s.stack).find((c) => c.instanceId === instanceId)
            || myPlayer?.items.find((i) => i.instanceId === instanceId);
          const isFlipped = cardInstance?.flipped ?? false;
          actions.push({
            action: 'action:flip_card',
            payload: { instanceId },
            label: isFlipped ? 'Flip to Front' : 'Flip to Back',
            onClick: () => { playSound('cardFlip'); },
          });
        }

        // Return to Deck
        const deckType = hoveredCard ? inferDeckType(hoveredCard.cardType) : null;
        if (deckType) {
          const base = { cardId: hoveredCardInstance.cardId, deckType, fromInstanceId: instanceId };
          actions.push({
            action: 'action:return_to_deck',
            payload: { ...base, position: 'top' },
            label: 'Return to Top',
            onClick: () => { playSound('cardSlide'); },
          });
          actions.push({
            action: 'action:return_to_deck',
            payload: { ...base, position: 'bottom' },
            label: 'Return to Bottom',
            onClick: () => { playSound('cardSlide'); },
          });
          actions.push({
            action: 'action:return_to_deck',
            payload: { ...base, position: 'random' },
            label: 'Return Random',
            onClick: () => { playSound('cardSlide'); },
          });
        }

        // Discard
        actions.push({
          action: 'action:destroy_card',
          payload: { instanceId },
          label: 'Discard',
          onClick: () => { playSound('cardSlide'); },
        });

        setContextMenu({ x: e.clientX, y: e.clientY, actions });
      } else if (isHandCard && hoveredCardInstance) {
        const actions = [];

        // Play
        actions.push({
          action: 'action:play_loot',
          payload: { cardId: hoveredCardInstance.cardId, targets: [] },
          label: 'Play',
          onClick: () => { playSound('cardSlide'); },
        });

        // Return to Deck
        const deckType = hoveredCard ? inferDeckType(hoveredCard.cardType) : null;
        if (deckType) {
          const base = { cardId: hoveredCardInstance.cardId, deckType, fromHand: true };
          actions.push({
            action: 'action:return_to_deck',
            payload: { ...base, position: 'top' },
            label: 'Return to Top',
            onClick: () => { playSound('cardSlide'); },
          });
          actions.push({
            action: 'action:return_to_deck',
            payload: { ...base, position: 'bottom' },
            label: 'Return to Bottom',
            onClick: () => { playSound('cardSlide'); },
          });
          actions.push({
            action: 'action:return_to_deck',
            payload: { ...base, position: 'random' },
            label: 'Return Random',
            onClick: () => { playSound('cardSlide'); },
          });
        }

        // Discard
        actions.push({
          action: 'action:discard_loot',
          payload: { cardId: hoveredCardInstance.cardId },
          label: 'Discard',
          onClick: () => { playSound('cardSlide'); },
        });

        setContextMenu({ x: e.clientX, y: e.clientY, actions });
      } else if (hoveredDeck) {
        const actions = [];

        // Draw 1
        actions.push({
          action: 'action:draw_from_deck',
          payload: { deckType: hoveredDeck.deckType, count: 1, fromDiscard: hoveredDeck.pile === 'discard' },
          label: hoveredDeck.pile === 'discard' ? 'Draw 1 from Discard' : 'Draw 1',
          onClick: () => { playSound('cardFlip'); },
        });

        // Draw 3
        actions.push({
          action: 'action:draw_from_deck',
          payload: { deckType: hoveredDeck.deckType, count: 3, fromDiscard: hoveredDeck.pile === 'discard' },
          label: hoveredDeck.pile === 'discard' ? 'Draw 3 from Discard' : 'Draw 3',
          onClick: () => { playSound('cardFlip'); },
        });

        // Shuffle (only for deck)
        if (hoveredDeck.pile === 'deck') {
          actions.push({
            action: 'action:shuffle_deck',
            payload: { deckType: hoveredDeck.deckType },
            label: 'Shuffle',
            onClick: () => { playSound('cardFlip'); },
          });
        }

        // Return top discard to deck
        if (hoveredDeck.pile === 'discard') {
          const topCard = hoveredCard;
          if (topCard) {
            const deckType = inferDeckType(topCard.cardType) ?? hoveredDeck.deckType;
            actions.push({
              action: 'action:return_to_deck',
              payload: { cardId: topCard.id, deckType, fromDiscard: true, position: 'top' },
              label: 'Return Top to Deck',
              onClick: () => { playSound('cardSlide'); },
            });
          }
        }

        setContextMenu({ x: e.clientX, y: e.clientY, actions });
      }
    };

    document.addEventListener('contextmenu', handler);
    return () => document.removeEventListener('contextmenu', handler);
  }, [game, hoveredCard, hoveredCardInstance, hoveredDeck, setContextMenu]);
}
