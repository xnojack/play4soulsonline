import React, { useState } from 'react';
import { ClientPlayer, CardInPlay, useGameStore } from '../../store/gameStore';
import { ResolvedCard, useCard, getCardFromCache } from '../board/CardResolver';
import { CardAction } from '../cards/CardComponent';
import { StatDisplay } from './StatDisplay';
import { HandPanel } from './HandPanel';
import { Button } from '../ui/Button';
import { getSocket } from '../../socket/client';
import { useIsMyTurn } from '../../hooks/useMyPlayer';

/** Pre-warms a single card in the cache */
function CardPreloader({ cardId }: { cardId: string }) {
  useCard(cardId);
  return null;
}

/** Shows total soul value. Preloads all soul cards so values are available. */
function SoulValueBadge({ souls, kills }: { souls: CardInPlay[]; kills: CardInPlay[] }) {
  const total = souls.reduce((sum, s) => sum + (getCardFromCache(s.cardId)?.soulValue ?? 1), 0);
  return (
    <>
      {souls.map((s) => <CardPreloader key={s.instanceId} cardId={s.cardId} />)}
      {kills.map((k) => <CardPreloader key={k.instanceId} cardId={k.cardId} />)}
      <span className={`text-sm ml-1 font-bold ${total > 0 ? 'text-purple-400' : 'text-purple-400/30'}`}>
        {total > 0 ? `${total} soul pt${total !== 1 ? 's' : ''}` : '0 souls'}
      </span>
    </>
  );
}

interface PlayerAreaProps {
  player: ClientPlayer;
  isMe: boolean;
}

/** Item card with all actions consolidated into the popover */
function ItemCard({
  item,
  isMe,
  otherPlayers,
}: {
  item: CardInPlay;
  isMe: boolean;
  otherPlayers: { id: string; name: string }[];
}) {
  const [givingTo, setGivingTo] = useState(false);

  const handleTap = () => {
    if (item.charged) {
      getSocket().emit('action:deactivate_item', { instanceId: item.instanceId });
    } else {
      getSocket().emit('action:charge_item', { instanceId: item.instanceId });
    }
  };

  const handleDestroy = () => {
    if (!confirm('Destroy this item?')) return;
    getSocket().emit('action:destroy_card', { instanceId: item.instanceId });
  };

  const handleTrade = (toPlayerId: string) => {
    getSocket().emit('action:trade_card', { instanceId: item.instanceId, toPlayerId, fromHand: false });
    setGivingTo(false);
  };

  const handlePlaceInRoom = () => {
    getSocket().emit('action:place_in_room', { instanceId: item.instanceId });
  };

  // Build actions — only for own items
  const actions: CardAction[] = isMe ? (
    givingTo
      ? [
          ...otherPlayers.map((p) => ({
            label: `→ ${p.name}`,
            onClick: () => handleTrade(p.id),
            variant: 'ghost' as const,
          })),
          { label: 'Cancel give', onClick: () => setGivingTo(false), variant: 'ghost' as const },
        ]
      : [
          {
            label: item.charged ? 'Tap' : 'Ready',
            onClick: handleTap,
            variant: item.charged ? 'default' as const : 'ghost' as const,
          },
          { label: 'Destroy', onClick: handleDestroy, variant: 'danger' as const },
          ...(otherPlayers.length > 0
            ? [{ label: 'Give to…', onClick: () => setGivingTo(true), variant: 'ghost' as const }]
            : []),
          { label: 'Place in Room', onClick: handlePlaceInRoom, variant: 'ghost' as const },
        ]
  ) : [];

  return (
    <ResolvedCard
      instance={item}
      size="sm"
      actions={actions.length > 0 ? actions : undefined}
      alwaysPopover
      popoverBelow
    />
  );
}

export function PlayerArea({ player, isMe }: PlayerAreaProps) {
  const game = useGameStore((s) => s.game);
  const isMyTurn = useIsMyTurn();

  const isActiveTurn = game?.turn.activePlayerId === player.id;
  const otherPlayers = game?.players.filter((p) => p.id !== player.id && !p.isSpectator) ?? [];

  const handleEndTurn = () => {
    getSocket().emit('action:end_turn');
  };

  const handleTapCharacter = () => {
    const charInstance = game?.characterCards[player.characterInstanceId];
    const isCharged = charInstance?.charged ?? false;
    if (isCharged) {
      getSocket().emit('action:deactivate_item', { instanceId: player.characterInstanceId });
    } else {
      getSocket().emit('action:charge_item', { instanceId: player.characterInstanceId });
    }
  };

  const charInstance = game?.characterCards[player.characterInstanceId];
  const charActions: CardAction[] = isMe
    ? [{
        label: charInstance?.charged ? 'Tap' : 'Ready',
        onClick: handleTapCharacter,
        variant: charInstance?.charged ? 'default' : 'ghost',
      }]
    : [];

  return (
    <div
      className={`panel p-2 transition-colors ${
        isActiveTurn ? 'border-fs-gold/70 bg-fs-gold/5' : ''
      } ${!player.isAlive ? 'opacity-60' : ''}`}
    >
      {/* Player header */}
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <span className="font-display text-fs-gold-light font-semibold">
          {player.name}
        </span>
        {isActiveTurn && (
          <span className="px-1.5 py-0.5 bg-fs-gold/20 text-fs-gold text-sm rounded font-display">
            Active
          </span>
        )}
        {player.isSpectator && (
          <span className="text-sm text-fs-parchment/40">Spectator</span>
        )}

        {/* End turn button — only when it's my turn */}
        {isMe && isMyTurn && game?.stack.length === 0 && (
          <Button variant="primary" size="sm" onClick={handleEndTurn} className="font-bold">
            End Turn
          </Button>
        )}

        {/* Souls */}
        <div className="flex items-center gap-1 ml-2 flex-wrap">
          {player.souls.map((soul) => {
            const isGeneric = soul.cardId === '';
            if (isGeneric) {
              // Generic souls have no backing card — render a simple token with a direct remove button
              return (
                <div
                  key={soul.instanceId}
                  className="relative group"
                  title="Generic soul (1 soul point)"
                >
                  <img
                    src="/card-back.png"
                    alt="Soul"
                    className="rounded border border-purple-700/40"
                    style={{ width: 52, height: 71, objectFit: 'cover' }}
                  />
                  {isMe && (
                    <button
                      onClick={() => getSocket().emit('action:remove_soul', { instanceId: soul.instanceId })}
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-900/80 border border-red-500/60 text-red-300 text-xs leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove this soul"
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            }
            return (
              <ResolvedCard
                key={soul.instanceId}
                instance={soul}
                size="xs"
                showCounters={false}
                alwaysPopover={isMe}
                actions={isMe ? [{
                  label: 'Remove Soul',
                  onClick: () => getSocket().emit('action:remove_soul', { instanceId: soul.instanceId }),
                  variant: 'danger',
                }] : undefined}
              />
            );
          })}
          <SoulValueBadge souls={player.souls} kills={player.kills} />
          {isMe && (
            <button
              onClick={() => getSocket().emit('action:gain_generic_soul')}
              title="Gain a soul (from a card effect)"
              className="text-xs px-1 py-0.5 rounded border border-purple-700/50 text-purple-400/70 hover:text-purple-300 hover:border-purple-500 transition-colors ml-1"
            >
              +Soul
            </button>
          )}
        </div>
      </div>

      {/* Stats (includes inline dice roller) */}
      <StatDisplay player={player} isMe={isMe} />

      <div className="border-t border-fs-gold/10 my-1" />

      {/* Character + Items */}
      <div className="flex gap-3">
        {/* Character card */}
        {player.characterInstanceId && (
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-sm text-fs-parchment/40">Character</span>
            <ResolvedCard
              instance={
                charInstance ?? {
                  instanceId: player.characterInstanceId,
                  cardId: player.characterCardId || player.characterInstanceId,
                  charged: false,
                  damageCounters: 0,
                  hpCounters: 0,
                  atkCounters: 0,
                  genericCounters: 0,
                  namedCounters: {},
                  flipped: false,
                }
              }
              size="sm"
              actions={charActions.length > 0 ? charActions : undefined}
              alwaysPopover
              popoverBelow
            />
          </div>
        )}

        {/* Items */}
        <div className="flex-1">
          <span className="text-sm text-fs-parchment/40 block mb-1">
            Items
            {isMe && <span className="text-fs-parchment/20 ml-1">(click to act)</span>}
          </span>
          <div className="flex flex-wrap gap-2">
            {player.items.map((item) => (
              <ItemCard
                key={item.instanceId}
                item={item}
                isMe={isMe}
                otherPlayers={otherPlayers}
              />
            ))}
            {player.items.length === 0 && (
              <span className="text-sm text-fs-parchment/20 italic">No items</span>
            )}
          </div>
        </div>
      </div>

      {/* Curses */}
      {player.curses.length > 0 && (
        <div className="mt-1">
          <span className="text-sm text-red-400/70 block mb-0.5">Curses</span>
          <div className="flex gap-1">
            {player.curses.map((curse) => (
              <ResolvedCard key={curse.instanceId} instance={curse} size="xs" showCounters={false} />
            ))}
          </div>
        </div>
      )}

      {/* Kill trophies */}
      {player.kills.length > 0 && (
        <div className="mt-1">
          <span className="text-sm text-orange-400/70 block mb-0.5">Kills ({player.kills.length})</span>
          <div className="flex gap-1 flex-wrap">
            {player.kills.map((kill) => (
              <ResolvedCard key={kill.instanceId} instance={kill} size="xs" showCounters={false} />
            ))}
          </div>
        </div>
      )}

      {/* My hand */}
      {isMe && (
        <>
          <div className="border-t border-fs-gold/10 my-1" />
          <HandPanel player={player} />
        </>
      )}
    </div>
  );
}
