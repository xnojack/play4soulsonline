import React, { useState, useCallback, useEffect } from 'react';
import { ClientCard, CardInPlay, useGameStore } from '../../store/gameStore';
import { CardComponent, CardAction } from '../cards/CardComponent';
import { Button } from '../ui/Button';
import { getSocket } from '../../socket/client';
import { SERVER_URL } from '../../config';

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
  const serverUrl = SERVER_URL;

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
    // Generic soul (cardId === '') — show the card back image instead of a placeholder
    if (instance.cardId === '') {
      return (
        <img
          src="/card-back.png"
          alt="Soul"
          className={`rounded border border-purple-700/30 ${className ?? ''}`}
          style={{ width: w, height: h, objectFit: 'cover' }}
        />
      );
    }
    return (
      <div
        className={`bg-fs-darker border border-fs-gold/20 rounded flex items-center justify-center text-xs text-fs-parchment/30 ${className ?? ''}`}
        style={{ width: w, height: h }}
      >
        {instance.cardId === 'unknown' || instance.cardId === 'placeholder-starting-item' ? '?' : 'Loading…'}
      </div>
    );
  }

  // Inject a generic "Flip" action for dual-sided cards
  const flipAction: CardAction | null = card.backImageUrl
    ? {
        label: instance.flipped ? 'Flip to front' : 'Flip',
        onClick: () => {
          getSocket().emit('action:flip_card', { instanceId: instance.instanceId });
        },
        variant: 'ghost',
      }
    : null;

  const mergedActions = flipAction
    ? [flipAction, ...(actions ?? [])]
    : actions;

  return (
    <CardComponent
      card={card}
      instance={instance}
      size={size}
      showCounters={showCounters}
      actions={mergedActions}
      onClick={onClick}
      selected={selected}
      className={className}
      popoverBelow={popoverBelow}
      alwaysPopover={alwaysPopover}
    />
  );
}
