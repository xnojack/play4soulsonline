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

type BrowseDeckType = 'loot' | 'treasure' | 'monster' | 'room' | 'eternal';
type BrowseInitialTab = `discard_${BrowseDeckType}`;

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
  const isMyTurn = useIsMyTurn();

  if (!game) return null;

  const topTreasureDiscard = game.treasureDiscard[game.treasureDiscard.length - 1];
  const topLootDiscard = game.lootDiscard[game.lootDiscard.length - 1];
  const topMonsterDiscard = game.monsterDiscard[game.monsterDiscard.length - 1];
  const topRoomDiscard = game.roomDiscard[game.roomDiscard.length - 1];
  const topEternalDiscard = game.eternalDiscard[game.eternalDiscard.length - 1];

  const isActiveTurn = game.turn.activePlayerId === game.myPlayerId;

  return (
    <div className="panel pt-2 px-2 pb-0 space-y-2">
      {/* Monster slots */}
      <div>
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
        <div className="flex gap-2 flex-wrap">
          {game.monsterSlots.map((slot) => (
            <MonsterSlotComponent key={slot.slotIndex} slot={slot} />
          ))}
        </div>
      </div>

      <div className="border-t border-fs-gold/10" />

      {/* Shop slots + buy-top slot */}
      <div>
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
        <div className="flex gap-2 flex-wrap">
          {game.shopSlots.map((slot) => (
            <ShopSlotComponent key={slot.slotIndex} slot={slot} />
          ))}
          {/* Always-visible blind-buy slot at the end */}
          <BuyDeckTopSlot />
        </div>
      </div>

      {/* Room + Bonus Souls */}
      {(game.roomSlots.length > 0 || game.roomDeckCount > 0 || game.roomDiscard.length > 0 || game.bonusSouls.length > 0) && (
        <>
          <div className="border-t border-fs-gold/10" />
          <div className="flex gap-3 flex-wrap items-start">
            {/* Room slots */}
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
                <div className="flex gap-2 flex-wrap">
                  {game.roomSlots.length === 0 && (
                    <div className="w-[78px] h-[107px] rounded border border-dashed border-fs-gold/20 flex items-center justify-center text-sm text-fs-parchment/20">
                      Empty
                    </div>
                  )}
                  {game.roomSlots.map((slot) => {
                    const roomActions: CardAction[] = [
                      {
                        label: 'Discard',
                        onClick: () => getSocket().emit('action:discard_room_slot', { instanceId: slot.instanceId }),
                        variant: 'danger',
                      },
                    ];
                    return (
                      <ResolvedCard
                        key={slot.instanceId}
                        instance={slot}
                        size="sm"
                        actions={roomActions}
                        alwaysPopover
                        popoverBelow
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {game.bonusSouls.length > 0 && (
              <div className="flex flex-col gap-1">
                <div className="section-title text-sm">Bonus Souls</div>
                <div className="flex gap-1.5">
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
        </>
      )}

      <div className="border-t border-fs-gold/10" />

      {/* Decks */}
      <div>
        <div className="section-title mb-1 text-sm">Decks</div>
        <div className="flex gap-3 flex-wrap">
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
      </div>

      {/* Deck browser modal */}
      {browseDeck && (
        <DeckBrowserModal
          isOpen={true}
          deckType={browseDeck}
          initialTab={browseInitialTab}
          onClose={() => { setBrowseDeck(null); setBrowseInitialTab(undefined); }}
        />
      )}
    </div>
  );
}
