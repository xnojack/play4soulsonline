import React from 'react';
import { useGameStore, StackItem } from '../../store/gameStore';
import { getSocket } from '../../socket/client';
import { useHasPriority, useIsMyTurn } from '../../hooks/useMyPlayer';
import { ResolvedCard, useCard } from '../board/CardResolver';
import { Button } from '../ui/Button';
import { DiceFace } from './TheStack';
import { Draggable } from '../board/DnDPrimitives';

function resolveStackCardId(item: StackItem, game: ReturnType<typeof useGameStore.getState>['game']): string | null {
  if (!game) return null;
  if (item.type === 'loot') {
    return item.sourceCardInstanceId || null;
  }
  if (item.type === 'dice_roll' || item.type === 'attack_roll') {
    return null; // these use DiceFace, not a card image
  }
  const instanceId = item.sourceCardInstanceId;
  if (!instanceId) return null;
  const charCard = game.characterCards[instanceId];
  if (charCard) return charCard.cardId;
  const startItem = game.startingItemCards[instanceId];
  if (startItem) return startItem.cardId;
  for (const player of game.players) {
    const found = player.items.find((i) => i.instanceId === instanceId);
    if (found) return found.cardId;
  }
  return null;
}

const TYPE_ICON: Record<string, string> = {
  attack_declaration: '⚔️',
  activated_ability: '⚡',
  triggered_ability: '↯',
  loot: '🃏',
};

export function StackTop() {
  const game = useGameStore((s) => s.game);
  const hasPriority = useHasPriority();
  const isMyTurn = useIsMyTurn();

  if (!game) return null;

  const stack = game.stack;
  const topItem = stack.length > 0 ? stack[stack.length - 1] : null;
  const topCanceled = topItem?.isCanceled ?? false;

  const topCardId = topItem ? resolveStackCardId(topItem, game) : null;
  const topCard = useCard(topCardId ?? undefined);

  const handleResolveTop = () => { getSocket().emit('action:resolve_top'); };
  const handleCancel = () => {
    if (topItem) getSocket().emit('action:cancel_stack_item', { stackItemId: topItem.id });
  };
  const handlePass = () => { getSocket().emit('action:pass_priority'); };

  const actionButtons = (
    <div className="flex gap-2 mt-1 flex-wrap justify-center">
      {!topCanceled && isMyTurn && (
        <Button size="sm" variant="primary" onClick={handleResolveTop}>
          Resolve
        </Button>
      )}
      {!topCanceled && (
        <Button size="sm" variant="danger" onClick={handleCancel}>
          Cancel
        </Button>
      )}
      {hasPriority && (
        <Button size="sm" variant="ghost" onClick={handlePass}>
          Pass Priority
        </Button>
      )}
    </div>
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="section-title text-sm">Stack Top</div>

      {!topItem ? (
        <div className="w-[117px] h-[160px] rounded border-2 border-dashed border-fs-gold/20 flex items-center justify-center text-sm text-fs-parchment/20">
          Stack is empty
        </div>
      ) : (topItem.type === 'dice_roll' || topItem.type === 'attack_roll') ? (
        // ── Dice roll / attack roll ──────────────────────────────────────────
        <div className={`flex flex-col items-center gap-2 ${topCanceled ? 'opacity-40 grayscale' : ''}`}>
          <Draggable
            id={`stack-top-${topItem.id}`}
            payload={{ cardId: topCardId ?? '', instanceId: topItem.id, sourceZone: 'stack', sourceZoneId: topItem.sourceCardInstanceId }}
          >
          <div className="relative">
            <DiceFace value={topItem.data?.roll as number ?? 0} size="lg" />
            {!topCanceled && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-fs-gold text-fs-dark text-[10px] rounded font-display font-bold shadow">
                resolves next
              </span>
            )}
          </div>
          </Draggable>
          <div className="text-sm text-fs-parchment/70 text-center max-w-md italic">
            {topItem.description}
          </div>
          {actionButtons}
        </div>
      ) : topItem.type === 'attack_declaration' ? (
        // ── Attack declaration ───────────────────────────────────────────────
        <div className={`flex flex-col items-center gap-2 ${topCanceled ? 'opacity-40 grayscale' : ''}`}>
          <Draggable
            id={`stack-top-${topItem.id}`}
            payload={{ cardId: topCardId ?? '', instanceId: topItem.id, sourceZone: 'stack', sourceZoneId: topItem.sourceCardInstanceId }}
          >
          <div className="relative">
            <div className="w-16 h-20 bg-fs-darker border-2 border-fs-gold/50 rounded-lg flex flex-col items-center justify-center gap-1 flex-shrink-0">
              <span className="text-3xl leading-none">⚔️</span>
              <span className="font-display text-fs-gold text-xs font-bold leading-none uppercase tracking-wide">Attack</span>
            </div>
            {!topCanceled && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-fs-gold text-fs-dark text-[10px] rounded font-display font-bold shadow">
                resolves next
              </span>
            )}
          </div>
          </Draggable>
          <div className="text-sm text-fs-parchment/70 text-center max-w-md italic">
            {topItem.description}
          </div>
          {actionButtons}
        </div>
      ) : topCardId ? (
        // ── Card-based item (loot, activated_ability, triggered_ability) ─────
        <div className="flex flex-col items-center gap-2">
          <Draggable
            id={`stack-top-${topItem.id}`}
            payload={{ cardId: topCardId, instanceId: topItem.id, sourceZone: 'stack', sourceZoneId: topItem.sourceCardInstanceId }}
          >
          <div className={`relative ${topCanceled ? 'opacity-40 grayscale' : ''}`}>
            <ResolvedCard
              instance={{
                instanceId: topItem.sourceCardInstanceId ?? '',
                cardId: topCardId,
                charged: true,
                damageCounters: 0,
                hpCounters: 0,
                atkCounters: 0,
                genericCounters: 0,
                namedCounters: {},
                flipped: false,
              }}
              size="md"
              showCounters={false}
            />
            {!topCanceled && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-fs-gold text-fs-dark text-[10px] rounded font-display font-bold shadow">
                resolves next
              </span>
            )}
          </div>
          </Draggable>
          {topItem && (
            <div className="text-sm text-fs-parchment/70 text-center max-w-md italic">
              {topItem.description}
            </div>
          )}
          {topCard?.abilityText && (
            <div className="text-xs text-fs-parchment/50 text-center max-w-md">
              {topCard.abilityText}
            </div>
          )}
          {actionButtons}
        </div>
      ) : (
        // ── Fallback — unknown type with no card ─────────────────────────────
        <div className={`flex flex-col items-center gap-2 ${topCanceled ? 'opacity-40' : ''}`}>
          <Draggable
            id={`stack-top-${topItem.id}`}
            payload={{ cardId: '', instanceId: topItem.id, sourceZone: 'stack', sourceZoneId: topItem.sourceCardInstanceId }}
          >
          <div className="w-16 h-20 bg-fs-darker border-2 border-fs-gold/30 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-3xl">{TYPE_ICON[topItem.type] ?? '📋'}</span>
          </div>
          </Draggable>
          <div className="text-sm text-fs-parchment/70 text-center max-w-md italic">
            {topItem.description}
          </div>
          {actionButtons}
        </div>
      )}
    </div>
  );
}
