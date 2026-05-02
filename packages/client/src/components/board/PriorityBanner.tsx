import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { useHasPriority, useIsMyTurn, useMyPlayer } from '../../hooks/useMyPlayer';
import { getSocket } from '../../socket/client';

/**
 * Slide-down banner that calls attention when this client has priority.
 * Designed to be non-blocking (doesn't capture pointer outside its bounds)
 * but visually prominent so the player notices their window to act.
 *
 * Hidden when it's your turn — the bottom TurnActionBar handles that case
 * with full UI. This is for off-turn priority responses (reactions, etc.).
 */
export function PriorityBanner() {
  const game = useGameStore((s) => s.game);
  const hasPriority = useHasPriority();
  const isMyTurn = useIsMyTurn();
  const myPlayer = useMyPlayer();

  if (!game || !myPlayer || myPlayer.isSpectator) return null;
  if (game.phase !== 'active') return null;

  // Only show off-turn — the bottom action bar already covers your-turn case
  const visible = hasPriority && !isMyTurn;

  const stackLength = game.stack.length;
  const timeoutRemaining = game.priorityTimeoutRemaining ?? 0;
  const isUrgent = timeoutRemaining > 0 && timeoutRemaining <= 5;

  const handlePass = () => {
    getSocket().emit('action:pass_priority');
  };

  const handleScrollToStack = () => {
    // Scroll the stack into view (works on mobile + desktop)
    const stackEl = document.querySelector('[data-zone="the-stack"]');
    if (stackEl) {
      stackEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="priority-banner"
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          className="fixed top-0 left-0 right-0 z-50 pointer-events-none flex justify-center pt-2 px-2"
        >
          <motion.div
            animate={
              isUrgent
                ? { boxShadow: ['0 0 0 0 rgba(248,113,113,0.0)', '0 0 22px 4px rgba(248,113,113,0.6)', '0 0 0 0 rgba(248,113,113,0.0)'] }
                : { boxShadow: ['0 0 0 0 rgba(212,175,55,0.0)', '0 0 18px 3px rgba(212,175,55,0.45)', '0 0 0 0 rgba(212,175,55,0.0)'] }
            }
            transition={{ duration: isUrgent ? 0.9 : 2.0, repeat: Infinity, ease: 'easeInOut' }}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-2 rounded-full border-2 backdrop-blur-md shadow-2xl ${
              isUrgent
                ? 'bg-red-950/85 border-red-500/70'
                : 'bg-fs-dark/90 border-fs-gold/60'
            }`}
          >
            <motion.span
              className="text-xl leading-none"
              animate={{ rotate: [0, -10, 10, -6, 6, 0] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.4 }}
            >
              {isUrgent ? '⏰' : '⚡'}
            </motion.span>
            <div className="flex flex-col leading-tight">
              <span className={`font-display font-bold text-sm ${isUrgent ? 'text-red-300' : 'text-fs-gold'}`}>
                You have priority
              </span>
              <span className="text-[11px] text-fs-parchment/60">
                {stackLength > 0
                  ? `${stackLength} item${stackLength !== 1 ? 's' : ''} on the stack`
                  : 'Respond, or pass to continue'}
                {timeoutRemaining > 0 && (
                  <span className={`ml-1.5 font-semibold ${isUrgent ? 'text-red-400' : 'text-amber-400'}`}>
                    · {timeoutRemaining}s
                  </span>
                )}
              </span>
            </div>
            {stackLength > 0 && (
              <button
                onClick={handleScrollToStack}
                className="ml-1 px-3 py-1 rounded-full text-xs font-display font-semibold border transition-colors border-fs-gold/40 text-fs-parchment/80 hover:bg-fs-gold/10 hover:text-fs-parchment"
              >
                View Stack
              </button>
            )}
            <button
              onClick={handlePass}
              className={`ml-1 px-3 py-1 rounded-full text-xs font-display font-bold border-2 transition-colors ${
                isUrgent
                  ? 'border-red-400 text-red-300 hover:bg-red-900/40'
                  : 'border-fs-gold text-fs-gold hover:bg-fs-gold/15'
              }`}
            >
              Pass
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
