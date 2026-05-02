import React, { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { MonsterSlotComponent } from './MonsterSlot';
import { ShopSlotComponent } from './ShopSlot';
import { DeckZone } from './DeckZone';
import { DeckBrowserModal } from './DeckBrowserModal';
import { ResolvedCard } from './CardResolver';
import { getSocket } from '../../socket/client';
import { useIsMyTurn } from '../../hooks/useMyPlayer';
import { CardAction } from '../cards/CardComponent';

type DeckType = 'loot' | 'treasure' | 'monster' | 'room' | 'eternal';
type BrowseDeckType = DeckType | null;
type BrowseInitialTab = `discard_${DeckType}`;

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

export function SharedTable() {
  const game = useGameStore((s) => s.game);
  const [browseDeck, setBrowseDeck] = useState<BrowseDeckType | null>(null);
  const [browseInitialTab, setBrowseInitialTab] = useState<BrowseInitialTab | undefined>(undefined);
  // Feature 1: track which room card instanceId is being returned to a player
  const [returningCard, setReturningCard] = useState<string | null>(null);
  // Feature 4: track whether slot-picker for "Flip & Attack" is open
  const [flippingAttack, setFlippingAttack] = useState(false);
  const isMyTurn = useIsMyTurn();

  if (!game) return null;

  const topTreasureDiscard = game.treasureDiscard[game.treasureDiscard.length - 1];
  const topLootDiscard = game.lootDiscard[game.lootDiscard.length - 1];
  const topMonsterDiscard = game.monsterDiscard[game.monsterDiscard.length - 1];
  const topRoomDiscard = game.roomDiscard[game.roomDiscard.length - 1];
  const topEternalDiscard = game.eternalDiscard[game.eternalDiscard.length - 1];

  const isActiveTurn = game.turn.activePlayerId === game.myPlayerId;
  const canFlipAttack =
    isActiveTurn &&
    game.monsterDeckCount > 0 &&
    game.turn.currentAttack === null;

  // Non-spectator players for "Return to player" picker
  const nonSpectatorPlayers = game.players.filter((p) => !p.isSpectator);

  return (
    <div className="panel pt-2 px-2 pb-0">
      <div className="flex gap-4 flex-wrap content-start items-start">
        {/* Monster slots */}
        <div className="flex-1 min-w-[220px]">
          <div className="flex items-center justify-between mb-1">
            <div className="section-title text-sm">Monsters</div>
            <div className="flex items-center gap-2">
              {canFlipAttack && (
                <div className="relative">
                  {flippingAttack ? (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-red-400/70">Flip into:</span>
                      {game.monsterSlots.map((slot) => (
                        <button
                          key={slot.slotIndex}
                          onClick={() => {
                            getSocket().emit('action:attack_monster_deck', { slotIndex: slot.slotIndex });
                            setFlippingAttack(false);
                          }}
                          className="text-xs px-1.5 py-0.5 rounded border border-red-700/50 text-red-400/80 hover:text-red-300 hover:bg-red-900/20 transition-colors"
                          title={`Flip top of monster deck into monster slot ${slot.slotIndex + 1}`}
                        >
                          Slot {slot.slotIndex + 1}
                        </button>
                      ))}
                      <button
                        onClick={() => setFlippingAttack(false)}
                        className="text-xs px-1 py-0.5 rounded border border-fs-gold/20 text-fs-parchment/40 hover:text-fs-parchment transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setFlippingAttack(true)}
                      className="text-xs px-1.5 py-0.5 rounded border border-red-700/40 text-red-500/60 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                      title="Flip top of monster deck into a slot and attack"
                    >
                      Flip &amp; Attack
                    </button>
                  )}
                </div>
              )}
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
          </div>
          <div className="flex gap-2 flex-wrap content-start">
            {game.monsterSlots.map((slot) => (
              <MonsterSlotComponent key={slot.slotIndex} slot={slot} />
            ))}
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

        {/* Room + Bonus Souls */}
        {(game.roomSlots.length > 0 || game.roomDeckCount > 0 || game.roomDiscard.length > 0 || game.bonusSouls.length > 0) && (
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
                          <ResolvedCard
                            instance={slot}
                            size="sm"
                            landscape
                            actions={roomActions}
                            alwaysPopover
                            popoverBelow
                          />
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
                </div>
              )}

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
        )}

      </div>

      {/* Decks — own row for full-width spread */}
      <div className="flex gap-3 flex-wrap content-start mt-2 pt-2 border-t border-fs-gold/10">
        <div className="section-title text-sm self-start pt-0.5 min-w-[40px]">Decks</div>
        <DeckZone
          label="Treasure"
          count={game.treasureDeckCount}
          topDiscardCardId={topTreasureDiscard}
          deckType="treasure"
          onBrowse={() => setBrowseDeck('treasure')}
          onDraw={() => getSocket().emit('action:gain_treasure', { playerId: game.myPlayerId, count: 1 })}
          discardCount={game.treasureDiscard.length}
          onBrowseDiscard={() => { setBrowseDeck('treasure'); setBrowseInitialTab('discard_treasure'); }}
        />
        <DeckZone
          label="Loot"
          count={game.lootDeckCount}
          topDiscardCardId={topLootDiscard}
          deckType="loot"
          onBrowse={() => setBrowseDeck('loot')}
          onDraw={() => getSocket().emit('action:draw_loot', { playerId: game.myPlayerId, count: 1 })}
          discardCount={game.lootDiscard.length}
          onBrowseDiscard={() => { setBrowseDeck('loot'); setBrowseInitialTab('discard_loot'); }}
          discardIsDroppable
        />
        <DeckZone
          label="Monster"
          count={game.monsterDeckCount}
          topDiscardCardId={topMonsterDiscard}
          deckType="monster"
          onBrowse={() => setBrowseDeck('monster')}
          discardCount={game.monsterDiscard.length}
          onBrowseDiscard={() => { setBrowseDeck('monster'); setBrowseInitialTab('discard_monster'); }}
        />
        {game.roomDeckCount > 0 && (
          <DeckZone
            label="Room"
            count={game.roomDeckCount}
            topDiscardCardId={topRoomDiscard}
            deckType="room"
            onBrowse={() => setBrowseDeck('room')}
            discardCount={game.roomDiscard.length}
            onBrowseDiscard={() => { setBrowseDeck('room'); setBrowseInitialTab('discard_room'); }}
          />
        )}
        {(game.eternalDeckCount > 0 || game.eternalDiscard.length > 0) && (
          <DeckZone
            label="Eternal"
            count={game.eternalDeckCount}
            topDiscardCardId={topEternalDiscard}
            deckType="eternal"
            onBrowse={() => setBrowseDeck('eternal')}
            discardCount={game.eternalDiscard.length}
            onBrowseDiscard={() => { setBrowseDeck('eternal'); setBrowseInitialTab('discard_eternal'); }}
          />
        )}
      </div>

      {/* Deck browser modal */}
      {browseDeck && (
        <DeckBrowserModal
          isOpen={true}
          deckType={browseDeck as DeckType}
          initialTab={browseInitialTab}
          onClose={() => { setBrowseDeck(null); setBrowseInitialTab(undefined); }}
        />
      )}
    </div>
  );
}
