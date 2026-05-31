import React, { useState } from 'react';
import { ShopSlot as ShopSlotType, useGameStore } from '../../store/gameStore';
import { ResolvedCard, useCard } from './CardResolver';
import { CardAction } from '../cards/CardComponent';
import { getSocket } from '../../socket/client';
import { useIsMyTurn, useMyPlayer } from '../../hooks/useMyPlayer';
import { Draggable, Droppable } from './DnDPrimitives';
import { playSound } from '../audio/SoundManager';

const DEFAULT_COST = 10;

interface ShopSlotProps {
  slot: ShopSlotType;
  size?: 'xs' | 'sm' | 'md';
}

export function ShopSlotComponent({ slot, size = 'md' }: ShopSlotProps) {
  const isMyTurn = useIsMyTurn();
  const myPlayer = useMyPlayer();
  const game = useGameStore((s) => s.game);
  const [editingCost, setEditingCost] = useState(false);
  const [costInput, setCostInput] = useState('');

  const topCard = slot.card;
  const topCardData = useCard(topCard?.cardId);
  const cost = slot.cost ?? DEFAULT_COST;

  const canPurchase = isMyTurn && !!topCard;
  const isActive = game?.turn.activePlayerId === myPlayer?.id;

  const handlePurchase = () => {
    playSound('coinClink');
    getSocket().emit('action:purchase', { slotIndex: slot.slotIndex });
  };

  const handleSetCost = () => {
    const n = parseInt(costInput, 10);
    if (!isNaN(n)) {
      getSocket().emit('action:set_shop_cost', { slotIndex: slot.slotIndex, cost: n });
    }
    setEditingCost(false);
  };

  const actions: CardAction[] = [];
  if (canPurchase) {
    if (cost <= 0) {
      actions.push({
        label: cost < 0 ? `Take (+${Math.abs(cost)}¢ back)` : 'Take (free)',
        onClick: handlePurchase,
        variant: 'soul',
      });
    } else {
      actions.push({
        label: `Buy for ${cost}¢`,
        onClick: handlePurchase,
        variant: 'default',
      });
    }
  }
  if (isActive && topCard) {
    actions.push({
      label: 'Discard',
      onClick: () => getSocket().emit('action:destroy_card', { instanceId: topCard.instanceId }),
      variant: 'danger',
    });
    actions.push({
      label: 'Set cost…',
      onClick: () => { setCostInput(String(cost)); setEditingCost(true); },
      variant: 'ghost',
    });
  }

  return (
    <Droppable
      id={`drop-shop-${slot.slotIndex}`}
      payload={{ targetZone: 'shop', targetZoneId: String(slot.slotIndex) }}
    >
    <div
      className="flex flex-col items-center gap-1 flex-shrink-0"
      data-zone={`shop-${slot.slotIndex}`}
    >
      {!slot.card ? (
        <div
          className="rounded border-2 border-dashed border-fs-gold/20 flex items-center justify-center text-fs-parchment/20 text-sm"
          style={{
            width: size === 'sm' ? 78 : size === 'xs' ? 52 : 117,
            height: size === 'sm' ? 107 : size === 'xs' ? 71 : 160,
          }}
        >
          Empty
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1">
        <Draggable
          id={`shop-${slot.card.instanceId}`}
          payload={{ cardId: slot.card.cardId, instanceId: slot.card.instanceId, sourceZone: 'shop', sourceZoneId: String(slot.slotIndex) }}
        >
         <ResolvedCard
            instance={slot.card}
            size={size}
            actions={actions.length > 0 ? actions : undefined}
            alwaysPopover
          />
        </Draggable>

        {/* Buy button — inline, below card */}
        {canPurchase && (
          <button
            onClick={handlePurchase}
            className={`text-xs px-2 py-1 md:px-3 md:py-1 rounded border transition-colors font-display ${
              cost <= 0
                ? 'border-purple-700/50 text-purple-300 hover:bg-purple-900/30 hover:border-purple-400/70'
                : 'border-fs-gold/30 text-fs-parchment hover:bg-fs-brown/40 hover:border-fs-gold/50'
            }`}
          >
            {cost <= 0
              ? (cost < 0 ? `Take (+${Math.abs(cost)}¢)` : 'Take')
              : `Buy for ${cost}¢`}
          </button>
        )}

        {/* Inline cost editor — shown when Set cost… action is triggered */}
        {editingCost && (
          <span className="flex items-center gap-0.5">
            <input
              autoFocus
              type="number"
              value={costInput}
              onChange={(e) => setCostInput(e.target.value)}
              onBlur={handleSetCost}
              onKeyDown={(e) => e.key === 'Enter' && handleSetCost()}
              className="w-12 text-xs bg-fs-darker border border-fs-gold/40 rounded px-1 text-fs-parchment text-center"
              placeholder={String(cost)}
            />
            <span className="text-fs-gold/50 text-xs">¢</span>
          </span>
        )}
        </div>
      )}
    </div>
    </Droppable>
  );
}
