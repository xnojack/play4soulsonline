import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, GameState, StackItem } from '../../store/gameStore';
import { getSocket } from '../../socket/client';
import { useHasPriority, useIsMyTurn } from '../../hooks/useMyPlayer';
import { Button } from '../ui/Button';
import { useCard } from '../board/CardResolver';
import { SERVER_URL } from '../../config';

/** Resolve sourceCardInstanceId to a DB cardId for image lookup.
 *  For loot the sourceCardInstanceId is the cardId itself.
 *  For abilities it's an instanceId — search the game state for the matching CardInPlay. */
function resolveStackCardId(item: StackItem, game: GameState): string | null {
  if (item.type === 'loot' || item.type === 'dice_roll') {
    // sourceCardInstanceId is the raw cardId
    return item.sourceCardInstanceId || null;
  }
  // activated_ability / triggered_ability — look up instance across all players & character cards
  const instanceId = item.sourceCardInstanceId;
  if (!instanceId) return null;

  // Check character cards
  const charCard = game.characterCards[instanceId];
  if (charCard) return charCard.cardId;

  // Check starting items
  const startItem = game.startingItemCards[instanceId];
  if (startItem) return startItem.cardId;

  // Check players' items
  for (const player of game.players) {
    const found = player.items.find((i) => i.instanceId === instanceId);
    if (found) return found.cardId;
  }

  return null;
}

/** Small card thumbnail shown in the stack — just the image, hover for tooltip, click for full modal */
function StackCardThumb({ cardId }: { cardId: string }) {
  const card = useCard(cardId);
  const setModalCard = useGameStore((s) => s.setModalCard);
  const serverUrl = SERVER_URL;
  const [showTip, setShowTip] = React.useState(false);

  if (!card) return <div className="w-10 h-14 bg-fs-darker border border-fs-gold/20 rounded flex-shrink-0" />;

  const imgSrc = card.imageUrl.startsWith('http') ? card.imageUrl : `${serverUrl}${card.imageUrl}`;

  return (
    <div
      className="relative flex-shrink-0 cursor-pointer"
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
      onClick={() => setModalCard(card)}
      title="Click to view full card"
    >
      <img
        src={imgSrc}
        alt={card.name}
        className="w-10 h-14 object-cover rounded border border-fs-gold/30 hover:border-fs-gold/70 transition-colors"
        draggable={false}
      />
      {showTip && (
        <div className="absolute left-full top-0 ml-2 z-50 bg-fs-brown border border-fs-gold/50 rounded p-2 shadow-xl w-48 pointer-events-none">
          <div className="font-display text-fs-gold text-sm font-bold mb-1">{card.name}</div>
          {card.abilityText && <p className="text-fs-parchment/80 text-sm leading-tight">{card.abilityText}</p>}
          {card.rewardText && <p className="text-green-400/80 text-sm leading-tight mt-1">{card.rewardText}</p>}
        </div>
      )}
    </div>
  );
}

const STACK_TYPE_ICONS: Record<string, string> = {
  loot: '🃏',
  activated_ability: '⚡',
  triggered_ability: '↯',
  dice_roll: '🎲',
  attack_roll: '⚔',
  attack_declaration: '⚔',
};

export function TheStack() {
  const stack = useGameStore((s) => s.game?.stack ?? []);
  const hasPriority = useHasPriority();
  const isMyTurn = useIsMyTurn();
  const game = useGameStore((s) => s.game);

  const handlePass = () => {
    getSocket().emit('action:pass_priority');
  };

  const handleResolveTop = () => {
    getSocket().emit('action:resolve_top');
  };

  const handleCancel = (stackItemId: string) => {
    getSocket().emit('action:cancel_stack_item', { stackItemId });
  };

  const visibleStack = [...stack].reverse(); // show top first

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-2 py-1 border-b border-fs-gold/20">
        <span className="section-title">The Stack</span>
        {stack.length > 0 && (
          <span className="text-sm text-fs-parchment/40">{stack.length} item{stack.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <AnimatePresence>
          {visibleStack.length === 0 ? (
            <div className="text-sm text-fs-parchment/30 text-center py-4">Stack is empty</div>
          ) : (
            visibleStack.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: item.isCanceled ? 0.3 : 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className={`bg-fs-darker/60 border rounded p-2 text-sm ${
                  i === 0
                    ? 'border-fs-gold/60 bg-fs-gold/5'
                    : 'border-fs-gold/20'
                } ${item.isCanceled ? 'line-through opacity-40' : ''}`}
              >
                <div className="flex items-start gap-2">
                  {/* Card thumbnail */}
                  {game && (() => {
                    const cardId = resolveStackCardId(item, game);
                    return cardId ? <StackCardThumb cardId={cardId} /> : null;
                  })()}
                  {/* Text + cancel */}
                  <div className="flex-1 flex items-start justify-between gap-1 min-w-0">
                    <div className="min-w-0">
                      <span className="text-fs-parchment/50 mr-1">{STACK_TYPE_ICONS[item.type] ?? '📋'}</span>
                      <span className="text-fs-parchment/90 break-words">{item.description}</span>
                      {i === 0 && !item.isCanceled && (
                        <span className="ml-1 text-fs-gold/60 text-xs">(resolves next)</span>
                      )}
                    </div>
                    {!item.isCanceled && (
                      <button
                        onClick={() => handleCancel(item.id)}
                        className="text-red-500/60 hover:text-red-500 text-xs flex-shrink-0"
                        title="Cancel"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Priority actions */}
      <div className="p-2 border-t border-fs-gold/20 space-y-1">
        <PriorityRing />
        {hasPriority && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={handlePass}
          >
            Pass Priority
          </Button>
        )}
        {isMyTurn && stack.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-fs-gold/70 hover:text-fs-gold"
            onClick={handleResolveTop}
            title="Resolve top of stack immediately without waiting for all players to pass"
          >
            Resolve Top
          </Button>
        )}
      </div>
    </div>
  );
}

function PriorityRing() {
  const game = useGameStore((s) => s.game);
  if (!game) return null;

  const queue = game.priorityQueue;
  const passed = new Set(game.turn.passedPriorityIds);

  return (
    <div className="flex flex-wrap gap-1">
      {queue.map((playerId, i) => {
        const player = game.players.find((p) => p.id === playerId);
        const hasPriority = i === 0;
        const hasPassed = passed.has(playerId);
        return (
          <div
            key={playerId}
            className={`px-2 py-0.5 rounded text-xs font-display transition-colors ${
              hasPriority
                ? 'bg-fs-gold text-fs-dark font-bold'
                : hasPassed
                ? 'bg-fs-darker text-fs-parchment/30 line-through'
                : 'bg-fs-darker/50 text-fs-parchment/60 border border-fs-gold/20'
            }`}
          >
            {player?.name ?? playerId.slice(0, 6)}
            {hasPriority && ' ★'}
          </div>
        );
      })}
    </div>
  );
}

