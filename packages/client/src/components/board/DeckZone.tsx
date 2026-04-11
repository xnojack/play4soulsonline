import React from 'react';
import { ResolvedCard, useCard } from './CardResolver';

interface DeckZoneProps {
  label: string;
  count: number;
  topDiscardCardId?: string;
  discardCount?: number;
  deckType: 'loot' | 'treasure' | 'monster' | 'room' | 'eternal';
  /** If provided, clicking opens the deck browser */
  onBrowse?: () => void;
  /** If provided, show a Browse button below the discard thumbnail */
  onBrowseDiscard?: () => void;
  /** If provided, show a Draw button that calls this callback */
  onDraw?: () => void;
}

export function DeckZone({
  label,
  count,
  topDiscardCardId,
  discardCount = 0,
  deckType,
  onBrowse,
  onBrowseDiscard,
  onDraw,
}: DeckZoneProps) {
  const topDiscard = useCard(topDiscardCardId);

  const DECK_BACKS: Record<string, string> = {
    treasure: '/treasure-back.png',
    loot: '/loot-back.png',
    monster: '/monster-back.png',
    room: '/room-back.png',
    eternal: '/eternal-back.png',
  };
  const backSrc = DECK_BACKS[deckType] ?? '/card-back.png';

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="section-title text-center text-sm">{label}</div>
      <div className="flex gap-2">
        {/* Deck */}
        <div className="flex flex-col items-center gap-1">
          {/* Card back image as deck face */}
          <div className="relative w-[78px] h-[107px]">
            <img
              src={backSrc}
              alt={`${label} deck`}
              className={`w-full h-full object-cover rounded border-2 transition-colors ${
                count > 0
                  ? 'border-fs-gold/40 opacity-100'
                  : 'border-fs-gold/10 opacity-30'
              }`}
              draggable={false}
            />
            {/* Count badge overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="bg-fs-darker/70 text-fs-gold font-display font-bold text-base rounded px-1.5 py-0.5 shadow">
                {count}
              </span>
            </div>
          </div>

          {/* Browse and Draw buttons — shown simultaneously when available */}
          <div className="flex flex-col gap-0.5 w-full">
            {onBrowse && count > 0 && (
              <button
                onClick={onBrowse}
                className="text-xs px-2 py-0.5 rounded border border-fs-gold/30 text-fs-gold/60 hover:text-fs-gold hover:border-fs-gold/60 transition-colors w-full text-center"
                title={`Browse ${label} deck`}
              >
                Browse
              </button>
            )}
            {onDraw && (
              <button
                onClick={onDraw}
                disabled={count === 0}
                className={`text-xs px-2 py-0.5 rounded border transition-colors w-full text-center ${
                  count > 0
                    ? 'border-green-700/50 text-green-400/70 hover:text-green-300 hover:border-green-600 cursor-pointer'
                    : 'border-gray-700 text-gray-600 cursor-not-allowed'
                }`}
                title={`Draw 1 ${label} card`}
              >
                Draw
              </button>
            )}
            {!onBrowse && !onDraw && (
              <span className="text-sm text-fs-parchment/40 text-center">Deck</span>
            )}
          </div>
        </div>

        {/* Discard */}
        <div className="flex flex-col items-center gap-1">
          {topDiscard && topDiscardCardId ? (
            <div className="w-[78px] h-[107px] rounded overflow-hidden">
              <ResolvedCard
                instance={{
                  instanceId: 'discard',
                  cardId: topDiscardCardId,
                  charged: true,
                  damageCounters: 0,
                  hpCounters: 0,
                  atkCounters: 0,
                  genericCounters: 0,
                  namedCounters: {},
                }}
                size="sm"
                showCounters={false}
              />
            </div>
          ) : (
            <div className="w-[78px] h-[107px] rounded border border-dashed border-fs-gold/10 flex items-center justify-center text-fs-parchment/20 text-sm">
              Empty
            </div>
          )}
          {onBrowseDiscard && discardCount > 0 ? (
            <button
              onClick={onBrowseDiscard}
              className="text-xs px-2 py-0.5 rounded border border-fs-gold/30 text-fs-gold/60 hover:text-fs-gold hover:border-fs-gold/60 transition-colors w-full text-center"
              title={`Browse ${label} discard`}
            >
              Browse
            </button>
          ) : (
            <span className="text-sm text-fs-parchment/40">Discard</span>
          )}
        </div>
      </div>
    </div>
  );
}
