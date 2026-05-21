import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { MonsterSlotComponent } from './MonsterSlot';
import { ShopSlotComponent } from './ShopSlot';
import { DeckZone } from './DeckZone';
import { ResolvedCard } from './CardResolver';
import { getSocket } from '../../socket/client';
import { useIsMyTurn } from '../../hooks/useMyPlayer';
import { CardAction } from '../cards/CardComponent';
import { StackTop } from '../stack/StackTop';
import { InlineDeckBrowser } from './InlineDeckBrowser';
import { AnimatePresence } from 'framer-motion';
import { Draggable, Droppable } from './DnDPrimitives';
import { playSound } from '../audio/SoundManager';

type DeckType = 'loot' | 'treasure' | 'monster' | 'room' | 'eternal';
type InlineTabKey = DeckType | `discard_${DeckType}`;

/** A fake shop slot that lets the active player buy the top card of the treasure deck blind */
function BuyDeckTopSlot() {
  const game = useGameStore((s) => s.game);
  const isMyTurn = useIsMyTurn();
  const canBuy = isMyTurn && (game?.treasureDeckCount ?? 0) > 0;

  return (
    <div className="flex flex-col items-center gap-1 min-w-[130px]">
      <div className="section-title text-center text-sm mb-0.5 text-fs-parchment/40">
        Deck Top
      </div>
      <button
        onClick={() => getSocket().emit('action:buy_top_treasure')}
        disabled={!canBuy}
        className={`w-[117px] h-[160px] rounded border-2 flex flex-col items-center justify-center gap-1 transition-colors ${
          canBuy
            ? 'border-fs-gold/40 hover:border-fs-gold bg-fs-brown/20 hover:bg-fs-brown/40 cursor-pointer'
            : 'border-fs-gold/10 bg-fs-darker/30 cursor-not-allowed'
        }`}
        title="Buy the top card of the treasure deck (cost set by cost label)"
      >
        <span className="text-2xl">🃏</span>
        <span className={`text-sm font-display ${canBuy ? 'text-fs-gold' : 'text-fs-parchment/20'}`}>
          Buy Top
        </span>
        <span className={`text-xs ${canBuy ? 'text-fs-parchment/50' : 'text-fs-parchment/20'}`}>
          (blind)
        </span>
      </button>
    </div>
  );
}

/** A card-sized button in the monster section that flips the top monster card into a chosen slot and attacks */
function FlipAttackSlot() {
  const game = useGameStore((s) => s.game);
  const isMyTurn = useIsMyTurn();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isActiveTurn = game?.turn.activePlayerId === game?.myPlayerId;
  const canFlip =
    isMyTurn &&
    isActiveTurn &&
    (game?.monsterDeckCount ?? 0) > 0 &&
    game?.turn.currentAttack === null;

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  return (
    <div ref={ref} className="flex flex-col items-center gap-1 min-w-[130px] relative">
      <div className="section-title text-center text-sm mb-0.5 text-fs-parchment/40">
        Monster Deck
      </div>
      <button
        onClick={() => canFlip && setDropdownOpen(true)}
        disabled={!canFlip}
        className={`w-[117px] h-[160px] rounded border-2 flex flex-col items-center justify-center gap-1 transition-colors ${
          canFlip
            ? 'border-red-700/40 hover:border-red-500 bg-red-900/20 hover:bg-red-900/40 cursor-pointer'
            : 'border-red-700/10 bg-fs-darker/30 cursor-not-allowed'
        }`}
        title="Flip top of monster deck into a slot and attack"
      >
        <span className="text-2xl">⚔️</span>
        <span className={`text-sm font-display ${canFlip ? 'text-red-400' : 'text-fs-parchment/20'}`}>
          Flip &amp; Attack
        </span>
        <span className={`text-xs ${canFlip ? 'text-fs-parchment/50' : 'text-fs-parchment/20'}`}>
          (choose slot)
        </span>
      </button>
      {dropdownOpen && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 bg-fs-darker/95 border border-red-700/50 rounded-lg p-2 flex flex-col gap-1 shadow-xl backdrop-blur-sm">
          <span className="text-xs text-red-400/70 text-center">Flip into:</span>
          {game?.monsterSlots?.map((slot) => (
            <button
              key={slot.slotIndex}
              onClick={() => {
                getSocket().emit('action:attack_monster_deck', { slotIndex: slot.slotIndex });
                setDropdownOpen(false);
              }}
              className="text-xs px-2 py-1 rounded border border-red-700/50 text-red-400/80 hover:text-red-300 hover:bg-red-900/20 transition-colors"
            >
              Slot {slot.slotIndex + 1}
            </button>
          ))}
          <button
            onClick={() => setDropdownOpen(false)}
            className="text-xs px-2 py-1 rounded border border-fs-gold/20 text-fs-parchment/40 hover:text-fs-parchment transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

export function SharedTable() {
  const game = useGameStore((s) => s.game);
  const [inlineBrowser, setInlineBrowser] = useState<{ deckType: DeckType; initialTab?: InlineTabKey } | null>(null);
  // Feature 1: track which room card instanceId is being returned to a player
  const [returningCard, setReturningCard] = useState<string | null>(null);
  const isMyTurn = useIsMyTurn();

  if (!game) return null;

  const topTreasureDiscard = game.treasureDiscard[game.treasureDiscard.length - 1];
  const topLootDiscard = game.lootDiscard[game.lootDiscard.length - 1];
  const topMonsterDiscard = game.monsterDiscard[game.monsterDiscard.length - 1];
  const topRoomDiscard = game.roomDiscard[game.roomDiscard.length - 1];

  const isActiveTurn = game.turn.activePlayerId === game.myPlayerId;

  // Non-spectator players for "Return to player" picker
  const nonSpectatorPlayers = game.players.filter((p) => !p.isSpectator);

  return (
    <div className="table-felt p-4">
      {/* Main row: Monsters | Shop | Room | Stack | Bonus Souls — wraps if narrow */}
      <div className="flex gap-4 flex-wrap content-start items-start">
        {/* Monster slots */}
        <div className="flex-1 min-w-[220px]">
          <div className="flex items-center justify-between mb-1">
            <div className="section-title text-sm">Monsters</div>
            {isActiveTurn && (
              <button
                onClick={() => getSocket().emit('action:add_slot', { slotType: 'monster' })}
                className="text-xs px-1.5 py-0.5 rounded border border-fs-gold/20 text-fs-parchment/40 hover:text-fs-parchment hover:border-fs-gold/50 transition-colors"
                title="Add a monster slot"
              >
                + Slot
              </button>
            )}
          </div>
          <div className="flex gap-2 flex-wrap content-start">
            {game.monsterSlots.map((slot) => (
              <MonsterSlotComponent key={slot.slotIndex} slot={slot} />
            ))}
            <FlipAttackSlot />
          </div>
        </div>

        {/* Shop slots + buy-top slot */}
        <div className="flex-1 min-w-[220px]">
          <div className="flex items-center justify-between mb-1">
            <div className="section-title text-sm">Shop</div>
            {isActiveTurn && (
              <button
                onClick={() => getSocket().emit('action:add_slot', { slotType: 'shop' })}
                className="text-xs px-1.5 py-0.5 rounded border border-fs-gold/20 text-fs-parchment/40 hover:text-fs-parchment hover:border-fs-gold/50 transition-colors"
                title="Add a shop slot"
              >
                + Slot
              </button>
            )}
          </div>
          <div className="flex gap-2 flex-wrap content-start">
            {game.shopSlots.map((slot) => (
              <ShopSlotComponent key={slot.slotIndex} slot={slot} />
            ))}
            <BuyDeckTopSlot />
          </div>
        </div>

        {/* Room + Stack + Bonus Souls */}
        <div className="flex-1 min-w-[220px]">
          <div className="flex gap-3 flex-wrap content-start items-start">
              {(game.roomSlots.length > 0 || game.roomDeckCount > 0 || game.roomDiscard.length > 0) && (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <div className="section-title text-sm">Room</div>
                    {isActiveTurn && game.roomDeckCount > 0 && (
                      <button
                        onClick={() => getSocket().emit('action:add_slot', { slotType: 'room' })}
                        className="text-xs px-1 py-0.5 rounded border border-fs-gold/20 text-fs-parchment/40 hover:text-fs-parchment hover:border-fs-gold/50 transition-colors"
                        title="Draw a new room card"
                      >
                        + Room
                      </button>
                    )}
                  </div>
                  <Droppable
                    id="drop-room"
                    payload={{ targetZone: 'room' }}
                  >
                  <div className="flex gap-2 flex-wrap content-start">
                    {game.roomSlots.length === 0 && (
                      <div className="w-[107px] h-[78px] rounded border border-dashed border-fs-gold/20 flex items-center justify-center text-sm text-fs-parchment/20">
                        Empty
                      </div>
                    )}
                    {game.roomSlots.map((slot) => {
                      const isReturning = returningCard === slot.instanceId;
                      const roomActions: CardAction[] = [
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
                        <div key={slot.instanceId} className="flex flex-col items-center gap-1">
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
                              landscape
                              actions={roomActions}
                              alwaysPopover
                              popoverBelow
                            />
                          </Draggable>
                          </Droppable>
                          {isReturning && (
                            <div className="flex flex-col gap-0.5 bg-fs-darker border border-fs-gold/20 rounded p-1">
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
                                  className="text-xs px-2 py-0.5 rounded hover:bg-fs-gold/10 text-fs-parchment/70 hover:text-fs-parchment text-left transition-colors"
                                >
                                  {p.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  </Droppable>
                </div>
              )}

               {/* Stack */}
               <div className="flex flex-col gap-1">
                 <div className="section-title text-sm">Stack</div>
                 <Droppable
                   id="drop-stack"
                   payload={{ targetZone: 'stack' }}
                   highlightInset="-inset-2"
                 >
                   <div className="min-h-[160px]">
                     <StackTop />
                   </div>
                 </Droppable>
               </div>

               {game.bonusSouls.length > 0 && (
                <div className="flex flex-col gap-1">
                  <div className="section-title text-sm">Bonus Souls</div>
                  <div className="flex gap-1.5 flex-wrap content-start">
                    {game.bonusSouls.map((bs) => {
                      const gainAction: CardAction[] = (!bs.isGained && !bs.isDestroyed)
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
                        <div key={bs.cardId} className="flex flex-col items-center gap-0.5">
                          <ResolvedCard
                            instance={bs.instance}
                            size="sm"
                            showCounters={true}
                            actions={gainAction.length > 0 ? gainAction : undefined}
                            alwaysPopover
                            popoverBelow
                            className={bs.isGained || bs.isDestroyed ? 'opacity-40 grayscale' : ''}
                          />
                          {bs.isGained && (
                             <span className="text-sm text-purple-400">Gained</span>
                          )}
                          {bs.isDestroyed && (
                            <span className="text-sm text-gray-500 line-through">Gone</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
           </div>

      </div>

      {/* Decks — own row for full-width spread */}
      <div className="flex gap-3 flex-wrap content-start mt-2 pt-2 border-t border-fs-gold/10">
        <div className="section-title text-sm self-start pt-0.5 min-w-[40px]">Decks</div>
        <DeckZone
          label="Treasure"
          count={game.treasureDeckCount}
          topDiscardCardId={topTreasureDiscard}
          deckType="treasure"
          onBrowse={() => setInlineBrowser({ deckType: 'treasure' })}
          onDraw={() => { playSound('cardFlip'); getSocket().emit('action:gain_treasure', { playerId: game.myPlayerId, count: 1 }); }}
          discardCount={game.treasureDiscard.length}
          onBrowseDiscard={() => setInlineBrowser({ deckType: 'treasure', initialTab: 'discard_treasure' })}
          discardIsDroppable
          discardIsDraggable
          deckIsDroppable
        />
        <DeckZone
          label="Loot"
          count={game.lootDeckCount}
          topDiscardCardId={topLootDiscard}
          deckType="loot"
          onBrowse={() => setInlineBrowser({ deckType: 'loot' })}
          onDraw={() => { playSound('cardFlip'); getSocket().emit('action:draw_loot', { playerId: game.myPlayerId, count: 1 }); }}
          discardCount={game.lootDiscard.length}
          onBrowseDiscard={() => setInlineBrowser({ deckType: 'loot', initialTab: 'discard_loot' })}
          discardIsDroppable
          discardIsDraggable
          deckIsDroppable
        />
        <DeckZone
          label="Monster"
          count={game.monsterDeckCount}
          topDiscardCardId={topMonsterDiscard}
          deckType="monster"
          onBrowse={() => setInlineBrowser({ deckType: 'monster' })}
          discardCount={game.monsterDiscard.length}
          onBrowseDiscard={() => setInlineBrowser({ deckType: 'monster', initialTab: 'discard_monster' })}
          discardIsDroppable
          discardIsDraggable
          deckIsDroppable
        />
        {game.roomDeckCount > 0 && (
          <DeckZone
            label="Room"
            count={game.roomDeckCount}
            topDiscardCardId={topRoomDiscard}
            deckType="room"
            onBrowse={() => setInlineBrowser({ deckType: 'room' })}
            discardCount={game.roomDiscard.length}
            onBrowseDiscard={() => setInlineBrowser({ deckType: 'room', initialTab: 'discard_room' })}
            discardIsDroppable
            discardIsDraggable
            deckIsDroppable
          />
        )}
      </div>

      {/* Inline deck browser */}
      <AnimatePresence>
        {inlineBrowser && (
          <InlineDeckBrowser
            deckType={inlineBrowser.deckType}
            initialTab={inlineBrowser.initialTab}
            onClose={() => setInlineBrowser(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
