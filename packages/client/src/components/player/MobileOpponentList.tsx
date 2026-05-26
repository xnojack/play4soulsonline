import React from 'react';
import { ClientPlayer } from '../../store/gameStore';
import { useCard } from '../board/CardResolver';
import { SERVER_URL } from '../../config';

interface MobileOpponentListProps {
  players: ClientPlayer[];
  activePlayerId: string;
  priorityPlayerId: string | null;
  onSelectPlayer: (playerId: string) => void;
}

export function MobileOpponentList({ players, activePlayerId, priorityPlayerId, onSelectPlayer }: MobileOpponentListProps) {
  if (players.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      {players.map((p) => {
        const isActive = activePlayerId === p.id;
        const hasPriority = priorityPlayerId === p.id && priorityPlayerId !== activePlayerId;
        const hp = p.effectiveHp;
        const maxHp = p.baseHp;
        const atk = p.effectiveAtk;
        const handCount = p.handCount;
        const souls = p.souls.length;
        const coins = p.coins;
        const charCard = useCard(p.characterCardId);

        return (
          <button
            key={p.id}
            onClick={() => onSelectPlayer(p.id)}
            className={`w-full text-left rounded border p-1.5 transition-colors flex items-center gap-2 ${
              isActive
                ? 'border-fs-gold/50 bg-fs-gold/10'
                : 'border-fs-gold/10 bg-fs-darker/50 hover:bg-fs-brown/20'
            }`}
          >
            {charCard && (
              <img
                src={`${SERVER_URL}${charCard.imageUrl}`}
                alt={p.name}
                className="w-8 h-11 object-cover rounded flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 mb-0.5">
                <span className={`text-xs font-display truncate ${isActive ? 'text-fs-gold' : 'text-fs-parchment/60'}`}>
                  {p.name}
                </span>
                {isActive && (
                  <span className="text-[8px] text-fs-gold/60 flex-shrink-0">●</span>
                )}
                {hasPriority && (
                  <span className="text-[8px] text-fs-gold flex-shrink-0" title="Has priority">⚡ Priority</span>
                )}
              </div>
              <div className="text-[10px] text-fs-parchment/40 flex items-center gap-2 flex-wrap">
                {hp !== null && maxHp !== null && (
                  <span>
                    <span className="text-red-400/60">❤</span> {hp}/{maxHp}
                  </span>
                )}
                <span>
                  <span className="text-orange-400/60">⚔</span> {atk}
                </span>
              </div>
              <div className="text-[10px] text-fs-parchment/40 flex items-center gap-2 flex-wrap">
                <span>
                  <span className="text-fs-parchment/30">🃏</span> {handCount}
                </span>
                {souls > 0 && (
                  <span>
                    <span className="text-purple-400/60">★</span> {souls}
                  </span>
                )}
                <span>
                  <span className="text-fs-gold/40">¢</span> {coins}
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
