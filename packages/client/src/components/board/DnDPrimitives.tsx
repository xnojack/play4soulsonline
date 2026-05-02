import React from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from 'framer-motion';
import { DragPayload, DropPayload, useDragState } from './DnDProvider';

/**
 * Wraps any element to make it draggable. The element retains all its
 * pointer interactions (clicks, hovers) — drag only activates after the
 * pointer moves 8px (set in DnDProvider activationConstraint).
 */
export function Draggable({
  id,
  payload,
  disabled,
  children,
  className = '',
}: {
  id: string;
  payload: DragPayload;
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
        touchAction: 'manipulation',
      }}
      className={className}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}

/**
 * Wraps any element to make it a drop target. When a compatible drag is
 * active, a gold ring fades in. When the dragged item is hovering directly
 * over this zone, the ring intensifies to bright gold/green.
 */
export function Droppable({
  id,
  payload,
  accepts,
  children,
  className = '',
  highlightInset = '-inset-1',
}: {
  id: string;
  payload: DropPayload;
  /** Predicate: returns true if the currently-active drag is acceptable here */
  accepts: (drag: DragPayload) => boolean;
  children: React.ReactNode;
  className?: string;
  /** Tailwind inset for the highlight ring (default -inset-1) */
  highlightInset?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, data: payload });
  const { activeDrag } = useDragState();
  const isAcceptable = activeDrag ? accepts(activeDrag) : false;
  const showHighlight = isAcceptable;

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
