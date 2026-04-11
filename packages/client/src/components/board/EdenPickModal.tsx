import React from 'react';
import { useGameStore } from '../../store/gameStore';
import { useCard } from './CardResolver';
import { getSocket } from '../../socket/client';

import { SERVER_URL } from '../../config';

const serverUrl = SERVER_URL;

/** Single selectable card for the Eden pick UI */
function EdenCardChoice({ cardId, onPick }: { cardId: string; onPick: (id: string) => void }) {
  const card = useCard(cardId);

  return (
    <button
      onClick={() => onPick(cardId)}
      className="flex flex-col items-center gap-2 group focus:outline-none"
    >
      <div       className="relative rounded-lg overflow-hidden border-2 border-fs-gold/40 group-hover:border-fs-gold group-focus:border-fs-gold transition-colors shadow-lg w-40 h-56">
        {card ? (
          <img
            src={`${serverUrl}${card.imageUrl}`}
            alt={card.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-150"
            onError={(e) => { (e.target as HTMLImageElement).src = '/treasure-back.png'; }}
          />
        ) : (
          <div className="w-full h-full bg-fs-darker flex items-center justify-center text-fs-parchment/30 text-xs">
            Loading…
          </div>
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-fs-gold/0 group-hover:bg-fs-gold/10 transition-colors" />
      </div>
      {/* Eternal tag — below card image, above name */}
      {card?.isEternal && (
        <span className="text-xs px-1.5 py-0.5 rounded bg-teal-900/80 text-teal-300">
          Eternal
        </span>
      )}
      <div className="text-center max-w-[8rem]">
          <div className="font-display text-fs-gold text-base font-semibold leading-tight">
          {card?.name ?? '…'}
        </div>
        {card?.abilityText && (
          <div className="text-fs-parchment/60 text-sm mt-1 line-clamp-3 leading-snug">
            {card.abilityText}
          </div>
        )}
      </div>
      <div className="px-3 py-1 rounded bg-fs-gold/20 border border-fs-gold/40 text-fs-gold text-sm font-semibold group-hover:bg-fs-gold/40 transition-colors">
        Choose
      </div>
    </button>
  );
}

/** Full-screen blocking modal shown during the eden_pick phase */
export function EdenPickModal() {
  const game = useGameStore((s) => s.game);
  if (!game || game.phase !== 'eden_pick') return null;

  const { edenPickQueue, edenPickOptions, players, myPlayerId } = game;
  const currentPickerId = edenPickQueue[0];
  const isMyTurn = currentPickerId === myPlayerId;
  const currentPicker = players.find((p) => p.id === currentPickerId);

  function handlePick(cardId: string) {
    getSocket().emit('action:eden_pick', { cardId });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="panel max-w-2xl w-full mx-4 p-6 space-y-6 text-center">
        <div>
          <h2 className="font-display text-fs-gold text-2xl font-bold">Starting Item Pick</h2>
          {isMyTurn ? (
            <p className="text-fs-parchment/70 text-sm mt-1">
              You are playing as Eden. Choose one of the three cards below as your starting item.
            </p>
          ) : (
            <p className="text-fs-parchment/70 text-sm mt-1">
              Waiting for{' '}
              <span className="text-fs-gold font-semibold">{currentPicker?.name ?? 'a player'}</span>
              {' '}to choose their starting item…
            </p>
          )}
        </div>

        {isMyTurn && edenPickOptions.length > 0 && (
          <div className="flex flex-wrap justify-center gap-6">
            {edenPickOptions.map((cardId) => (
              <EdenCardChoice key={cardId} cardId={cardId} onPick={handlePick} />
            ))}
          </div>
        )}

        {!isMyTurn && (
          <div className="flex justify-center py-4">
            <div className="text-fs-parchment/30 text-sm animate-pulse">
              {edenPickQueue.length > 1
                ? `${edenPickQueue.length} players remaining to pick`
                : 'Waiting…'}
            </div>
          </div>
        )}

        {/* Queue indicator */}
        {edenPickQueue.length > 1 && (
          <div className="text-xs text-fs-parchment/40 border-t border-fs-gold/20 pt-3">
            Pick order:{' '}
            {edenPickQueue.map((pid, i) => {
              const p = players.find((pl) => pl.id === pid);
              return (
                <span key={pid} className={i === 0 ? 'text-fs-gold' : ''}>
                  {p?.name ?? pid}{i < edenPickQueue.length - 1 ? ' → ' : ''}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
