import React, { useState } from 'react';
import { ClientPlayer, useGameStore } from '../../store/gameStore';
import { ResolvedCard } from '../board/CardResolver';
import { OpponentArea } from './OpponentArea';
import { Droppable } from '../board/DnDPrimitives';

interface CompactOpponentProps {
  player: ClientPlayer;
  isActiveTurn: boolean;
}

/**
 * Compact opponent card for mobile horizontal bar.
 * Shows name, active badge, key stats, character thumbnail.
 * Tap to expand into a dropdown with the full OpponentArea.
 */
export function CompactOpponent({ player, isActiveTurn }: CompactOpponentProps) {
  const [expanded, setExpanded] = useState(false);
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

  return (
    <Droppable
      id={`drop-give-compact-${player.id}`}
      payload={{ kind: 'give-item', toPlayerId: player.id }}
      accepts={(drag) => drag.type === 'item' || drag.type === 'loot-hand'}
    >
    <div className="relative flex-shrink-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border transition-colors min-w-[140px] flex-1 ${
          isActiveTurn
            ? 'border-fs-gold/60 bg-fs-gold/10'
            : 'border-fs-gold/20 bg-fs-darker/60 hover:bg-fs-darker/80'
        } ${!player.isAlive ? 'opacity-50' : ''}`}
      >
        {/* Character thumbnail */}
        {charInstance && (
          <div className="flex-shrink-0">
            <ResolvedCard
              instance={charInstance}
              size="xs"
              showCounters={false}
            />
          </div>
        )}

        {/* Info */}
        <div className="flex flex-col items-start gap-0.5 min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="text-xs font-display text-fs-parchment font-semibold truncate max-w-[80px]">
              {player.name}
            </span>
            {isActiveTurn && (
              <span className="w-1.5 h-1.5 rounded-full bg-fs-gold flex-shrink-0" />
            )}
            {!player.connected && (
              <span className="text-xs text-yellow-600 flex-shrink-0">⚡</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-fs-parchment/60">
            <span>❤ {player.effectiveHp}</span>
            <span>⚔ {player.effectiveAtk}</span>
            <span>¢ {player.coins}</span>
            {player.souls.length > 0 && (
              <span className="text-purple-400">♦ {player.souls.length}</span>
            )}
          </div>
        </div>
      </button>

      {/* Expanded dropdown — full opponent area */}
      {expanded && (
        <>
          {/* Backdrop to close on click outside */}
          <div
            className="fixed inset-0 z-30"
            onClick={() => setExpanded(false)}
          />
          <div className="absolute top-full left-0 mt-1 z-40 w-80 max-h-96 overflow-y-auto shadow-2xl rounded-lg">
            <OpponentArea player={player} isActiveTurn={isActiveTurn} />
          </div>
        </>
      )}
    </div>
    </Droppable>
  );
}
