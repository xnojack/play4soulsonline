import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { getSocket } from '../../socket/client';

function genRollId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

interface DiceRollerProps {
  context?: 'attack' | 'ability' | 'manual';
  disabled?: boolean;
  /** Compact inline variant — small button that fits in the stat row */
  compact?: boolean;
}

/**
 * Simple dice roller. Emits action:roll_dice and immediately re-enables.
 * The result is shown to ALL players via DiceResultToast — no per-component
 * state machine waiting for a server echo.
 */
export function DiceRoller({ context = 'manual', disabled = false, compact = false }: DiceRollerProps) {
  const [cooldown, setCooldown] = useState(false);

  const handleRoll = useCallback(() => {
    if (cooldown || disabled) return;
    setCooldown(true);
    getSocket().emit('action:roll_dice', { context, rollId: genRollId() });
    // Re-enable after 1 s so the toast has time to show
    setTimeout(() => setCooldown(false), 1000);
  }, [cooldown, disabled, context]);

  const isDisabled = disabled || cooldown;

  if (compact) {
    return (
      <motion.button
        className={`h-7 px-2 rounded border text-sm font-bold flex items-center gap-1 transition-colors ${
          isDisabled
            ? 'border-gray-700 text-gray-600 cursor-not-allowed'
            : 'border-fs-gold/60 text-fs-parchment bg-fs-brown hover:bg-fs-brown/80 cursor-pointer'
        }`}
        onClick={handleRoll}
        disabled={isDisabled}
        whileTap={!isDisabled ? { scale: 0.9 } : {}}
        title={context === 'attack' ? 'Roll attack dice' : 'Roll dice'}
      >
        <span>🎲</span>
        <span className="text-xs text-fs-parchment/60">
          {context === 'attack' ? 'Roll ATK' : 'Roll'}
        </span>
      </motion.button>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <motion.button
        className={`w-16 h-16 rounded-xl border-2 text-4xl font-bold flex items-center justify-center transition-colors ${
          isDisabled
            ? 'border-gray-700 text-gray-600 cursor-not-allowed bg-fs-darker'
            : 'border-fs-gold text-fs-parchment bg-fs-brown hover:bg-fs-brown/80 cursor-pointer'
        }`}
        onClick={handleRoll}
        disabled={isDisabled}
        whileTap={!isDisabled ? { scale: 0.9 } : {}}
      >
        🎲
      </motion.button>
      <button
        onClick={handleRoll}
        disabled={isDisabled}
        className="text-xs text-fs-parchment/50 hover:text-fs-parchment transition-colors"
      >
        Roll Dice
      </button>
    </div>
  );
}

/** Shows the latest dice result from any player as a floating toast */
export function DiceResultToast() {
  const lastDiceResult = useGameStore((s) => s.lastDiceResult);
  const clearDiceResult = useGameStore((s) => s.clearDiceResult);
  const game = useGameStore((s) => s.game);

  React.useEffect(() => {
    if (lastDiceResult) {
      const timer = setTimeout(clearDiceResult, 4000);
      return () => clearTimeout(timer);
    }
  }, [lastDiceResult, clearDiceResult]);

  if (!lastDiceResult || !game) return null;

  const player = game.players.find((p) => p.id === lastDiceResult.playerId);

  return (
    <AnimatePresence>
      <motion.div
        key={lastDiceResult.rollId}
        className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-fs-brown border border-fs-gold/50 rounded-xl px-6 py-3 shadow-2xl flex items-center gap-3 pointer-events-none"
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -40, opacity: 0 }}
      >
        <span className="text-3xl">{DICE_FACES[lastDiceResult.value - 1]}</span>
        <div>
          <div className="font-display text-fs-gold font-bold text-lg">{lastDiceResult.value}</div>
          <div className="text-xs text-fs-parchment/60">{player?.name ?? 'Unknown'} rolled</div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
