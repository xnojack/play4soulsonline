import React from 'react';
import { ClientPlayer, useGameStore } from '../../store/gameStore';
import { ResolvedCard } from '../board/CardResolver';
import { StatDisplay } from './StatDisplay';

interface OpponentAreaProps {
  player: ClientPlayer;
  isActiveTurn: boolean;
}

export function OpponentArea({ player, isActiveTurn }: OpponentAreaProps) {
  const characterCards = useGameStore((s) => s.game?.characterCards ?? {});

  // Resolve character card instance — same fallback pattern as PlayerArea
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
      })
    : null;

  return (
    <div
      className={`panel p-2 transition-colors ${
        isActiveTurn ? 'border-fs-gold/60 bg-fs-gold/5' : ''
      } ${!player.isAlive ? 'opacity-50' : ''}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="font-display text-fs-parchment text-sm font-semibold">
            {player.name}
          </span>
          {isActiveTurn && (
            <span className="px-1 py-0.5 bg-fs-gold/20 text-fs-gold text-sm rounded font-display">
              Active
            </span>
          )}
          {!player.connected && (
            <span className="text-xs text-yellow-600">⚡</span>
          )}
        </div>

        {/* Souls */}
        {player.souls.length > 0 && (
          <div className="flex items-center gap-0.5 flex-wrap justify-end">
            {player.souls.map((soul) => (
              <ResolvedCard
                key={soul.instanceId}
                instance={soul}
                size="xs"
                showCounters={false}
              />
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      <StatDisplay player={player} isMe={false} />

      {/* Character card + items side by side */}
      <div className="flex gap-2 mt-2 items-start">
        {/* Character card */}
        {charInstance && (
          <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
            <span className="text-sm text-fs-parchment/30">Character</span>
            <ResolvedCard
              instance={charInstance}
              size="sm"
              showCounters={false}
            />
          </div>
        )}

        {/* Items */}
        {player.items.length > 0 && (
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-sm text-fs-parchment/30">Items</span>
            <div className="flex gap-1 flex-wrap">
              {player.items.map((item) => (
                <ResolvedCard
                  key={item.instanceId}
                  instance={item}
                  size="xs"
                  showCounters={false}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Hand count (face-down cards) */}
      {player.handCount > 0 && (
        <div className="flex gap-0.5 mt-1.5 flex-wrap">
          {Array.from({ length: Math.min(player.handCount, 8) }).map((_, i) => (
            <div
              key={i}
              className="w-[31px] h-[43px] rounded-sm bg-fs-brown border border-fs-gold/20"
            />
          ))}
          {player.handCount > 8 && (
            <span className="text-sm text-fs-parchment/40 self-center">
              +{player.handCount - 8}
            </span>
          )}
        </div>
      )}

      {/* Kill trophies */}
      {player.kills.length > 0 && (
        <div className="mt-1.5">
          <span className="text-sm text-orange-400/60 block mb-0.5">
            Kills ({player.kills.length})
          </span>
          <div className="flex gap-0.5 flex-wrap">
            {player.kills.map((kill) => (
              <ResolvedCard
                key={kill.instanceId}
                instance={kill}
                size="xs"
                showCounters={false}
              />
            ))}
          </div>
        </div>
      )}

      {/* Curses */}
      {player.curses.length > 0 && (
        <div className="flex gap-0.5 mt-1 flex-wrap">
          {player.curses.map((curse) => (
            <ResolvedCard
              key={curse.instanceId}
              instance={curse}
              size="xs"
              showCounters={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}
