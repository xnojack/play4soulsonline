import { useGameStore } from '../../store/gameStore';
import { getSocket } from '../../socket/client';
import { useIsMyTurn } from '../../hooks/useMyPlayer';
import { ResolvedCard, useCard } from './CardResolver';
import { CardInPlay } from '../../store/gameStore';

// ─── Challenge card row ────────────────────────────────────────────────────

export function ChallengeRow({ slot, challengeName, challengeDifficulty }: {
  slot: CardInPlay;
  challengeName: string | null;
  challengeDifficulty: string | null;
}) {
  useCard(slot.cardId);
  const label = challengeName ? `${challengeName} (${challengeDifficulty})` : 'Challenge';
  return (
    <div className="flex flex-col gap-1 items-start p-2 rounded-lg border-2 border-purple-700/30 bg-purple-900/10">
      <span className="text-2xl text-purple-400/70 font-display uppercase tracking-wider">{label}</span>
      <div className="relative group">
        <ResolvedCard
          instance={slot}
          size="md"
          showCounters={false}
          alwaysPopover
          landscape
        />
      </div>
    </div>
  );
}

// ─── Final Boss zone ───────────────────────────────────────────────────────

export function FinalBossZone({ boss, challengeName, challengeDifficulty }: {
  boss: CardInPlay;
  challengeName: string | null;
  challengeDifficulty: string | null;
}) {
  const game = useGameStore((s) => s.game);
  const isActiveTurn = useIsMyTurn();
  const bossCard = useCard(boss.cardId);
  const maxHp = bossCard ? (bossCard.hp ?? 0) + boss.hpCounters : 0;
  const currentHp = maxHp > 0 ? maxHp - boss.damageCounters : 0;
  const isLandscape = bossCard ? bossCard.cardType === 'Challenge' : false;
  const label = challengeName ? `Final Boss — ${challengeName} (${challengeDifficulty})` : 'Final Boss';
  return (
    <div className="flex flex-col gap-1 items-start p-2 rounded-lg border-2 border-red-800/40 bg-red-900/10">
      <span className="text-2xl text-red-400/70 font-display uppercase tracking-wider">{label}</span>
      <div className="flex flex-col items-center gap-1">
        <ResolvedCard
          instance={boss}
          size="md"
          showCounters
          alwaysPopover
          landscape={isLandscape}
        />
        {maxHp > 0 && (
          <div className="flex items-center gap-1">
            {isActiveTurn && (
              <button
                onClick={() => getSocket().emit('action:apply_damage', { targetInstanceId: boss.instanceId, amount: 1 })}
                className="w-10 h-10 rounded bg-red-900/50 text-red-400 hover:bg-red-800 text-3xl font-bold"
                title="Deal 1 damage"
              >-❤</button>
            )}
            <div className="flex gap-1 items-center">
              {maxHp <= 4 ? (
                Array.from({ length: Math.min(maxHp, 10) }).map((_, i) => (
                  <span
                    key={i}
                    className={`text-3xl ${i < currentHp ? 'text-red-500' : 'text-gray-700'}`}
                  >
                    {i < currentHp ? '❤' : '♡'}
                  </span>
                ))
              ) : (
                <span className="text-3xl text-red-500">{currentHp} ❤</span>
              )}
            </div>
            {isActiveTurn && (
              <button
                onClick={() => getSocket().emit('action:heal', { targetInstanceId: boss.instanceId, amount: 1 })}
                className="w-10 h-10 rounded bg-green-900/50 text-green-400 hover:bg-green-800 text-3xl font-bold"
                title="Heal 1"
              >+❤</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
