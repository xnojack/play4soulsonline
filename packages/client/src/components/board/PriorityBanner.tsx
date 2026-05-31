import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { useHasPriority, useIsMyTurn, useMyPlayer } from '../../hooks/useMyPlayer';
import { getSocket } from '../../socket/client';

/**
 * Large, prominent banner when this client has priority off-turn.
 * Shows an animated countdown that ticks every second.
 */
export function PriorityBanner() {
  const game = useGameStore((s) => s.game);
  const hasPriority = useHasPriority();
  const isMyTurn = useIsMyTurn();
  const myPlayer = useMyPlayer();

  // Derive values needed by hooks — safe to compute even when game is null
  const serverTimeout = game?.priorityTimeoutRemaining ?? 0;

  // ALL hooks must be called unconditionally, before any early return
  const [countdown, setCountdown] = useState(serverTimeout);
  const prevTimeoutRef = useRef(serverTimeout);

  const visible = !!(game && myPlayer && !myPlayer.isSpectator && game.phase === 'active' && hasPriority && !isMyTurn);

  useEffect(() => {
    if (!visible || serverTimeout <= 0) return;

    // Reset when server value jumps (e.g. new priority assignment or server tick)
    if (serverTimeout !== prevTimeoutRef.current) {
      prevTimeoutRef.current = serverTimeout;
      setCountdown(serverTimeout);
      return;
    }

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [visible, serverTimeout]);

  // Early-return guards — after ALL hooks
  if (!game || !myPlayer || myPlayer.isSpectator) return null;
  if (game.phase !== 'active') return null;

  const stackLength = game.stack.length;
  const isUrgent = serverTimeout > 0 && serverTimeout <= 5;

  const handlePass = () => {
    getSocket().emit('action:pass_priority');
  };

  const handleScrollToStack = () => {
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
          data-tutorial="priority"
          initial={{ y: -120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -120, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          className="fixed top-0 left-0 right-0 z-50 pointer-events-none flex justify-center pt-3 px-2"
        >
          <motion.div
            animate={
              isUrgent
                ? { boxShadow: ['0 0 0 0 rgba(248,113,113,0)', '0 0 30px 6px rgba(248,113,113,0.7)', '0 0 0 0 rgba(248,113,113,0)'] }
                : { boxShadow: ['0 0 0 0 rgba(212,175,55,0)', '0 0 24px 4px rgba(212,175,55,0.5)', '0 0 0 0 rgba(212,175,55,0)'] }
            }
            transition={{ duration: isUrgent ? 0.8 : 2, repeat: Infinity, ease: 'easeInOut' }}
            className={`pointer-events-auto flex items-center gap-4 md:gap-6 px-5 md:px-8 py-3 md:py-4 rounded-2xl border-2 backdrop-blur-md shadow-2xl ${
              isUrgent
                ? 'bg-red-950/90 border-red-500/70'
                : 'bg-fs-dark/95 border-fs-gold/60'
            }`}
          >
            {/* Animated icon */}
            <motion.span
              className="text-2xl md:text-3xl leading-none"
              animate={{ rotate: [0, -12, 12, -8, 8, 0] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.4 }}
            >
              {isUrgent ? '⏰' : '⚡'}
            </motion.span>

            {/* Text + countdown */}
            <div className="flex flex-col leading-tight">
              <span className={`font-display font-bold text-base md:text-lg ${isUrgent ? 'text-red-300' : 'text-fs-gold'}`}>
                You have priority
              </span>
              <span className="text-xs md:text-sm text-fs-parchment/60">
                {stackLength > 0
                  ? `${stackLength} item${stackLength !== 1 ? 's' : ''} on the stack`
                  : 'Respond, or pass to continue'}
              </span>
            </div>

            {/* Big animated countdown */}
            {countdown > 0 && (
              <div className="flex flex-col items-center justify-center ml-1">
                <motion.span
                  key={countdown}
                  initial={{ scale: 1.4, opacity: 0.5 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  className={`text-3xl md:text-4xl font-display font-black tabular-nums leading-none ${
                    isUrgent ? 'text-red-400' : 'text-amber-400'
                  }`}
                >
                  {countdown}
                </motion.span>
                <span className={`text-[10px] uppercase tracking-widest ${isUrgent ? 'text-red-500/70' : 'text-fs-parchment/30'}`}>
                  seconds
                </span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 ml-1">
              {stackLength > 0 && (
                <button
                  onClick={handleScrollToStack}
                  className="px-3 py-1.5 rounded-full text-xs md:text-sm font-display font-semibold border border-fs-gold/40 text-fs-parchment/80 hover:bg-fs-gold/10 hover:text-fs-parchment transition-colors"
                >
                  View Stack
                </button>
              )}
              <button
                onClick={handlePass}
                className={`px-4 py-1.5 rounded-full text-xs md:text-sm font-display font-bold border-2 transition-colors ${
                  isUrgent
                    ? 'border-red-400 text-red-300 hover:bg-red-900/40'
                    : 'border-fs-gold text-fs-gold hover:bg-fs-gold/15'
                }`}
              >
                Pass
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
