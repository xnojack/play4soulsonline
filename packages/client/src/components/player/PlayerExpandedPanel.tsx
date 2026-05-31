import React from 'react';
import { motion } from 'framer-motion';
import { ClientPlayer, useGameStore } from '../../store/gameStore';
import { ResolvedCard } from '../board/CardResolver';
import { CardAction } from '../cards/CardComponent';
import { getSocket } from '../../socket/client';
import { Draggable, Droppable } from '../board/DnDPrimitives';
import { StatDisplay } from './StatDisplay';
import { HandPanel } from './HandPanel';

interface PlayerExpandedPanelProps {
  player: ClientPlayer;
  isMe: boolean;
  /** When false, hand cards render face-down (opponent view). */
  showHand: boolean;
  /** Visual label on top-right, e.g. "Active" / "Priority" / "You" */
  label?: string;
  labelColor?: 'gold' | 'purple' | 'parchment';
  /** Compact mode reduces paddings for top-third dual-pane layout */
  compact?: boolean;
}

/**
 * Full-detail player panel used in:
 *  - top 1/3 active and priority panes
 *  - hover tooltip for any player
 *  - bottom 1/3 (local player) with showHand=true
 *
 * Layout: [Souls vertical stack] [Character card] [Items grid] [Hand row above items]
 * Drag/drop preserved on all sub-zones.
 */
export function PlayerExpandedPanel({
  player,
  isMe,
  showHand,
  label,
  labelColor = 'gold',
  compact = false,
}: PlayerExpandedPanelProps) {
  const game = useGameStore((s) => s.game);
  const characterCards = game?.characterCards ?? {};

  const charInstance = player.characterInstanceId
    ? (characterCards[player.characterInstanceId] ?? {
        instanceId: player.characterInstanceId,
        cardId: player.characterCardId || player.characterInstanceId,
        charged: false,
        damageCounters: 0,
        hpCounters: 0,
        atkCounters: 0,
        genericCounters: 0,
        namedCounters: {},
        flipped: false,
      })
    : null;

  const isActiveTurn = game?.turn.activePlayerId === player.id;
  const otherPlayers = game?.players.filter((p) => p.id !== player.id && !p.isSpectator) ?? [];

  const labelClass =
    labelColor === 'gold'
      ? 'bg-fs-gold/90 text-fs-darker'
      : labelColor === 'purple'
      ? 'bg-fs-soul/90 text-white'
      : 'bg-fs-brown/90 text-fs-parchment';

  // Character actions — TODO: wire to automation
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _charActions: CardAction[] = isMe && charInstance
    ? [{
        label: charInstance.charged ? 'Tap' : 'Ready',
        onClick: () => {
          if (charInstance.charged) {
            getSocket().emit('action:deactivate_item', { instanceId: charInstance.instanceId });
          } else {
            getSocket().emit('action:charge_item', { instanceId: charInstance.instanceId });
          }
        },
        variant: charInstance.charged ? 'default' : 'ghost',
      }]
    : [];

  return (
    <Droppable
      id={`drop-player-panel-${player.id}`}
      payload={{ targetZone: 'player', targetZoneId: player.id }}
      className="h-full"
    >
      <motion.div
        data-zone={`player-${player.id}`}
        animate={
          isActiveTurn
            ? {
                boxShadow: [
                  '0 0 0px 0px rgba(212,175,55,0.0)',
                  '0 0 14px 2px rgba(212,175,55,0.5)',
                  '0 0 0px 0px rgba(212,175,55,0.0)',
                ],
              }
            : { boxShadow: '0 0 0px 0px rgba(212,175,55,0)' }
        }
        transition={
          isActiveTurn
            ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }
            : { duration: 0.3 }
        }
        className={`relative rounded-lg border bg-fs-darker/55 backdrop-blur-sm ${
          isActiveTurn ? 'border-fs-gold/70' : 'border-fs-gold/20'
        } ${!player.isAlive ? 'opacity-60' : ''} ${compact ? 'p-1.5' : 'p-2'} h-full overflow-hidden`}
      >
        {/* Label badge */}
        {label && (
          <span
            className={`absolute top-1 right-1 px-2 py-0.5 text-[10px] rounded-full font-display font-bold shadow-lg z-10 ${labelClass}`}
          >
            {label}
          </span>
        )}

        {/* Two-column layout: left = header+stats+cards, right = hand */}
        <div className="flex gap-2 h-full min-h-0">

          {/* LEFT HALF: header + stats + souls + char + items */}
          <div className="flex flex-col min-w-0 min-h-0 overflow-hidden" style={{ flex: '1 1 0' }}>

            {/* Header: name + inline counters */}
            <div className="flex items-center gap-2 mb-1 min-w-0 flex-shrink-0">
              <span className="font-display text-fs-gold-light text-sm font-semibold truncate">
                {player.name}
              </span>
              {!player.connected && (
                <span className="text-xs text-yellow-600 flex-shrink-0" title="Disconnected">⚡</span>
              )}
              {!player.isAlive && (
                <span className="text-xs text-gray-500 flex-shrink-0">💀</span>
              )}
              {/* Items count */}
              <span className="flex items-center gap-0.5 text-[11px] text-fs-parchment/60 flex-shrink-0" title="Items">
                <img src="/treasure-back.png" alt="items" style={{ width: 12, height: 17, objectFit: 'cover' }} className="rounded-sm opacity-80" />
                {player.items.length}
              </span>
              {/* Hand count */}
              <span className="flex items-center gap-0.5 text-[11px] text-fs-parchment/60 flex-shrink-0" title="Hand">
                <img src="/loot-back.png" alt="hand" style={{ width: 12, height: 17, objectFit: 'cover' }} className="rounded-sm opacity-80" />
                {player.handCount}
              </span>
              {/* Soul count */}
              <span className="flex items-center gap-0.5 text-[11px] text-purple-400 flex-shrink-0" title="Souls">
                👻 {player.souls.length}
              </span>
            </div>

            {/* Stats row — hidden in compact opponent view (strip shows key stats) */}
            {(!compact || isMe) && (
              <div className="mb-1 flex-shrink-0">
                <StatDisplay player={player} isMe={isMe} />
              </div>
            )}

            {/* Cards: grid [souls | char | items(1fr)] */}
            <div className="grid gap-2 items-start min-h-0 flex-1" style={{ gridTemplateColumns: 'auto auto 1fr' }}>
              {/* Souls vertical stack */}
              <div className="flex flex-col gap-0.5 flex-shrink-0">
                {player.souls.length === 0 && (
                  <div className={`${compact ? 'w-[52px] h-[71px]' : 'w-[52px] h-[71px]'} rounded border border-dashed border-purple-700/20 flex items-center justify-center text-[10px] text-fs-parchment/20`}>
                    no souls
                  </div>
                )}
                {player.souls.map((soul) => {
                  const isGeneric = soul.cardId === '';
                  const draggable = isMe;
                  const inner = isGeneric ? (
                    <div className="relative group">
                      <img
                        src="/card-back.png"
                        alt="Soul"
                        className="rounded border border-purple-700/50"
                        style={{ width: 52, height: 71, objectFit: 'cover' }}
                      />
                      {isMe && (
                        <button
                          onClick={() => getSocket().emit('action:remove_soul', { instanceId: soul.instanceId })}
                          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-900/80 border border-red-500/60 text-red-300 text-[10px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove this soul"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ) : (
                    <ResolvedCard
                      instance={soul}
                      size="xs"
                      showCounters={false}
                    />
                  );
                  return draggable ? (
                    <Draggable
                      key={soul.instanceId}
                      id={`soul-${soul.instanceId}`}
                      payload={{ cardId: soul.cardId, instanceId: soul.instanceId, sourceZone: 'soul', sourceZoneId: player.id }}
                    >
                      {inner}
                    </Draggable>
                  ) : (
                    <div key={soul.instanceId}>{inner}</div>
                  );
                })}
                {isMe && (
                  <button
                    onClick={() => getSocket().emit('action:gain_generic_soul')}
                    className="text-[10px] px-1 py-0.5 rounded border border-purple-700/50 text-purple-400/70 hover:text-purple-300 hover:border-purple-500 transition-colors"
                    title="Gain a soul"
                  >
                    +Soul
                  </button>
                )}
              </div>

              {/* Character card */}
              {charInstance && (
                <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                  {isMe ? (
                    <Draggable
                      id={`char-${charInstance.instanceId}`}
                      payload={{
                        cardId: charInstance.cardId,
                        instanceId: charInstance.instanceId,
                        sourceZone: 'character',
                        sourceZoneId: player.id,
                      }}
                    >
                      <ResolvedCard
                        instance={charInstance}
                        size={compact ? 'xs' : 'sm'}
                      />
                    </Draggable>
                  ) : (
                    <ResolvedCard
                      instance={charInstance}
                      size={compact ? 'xs' : 'sm'}
                    />
                  )}
                </div>
              )}

              {/* Items — 3rd column (1fr), wrap + scroll */}
              <Droppable
                id={`drop-items-${player.id}`}
                payload={{ targetZone: 'items', targetZoneId: player.id }}
                className="min-w-0"
              >
                <div className="overflow-x-auto" data-zone={`items-${player.id}`}>
                  <div className="flex flex-wrap gap-1 content-start overflow-y-auto" style={{ maxHeight: compact ? 71 : 160 }}>
                    {player.items.length === 0 && (
                      <span className="text-[11px] text-fs-parchment/20 italic self-center">no items</span>
                    )}
                    {player.items.map((item) => {
                      // TODO: wire to automation
                      // eslint-disable-next-line @typescript-eslint/no-unused-vars
                      const _itemActions: CardAction[] = isMe
                        ? [
                            {
                              label: item.charged ? 'Tap' : 'Ready',
                              onClick: () => {
                                if (item.charged) getSocket().emit('action:deactivate_item', { instanceId: item.instanceId });
                                else getSocket().emit('action:charge_item', { instanceId: item.instanceId });
                              },
                              variant: item.charged ? 'default' : 'ghost',
                            },
                            {
                              label: 'Destroy',
                              onClick: () => {
                                if (confirm('Destroy this item?')) getSocket().emit('action:destroy_card', { instanceId: item.instanceId });
                              },
                              variant: 'danger',
                            },
                            ...(otherPlayers.length > 0
                              ? otherPlayers.map((p) => ({
                                  label: `→ ${p.name}`,
                                  onClick: () => getSocket().emit('action:trade_card', { instanceId: item.instanceId, toPlayerId: p.id, fromHand: false }),
                                  variant: 'ghost' as const,
                                }))
                              : []),
                            {
                              label: 'Place in Room',
                              onClick: () => getSocket().emit('action:place_in_room', { instanceId: item.instanceId }),
                              variant: 'ghost',
                            },
                          ]
                        : [];
                      const draggableId = `item-${item.instanceId}`;
                      const draggablePayload = { cardId: item.cardId, instanceId: item.instanceId, sourceZone: 'items', sourceZoneId: player.id };
                      const cardEl = (
                        <ResolvedCard
                          instance={item}
                          size={compact ? 'xs' : 'sm'}
                        />
                      );
                      return isMe ? (
                        <Draggable
                          key={item.instanceId}
                          id={draggableId}
                          payload={draggablePayload}
                        >
                          {cardEl}
                        </Draggable>
                      ) : (
                        <React.Fragment key={item.instanceId}>{cardEl}</React.Fragment>
                      );
                    })}
                  </div>
                </div>
              </Droppable>
            </div>

            {/* Curses row — only when non-empty */}
            {player.curses.length > 0 && (
              <div className="mt-1 overflow-x-auto flex-shrink-0">
                <div className="flex gap-1 flex-nowrap">
                  {player.curses.map((curse) => {
                    const el = (
                      <ResolvedCard
                        instance={curse}
                        size="xs"
                        showCounters={false}
                      />
                    );
                    return isMe ? (
                      <Draggable
                        key={curse.instanceId}
                        id={`curse-${curse.instanceId}`}
                        payload={{ cardId: curse.cardId, instanceId: curse.instanceId, sourceZone: 'curse', sourceZoneId: player.id }}
                      >
                        {el}
                      </Draggable>
                    ) : (
                      <React.Fragment key={curse.instanceId}>{el}</React.Fragment>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT HALF: hand panel (full height) */}
          <div className="flex flex-col min-w-0 min-h-0" style={{ flex: '1 1 0' }}>
            <HandRow player={player} showFaces={showHand} isMe={isMe} />
          </div>

        </div>
      </motion.div>
    </Droppable>
  );
}

/** Hand row — face-up if showFaces=true (local player), face-down otherwise. */
function HandRow({ player, showFaces, isMe }: { player: ClientPlayer; showFaces: boolean; isMe: boolean }) {
  if (showFaces && isMe) {
    return <HandPanel player={player} />;
  }
  // Face-down rendering for opponents
  const visible = Math.min(player.handCount, 10);
  if (player.handCount === 0) {
    return (
      <div className="text-[10px] text-fs-parchment/20 italic">empty hand</div>
    );
  }
  return (
    <div style={{ height: 56, width: visible * 14 + 32, position: 'relative' }}>
      {Array.from({ length: visible }).map((_, i) => (
        <img
          key={i}
          src="/loot-back.png"
          alt=""
          className="rounded border border-fs-gold/30 absolute"
          style={{
            width: 32,
            height: 44,
            left: i * 14,
            top: 0,
            zIndex: i,
            boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
          }}
          draggable={false}
        />
      ))}
      {player.handCount > visible && (
        <span
          className="absolute text-[10px] text-fs-parchment/60 font-display"
          style={{ left: visible * 14 + 6, top: 16 }}
        >
          +{player.handCount - visible}
        </span>
      )}
    </div>
  );
}
