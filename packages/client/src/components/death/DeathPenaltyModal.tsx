import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { getSocket } from '../../socket/client';
import { useCard } from '../board/CardResolver';
import { SERVER_URL } from '../../config';

/** Modal shown when active player dies and must choose which item to destroy */
export function DeathPenaltyModal() {
  const deathPenaltyPending = useGameStore((s) => s.game?.turn.deathPenaltyPending);
  const myPlayerId = useGameStore((s) => s.game?.myPlayerId);
  const player = useGameStore((s) =>
    s.game?.players.find((p) => p.id === deathPenaltyPending)
  );

  const isVisible = deathPenaltyPending === myPlayerId;

  const handleChoose = (itemId: string) => {
    getSocket().emit('action:choose_death_penalty_item', { itemId });
  };

  if (!isVisible || !player) return null;

  // Filter non-eternal items
  const destroyableItems = player.items.filter((item) => {
    const card = useCard(item.cardId);
    return !card?.isEternal;
  });

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center"
          >
            {/* Modal */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-fs-brown border-2 border-red-800/60 rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl"
            >
              <h2 className="text-xl font-display text-red-400 mb-2 text-center">
                💀 Death Penalty
              </h2>
              <p className="text-fs-parchment/70 text-sm text-center mb-4">
                You have died. Choose a non-eternal item to destroy, then discard 1 loot, lose 1¢, and deactivate all ↷ items.
              </p>

              {destroyableItems.length > 0 ? (
                <div className="flex flex-wrap gap-3 justify-center">
                  {destroyableItems.map((item) => (
                    <DeathPenaltyItemCard
                      key={item.instanceId}
                      item={item}
                      onClick={() => handleChoose(item.instanceId)}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-fs-parchment/50 text-center italic">
                  No non-eternal items to destroy — this part of the penalty is skipped.
                </p>
              )}

              {destroyableItems.length === 0 && (
                <div className="mt-4 text-center">
                  <button
                    onClick={() => handleChoose('')}
                    className="px-4 py-2 bg-fs-gold/20 hover:bg-fs-gold/30 text-fs-gold rounded-lg border border-fs-gold/30 transition-colors"
                  >
                    Continue
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function DeathPenaltyItemCard({
  item,
  onClick,
}: {
  item: { instanceId: string; cardId: string };
  onClick: () => void;
}) {
  const card = useCard(item.cardId);
  const serverUrl = SERVER_URL;

  if (!card) return null;

  const imgSrc = card.imageUrl.startsWith('http')
    ? card.imageUrl
    : `${serverUrl}${card.imageUrl}`;

  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col items-center gap-1 p-2 rounded-lg bg-fs-darker/60 border border-fs-gold/20 hover:border-red-500/60 transition-colors cursor-pointer"
      title={`Destroy ${card.name}`}
    >
      <img
        src={imgSrc}
        alt={card.name}
        className="w-14 h-20 object-cover rounded border border-fs-gold/20 group-hover:border-red-500/40 transition-colors"
        draggable={false}
      />
      <span className="text-xs text-fs-parchment/60 group-hover:text-red-400 transition-colors text-center leading-tight max-w-[5.5rem]">
        {card.name}
      </span>
      <span className="text-[10px] text-red-400/60 group-hover:text-red-400 transition-colors">
        Click to destroy
      </span>
    </button>
  );
}
