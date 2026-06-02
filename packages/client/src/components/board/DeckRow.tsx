import React from 'react';
import { useGameStore } from '../../store/gameStore';
import { useIsMyTurn } from '../../hooks/useMyPlayer';
import { getSocket } from '../../socket/client';
import { ResolvedCard, useCard } from './CardResolver';
import { Draggable, Droppable } from './DnDPrimitives';
import { DECK_TOP_SENTINEL } from './DropActionResolver';
import { DeckHoverTooltip } from './DeckHoverTooltip';

type DeckType = 'treasure' | 'loot' | 'monster' | 'room' | 'eternal';

const DECK_BACKS: Record<DeckType, string> = {
  treasure: '/treasure-back.png',
  loot: '/loot-back.png',
  monster: '/monster-back.png',
  room: '/room-back.png',
  eternal: '/eternal-back.png',
};

/**
 * A compact deck "post" with both discard pile and deck back.
 * Used by DeckRow and as the standalone loot deck pair.
 */
export function DiscardDeckPair({
  deckType,
  deckCount,
  discardCardId,
  discardCount,
  size = 'sm',
  discardSize,
  deckIsDraggable = false,
  landscape = false,
  belowDeck,
}: {
  deckType: DeckType;
  deckCount: number;
  discardCardId?: string;
  discardCount: number;
  size?: 'xs' | 'sm' | 'md';
  /** Override size for the discard pile specifically */
  discardSize?: 'xs' | 'sm' | 'md';
  /** If true, the deck face is draggable (draw-to-hand sentinel drag) */
  deckIsDraggable?: boolean;
  /** If true, swaps width and height for landscape-oriented decks (e.g. room) */
  landscape?: boolean;
  /** Content rendered directly below the deck face (e.g. +Room button) */
  belowDeck?: React.ReactNode;
}) {
  const topDiscard = useCard(discardCardId);
  const effectiveDiscardSize = discardSize ?? size;
  const deckW = size === 'md' ? 234 : size === 'sm' ? 156 : 104;
  const deckH = size === 'md' ? 320 : size === 'sm' ? 214 : 142;
  const deckCardW = landscape ? deckH : deckW;
  const deckCardH = landscape ? deckW : deckH;
  const discardW = effectiveDiscardSize === 'md' ? 234 : effectiveDiscardSize === 'sm' ? 156 : 104;
  const discardH = effectiveDiscardSize === 'md' ? 320 : effectiveDiscardSize === 'sm' ? 214 : 142;
  const discardCardW = landscape ? discardH : discardW;
  const discardCardH = landscape ? discardW : discardH;

  const deckFace = (
    <div className="relative" style={{ width: deckCardW, height: deckCardH }}>
      <img
        src={DECK_BACKS[deckType]}
        alt={`${deckType} deck`}
        className={`w-full h-full object-cover rounded border-2 transition-colors ${
          deckCount > 0 ? 'border-fs-gold/40 opacity-100' : 'border-fs-gold/10 opacity-30'
        }`}
        draggable={false}
      />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="bg-fs-darker/80 text-fs-gold font-display font-bold text-2xl rounded px-3 py-1 shadow">
          {deckCount}
        </span>
      </div>
    </div>
  );

  const discardEl = topDiscard && discardCardId ? (
    <div className="overflow-hidden rounded" style={{ width: discardCardW, height: discardCardH }}>
      <ResolvedCard
        instance={{
          instanceId: 'discard',
          cardId: discardCardId,
          charged: true,
          damageCounters: 0,
          hpCounters: 0,
          atkCounters: 0,
          genericCounters: 0,
          namedCounters: {},
          flipped: false,
        }}
        size={effectiveDiscardSize}
        showCounters={false}
        landscape={landscape}
      />
    </div>
  ) : (
    <div
      className="rounded border-2 border-dashed border-fs-gold/15 flex items-center justify-center text-fs-parchment/20 text-2xl"
      style={{ width: discardCardW, height: discardCardH }}
    >
      empty
    </div>
  );

  const isTooltipDeckType = deckType !== 'eternal';

  const deckTypeSafe = isTooltipDeckType ? deckType : 'loot';

  return (
    <div className="flex gap-2 items-start">
      {/* Discard */}
      <div className="flex flex-col items-center gap-2">
        <Droppable
          id={`drop-discard-${deckType}`}
          payload={{ targetZone: 'discard', targetZoneId: deckType }}
        >
          {isTooltipDeckType ? (
            <DeckHoverTooltip deckType={deckTypeSafe} pile="discard">
              {discardCardId && topDiscard ? (
                <Draggable
                  id={`drag-discard-${deckType}-top`}
                  payload={{ cardId: discardCardId, sourceZone: 'discard', sourceZoneId: deckType }}
                >
                  {discardEl}
                </Draggable>
              ) : (
                discardEl
              )}
            </DeckHoverTooltip>
          ) : (
            discardCardId && topDiscard ? (
              <Draggable
                id={`drag-discard-${deckType}-top`}
                payload={{ cardId: discardCardId!, sourceZone: 'discard', sourceZoneId: deckType }}
              >
                {discardEl}
              </Draggable>
            ) : (
              discardEl
            )
          )}
        </Droppable>
      </div>

      {/* Deck */}
      <div className="flex flex-col items-center gap-2">
        <Droppable
          id={`drop-deck-${deckType}`}
          payload={{ targetZone: 'deck', targetZoneId: deckType }}
        >
          {isTooltipDeckType ? (
            <DeckHoverTooltip deckType={deckTypeSafe} pile="deck">
              {deckIsDraggable && deckCount > 0 ? (
                <Draggable
                  id={`drag-deck-${deckType}`}
                  payload={{ cardId: DECK_TOP_SENTINEL, sourceZone: 'deck', sourceZoneId: deckType }}
                >
                  {deckFace}
                </Draggable>
              ) : deckFace}
            </DeckHoverTooltip>
          ) : (
            deckIsDraggable && deckCount > 0 ? (
              <Draggable
                id={`drag-deck-${deckType}`}
                payload={{ cardId: DECK_TOP_SENTINEL, sourceZone: 'deck', sourceZoneId: deckType }}
              >
                {deckFace}
              </Draggable>
            ) : deckFace
          )}
        </Droppable>
        {belowDeck}
      </div>
    </div>
  );
}

interface DeckRowProps {
  deckType: 'treasure' | 'monster' | 'room';
  deckCount: number;
  discardCardId?: string;
  discardCount: number;
  /** The slot cards rendered between deck and action button */
  children?: React.ReactNode;
  /** Optional special action slot (Buy Top, Flip&Attack, etc) */
  actionSlot?: React.ReactNode;
  /** Whether to show the +Slot/+Room button */
  showAddSlot?: boolean;
  /** If true, the deck face is draggable (draw-to-hand sentinel drag) */
  deckIsDraggable?: boolean;
}

/**
 * One row on the board: [Discard] [Deck] [Slot1...SlotN] [Action] [+Slot]
 * Used for shop, monster, and room rows. No section labels (rely on the
 * card backs / theming for identification).
 */
export function DeckRow({
  deckType,
  deckCount,
  discardCardId,
  discardCount,
  children,
  actionSlot,
  showAddSlot,
  deckIsDraggable = false,
}: DeckRowProps) {
  const game = useGameStore((s) => s.game);
  const isMyTurn = useIsMyTurn();

  const isActiveTurn = game?.turn.activePlayerId === game?.myPlayerId;

  // Map deckType -> add-slot semantics
  // treasure row hosts "shop" slots; monster row -> monster slots; room row -> room slots
  const addSlotType: 'shop' | 'monster' | 'room' =
    deckType === 'treasure' ? 'shop' : deckType === 'monster' ? 'monster' : 'room';
  const addLabel =
    addSlotType === 'room' ? '+ Room' : '+ Slot';

  const canAddSlot = !!showAddSlot && isActiveTurn && (addSlotType !== 'room' || (game?.roomDeckCount ?? 0) > 0);

  return (
    <div className="flex gap-2 items-start flex-nowrap min-w-0">
      {/* Deck pair — fixed, never shrinks */}
      <div className="flex-shrink-0">
        <DiscardDeckPair
          deckType={deckType}
          deckCount={deckCount}
          discardCardId={discardCardId}
          discardCount={discardCount}
          size="md"
          discardSize="sm"
          deckIsDraggable={deckIsDraggable}
        />
      </div>

      {/* Stacked action block — +Slot on top, action (Buy Top / Flip&Attack) on bottom */}
      {!!showAddSlot && (
        <div className="flex-shrink-0 flex flex-col" style={{ width: 234, height: 320 }}>
          {/* Top half — +Slot droppable */}
          <Droppable
            id={`drop-add-slot-${addSlotType}`}
            payload={{ targetZone: 'add_slot', targetZoneId: addSlotType }}
            className="flex-1"
          >
            {canAddSlot ? (
              <button
                onClick={() => getSocket().emit('action:add_slot', { slotType: addSlotType })}
                className="w-full h-full rounded-t border-2 border-fs-gold/40 hover:border-fs-gold bg-fs-darker/60 hover:bg-fs-darker/80 flex items-center justify-center text-3xl font-display text-fs-parchment/60 hover:text-fs-parchment transition-colors cursor-pointer"
                title={`Add a ${addSlotType} slot`}
              >
                {addLabel}
              </button>
            ) : (
              <div
                className="w-full h-full rounded-t border-2 border-dashed border-fs-gold/15 flex items-center justify-center text-3xl font-display text-fs-parchment/20 select-none"
                title={`Drop a card here to add a ${addSlotType} slot`}
              >
                {addLabel}
              </div>
            )}
          </Droppable>
          {/* Bottom half — action slot */}
          <div className="flex-1">
            {actionSlot}
          </div>
        </div>
      )}

      {/* Active slots — fills remaining space, scrolls when cards overflow */}
      <div style={{ flex: '1 1 0', minWidth: 0, overflowX: 'auto' }}>
        <div className="flex gap-2 items-start flex-nowrap">
          {children}
        </div>
      </div>
    </div>
  );
}
