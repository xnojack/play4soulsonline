import React, { useState } from 'react';
import { ShopSlot as ShopSlotType, useGameStore } from '../../store/gameStore';
import { ResolvedCard, useCard } from './CardResolver';
import { CardAction } from '../cards/CardComponent';
import { getSocket } from '../../socket/client';
import { useIsMyTurn, useMyPlayer } from '../../hooks/useMyPlayer';

interface ShopSlotProps {
  slot: ShopSlotType;
}

const DEFAULT_COST = 10;

export function ShopSlotComponent({ slot }: ShopSlotProps) {
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
  }

  return (
    <div
      className="flex flex-col items-center gap-1 min-w-[120px] max-w-[180px] flex-1"
      data-zone={`shop-${slot.slotIndex}`}
    >
      <div className="section-title text-center text-sm mb-0.5 flex items-center gap-1">
        Shop {slot.slotIndex + 1}
        {topCardData && (
          editingCost ? (
            <span className="flex items-center gap-0.5">
              <input
                autoFocus
                type="number"
                value={costInput}
                onChange={(e) => setCostInput(e.target.value)}
                onBlur={handleSetCost}
                onKeyDown={(e) => e.key === 'Enter' && handleSetCost()}
                className="w-12 text-sm bg-fs-darker border border-fs-gold/40 rounded px-1 text-fs-parchment text-center"
                placeholder={String(cost)}
              />
              <span className="text-fs-gold/50 text-sm">¢</span>
            </span>
          ) : (
            <button
              className={`text-sm ml-1 font-body font-normal px-1 rounded hover:bg-fs-gold/10 transition-colors ${
                cost < 0 ? 'text-green-400' : cost === 0 ? 'text-purple-400' : 'text-fs-gold/50'
              }`}
              title="Click to change cost"
              onClick={() => { setCostInput(String(cost)); setEditingCost(true); }}
            >
              {cost < 0 ? `+${Math.abs(cost)}¢ back` : cost === 0 ? 'free' : `${cost}¢`}
            </button>
          )
        )}
      </div>

      {!slot.card ? (
        <div className="w-[117px] h-[160px] rounded border-2 border-dashed border-fs-gold/20 flex items-center justify-center text-fs-parchment/20 text-sm">
          Empty
        </div>
      ) : (
        <ResolvedCard
          instance={slot.card}
          size="md"
          actions={actions.length > 0 ? actions : undefined}
          alwaysPopover
        />
      )}
    </div>
  );
}
