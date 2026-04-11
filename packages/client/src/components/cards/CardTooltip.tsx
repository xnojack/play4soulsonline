import React from 'react';
import { ClientCard, CardInPlay } from '../../store/gameStore';

interface CardTooltipProps {
  card: ClientCard;
  instance?: CardInPlay;
}

const TYPE_COLORS: Record<string, string> = {
  Monster: 'text-red-400',
  Treasure: 'text-fs-gold',
  Loot: 'text-green-400',
  Character: 'text-blue-400',
  Room: 'text-orange-400',
  BonusSoul: 'text-purple-400',
};

export function CardTooltip({ card, instance }: CardTooltipProps) {
  const typeColor = TYPE_COLORS[card.cardType] ?? 'text-fs-parchment';

  return (
    <div className="w-80 bg-fs-darker border border-fs-gold/50 rounded-lg shadow-2xl p-3 text-sm pointer-events-none">
      {/* Name */}
      <div className="font-display font-semibold text-fs-gold-light text-base mb-1">{card.name}</div>

      {/* Type + Set */}
      <div className={`text-sm mb-2 ${typeColor}`}>
        {card.cardType}{card.subType ? ` — ${card.subType}` : ''}
        <span className="text-fs-parchment/40 ml-2">({card.set})</span>
      </div>

      {/* Stats */}
      {(card.hp !== null || card.atk !== null || card.evasion !== null) && (
        <div className="flex gap-3 mb-2 text-sm">
          {card.hp !== null && (
            <span className="text-pink-400">
              ❤ {card.hp}{instance?.hpCounters ? `+${instance.hpCounters}` : ''}
              {instance?.damageCounters ? ` (${(card.hp + (instance?.hpCounters ?? 0)) - instance.damageCounters} left)` : ''}
            </span>
          )}
          {card.atk !== null && (
            <span className="text-orange-400">
              ⚔ {card.atk}{instance?.atkCounters ? `+${instance.atkCounters}` : ''}
            </span>
          )}
          {card.evasion !== null && (
            <span className="text-blue-400">DC {card.evasion}</span>
          )}
        </div>
      )}

      {/* Soul value */}
      {card.soulValue > 0 && (
        <div className="text-sm text-purple-400 mb-2">Soul Value: {card.soulValue}</div>
      )}

      {/* Ability text */}
      {card.abilityText && (
        <div className="text-sm text-fs-parchment/90 whitespace-pre-line border-t border-fs-gold/20 pt-2 mt-1 leading-relaxed max-h-56 overflow-y-auto">
          {card.abilityText}
        </div>
      )}

      {/* Reward text */}
      {card.rewardText && (
        <div className="text-sm text-fs-gold/70 mt-2 italic border-t border-fs-gold/10 pt-1">
          Reward: {card.rewardText}
        </div>
      )}

      {/* Badges */}
      <div className="flex gap-2 mt-1 flex-wrap">
        {card.isEternal && (
          <span className="text-sm text-amber-400">Eternal</span>
        )}
        {card.threePlayerOnly && (
          <span className="text-sm text-gray-400">3+ Players</span>
        )}
      </div>
    </div>
  );
}
