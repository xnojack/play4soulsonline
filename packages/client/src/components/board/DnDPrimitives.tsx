import React from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from 'framer-motion';
import { UniversalDrag, UniversalDrop, useDragState } from './DnDProvider';

export function Draggable({
  id,
  payload,
  disabled,
  children,
  className = '',
}: {
  id: string;
  payload: UniversalDrag;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data: payload,
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.35 : 1,
        touchAction: 'none',
      }}
      className={className}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}

export function Droppable({
  id,
  payload,
  children,
  className = '',
  highlightInset = '-inset-1',
}: {
  id: string;
  payload: UniversalDrop;
  children: React.ReactNode;
  className?: string;
  highlightInset?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, data: payload });
  const { activeDrag } = useDragState();
  const showHighlight = !!activeDrag;

  return (
    <div ref={setNodeRef} className={`relative ${className}`}>
      <AnimatePresence>
        {showHighlight && (
          <motion.div
            key="drop-highlight"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{
              opacity: isOver ? 1 : 0.55,
              scale: isOver ? 1.02 : 1,
            }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className={`absolute ${highlightInset} pointer-events-none rounded-lg border-2 z-30 ${
              isOver
                ? 'border-emerald-400 bg-emerald-400/15 shadow-[0_0_18px_rgba(52,211,153,0.6)]'
                : 'border-fs-gold/70 bg-fs-gold/5'
            }`}
          />
        )}
      </AnimatePresence>
      {children}
    </div>
  );
}
