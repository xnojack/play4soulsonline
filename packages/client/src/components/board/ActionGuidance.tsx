import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { getSocket } from '../../socket/client';
import { useIsMyTurn, useHasPriority, useMyPlayer } from '../../hooks/useMyPlayer';

interface ActionOption {
  label: string;
  icon: string;
  action: () => void;
  priority: number;
}

export function ActionGuidance({ helpMode = false }: { helpMode?: boolean }) {
  const game = useGameStore((s) => s.game);
  const isMyTurn = useIsMyTurn();
  const hasPriority = useHasPriority();
  const myPlayer = useMyPlayer();
  const [visible, setVisible] = useState(false);

  const options = useMemo<ActionOption[]>(() => {
    if (!game || !myPlayer || myPlayer.isSpectator || game.phase !== 'active') {
      return [];
    }

    const opts: ActionOption[] = [];
    const turn = game.turn;
    const inAttack = !!turn.currentAttack;
    const stackEmpty = game.stack.length === 0;
    const monstersExist = game.monsterSlots.some(s => s.stack.length > 0);

    if (hasPriority && myPlayer.handCount > 0 && !inAttack) {
      opts.push({
        label: 'Play a loot card',
        icon: '🃏',
        action: () => {},
        priority: 1,
      });
    }

    if (isMyTurn && !inAttack && stackEmpty && monstersExist) {
      opts.push({
        label: 'Attack a monster',
        icon: '⚔',
        action: () => {},
        priority: 2,
      });
    }

    if (isMyTurn && !inAttack && stackEmpty && 
        game.shopSlots.some(s => s.card) && myPlayer.coins > 0) {
      opts.push({
        label: 'Buy from shop',
        icon: '💰',
        action: () => {},
        priority: 3,
      });
    }

    if (hasPriority) {
      opts.push({
        label: 'Pass priority',
        icon: '➡️',
        action: () => getSocket().emit('action:pass_priority'),
        priority: 4,
      });
    }

    if (isMyTurn) {
      opts.push({
        label: stackEmpty ? 'End turn' : 'End turn (⚠ discards stack)',
        icon: '✅',
        action: () => getSocket().emit('action:end_turn'),
        priority: 5,
      });
    }

    return opts.sort((a, b) => a.priority - b.priority);
  }, [game, isMyTurn, hasPriority, myPlayer]);

  useEffect(() => {
    if (options.length === 0) {
      setVisible(false);
      return;
    }
    setVisible(true);
    if (helpMode) return;
    const timer = setTimeout(() => setVisible(false), 5000);
    return () => clearTimeout(timer);
  }, [options, helpMode]);

  if (options.length === 0 || (!visible && !helpMode)) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 bg-fs-dark/95 border border-fs-gold/40 rounded-lg px-4 py-2 backdrop-blur-sm shadow-xl"
      >
        <div className="flex flex-col md:flex-row items-start md:items-center gap-1.5 md:gap-3 text-sm">
          <span className="text-fs-parchment/50 text-xs">Your options:</span>
          {options.slice(0, 3).map((opt, i) => (
            <button
              key={i}
              onClick={opt.action}
              className="flex items-center gap-1 px-1.5 py-0.5 md:px-2 md:py-1 rounded bg-fs-brown/60 border border-fs-gold/30 text-xs md:text-sm text-fs-parchment hover:bg-fs-brown hover:border-fs-gold/60 transition-colors"
            >
              <span className="text-xs">{opt.icon}</span>
              <span>{opt.label}</span>
            </button>
          ))}
          {options.length > 3 && (
            <span className="text-fs-parchment/30 text-xs">+{options.length - 3} more</span>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
