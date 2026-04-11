import React, { useRef, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import { motion, AnimatePresence } from 'framer-motion';

const TYPE_ICONS: Record<string, string> = {
  attack: '⚔',
  death: '💀',
  card_play: '🃏',
  purchase: '💰',
  dice: '🎲',
  soul_gain: '✨',
  stack: '📚',
  phase: '🔄',
  info: 'ℹ',
};

const TYPE_COLORS: Record<string, string> = {
  attack: 'text-red-400',
  death: 'text-gray-400',
  card_play: 'text-green-400',
  purchase: 'text-fs-gold',
  dice: 'text-blue-400',
  soul_gain: 'text-purple-400',
  stack: 'text-orange-400',
  phase: 'text-fs-parchment/60',
  info: 'text-fs-parchment/70',
};

export function GameLog() {
  const log = useGameStore((s) => s.game?.log ?? []);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log.length]);

  return (
    <div className="flex flex-col h-full">
      <div className="section-title px-2 py-1 border-b border-fs-gold/20">Game Log</div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1 text-sm">
        <AnimatePresence initial={false}>
          {log.map((entry) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className={`flex gap-1.5 items-start ${TYPE_COLORS[entry.type] ?? 'text-fs-parchment/70'}`}
            >
              <span className="flex-shrink-0 w-4">{TYPE_ICONS[entry.type] ?? 'ℹ'}</span>
              <span className="leading-snug">{entry.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={endRef} />
      </div>
    </div>
  );
}
