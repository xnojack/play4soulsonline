import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ClientPlayer, useGameStore } from '../../store/gameStore';
import { ResolvedCard } from '../board/CardResolver';
import { Droppable } from '../board/DnDPrimitives';
import { PlayerExpandedPanel } from './PlayerExpandedPanel';

interface BoardTopSectionProps {
  myPlayerId: string | undefined;
}

/**
 * Top 1/3 of the board:
 *  - Horizontal scrolling player strip (auto-scrolls active player into view)
 *  - Active player panel (left half) + Priority player panel (right half)
 *  - Hover on a strip entry shows a floating PlayerExpandedPanel popover
 *
 * Excludes the local player from the visible panes (their info is in the bottom 1/3).
 */
export function BoardTopSection({ myPlayerId }: BoardTopSectionProps) {
  const game = useGameStore((s) => s.game);
  const stripRef = useRef<HTMLDivElement>(null);
  const [hoverState, setHoverState] = useState<{ player: ClientPlayer; rect: DOMRect } | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const allPlayers = (game?.players ?? []).filter((p) => !p.isSpectator);
  const activePlayerId = game?.turn.activePlayerId ?? null;
  const priorityPlayerId = game?.priorityQueue[0] ?? null;

  // Determine which player goes into the right "priority" pane
  // Rule: priorityPlayer if it differs from active; otherwise next-in-queue (priorityQueue[1])
  const rightPaneId =
    priorityPlayerId && priorityPlayerId !== activePlayerId
      ? priorityPlayerId
      : (game?.priorityQueue[1] ?? null);

  const activePlayer = allPlayers.find((p) => p.id === activePlayerId) ?? null;
  const rightPanePlayer = allPlayers.find((p) => p.id === rightPaneId) ?? null;

  // Auto-scroll active player into view when changed
  useEffect(() => {
    if (!stripRef.current || !activePlayerId) return;
    const target = stripRef.current.querySelector<HTMLElement>(`[data-strip-id="${activePlayerId}"]`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [activePlayerId]);

  if (!game) return null;

  return (
    <div className="h-full flex flex-col gap-1 px-2 pt-1 pb-1 min-h-0 overflow-hidden">
      {/* Player strip */}
       <div
        ref={stripRef}
        className="flex gap-5 overflow-x-auto overflow-y-hidden flex-shrink-0 pb-1"
        style={{ scrollbarWidth: 'thin' }}
      >
       {allPlayers.map((p) => (
           <StripEntry
             key={p.id}
             player={p}
             isActive={p.id === activePlayerId}
             isPriority={p.id === priorityPlayerId && p.id !== activePlayerId}
             isMe={p.id === myPlayerId}
             onHover={(rect) => {
               if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
               setHoverState({ player: p, rect });
             }}
             onLeave={() => {
               hideTimer.current = setTimeout(() => setHoverState(null), 200);
             }}
           />
         ))}
      </div>

      {/* Active + Priority panes (exclude local player; their info is below) */}
      <div className="flex-1 flex gap-2 min-h-0 overflow-visible">
        <div className="flex-1 min-w-0 min-h-0">
          <AnimatePresence mode="wait">
            {activePlayer && activePlayer.id !== myPlayerId ? (
              <motion.div
                key={`active-${activePlayer.id}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
                className="h-full"
              >
                <PlayerExpandedPanel
                  player={activePlayer}
                  isMe={false}
                  showHand={false}
                  label="ACTIVE"
                  labelColor="gold"
                  compact
                />
              </motion.div>
            ) : (
              <EmptyPane label={activePlayer?.id === myPlayerId ? 'You are active — see your area below' : 'No active player'} />
            )}
          </AnimatePresence>
        </div>

        <div className="flex-1 min-w-0 min-h-0">
          <AnimatePresence mode="wait">
            {rightPanePlayer && rightPanePlayer.id !== myPlayerId ? (
              <motion.div
                key={`prio-${rightPanePlayer.id}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.25 }}
                className="h-full"
              >
                <PlayerExpandedPanel
                  player={rightPanePlayer}
                  isMe={false}
                  showHand={false}
                  label={priorityPlayerId === rightPanePlayer.id ? 'PRIORITY' : 'NEXT'}
                  labelColor={priorityPlayerId === rightPanePlayer.id ? 'purple' : 'parchment'}
                  compact
                />
              </motion.div>
            ) : (
              <EmptyPane label="—" />
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Hover popover (portal) */}
      {hoverState && createPortal(
        <HoverPopover
          player={hoverState.player}
          anchor={hoverState.rect}
          onEnter={() => {
            if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
          }}
          onLeave={() => {
            hideTimer.current = setTimeout(() => setHoverState(null), 200);
          }}
        />,
        document.body
      )}
    </div>
  );
}

function EmptyPane({ label }: { label: string }) {
  return (
    <div className="h-full rounded-lg border-2 border-dashed border-fs-gold/15 bg-fs-darker/30 flex items-center justify-center text-2xl text-fs-parchment/30 italic">
      {label}
    </div>
  );
}

/** Compact entry for the horizontal player strip */
function StripEntry({
  player,
  isActive,
  isPriority,
  isMe,
  onHover,
  onLeave,
}: {
  player: ClientPlayer;
  isActive: boolean;
  isPriority: boolean;
  isMe: boolean;
  onHover: (rect: DOMRect) => void;
  onLeave: () => void;
}) {
  const characterCards = useGameStore((s) => s.game?.characterCards ?? {});
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
  const ref = useRef<HTMLDivElement>(null);

  return (
    <Droppable
      id={`drop-strip-${player.id}`}
      payload={{ targetZone: 'player', targetZoneId: player.id }}
    >
      <div
        ref={ref}
        data-strip-id={player.id}
        onMouseEnter={() => {
          if (ref.current) onHover(ref.current.getBoundingClientRect());
        }}
        onMouseLeave={onLeave}
        className={`flex items-center gap-5 px-8 py-4 rounded border-2 min-w-[400px] flex-shrink-0 transition-colors ${
          isActive
            ? 'border-fs-gold/70 bg-fs-gold/15'
            : isPriority
            ? 'border-fs-soul/60 bg-fs-soul/10'
            : 'border-fs-gold/20 bg-fs-darker/55'
        } ${!player.isAlive ? 'opacity-50' : ''}`}
      >
        {charInstance && (
          <div className="flex-shrink-0">
            <ResolvedCard instance={charInstance} size="sm" showCounters={false} />
          </div>
        )}
        <div className="flex flex-col items-start gap-0.5 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-3xl font-display text-fs-parchment font-semibold truncate max-w-[280px]">
              {player.name}
              {isMe && <span className="text-3xl text-fs-gold ml-1">(you)</span>}
            </span>
            {isActive && <span className="text-2xl px-2 py-0.5 bg-fs-gold text-fs-darker rounded font-bold">A</span>}
            {isPriority && <span className="text-2xl px-2 py-0.5 bg-fs-soul text-white rounded font-bold">P</span>}
            {!player.connected && <span className="text-2xl text-yellow-600">⚡</span>}
          </div>
          <div className="grid grid-cols-3 gap-x-2 gap-y-1 text-2xl text-fs-parchment/60">
            <span title="HP">❤ {player.effectiveHp}</span>
            <span title="ATK">🗡 {player.effectiveAtk}</span>
            <span title="Coins">¢ {player.coins}</span>
            <span title="Items" className="flex items-center gap-1">
              <img src="/treasure-back.png" alt="" className="w-[34px] h-[46px] object-cover rounded-sm opacity-80" />
              {player.items.length}
            </span>
            <span title="Hand" className="flex items-center gap-1">
              <img src="/loot-back.png" alt="" className="w-[34px] h-[46px] object-cover rounded-sm opacity-80" />
              {player.handCount}
            </span>
            <span title="Souls" className="text-purple-400 flex items-center gap-1">
              👻 {player.souls.length}
            </span>
          </div>
        </div>
      </div>
    </Droppable>
  );
}

/** Portal-rendered popover with the full PlayerExpandedPanel for the hovered player */
function HoverPopover({ player, anchor, onEnter, onLeave }: { player: ClientPlayer; anchor: DOMRect; onEnter: () => void; onLeave: () => void }) {
  const popoverW = 400;
  const popoverH = 320;
  const vw = window.innerWidth;
  const left = Math.max(8, Math.min(vw - popoverW - 8, anchor.left + anchor.width / 2 - popoverW / 2));
  const top = anchor.bottom + 6;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.12 }}
      className="fixed z-[200] pointer-events-none"
      style={{ left, top, width: popoverW, maxHeight: popoverH }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <div className="pointer-events-auto shadow-2xl">
      <PlayerExpandedPanel
           player={player}
           isMe={false}
           showHand={false}
           label="HOVER"
           labelColor="parchment"
           compact
           screenScale
         />
      </div>
    </motion.div>
  );
}
