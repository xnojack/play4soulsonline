import React from 'react';
import { ClientPlayer } from '../../store/gameStore';
import { getSocket } from '../../socket/client';
import { useGameStore } from '../../store/gameStore';
import { DiceRoller } from '../dice/DiceRoller';
import { useIsMyTurn } from '../../hooks/useMyPlayer';

interface StatDisplayProps {
  player: ClientPlayer;
  isMe: boolean;
  screenScale?: boolean;
}

/** Reusable +/- button pair */
function StatButton({
  onClick,
  label,
  title,
  color = 'text-fs-parchment/60 border-fs-gold/20 hover:bg-fs-gold/10',
  screenScale = false,
}: {
  onClick: () => void;
  label: string;
  title: string;
  color?: string;
  screenScale?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`${screenScale ? 'h-6 min-w-[24px] px-1.5 rounded border text-xs' : 'h-16 min-w-[64px] px-4 rounded-lg border-2 text-3xl'} font-semibold transition-colors ${color}`}
      title={title}
    >
      {label}
    </button>
  );
}

export function StatDisplay({ player, isMe, screenScale = false }: StatDisplayProps) {
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
    <div className={`flex flex-col ${screenScale ? 'gap-1.5' : 'gap-3'}`}>
      {/* Main stat row */}
      <div className={`flex ${screenScale ? 'gap-4' : 'gap-8'} items-center flex-wrap`}>
        {/* HP */}
       <div className={`flex items-center ${screenScale ? 'gap-1.5' : 'gap-3'}`}>
          <div className={`flex ${screenScale ? 'gap-0.5' : 'gap-2'}`}>
             {Array.from({ length: maxHp }).map((_, i) => (
               <span
                 key={i}
                 className={`${screenScale ? 'text-sm' : 'text-3xl'} ${i < player.effectiveHp ? 'text-red-500' : 'text-gray-700'}`}
               >
                 {i < player.effectiveHp ? '❤' : '♡'}
               </span>
             ))}
           </div>
          <span className={`${screenScale ? 'text-sm' : 'text-3xl'} text-fs-parchment/60 font-mono`}>
            {player.effectiveHp}/{maxHp}
          </span>
          {isMe && (
            <div className={`flex ${screenScale ? 'gap-1' : 'gap-1'} ml-1`}>
        <StatButton
              onClick={() => applyDamage(1)}
              label="-❤"
              title="Take 1 damage"
              color="text-red-400 border-red-700/50 bg-red-900/20 hover:bg-red-900/30"
              screenScale={screenScale}
            />
            <StatButton
              onClick={heal}
              label="+❤"
              title="Heal 1 HP"
              color="text-green-400 border-green-700/50 bg-green-900/20 hover:bg-green-900/30"
              screenScale={screenScale}
            />
            <StatButton
               onClick={() => changeBaseHp(-1)}
               label="↓max♡"
               title="Reduce max HP by 1"
               color="text-pink-300/50 border-pink-700/30 bg-pink-900/15 hover:bg-pink-900/20"
               screenScale={screenScale}
             />
             <StatButton
               onClick={() => changeBaseHp(1)}
               label="↑max❤"
               title="Increase max HP by 1"
               color="text-pink-300/50 border-pink-700/30 bg-pink-900/15 hover:bg-pink-900/20"
               screenScale={screenScale}
             />
            </div>
          )}
        </div>

        {/* ATK */}
        <div className={`flex items-center ${screenScale ? 'gap-1.5' : 'gap-3'}`}>
          <span className={`text-orange-400 ${screenScale ? 'text-sm' : 'text-3xl'} font-bold`} title="Attack">🗡</span>
          <span className={`${screenScale ? 'text-sm' : 'text-3xl'} font-display font-semibold text-fs-parchment`}>
            {player.effectiveAtk}
          </span>
          {isMe && (
            <div className={`flex ${screenScale ? 'gap-1' : 'gap-1'} ml-1`}>
        <StatButton
              onClick={() => changeBaseAtk(-1)}
              label="-🗡"
              title="Reduce ATK by 1"
              color="text-orange-300/50 border-orange-700/30 bg-orange-900/15 hover:bg-orange-900/20"
              screenScale={screenScale}
            />
            <StatButton
              onClick={() => changeBaseAtk(1)}
              label="+🗡"
              title="Increase ATK by 1"
              color="text-orange-300/50 border-orange-700/30 bg-orange-900/15 hover:bg-orange-900/20"
              screenScale={screenScale}
            />
            </div>
          )}
        </div>

        {/* Coins */}
        <div className={`flex items-center ${screenScale ? 'gap-1.5' : 'gap-3'}`}>
          <span className={`text-fs-gold ${screenScale ? 'text-sm' : 'text-3xl'} font-bold`} title="Coins">¢</span>
          <span className={`${screenScale ? 'text-sm' : 'text-3xl'} font-display font-semibold text-fs-parchment`}>
            {game?.sharedCoinPool ? '—' : player.coins}
          </span>
          {isMe && (
            <div className={`flex ${screenScale ? 'gap-1' : 'gap-1'}`}>
        <StatButton
              onClick={() => changeCoins(-1)}
              label="-¢"
              title="Spend 1 coin"
              color="text-fs-parchment/60 border-fs-gold/30 bg-fs-gold/5 hover:bg-fs-gold/10"
              screenScale={screenScale}
            />
            <StatButton
              onClick={() => changeCoins(1)}
              label="+¢"
              title="Gain 1 coin"
              color="text-fs-gold border-fs-gold/30 bg-fs-gold/10 hover:bg-fs-gold/20"
              screenScale={screenScale}
            />
            </div>
          )}
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
          <span className={`${screenScale ? 'text-sm' : 'text-3xl'} text-gray-500`}>💀 Dead</span>
        )}
        {!player.connected && (
          <span className={`${screenScale ? 'text-sm' : 'text-3xl'} text-yellow-600`}>⚡ Disconnected</span>
        )}
      </div>

    </div>
  );
}
