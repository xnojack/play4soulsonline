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
  /** When true, use normal screen-scale sizes (for portal-rendered hover preview) */
  screenScale?: boolean;
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
  screenScale = false,
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
      className={`relative rounded-lg border-2 bg-fs-darker/55 backdrop-blur-sm ${
           isActiveTurn ? 'border-fs-gold/70' : 'border-fs-gold/20'
         } ${!player.isAlive ? 'opacity-60' : ''} ${screenScale ? (compact ? 'p-1.5' : 'p-2') : (compact ? 'p-3' : 'p-4')} h-full overflow-hidden`}
      >
        {/* Label badge */}
        {label && (
          <span
            className={`absolute top-1 right-1 px-2 py-0.5 ${screenScale ? 'text-[10px]' : 'text-2xl'} rounded-full font-display font-bold shadow-lg z-10 ${labelClass}`}
          >
            {label}
          </span>
        )}

     {screenScale ? (
          /* SCREEN-SCALE LAYOUT: vertical stack — header, stats, hand, cards */
          <div className="flex flex-col gap-2 h-full min-h-0">
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
              <span className="flex items-center gap-1 text-[11px] text-fs-parchment/60 flex-shrink-0" title="Items">
                <img src="/treasure-back.png" alt="items" style={{ width: 12, height: 17, objectFit: 'cover' }} className="rounded-sm opacity-80" />
                {player.items.length}
              </span>
              <span className="flex items-center gap-1 text-[11px] text-fs-parchment/60 flex-shrink-0" title="Hand">
                <img src="/loot-back.png" alt="hand" style={{ width: 12, height: 17, objectFit: 'cover' }} className="rounded-sm opacity-80" />
                {player.handCount}
              </span>
              <span className="flex items-center gap-1 text-[11px] text-purple-400 flex-shrink-0" title="Souls">
                👻 {player.souls.length}
              </span>
            </div>

            {/* Stats row */}
            {(!compact || isMe) && (
              <div className="mb-1 flex-shrink-0">
                <StatDisplay player={player} isMe={isMe} screenScale={screenScale} />
              </div>
            )}

            {/* Hand cards — above items area */}
            <div className="flex-shrink-0">
              <HandRow player={player} showFaces={showHand} isMe={isMe} screenScale={screenScale} />
            </div>

            {/* Cards: grid [souls | char | items(1fr)] */}
            <div className="grid gap-2 items-start flex-1" style={{ gridTemplateColumns: 'auto auto 1fr' }}>
             {/* Souls vertical stack */}
               <div className="flex flex-col gap-1 flex-shrink-0">
                 {player.souls.length === 0 && (
                   <div className="w-[26px] h-[35px] rounded border-2 border-dashed border-purple-700/20 flex items-center justify-center text-[10px] text-fs-parchment/20">
                     no souls
                   </div>
                 )}
                 {player.souls.map((soul) => {
                   const isGeneric = soul.cardId === '';
                   const inner = isGeneric ? (
                     <div className="relative group">
                       <img
                         src="/soul-back.png"
                         alt="Soul"
                         className="rounded border-2 border-purple-700/50"
                         style={{ width: 26, height: 35, objectFit: 'cover' }}
                       />
                     </div>
                   ) : (
                     <ResolvedCard
                       instance={soul}
                       size="3xs"
                       showCounters={false}
                     />
                   );
                   return <div key={soul.instanceId}>{inner}</div>;
                 })}
               </div>

              {/* Character card */}
              {charInstance && (
                <div className="flex flex-col items-center gap-2 flex-shrink-0">
                  <ResolvedCard
                    instance={charInstance}
                    size="2xs"
                  />
                </div>
              )}

              {/* Items — 3rd column, wraps naturally */}
              <div className="min-w-0">
                <div className="flex flex-wrap gap-1 content-start" style={{ maxHeight: 'none' }}>
                  {player.items.length === 0 && (
                    <span className="text-[11px] text-fs-parchment/20 italic self-center">no items</span>
                  )}
                  {player.items.map((item) => (
                    <ResolvedCard
                      key={item.instanceId}
                      instance={item}
                      size="2xs"
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Curses row */}
            {player.curses.length > 0 && (
              <div className="flex-shrink-0">
                <div className="flex gap-1 flex-wrap">
                  {player.curses.map((curse) => (
                    <ResolvedCard
                      key={curse.instanceId}
                      instance={curse}
                      size="3xs"
                      showCounters={false}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* BOARD-SCALE LAYOUT: two-column */
          <div className={`flex ${screenScale ? 'gap-2' : 'gap-4'} h-full min-h-0`}>

            {/* LEFT HALF: header + stats + souls + char + items */}
            <div className="flex flex-col min-w-0 min-h-0 overflow-hidden" style={{ flex: '1 1 0' }}>

              {/* Header: name + inline counters */}
              <div className={`flex items-center ${screenScale ? 'gap-2' : 'gap-4'} mb-1 min-w-0 flex-shrink-0`}>
                <span className={`font-display text-fs-gold-light ${screenScale ? 'text-sm' : 'text-3xl'} font-semibold truncate`}>
                  {player.name}
                </span>
                {!player.connected && (
                  <span className={`${screenScale ? 'text-xs' : 'text-2xl'} text-yellow-600 flex-shrink-0`} title="Disconnected">⚡</span>
                )}
                {!player.isAlive && (
                  <span className={`${screenScale ? 'text-xs' : 'text-2xl'} text-gray-500 flex-shrink-0`}>💀</span>
                )}
                {/* Items count */}
                <span className={`flex items-center ${screenScale ? 'gap-1' : 'gap-4'} ${screenScale ? 'text-[11px]' : 'text-3xl'} text-fs-parchment/60 flex-shrink-0`} title="Items">
                  <img src="/treasure-back.png" alt="items" style={{ width: screenScale ? 12 : 32, height: screenScale ? 17 : 44, objectFit: 'cover' }} className="rounded-sm opacity-80" />
                  {player.items.length}
                </span>
                {/* Hand count */}
                <span className={`flex items-center ${screenScale ? 'gap-1' : 'gap-4'} ${screenScale ? 'text-[11px]' : 'text-3xl'} text-fs-parchment/60 flex-shrink-0`} title="Hand">
                  <img src="/loot-back.png" alt="hand" style={{ width: screenScale ? 12 : 32, height: screenScale ? 17 : 44, objectFit: 'cover' }} className="rounded-sm opacity-80" />
                  {player.handCount}
                </span>
                {/* Soul count */}
                <span className={`flex items-center ${screenScale ? 'gap-1' : 'gap-4'} ${screenScale ? 'text-[11px]' : 'text-3xl'} text-purple-400 flex-shrink-0`} title="Souls">
                  👻 {player.souls.length}
                </span>
              </div>

              {/* Stats row — hidden in compact opponent view (strip shows key stats) */}
              {(!compact || isMe) && (
                <div className="mb-1 flex-shrink-0">
                  <StatDisplay player={player} isMe={isMe} screenScale={screenScale} />
                </div>
              )}

              {/* Cards: grid [souls | char | items(1fr)] */}
              <div className={`grid ${screenScale ? 'gap-2' : 'gap-4'} items-start min-h-0 flex-1 mt-4`} style={{ gridTemplateColumns: 'auto auto 1fr' }}>
               {/* Souls vertical stack */}
                 <div className={`flex flex-col ${screenScale ? 'gap-1' : 'gap-2'} flex-shrink-0`}>
                 {player.souls.length === 0 && (
                     <div className={`${screenScale ? 'w-[26px] h-[35px]' : 'w-[52px] h-[71px]'} rounded border-2 border-dashed border-purple-700/20 flex items-center justify-center ${screenScale ? 'text-[10px]' : 'text-xs'} text-fs-parchment/20`}>
                       no souls
                     </div>
                   )}
                  {player.souls.map((soul) => {
                    const isGeneric = soul.cardId === '';
                    const draggable = isMe;
                    const inner = isGeneric ? (
                       <div className="relative group">
                 <img
                           src="/soul-back.png"
                           alt="Soul"
                           className="rounded border-2 border-purple-700/50"
                           style={{ width: screenScale ? 26 : 52, height: screenScale ? 35 : 71, objectFit: 'cover' }}
                         />
                        {isMe && (
                          <button
                            onClick={() => getSocket().emit('action:remove_soul', { instanceId: soul.instanceId })}
                            className={`absolute -top-1 -right-1 ${screenScale ? 'w-4 h-4 text-[10px]' : 'w-6 h-6 text-xl'} rounded-full bg-red-900/80 border border-red-500/60 text-red-300 leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity`}
                            title="Remove this soul"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ) : (
                <ResolvedCard
                         instance={soul}
                         size={screenScale ? '3xs' : '2xs'}
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
                      className={`${screenScale ? 'text-[10px]' : 'text-3xl'} h-16 px-6 rounded-lg border-2 border-purple-700/50 bg-purple-900/20 text-purple-400/70 hover:text-purple-300 hover:border-purple-500 hover:bg-purple-900/30 transition-colors`}
                      title="Gain a soul"
                    >
                      +Soul
                    </button>
                  )}
                </div>

                {/* Character card */}
                {charInstance && (
                  <div className="flex flex-col items-center gap-4 flex-shrink-0">
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
                          size={screenScale ? '2xs' : (compact ? 'xs' : 'sm')}
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
                  <div className="overflow-x-auto" data-zone={isMe ? "my-items" : `items-${player.id}`}>
                    <div className={`flex flex-wrap ${screenScale ? 'gap-1' : 'gap-2'} content-start overflow-y-auto`} style={{ maxHeight: screenScale ? (compact ? 71 : 160) : (compact ? 142 : 320) }}>
                      {player.items.length === 0 && (
                        <span className={`${screenScale ? 'text-[11px]' : 'text-3xl'} text-fs-parchment/20 italic self-center`}>no items</span>
                      )}
                      {player.items.map((item) => {
                        const draggableId = `item-${item.instanceId}`;
                        const draggablePayload = { cardId: item.cardId, instanceId: item.instanceId, sourceZone: 'items', sourceZoneId: player.id };
                        const cardEl = (
                  <ResolvedCard
                            instance={item}
                            size={screenScale ? '2xs' : (compact ? 'xs' : 'sm')}
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
                  <div className={`flex ${screenScale ? 'gap-1' : 'gap-4'} flex-nowrap`}>
                    {player.curses.map((curse) => {
                      const el = (
                <ResolvedCard
                          instance={curse}
                          size={screenScale ? '3xs' : 'xs'}
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
              <HandRow player={player} showFaces={showHand} isMe={isMe} screenScale={screenScale} />
            </div>

          </div>
        )}
      </motion.div>
    </Droppable>
  );
}

/** Hand row — face-up if showFaces=true (local player), face-down otherwise. */
function HandRow({ player, showFaces, isMe, screenScale }: { player: ClientPlayer; showFaces: boolean; isMe: boolean; screenScale?: boolean }) {
  if (showFaces && isMe) {
    return <HandPanel player={player} />;
  }
  const visible = Math.min(player.handCount, 10);
  if (player.handCount === 0) {
    return (
      <div className={`${screenScale ? 'text-[10px]' : 'text-3xl'} text-fs-parchment/20 italic`}>empty hand</div>
    );
  }
  if (screenScale) {
    const cardW = 32;
    const cardH = 44;
    return (
      <div className="flex flex-wrap gap-1 items-start">
        {Array.from({ length: visible }).map((_, i) => (
          <img
            key={i}
            src="/loot-back.png"
            alt=""
            className="rounded border border-fs-gold/30 flex-shrink-0"
            style={{
              width: cardW,
              height: cardH,
              boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
            }}
            draggable={false}
          />
        ))}
        {player.handCount > visible && (
          <span className="text-[10px] text-fs-parchment/60 font-display self-center">
            +{player.handCount - visible}
          </span>
        )}
      </div>
    );
  }
  const cardW = 64;
  const cardH = 88;
  const overlap = 28;
  const containerH = 112;
  return (
    <div style={{ height: containerH, width: visible * overlap + cardW, position: 'relative' }}>
      {Array.from({ length: visible }).map((_, i) => (
        <img
          key={i}
          src="/loot-back.png"
          alt=""
          className="rounded border border-fs-gold/30 absolute"
          style={{
            width: cardW,
            height: cardH,
            left: i * overlap,
            top: 0,
            zIndex: i,
            boxShadow: '0 4px 8px rgba(0,0,0,0.4)',
          }}
          draggable={false}
        />
      ))}
      {player.handCount > visible && (
        <span
          className="absolute text-2xl text-fs-parchment/60 font-display"
          style={{ left: visible * overlap + 12, top: 32 }}
        >
          +{player.handCount - visible}
        </span>
      )}
    </div>
  );
}
