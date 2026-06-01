import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { getSocket } from '../socket/client';
import { playSound } from '../components/audio/SoundManager';

const KEYBOARD_EXCLUDE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

function inferDeckType(cardType: string): 'loot' | 'treasure' | 'monster' | 'room' | null {
  switch (cardType) {
    case 'Loot': return 'loot';
    case 'Treasure': return 'treasure';
    case 'Monster': return 'monster';
    case 'Room': return 'room';
    default: return null;
  }
}

export function useDeckKeyboardShortcuts() {
  const game = useGameStore((s) => s.game);
  const hoveredDeck = useGameStore((s) => s.hoveredDeck);
  const hoveredCard = useGameStore((s) => s.hoveredCard);
  const setHoveredCard = useGameStore((s) => s.setHoveredCard);
  const setContextMenu = useGameStore((s) => s.setContextMenu);
  const mousePosRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
    };
    document.addEventListener('mousemove', onMove);
    return () => document.removeEventListener('mousemove', onMove);
  }, []);

  const myHand = useGameStore((s) => {
    const g = s.game;
    if (!g) return [];
    const player = g.players.find((p) => p.id === g.myPlayerId);
    return player?.handCardIds ?? [];
  });

  useEffect(() => {
    if (!game) return;

    const handler = (e: KeyboardEvent) => {
      if (KEYBOARD_EXCLUDE_TAGS.has((e.target as HTMLElement).tagName)) return;

      const key = e.key.toUpperCase();

      if (key >= '1' && key <= '9') {
        if (!hoveredDeck) return;
        e.preventDefault();
        playSound('cardFlip');
        getSocket().emit('action:draw_from_deck', {
          deckType: hoveredDeck.deckType,
          count: parseInt(key, 10),
          fromDiscard: hoveredDeck.pile === 'discard',
        });
      } else if (key === 'S') {
        if (!hoveredDeck || hoveredDeck.pile !== 'deck') return;
        e.preventDefault();
        getSocket().emit('action:shuffle_deck', { deckType: hoveredDeck.deckType });
      } else if (key === 'R') {
        if (!hoveredCard) return;
        if (!myHand.includes(hoveredCard.id)) return;
        const deckType = inferDeckType(hoveredCard.cardType);
        if (!deckType) return;
        e.preventDefault();
        playSound('cardSlide');
        const base = { cardId: hoveredCard.id, deckType, fromHand: true };
        const actions = [
          { action: 'action:return_to_deck', payload: { ...base, position: 'top' }, label: 'Top of Deck' },
          { action: 'action:return_to_deck', payload: {}, label: 'Top, offset…', onClick: () => {
            const raw = window.prompt('How many from the top? (1 = just under top)');
            if (raw === null) return;
            const offset = parseInt(raw, 10);
            if (isNaN(offset) || offset < 1) return;
            getSocket().emit('action:return_to_deck', { ...base, position: 'top', offset });
          }},
          { action: 'action:return_to_deck', payload: { ...base, position: 'bottom' }, label: 'Bottom of Deck' },
          { action: 'action:return_to_deck', payload: {}, label: 'Bottom, offset…', onClick: () => {
            const raw = window.prompt('How many from the bottom? (1 = just above bottom)');
            if (raw === null) return;
            const offset = parseInt(raw, 10);
            if (isNaN(offset) || offset < 1) return;
            getSocket().emit('action:return_to_deck', { ...base, position: 'bottom', offset });
          }},
          { action: 'action:return_to_deck', payload: { ...base, position: 'random' }, label: 'Random' },
        ];
        setContextMenu({ x: mousePosRef.current.x, y: mousePosRef.current.y + 12, actions });
        setHoveredCard(null);
      } else if (key === 'D') {
        if (!hoveredCard) return;
        e.preventDefault();
        playSound('cardSlide');
        getSocket().emit('action:discard_loot', { cardId: hoveredCard.id });
        setHoveredCard(null);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [game, hoveredDeck, hoveredCard, myHand, setHoveredCard, setContextMenu]);
}
