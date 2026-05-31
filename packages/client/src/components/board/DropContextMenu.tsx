import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getSocket } from '../../socket/client';

interface DropContextMenuProps {
  x: number;
  y: number;
  actions: { label: string; action: string; payload: Record<string, unknown>; onClick?: () => void }[];
  onClose: () => void;
  stackSource?: boolean;    // if true, also dismiss the stack item after any non-cancel action
  stackItemId?: string;     // the stack item UUID to dismiss
}

export function DropContextMenu({ x, y, actions, onClose, stackSource, stackItemId }: DropContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const handleAction = (a: { action: string; payload: Record<string, unknown>; onClick?: () => void }) => {
    if (a.onClick) {
      a.onClick();
    } else {
      getSocket().emit(a.action, a.payload);
    }
    if (stackSource && stackItemId && a.action !== 'action:cancel_stack_item') {
      getSocket().emit('action:dismiss_stack_item', { stackItemId });
    }
    onClose();
  };

  return createPortal(
    <AnimatePresence>
      <motion.div
        ref={ref}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.1 }}
        className="fixed z-[9999] bg-fs-brown border border-fs-gold/50 rounded-lg shadow-xl py-1 min-w-[140px]"
        style={{ left: x, top: y }}
      >
        {actions.map((a, i) => (
          <button
            key={i}
            onClick={() => handleAction(a)}
            className="w-full text-left px-3 py-1.5 text-sm text-fs-parchment hover:bg-fs-gold/20 transition-colors"
          >
            {a.label}
          </button>
        ))}
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
