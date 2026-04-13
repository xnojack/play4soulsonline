import React from 'react';
import { ClientPlayer } from '../../store/gameStore';
import { getSocket } from '../../socket/client';
import { useGameStore } from '../../store/gameStore';
import { DiceRoller } from '../dice/DiceRoller';
import { useIsMyTurn } from '../../hooks/useMyPlayer';

interface StatDisplayProps {
  player: ClientPlayer;
  isMe: boolean;
}

/** Reusable +/- button pair */
function StatButton({
  onClick,
  label,
  title,
  color = 'text-fs-parchment/60 border-fs-gold/20 hover:bg-fs-gold/10',
}: {
  onClick: () => void;
  label: string;
  title: string;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`h-6 min-w-[24px] px-1.5 rounded border text-xs font-semibold transition-colors ${color}`}
      title={title}
    >
      {label}
    </button>
  );
}

export function StatDisplay({ player, isMe }: StatDisplayProps) {
  const isMyTurn = useIsMyTurn();
  const game = useGameStore((s) => s.game);
  const isInAttack = isMe && isMyTurn && !!game?.turn.currentAttack;
  const attackPhase = game?.turn.currentAttack?.phase;
  const hasAttackDeclarationOnStack =
    game?.stack.some((i) => i.type === 'attack_declaration' && !i.isCanceled) ?? false;
  const showAttackDice =
    isInAttack && !hasAttackDeclarationOnStack && (attackPhase === 'declared' || attackPhase === 'rolling');

  const changeCoins = (amount: number) => {
    getSocket().emit(amount > 0 ? 'action:gain_coins' : 'action:spend_coins', {
      playerId: player.id,
      amount: Math.abs(amount),
    });
  };

  const changeBaseHp = (delta: number) => {
    getSocket().emit('action:set_base_hp', { playerId: player.id, delta });
  };

  const changeBaseAtk = (delta: number) => {
    getSocket().emit('action:set_base_atk', { playerId: player.id, delta });
  };

  const applyDamage = (amount: number) => {
    getSocket().emit('action:apply_damage', { targetPlayerId: player.id, amount });
  };

  const heal = () => {
    getSocket().emit('action:heal', { targetPlayerId: player.id, amount: 1 });
  };

  const maxHp = player.baseHp + player.hpCounters;

  return (
    <div className="flex flex-col gap-1.5">
      {/* Main stat row */}
      <div className="flex gap-4 items-center flex-wrap">
        {/* HP */}
        <div className="flex items-center gap-1.5">
          <span className="text-pink-400 text-sm font-bold" title="Hit Points">❤</span>
          <div className="flex gap-0.5">
            {Array.from({ length: maxHp }).map((_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full border ${
                  i < player.effectiveHp
                    ? 'bg-pink-500 border-pink-400'
                    : 'bg-fs-darker border-gray-700'
                }`}
              />
            ))}
          </div>
          <span className="text-sm text-fs-parchment/60 font-mono">
            {player.effectiveHp}/{maxHp}
          </span>
          {isMe && (
            <div className="flex gap-1 ml-0.5">
              <StatButton
                onClick={() => applyDamage(1)}
                label="-1"
                title="Take 1 damage"
                color="text-red-400 border-red-700/50 hover:bg-red-900/30"
              />
              <StatButton
                onClick={heal}
                label="+1"
                title="Heal 1 HP"
                color="text-green-400 border-green-700/50 hover:bg-green-900/30"
              />
              <StatButton
                onClick={() => changeBaseHp(-1)}
                label="↓max"
                title="Reduce max HP by 1"
                color="text-pink-300/50 border-pink-700/30 hover:bg-pink-900/20"
              />
              <StatButton
                onClick={() => changeBaseHp(1)}
                label="↑max"
                title="Increase max HP by 1"
                color="text-pink-300/50 border-pink-700/30 hover:bg-pink-900/20"
              />
            </div>
          )}
        </div>

        {/* ATK */}
        <div className="flex items-center gap-1.5">
          <span className="text-orange-400 text-sm font-bold" title="Attack">⚔</span>
          <span className="text-sm font-display font-semibold text-fs-parchment">
            {player.effectiveAtk}
          </span>
          {isMe && (
            <div className="flex gap-1 ml-0.5">
              <StatButton
                onClick={() => changeBaseAtk(-1)}
                label="-1"
                title="Reduce ATK by 1"
                color="text-orange-300/50 border-orange-700/30 hover:bg-orange-900/20"
              />
              <StatButton
                onClick={() => changeBaseAtk(1)}
                label="+1"
                title="Increase ATK by 1"
                color="text-orange-300/50 border-orange-700/30 hover:bg-orange-900/20"
              />
            </div>
          )}
        </div>

        {/* Coins */}
        <div className="flex items-center gap-1.5">
          <span className="text-fs-gold text-sm font-bold" title="Coins">¢</span>
          <span className="text-sm font-display font-semibold text-fs-parchment">
            {player.coins}
          </span>
          {isMe && (
            <div className="flex gap-1">
              <StatButton
                onClick={() => changeCoins(-1)}
                label="-1"
                title="Spend 1 coin"
                color="text-fs-parchment/60 border-fs-gold/30 hover:bg-fs-gold/10"
              />
              <StatButton
                onClick={() => changeCoins(1)}
                label="+1"
                title="Gain 1 coin"
                color="text-fs-gold border-fs-gold/30 hover:bg-fs-gold/10"
              />
            </div>
          )}
        </div>

        {/* Hand count */}
        <div className="flex items-center gap-1 text-sm text-fs-parchment/50" title="Cards in hand">
          🃏 {player.handCount}
        </div>

        {/* Dice roller — inline compact */}
        {isMe && (
          <DiceRoller
            compact
            context={showAttackDice ? 'attack' : 'manual'}
          />
        )}

        {/* Status indicators */}
        {!player.isAlive && (
          <span className="text-sm text-gray-500">💀 Dead</span>
        )}
        {!player.connected && (
          <span className="text-sm text-yellow-600">⚡ Disconnected</span>
        )}
      </div>

    </div>
  );
}
