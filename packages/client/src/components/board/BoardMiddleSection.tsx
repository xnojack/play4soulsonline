import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore, StackItem, GameState, CardInPlay, ClientPlayer } from '../../store/gameStore';
import { getSocket } from '../../socket/client';
import { useIsMyTurn, useHasPriority } from '../../hooks/useMyPlayer';
import { MonsterSlotComponent } from './MonsterSlot';
import { ShopSlotComponent } from './ShopSlot';
import { ResolvedCard, useCard } from './CardResolver';
import { CardAction } from '../cards/CardComponent';
import { Draggable, Droppable } from './DnDPrimitives';
import { DeckRow, DiscardDeckPair } from './DeckRow';
import { DiceFace } from '../stack/TheStack';
import { SERVER_URL } from '../../config';

// ─── Stack helpers ─────────────────────────────────────────────────────────

function resolveStackCardId(item: StackItem, game: GameState): string | null {
  if (item.type === 'loot' || item.type === 'dice_roll') {
    return item.sourceCardInstanceId || null;
  }
  const instanceId = item.sourceCardInstanceId;
  if (!instanceId) return null;
  const charCard = game.characterCards[instanceId];
  if (charCard) return charCard.cardId;
  const startItem = game.startingItemCards[instanceId];
  if (startItem) return startItem.cardId;
  for (const player of game.players) {
    const found = player.items.find((i) => i.instanceId === instanceId);
    if (found) return found.cardId;
  }
  return null;
}

const STACK_TYPE_ICONS: Record<string, string> = {
  loot: '🃏',
  activated_ability: '⚡',
  triggered_ability: '↯',
  dice_roll: '🎲',
  attack_roll: '⚔',
  attack_declaration: '⚔',
};

function StackCardThumb({ cardId, small = false }: { cardId: string; small?: boolean }) {
  const card = useCard(cardId);
  const setModalCard = useGameStore((s) => s.setModalCard);
  if (!card) {
    return (
      <div
        className="bg-fs-darker border border-fs-gold/20 rounded flex-shrink-0"
        style={{ width: small ? 56 : 76, height: small ? 80 : 108 }}
      />
    );
  }
  const imgSrc = card.imageUrl.startsWith('http') ? card.imageUrl : `${SERVER_URL}${card.imageUrl}`;
  return (
    <img
      src={imgSrc}
      alt={card.name}
      onClick={() => setModalCard(card)}
      className="object-cover rounded border border-fs-gold/30 hover:border-fs-gold/70 transition-colors cursor-pointer flex-shrink-0"
      style={{ width: small ? 56 : 76, height: small ? 80 : 108 }}
      draggable={false}
      title={card.name}
    />
  );
}

// ─── Stack panels ──────────────────────────────────────────────────────────

function StackLivePanel() {
  const game = useGameStore((s) => s.game);
  const stack = game?.stack ?? [];
  const isMyTurn = useIsMyTurn();
  const hasPriority = useHasPriority();

  const liveItems = [...stack].reverse().filter((i) => !i.isCanceled);

  const handleCancel = (id: string) => getSocket().emit('action:cancel_stack_item', { stackItemId: id });
  const handleResolveTop = () => getSocket().emit('action:resolve_top');
  const handlePass = () => getSocket().emit('action:pass_priority');

  return (
    <Droppable
      id="drop-play-loot"
      payload={{ targetZone: 'stack' }}
      className="h-full"
      highlightInset="inset-1"
    >
      <div
        className="flex flex-col h-full min-h-0 rounded-lg border-2 border-fs-gold/30 bg-fs-darker/55 backdrop-blur-sm p-4 gap-3"
        data-zone="the-stack"
      >
        <div className="flex items-center justify-between gap-2 flex-shrink-0">
          <span className="font-display text-fs-gold text-3xl uppercase tracking-wider">
            Stack {stack.length > 0 ? `(${stack.length})` : ''}
          </span>
          <div className="flex gap-2">
            {isMyTurn && stack.length > 0 && (
              <button
                onClick={handleResolveTop}
                className="text-xl px-3 py-2 rounded border-2 border-fs-gold/50 text-fs-gold hover:bg-fs-gold/10 transition-colors"
                title="Resolve top of stack"
              >
                Resolve
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 space-y-2">
          <AnimatePresence>
            {liveItems.length === 0 && (
        <div className="text-2xl text-fs-parchment/30 text-center py-2 italic">
                 stack empty
               </div>
            )}
            {liveItems.map((item, i) => {
              const isTop = i === 0;
              const dragCardId = game ? (resolveStackCardId(item, game) ?? '') : '';
              const isRoll = item.type === 'dice_roll' || item.type === 'attack_roll';
              const rollValue = isRoll ? (item.data?.roll as number | undefined) : undefined;
              const cardId = game ? resolveStackCardId(item, game) : null;
              return (
                <Draggable
                  key={item.id}
                  id={`stack-${item.id}`}
                  payload={{
                    cardId: dragCardId,
                    instanceId: item.id,
                    sourceZone: 'stack',
                    sourceZoneId: item.sourceCardInstanceId,
                  }}
                >
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    className={`relative flex items-start gap-3 rounded border-2 p-2 text-xl ${
                      isTop
                        ? 'border-fs-gold/70 bg-fs-gold/10 shadow-[0_0_8px_rgba(201,162,39,0.25)]'
                        : 'border-fs-gold/20 bg-fs-darker/60'
                    }`}
                  >
                    {isRoll && rollValue !== undefined ? (
                      <DiceFace value={rollValue} size="sm" />
                    ) : cardId ? (
                      <StackCardThumb cardId={cardId} />
                    ) : null}
                    <div className="flex-1 min-w-0">
                      <span className="text-fs-parchment/50 mr-1">{STACK_TYPE_ICONS[item.type] ?? '📋'}</span>
                      <span className="text-fs-parchment/90 break-words">{item.description}</span>
                      {isTop && (
                        <span className="ml-1 px-4 py-2 bg-fs-gold/20 text-fs-gold text-lg rounded font-display whitespace-nowrap">
                          next
                        </span>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCancel(item.id);
                      }}
                      className="text-red-500/60 hover:text-red-500 text-lg leading-none flex-shrink-0"
                      title="Cancel"
                    >
                      ✕
                    </button>
                  </motion.div>
                </Draggable>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </Droppable>
  );
}

function StackHistoryPanel() {
  const game = useGameStore((s) => s.game);

  // Read from game log — stack-type entries are resolutions and cancellations.
  // Reversed so most recent is at top. Capped at 20 entries.
  const historyItems = [...(game?.log ?? [])]
    .reverse()
    .filter((e) => e.type === 'stack')
    .slice(0, 20);

  return (
    <div         className="flex flex-col h-full min-h-0 rounded-lg border-2 border-fs-gold/20 bg-fs-darker/40 backdrop-blur-sm p-4 gap-3">
      <div className="flex items-center justify-between gap-2 flex-shrink-0">
        <span className="font-display text-fs-parchment/50 text-2xl uppercase tracking-wider">History</span>
        <button
          disabled
          title="Undo last resolution (coming soon)"
          className="text-2xl px-3 py-2 rounded border-2 border-fs-gold/15 text-fs-parchment/20 cursor-not-allowed"
        >
          ↩
        </button>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 space-y-2">
        {historyItems.length === 0 ? (
        <div className="text-2xl text-fs-parchment/25 text-center py-2 italic">
             no history
           </div>
        ) : (
          historyItems.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start gap-2 rounded border-2 border-fs-gold/10 bg-fs-darker/50 p-2 text-xl"
            >
              <span className="text-fs-parchment/30 flex-shrink-0">{STACK_TYPE_ICONS['loot'] ? '📋' : '📋'}</span>
              <span className="text-fs-parchment/45 break-words flex-1">{entry.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Row action slots (Buy Top / Flip & Attack) ────────────────────────────

function BuyDeckTopSlot() {
  const game = useGameStore((s) => s.game);
  const isMyTurn = useIsMyTurn();
  const canBuy = isMyTurn && (game?.treasureDeckCount ?? 0) > 0;
  return (
    <button
      onClick={() => getSocket().emit('action:buy_top_treasure')}
      disabled={!canBuy}
       className={`w-full h-full rounded-b border-2 flex flex-col items-center justify-center gap-0.5 transition-colors text-center px-2 ${
        canBuy
          ? 'border-fs-gold/40 hover:border-fs-gold bg-fs-darker/60 hover:bg-fs-darker/80 cursor-pointer'
          : 'border-fs-gold/10 bg-fs-darker/30 cursor-not-allowed'
      }`}
      title="Buy the top card of the treasure deck (blind)"
    >
      <span className="text-2xl">🃏</span>
      <span className={`text-xl font-display leading-tight ${canBuy ? 'text-fs-gold' : 'text-fs-parchment/20'}`}>
        Buy Top
      </span>
    </button>
  );
}

function FlipAttackSlot() {
  const game = useGameStore((s) => s.game);
  const isMyTurn = useIsMyTurn();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  const isActiveTurn = game?.turn.activePlayerId === game?.myPlayerId;
  const canFlip =
    isMyTurn &&
    isActiveTurn &&
    (game?.monsterDeckCount ?? 0) > 0 &&
    game?.turn.currentAttack === null;

  React.useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  return (
    <div ref={ref} className="relative w-full h-full">
      <button
        onClick={() => canFlip && setDropdownOpen(true)}
        disabled={!canFlip}
      className={`w-full h-full rounded-b border-2 flex flex-col items-center justify-center gap-0.5 transition-colors text-center px-2 ${
          canFlip
            ? 'border-red-700/40 hover:border-red-500 bg-red-900/30 hover:bg-red-900/50 cursor-pointer'
            : 'border-red-700/10 bg-fs-darker/30 cursor-not-allowed'
        }`}
        title="Flip top of monster deck into a slot and attack"
      >
        <span className="text-2xl">⚔️</span>
        <span className={`text-xl font-display leading-tight ${canFlip ? 'text-red-400' : 'text-fs-parchment/20'}`}>
          Flip &amp; Attack
        </span>
      </button>
      {dropdownOpen && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 bg-fs-darker/95 border-2 border-red-700/50 rounded-lg p-3 flex flex-col gap-2 shadow-xl backdrop-blur-sm min-w-[200px]">
          <span className="text-xl text-red-400/70 text-center">Flip into:</span>
          {game?.monsterSlots?.map((slot) => (
            <button
              key={slot.slotIndex}
              onClick={() => {
                getSocket().emit('action:attack_monster_deck', { slotIndex: slot.slotIndex });
                setDropdownOpen(false);
              }}
              className="text-xl px-4 py-2 rounded border border-red-700/50 text-red-400/80 hover:text-red-300 hover:bg-red-900/20 transition-colors"
            >
              Slot {slot.slotIndex + 1}
            </button>
          ))}
          <button
            onClick={() => setDropdownOpen(false)}
            className="text-xl px-4 py-2 rounded border border-fs-gold/20 text-fs-parchment/40 hover:text-fs-parchment transition-colors"
          >
            cancel
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Bonus souls column ─────────────────────────────────────────────────────

function BonusSoulsColumn() {
  const game = useGameStore((s) => s.game);
  if (!game || game.bonusSouls.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 items-center">
      <span className="text-xl uppercase tracking-wider text-fs-parchment/40">Bonus</span>
      <div className="flex flex-col gap-2">
        {game.bonusSouls.map((bs) => {
          // TODO: wire to automation
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const _gainAction: CardAction[] = (!bs.isGained && !bs.isDestroyed)
            ? [{
                label: 'Gain Soul',
                onClick: () => getSocket().emit('action:gain_bonus_soul', {
                  cardId: bs.cardId,
                  playerId: game.myPlayerId,
                }),
                variant: 'soul',
              }]
            : [];
          return (
            <ResolvedCard
              key={bs.cardId}
              instance={bs.instance}
              size="xs"
              showCounters
              className={bs.isGained || bs.isDestroyed ? 'opacity-40 grayscale' : ''}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Room slot card (needs its own component to call useCard as a hook) ───────

function RoomSlotCard({
  slot,
  isActiveTurn,
  returningCard,
  setReturningCard,
  nonSpectatorPlayers,
}: {
  slot: CardInPlay;
  isActiveTurn: boolean;
  returningCard: string | null;
  setReturningCard: (id: string | null) => void;
  nonSpectatorPlayers: ClientPlayer[];
}) {
  const card = useCard(slot.cardId);
  // Landscape only for Room-type cards; assume landscape while loading
  const landscape = card ? card.cardType === 'Room' : true;
  const isReturning = returningCard === slot.instanceId;

  // TODO: wire to automation
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _roomActions: CardAction[] = [
    {
      label: 'Discard',
      onClick: () => getSocket().emit('action:discard_room_slot', { instanceId: slot.instanceId }),
      variant: 'danger',
    },
    ...(isActiveTurn
      ? [{
          label: isReturning ? 'Cancel return' : 'Return to Player…',
          onClick: () => setReturningCard(isReturning ? null : slot.instanceId),
          variant: 'ghost' as const,
        }]
      : []),
  ];

  return (
    <div className="flex flex-col items-center gap-2 relative flex-shrink-0">
      <Droppable
        id={`drop-room-slot-${slot.instanceId}`}
        payload={{ targetZone: 'room', targetZoneId: slot.instanceId }}
        highlightInset="inset-0"
      >
        <Draggable
          id={`room-${slot.instanceId}`}
          payload={{ cardId: slot.cardId, instanceId: slot.instanceId, sourceZone: 'room' }}
        >
          <ResolvedCard
            instance={slot}
            size="sm"
            landscape={landscape}
          />
        </Draggable>
      </Droppable>
      {isReturning && (
        <div className="absolute z-20 top-full mt-1 flex flex-col gap-2 bg-fs-darker border-2 border-fs-gold/30 rounded p-2 shadow-xl">
          {nonSpectatorPlayers.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                getSocket().emit('action:return_room_card', {
                  instanceId: slot.instanceId,
                  toPlayerId: p.id,
                });
                setReturningCard(null);
              }}
              className="text-xl px-4 py-2 rounded hover:bg-fs-gold/10 text-fs-parchment/70 hover:text-fs-parchment text-left transition-colors"
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main middle section ────────────────────────────────────────────────────

export function BoardMiddleSection() {
  const game = useGameStore((s) => s.game);
  const [returningCard, setReturningCard] = useState<string | null>(null);

  if (!game) return null;

  const topTreasureDiscard = game.treasureDiscard?.[game.treasureDiscard.length - 1];
  const topLootDiscard = game.lootDiscard?.[game.lootDiscard.length - 1];
  const topMonsterDiscard = game.monsterDiscard?.[game.monsterDiscard.length - 1];
  const topRoomDiscard = game.roomDiscard?.[game.roomDiscard.length - 1];

  const isActiveTurn = game.turn?.activePlayerId === game.myPlayerId;
  const nonSpectatorPlayers = game.players.filter((p) => !p.isSpectator);
  const shopSlots = game.shopSlots ?? [];
  const monsterSlots = game.monsterSlots ?? [];
  const roomSlots = game.roomSlots ?? [];

  const hasRoomRow = roomSlots.length > 0 || (game.roomDeckCount ?? 0) > 0 || (game.roomDiscard?.length ?? 0) > 0;

  return (
    /* Outer: full height, flex row — stack cols sit outside the card panel */
    <div className="h-full w-full flex items-stretch gap-4 px-4 py-2 min-h-0 overflow-hidden">

      {/* Col 1 — live stack (outside blurred panel) */}
      <div className="w-[400px] flex-shrink-0 min-h-0">
        <StackLivePanel />
      </div>

      {/* Col 2 — stack history (outside blurred panel) */}
      <div className="w-[260px] flex-shrink-0 min-h-0">
        <StackHistoryPanel />
      </div>

      {/* Card panel — blurred dark background for cols 3-5 */}
      <div className="flex-1 min-w-0 flex items-stretch gap-4 rounded-lg bg-fs-darker/40 backdrop-blur-sm px-4 py-2 overflow-hidden">

        {/* Col 3 — bonus souls (collapses when empty) */}
        {game.bonusSouls.length > 0 && (
          <div className="flex-shrink-0 flex items-center">
            <BonusSoulsColumn />
          </div>
        )}

        {/* Col 4 — loot (top row) + room (bottom row); grows at 1x priority, yields to col 5 */}
        <div className="flex flex-col gap-3 justify-center min-w-0" style={{ flex: '1 1 0' }}>
        {/* Row 1: loot deck pair */}
        <DiscardDeckPair
          deckType="loot"
          deckCount={game.lootDeckCount ?? 0}
          discardCardId={topLootDiscard}
          discardCount={game.lootDiscard?.length ?? 0}
          size="sm"
          deckIsDraggable
        />

        {/* Row 2: room deck + slots, or disabled notice */}
        {hasRoomRow ? (
          <div className="flex gap-2 items-center flex-nowrap min-w-0 overflow-hidden">
            {/* Deck pair — fixed */}
            <div className="flex-shrink-0">
              <DiscardDeckPair
                deckType="room"
                deckCount={game.roomDeckCount ?? 0}
                discardCardId={topRoomDiscard}
                discardCount={game.roomDiscard?.length ?? 0}
                size="sm"
                deckIsDraggable
                landscape
              />
            </div>

            {/* +Room — portrait card-sized (156×214), always visible, fixed */}
            <div className="flex-shrink-0" style={{ width: 156, height: 214 }}>
              <Droppable
                id="drop-add-slot-room"
                payload={{ targetZone: 'add_slot', targetZoneId: 'room' }}
                className="w-full h-full"
              >
                {isActiveTurn && (game.roomDeckCount ?? 0) > 0 ? (
                  <button
                    onClick={() => getSocket().emit('action:add_slot', { slotType: 'room' })}
                    className="w-full h-full rounded border-2 border-fs-gold/40 hover:border-fs-gold bg-fs-darker/60 hover:bg-fs-darker/80 flex items-center justify-center text-2xl font-display text-fs-parchment/60 hover:text-fs-parchment transition-colors cursor-pointer"
                    title="Add a room slot"
                  >
                    + Room
                  </button>
                ) : (
                  <div
                    className="w-full h-full rounded border-2 border-dashed border-fs-gold/15 flex items-center justify-center text-2xl font-display text-fs-parchment/20 select-none"
                    title="Drop a card here to add a room slot"
                  >
                    + Room
                  </div>
                )}
              </Droppable>
            </div>

            {/* Slots — scrollable, fills remaining col 4 space, min 1 or 2 slots */}
            {roomSlots.length > 0 && (
              <Droppable id="drop-room" payload={{ targetZone: 'room' }} className="flex-1 min-w-0 overflow-hidden">
                <div style={{
                  minWidth: roomSlots.length === 1 ? 78 : 160,
                  overflowX: 'auto',
                }}>
                  <div className="flex gap-2 items-center flex-nowrap">
                    {roomSlots.map((slot) => (
                      <RoomSlotCard
                        key={slot.instanceId}
                        slot={slot}
                        isActiveTurn={isActiveTurn}
                        returningCard={returningCard}
                        setReturningCard={setReturningCard}
                        nonSpectatorPlayers={nonSpectatorPlayers}
                      />
                    ))}
                  </div>
                </div>
              </Droppable>
            )}
          </div>
        ) : (
          <div
            className="flex items-center justify-center text-2xl text-fs-parchment/25 italic"
            style={{ height: 107 }}
          >
            Room deck not in use
          </div>
        )}
      </div>

      {/* Col 5 — shop (top row) + monster (bottom row); grows at 2x priority over col 4 */}
      <div className="flex flex-col gap-3 justify-center min-w-0" style={{ flex: '2 1 0' }}>
        <DeckRow
          deckType="treasure"
          deckCount={game.treasureDeckCount ?? 0}
          discardCardId={topTreasureDiscard}
          discardCount={game.treasureDiscard?.length ?? 0}
          actionSlot={<BuyDeckTopSlot />}
          showAddSlot
          deckIsDraggable
        >
          {shopSlots.map((slot) => (
            <ShopSlotComponent key={slot.slotIndex} slot={slot} size="sm" />
          ))}
        </DeckRow>

        <DeckRow
          deckType="monster"
          deckCount={game.monsterDeckCount ?? 0}
          discardCardId={topMonsterDiscard}
          discardCount={game.monsterDiscard?.length ?? 0}
          actionSlot={<FlipAttackSlot />}
          showAddSlot
          deckIsDraggable
        >
          {monsterSlots.map((slot) => (
            <MonsterSlotComponent key={slot.slotIndex} slot={slot} size="sm" />
          ))}
        </DeckRow>
      </div>

       </div>{/* end card panel */}
    </div>
  );
}
