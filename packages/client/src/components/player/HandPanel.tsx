import React, { useState } from 'react';
import { ClientPlayer, useGameStore } from '../../store/gameStore';
import { ResolvedCard } from '../board/CardResolver';
import { Button } from '../ui/Button';
import { getSocket } from '../../socket/client';
import { useHasPriority } from '../../hooks/useMyPlayer';
import { motion, AnimatePresence } from 'framer-motion';
import { Draggable, Droppable } from '../board/DnDPrimitives';
import { playSound } from '../audio/SoundManager';

interface HandPanelProps {
  player: ClientPlayer;
}

export function HandPanel({ player }: HandPanelProps) {
  const game = useGameStore((s) => s.game);
  const hasPriority = useHasPriority();
  const [sharing, setSharing] = useState(false);

  // Soft check — any player with priority can attempt to play a loot card.
  // Resource tracking (lootPlaysRemaining, character card charged state) is
  // handled server-side and never hard-blocks the play.
  const canPlayLoot = hasPriority;

  const handlePlayCard = (cardId: string) => {
    if (!canPlayLoot) return;
    playSound('cardSlide');
    getSocket().emit('action:play_loot', { cardId, targets: [] });
  };

  const handleShareHand = (withPlayerId: string) => {
    getSocket().emit('action:share_hand', { withPlayerId });
    setSharing(false);
  };

  const handleRevokeShare = (withPlayerId: string) => {
    getSocket().emit('action:revoke_hand_share', { withPlayerId });
  };

  const otherPlayers = game?.players.filter(
    (p) => p.id !== player.id && !p.isSpectator
  ) ?? [];

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center gap-4 flex-shrink-0">
        <button className="h-16 px-6 rounded-lg border-2 border-fs-gold/40 bg-fs-gold/5 text-3xl font-display font-semibold text-fs-parchment hover:bg-fs-gold/10 hover:border-fs-gold transition-colors" onClick={() => setSharing(!sharing)}>
          Share Hand
        </button>
      </div>

      {/* Share hand dropdown */}
      <AnimatePresence>
        {sharing && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-fs-darker/60 border border-fs-gold/20 rounded p-4 text-3xl space-y-1">
              <div className="text-3xl text-fs-parchment/40 mb-1">Share with:</div>
              {otherPlayers.map((p) => {
                const alreadyShared = player.handSharedWith.includes(p.id);
                return (
                  <div key={p.id} className="flex items-center justify-between">
                    <span className="text-fs-parchment/80">{p.name}</span>
                    {alreadyShared ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRevokeShare(p.id)}
                      >
                        Revoke
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => handleShareHand(p.id)}>
                        Share
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cards in hand — Droppable fills remaining height so entire right side is a drop target */}
      <Droppable
        id={`drop-hand-${player.id}`}
        payload={{ targetZone: 'hand', targetZoneId: player.id }}
        className="flex-1 min-h-0"
      >
      <div className="flex gap-4 flex-wrap content-start min-h-full overflow-y-auto" style={{ maxHeight: 320 }} data-zone="my-hand">
        {player.handCardIds.length === 0 && (
          <div className="text-3xl text-fs-parchment/30 italic">No cards in hand</div>
        )}
        {player.handCardIds.map((cardId, idx) => (
          <Draggable
            key={`${cardId}-${idx}`}
            id={`hand-${cardId}-${idx}`}
            payload={{ cardId, sourceZone: 'hand', sourceZoneId: player.id }}
          >
            <HandCardSlot
              cardId={cardId}
              idx={idx}
              playerId={player.id}
              canPlay={canPlayLoot}
              otherPlayers={otherPlayers}
              onPlay={() => handlePlayCard(cardId)}
            />
          </Draggable>
        ))}
      </div>
      </Droppable>
    </div>
  );
}

function HandCardSlot({
  cardId,
  idx,
  playerId,
  canPlay: _canPlay,
  otherPlayers: _otherPlayers,
  onPlay: _onPlay,
}: {
  cardId: string;
  idx: number;
  playerId: string;
  canPlay: boolean;
  otherPlayers: { id: string; name: string }[];
  onPlay: () => void;
  // TODO: wire to automation: onDiscard, onTrade, canPlay, otherPlayers
}) {
  return (
    <ResolvedCard
      instance={{
        instanceId: `hand-${cardId}`,
        cardId,
        charged: true,
        damageCounters: 0,
        hpCounters: 0,
        atkCounters: 0,
        genericCounters: 0,
        namedCounters: {},
        flipped: false,
      }}
      size="sm"
      showCounters={false}
    />
  );
}

