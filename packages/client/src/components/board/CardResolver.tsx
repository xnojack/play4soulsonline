import React, { useState, useCallback, useEffect } from 'react';
import { ClientCard, CardInPlay, useGameStore } from '../../store/gameStore';
import { CardComponent, CardAction } from '../cards/CardComponent';
import { Button } from '../ui/Button';
import { getSocket } from '../../socket/client';

// Card data cache
const cardCache = new Map<string, ClientCard>();

/** Read a card from the cache synchronously (returns null if not loaded) */
export function getCardFromCache(cardId: string): ClientCard | null {
  return cardCache.get(cardId) ?? null;
}

async function fetchCard(cardId: string, serverUrl: string): Promise<ClientCard | null> {
  if (cardCache.has(cardId)) return cardCache.get(cardId)!;
  try {
    const res = await fetch(`${serverUrl}/api/cards/${cardId}`);
    if (!res.ok) return null;
    const card = await res.json() as ClientCard;
    cardCache.set(cardId, card);
    return card;
  } catch {
    return null;
  }
}

/** Hook to resolve a cardId to card data */
export function useCard(cardId: string | undefined): ClientCard | null {
  const [card, setCard] = useState<ClientCard | null>(cardId ? cardCache.get(cardId) ?? null : null);
  const serverUrl = import.meta.env.VITE_SERVER_URL || '';

  useEffect(() => {
    if (!cardId) return;
    if (cardCache.has(cardId)) {
      setCard(cardCache.get(cardId)!);
      return;
    }
    fetchCard(cardId, serverUrl).then((c) => {
      if (c) setCard(c);
    });
  }, [cardId, serverUrl]);

  return card;
}

/** Resolved card instance — fetches card data for an instance */
export function ResolvedCard({
  instance,
  size = 'md',
  showCounters = true,
  actions,
  onClick,
  selected,
  className,
  popoverBelow,
  alwaysPopover,
}: {
  instance: CardInPlay;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showCounters?: boolean;
  actions?: CardAction[];
  onClick?: () => void;
  selected?: boolean;
  className?: string;
  popoverBelow?: boolean;
  alwaysPopover?: boolean;
}) {
  const card = useCard(instance.cardId);
  if (!card) {
    const SIZES = { xs: [52, 71], sm: [78, 107], md: [117, 160], lg: [182, 249] };
    const [w, h] = SIZES[size];
    return (
      <div
        className={`bg-fs-darker border border-fs-gold/20 rounded flex items-center justify-center text-xs text-fs-parchment/30 ${className ?? ''}`}
        style={{ width: w, height: h }}
      >
        {instance.cardId === 'unknown' || instance.cardId === 'placeholder-starting-item' ? '?' : 'Loading…'}
      </div>
    );
  }
  return (
    <CardComponent
      card={card}
      instance={instance}
      size={size}
      showCounters={showCounters}
      actions={actions}
      onClick={onClick}
      selected={selected}
      className={className}
      popoverBelow={popoverBelow}
      alwaysPopover={alwaysPopover}
    />
  );
}
