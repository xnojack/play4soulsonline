import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { isTouchDevice } from '../../hooks/useIsTouchDevice';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  delay?: number;
}

export function Tooltip({ content, children, delay = 400 }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const ref = useRef<HTMLDivElement>(null);

  const show = (e: React.MouseEvent) => {
    // Never show tooltip on touch — the popover serves that purpose
    if (isTouchDevice()) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPos({ x: rect.right + 8, y: rect.top });
    timer.current = setTimeout(() => setVisible(true), delay);
  };

  const hide = () => {
    clearTimeout(timer.current);
    setVisible(false);
  };

  return (
    <div onMouseEnter={show} onMouseLeave={hide} className="relative inline-block">
      {children}
      <AnimatePresence>
        {visible && (
          <motion.div
            ref={ref}
            style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 9999 }}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
