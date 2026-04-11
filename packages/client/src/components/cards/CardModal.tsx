import React from 'react';
import { ClientCard, CardInPlay, useGameStore } from '../../store/gameStore';
import { Modal } from '../ui/Modal';
import { SERVER_URL } from '../../config';

export function CardModal() {
  const { modalCard, setModalCard } = useGameStore();
  const serverUrl = SERVER_URL;

  return (
    <Modal isOpen={!!modalCard} onClose={() => setModalCard(null)} wide>
      {modalCard && (
        <div className="flex gap-6">
          {/* Card image */}
          <div className="flex-shrink-0">
            <img
              src={`${serverUrl}${modalCard.imageUrl}`}
              alt={modalCard.name}
              className="w-80 h-auto rounded-lg shadow-2xl"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/placeholder-card.png';
              }}
            />
          </div>

          {/* Card details */}
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-fs-gold-light text-2xl font-bold mb-1">
              {modalCard.name}
            </h2>

            <div className="flex items-center gap-2 mb-4">
              <TypeBadge type={modalCard.cardType} subType={modalCard.subType} />
              <span className="text-fs-parchment/40 text-base">{modalCard.set}</span>
            </div>

            {/* Stats */}
            {(modalCard.hp !== null || modalCard.atk !== null || modalCard.evasion !== null) && (
              <div className="flex gap-4 mb-4">
                {modalCard.hp !== null && (
                  <StatBlock label="HP" value={modalCard.hp} color="text-pink-400" icon="❤" />
                )}
                {modalCard.atk !== null && (
                  <StatBlock label="ATK" value={modalCard.atk} color="text-orange-400" icon="⚔" />
                )}
                {modalCard.evasion !== null && (
                  <StatBlock label="DC" value={modalCard.evasion} color="text-blue-400" icon="🛡" />
                )}
              </div>
            )}

            {/* Soul value */}
            {modalCard.soulValue > 0 && (
              <div className="mb-4 flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-fs-soul flex items-center justify-center text-white text-sm font-bold">
                  {modalCard.soulValue}
                </div>
                <span className="text-purple-400 text-base">
                  Soul{modalCard.soulValue > 1 ? ` (value: ${modalCard.soulValue})` : ''}
                </span>
              </div>
            )}

            {/* Ability text */}
            {modalCard.abilityText && (
              <div className="mb-4">
                <div className="section-title mb-1">Ability</div>
                  <div className="text-fs-parchment/90 text-base leading-relaxed whitespace-pre-line bg-fs-darker/50 rounded p-3 border border-fs-gold/10">
                  {modalCard.abilityText}
                </div>
              </div>
            )}

            {/* Reward text */}
            {modalCard.rewardText && (
              <div className="mb-4">
                <div className="section-title mb-1">Reward</div>
                  <div className="text-fs-gold/80 text-base italic">{modalCard.rewardText}</div>
              </div>
            )}

            {/* Flags */}
            <div className="flex gap-2 flex-wrap">
              {modalCard.isEternal && (
                <span className="px-2 py-0.5 bg-amber-900/50 text-amber-400 text-sm rounded border border-amber-700/50">
                  Eternal
                </span>
              )}
              {modalCard.threePlayerOnly && (
                <span className="px-2 py-0.5 bg-gray-800 text-gray-400 text-sm rounded border border-gray-600/50">
                  3+ Players Only
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function TypeBadge({ type, subType }: { type: string; subType: string }) {
  const colors: Record<string, string> = {
    Monster: 'bg-red-900/50 text-red-400 border-red-700/50',
    Treasure: 'bg-yellow-900/50 text-fs-gold border-yellow-700/50',
    Loot: 'bg-green-900/50 text-green-400 border-green-700/50',
    Character: 'bg-blue-900/50 text-blue-400 border-blue-700/50',
    Room: 'bg-orange-900/50 text-orange-400 border-orange-700/50',
    BonusSoul: 'bg-purple-900/50 text-purple-400 border-purple-700/50',
  };
  const cls = colors[type] ?? 'bg-gray-800 text-gray-400 border-gray-600/50';
  return (
    <span className={`px-2 py-0.5 text-sm rounded border ${cls}`}>
      {type}{subType ? ` — ${subType}` : ''}
    </span>
  );
}

function StatBlock({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  return (
    <div className="bg-fs-darker/50 rounded p-2 text-center min-w-[64px] border border-fs-gold/10">
      <div className={`text-xl font-bold ${color}`}>{icon} {value}</div>
      <div className="text-sm text-fs-parchment/50">{label}</div>
    </div>
  );
}
