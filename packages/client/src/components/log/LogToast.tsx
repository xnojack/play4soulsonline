import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';

const TOAST_TIMEOUT = 30000;
const MAX_TOASTS = 3;

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
  chat: '💬',
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
  chat: 'text-cyan-400',
};

interface ToastEntry {
  id: string;
  type: string;
  message: string;
  createdAt: number;
}

export function LogToast() {
  const game = useGameStore((s) => s.game);
  const showLog = useGameStore((s) => s.showLog);
  const myPlayerId = game?.myPlayerId;
  const log = game?.log ?? [];
  const logLength = log.length;

  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const lastSeenRef = useRef(0);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const addToast = useCallback((entry: ToastEntry) => {
    setToasts((prev) => {
      const updated = [...prev, entry];
      if (updated.length > MAX_TOASTS) {
        const removed = updated.shift();
        if (removed) {
          const timer = timersRef.current.get(removed.id);
          if (timer) {
            clearTimeout(timer);
            timersRef.current.delete(removed.id);
          }
        }
      }
      return updated;
    });

    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== entry.id));
      timersRef.current.delete(entry.id);
    }, TOAST_TIMEOUT);
    timersRef.current.set(entry.id, timer);
  }, []);

  useEffect(() => {
    if (!game) {
      lastSeenRef.current = 0;
      setToasts([]);
      return;
    }

    const newEntries = log.slice(lastSeenRef.current);
    for (const entry of newEntries) {
      if (entry.playerId !== myPlayerId) {
        addToast({
          id: entry.id,
          type: entry.type,
          message: entry.message,
          createdAt: entry.timestamp,
        });
      }
    }
    lastSeenRef.current = logLength;
  }, [logLength, game, myPlayerId, addToast]);

  const dismissToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  if (toasts.length === 0 || showLog) return null;

  return createPortal(
    <div className="fixed bottom-20 right-2 md:right-4 z-50 flex flex-col gap-1.5 items-end pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-auto max-w-[260px] md:max-w-xs"
          >
            <button
              onClick={() => dismissToast(toast.id)}
              className="w-full text-left bg-fs-dark/95 border border-fs-gold/20 rounded-lg px-3 py-2 shadow-lg text-sm"
            >
              <span className={`flex items-start gap-1.5 ${TYPE_COLORS[toast.type] ?? 'text-fs-parchment/70'}`}>
                <span className="flex-shrink-0 w-4 text-center">{TYPE_ICONS[toast.type] ?? 'ℹ'}</span>
                <span className="leading-snug">{toast.message}</span>
              </span>
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>,
    document.body
  );
}
