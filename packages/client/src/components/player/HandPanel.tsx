import React, { useState } from 'react';
import { ClientPlayer, useGameStore } from '../../store/gameStore';
import { ResolvedCard } from '../board/CardResolver';
import { CardAction } from '../cards/CardComponent';
import { Button } from '../ui/Button';
import { getSocket } from '../../socket/client';
import { useHasPriority } from '../../hooks/useMyPlayer';
import { motion, AnimatePresence } from 'framer-motion';
import { Draggable } from '../board/DnDPrimitives';

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
    getSocket().emit('action:play_loot', { cardId, targets: [] });
  };

  const handleDiscardCard = (cardId: string) => {
    getSocket().emit('action:discard_loot', { cardId });
  };

  const handleTradeCard = (cardId: string, toPlayerId: string) => {
    getSocket().emit('action:trade_card', { cardId, toPlayerId, fromHand: true });
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
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="section-title">Your Hand ({player.handCount} cards)</span>
        <Button size="sm" variant="ghost" onClick={() => setSharing(!sharing)}>
          Share Hand
        </Button>
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
            <div className="bg-fs-darker/60 border border-fs-gold/20 rounded p-2 text-sm space-y-1">
              <div className="text-sm text-fs-parchment/40 mb-1">Share with:</div>
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

      {/* Cards in hand */}
      <div className="flex gap-2 flex-wrap content-start" data-zone="my-hand">
        {player.handCardIds.length === 0 && (
          <div className="text-sm text-fs-parchment/30 italic">No cards in hand</div>
        )}
        {player.handCardIds.map((cardId, idx) => (
          <Draggable
            key={`${cardId}-${idx}`}
            id={`hand-${cardId}-${idx}`}
            payload={{ type: 'loot-hand', cardId }}
          >
            <HandCardSlot
              cardId={cardId}
              canPlay={canPlayLoot}
              otherPlayers={otherPlayers}
              onPlay={() => handlePlayCard(cardId)}
              onDiscard={() => handleDiscardCard(cardId)}
              onTrade={(toPlayerId) => handleTradeCard(cardId, toPlayerId)}
            />
          </Draggable>
        ))}
      </div>
    </div>
  );
}

function HandCardSlot({
  cardId,
  canPlay,
  otherPlayers,
  onPlay,
  onDiscard,
  onTrade,
}: {
  cardId: string;
  canPlay: boolean;
  otherPlayers: { id: string; name: string }[];
  onPlay: () => void;
  onDiscard: () => void;
  onTrade: (toPlayerId: string) => void;
}) {
  const [givingTo, setGivingTo] = useState(false);

  const actions: CardAction[] = givingTo
    ? [
        ...otherPlayers.map((p) => ({
          label: `→ ${p.name}`,
          onClick: () => { onTrade(p.id); setGivingTo(false); },
          variant: 'ghost' as const,
        })),
        { label: 'Cancel', onClick: () => setGivingTo(false), variant: 'ghost' as const },
      ]
    : [
        ...(canPlay ? [{ label: 'Play', onClick: onPlay, variant: 'default' as const }] : []),
        { label: 'Discard', onClick: onDiscard, variant: 'danger' as const },
        ...(otherPlayers.length > 0
          ? [{ label: 'Give to…', onClick: () => setGivingTo(true), variant: 'ghost' as const }]
          : []),
      ];

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
      actions={actions}
      alwaysPopover
      showCounters={false}
    />
  );
}

