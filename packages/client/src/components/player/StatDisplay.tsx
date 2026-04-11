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

export function StatDisplay({ player, isMe }: StatDisplayProps) {
  const isMyTurn = useIsMyTurn();
  const game = useGameStore((s) => s.game);
  const isInAttack = isMe && isMyTurn && !!game?.turn.currentAttack;
  const attackPhase = game?.turn.currentAttack?.phase;
  const showAttackDice = isInAttack && (attackPhase === 'declared' || attackPhase === 'rolling');

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

  return (
    <div className="flex gap-3 items-center flex-wrap">
      {/* HP */}
      <div className="flex items-center gap-1">
        <span className="text-pink-400 text-sm font-bold">❤</span>
        <div className="flex gap-0.5">
          {Array.from({ length: player.baseHp + player.hpCounters }).map((_, i) => (
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
        <span className="text-sm text-fs-parchment/60">
          {player.effectiveHp}/{player.baseHp + player.hpCounters}
        </span>
        {isMe && (
          <div className="flex gap-0.5">
            <button
              onClick={() => applyDamage(1)}
              className="w-4 h-4 rounded bg-red-900/60 text-red-400 hover:bg-red-800 text-xs"
              title="Take 1 damage"
            >-</button>
            <button
              onClick={heal}
              className="w-4 h-4 rounded bg-green-900/60 text-green-400 hover:bg-green-800 text-xs"
              title="Heal 1"
            >+</button>
            <button
              onClick={() => changeBaseHp(-1)}
              className="w-4 h-4 rounded bg-fs-darker/80 text-pink-600/60 hover:text-pink-400 text-xs border border-pink-900/40"
              title="Reduce max HP permanently (-1 base HP)"
            >↓</button>
            <button
              onClick={() => changeBaseHp(1)}
              className="w-4 h-4 rounded bg-fs-darker/80 text-pink-400/60 hover:text-pink-300 text-xs border border-pink-700/40"
              title="Increase max HP permanently (+1 base HP)"
            >↑</button>
          </div>
        )}
      </div>

      {/* ATK */}
      <div className="flex items-center gap-1">
        <span className="text-orange-400 text-sm font-bold">⚔</span>
        <span className="text-sm font-display font-semibold text-fs-parchment">
          {player.effectiveAtk}
        </span>
        {isMe && (
          <div className="flex gap-0.5">
            <button
              onClick={() => changeBaseAtk(-1)}
              className="w-4 h-4 rounded bg-fs-darker/80 text-orange-600/60 hover:text-orange-400 text-xs border border-orange-900/40"
              title="Reduce base ATK permanently"
            >↓</button>
            <button
              onClick={() => changeBaseAtk(1)}
              className="w-4 h-4 rounded bg-fs-darker/80 text-orange-400/60 hover:text-orange-300 text-xs border border-orange-700/40"
              title="Increase base ATK permanently"
            >↑</button>
          </div>
        )}
      </div>

      {/* Coins */}
      <div className="flex items-center gap-1">
        <span className="text-fs-gold text-sm font-bold">¢</span>
        <span className="text-sm font-display font-semibold text-fs-parchment">
          {player.coins}
        </span>
        {isMe && (
          <div className="flex gap-0.5">
            <button
              onClick={() => changeCoins(-1)}
              className="w-4 h-4 rounded bg-fs-darker/80 text-fs-parchment/60 hover:text-fs-parchment text-xs border border-fs-gold/20"
              title="Spend 1¢"
            >-</button>
            <button
              onClick={() => changeCoins(1)}
              className="w-4 h-4 rounded bg-fs-darker/80 text-fs-parchment/60 hover:text-fs-parchment text-xs border border-fs-gold/20"
              title="Gain 1¢"
            >+</button>
          </div>
        )}
      </div>

      {/* Hand count */}
      <div className="flex items-center gap-1 text-sm text-fs-parchment/50">
        🃏 {player.handCount}
      </div>

      {/* Dice roller — always visible for own player, right in the stat row */}
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
  );
}
