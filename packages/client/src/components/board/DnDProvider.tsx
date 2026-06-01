import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import { createPortal } from 'react-dom';
import { useGameStore } from '../../store/gameStore';
import { getSocket } from '../../socket/client';
import { useCard } from '../board/CardResolver';
import { SERVER_URL } from '../../config';
import {
  UniversalDrag,
  UniversalDrop,
  resolveDropActions,
  getAllAvailableActions,
  DECK_TOP_SENTINEL,
} from './DropActionResolver';

export type { UniversalDrag, UniversalDrop };
import { useDragEdgeScroll } from '../../hooks/useDragEdgeScroll';

const DECK_BACKS: Record<string, string> = {
  treasure: '/treasure-back.png',
  loot: '/loot-back.png',
  monster: '/monster-back.png',
  room: '/room-back.png',
  eternal: '/eternal-back.png',
};

interface DnDContextValue {
  activeDrag: UniversalDrag | null;
}

export const DnDStateContext = React.createContext<DnDContextValue>({ activeDrag: null });

export function useDragState() {
  return React.useContext(DnDStateContext);
}

export function DnDProvider({ children }: { children: React.ReactNode }) {
  const [activeDrag, setActiveDrag] = useState<UniversalDrag | null>(null);
  const contextMenu = useGameStore((s) => s.contextMenu);
  const setContextMenu = useGameStore((s) => s.setContextMenu);

  // Portal-based drag ghost position — tracks pointer at document level
  const pointerRef = useRef({ x: 0, y: 0 });
  useEffect(() => {
    if (!activeDrag) return;
    const onMove = (e: PointerEvent) => {
      pointerRef.current = { x: e.clientX, y: e.clientY };
    };
    document.addEventListener('pointermove', onMove);
    return () => document.removeEventListener('pointermove', onMove);
  }, [activeDrag]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as UniversalDrag | undefined;
    if (data) setActiveDrag(data);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveDrag(null);
    const drag = event.active.data.current as UniversalDrag | undefined;
    const drop = event.over?.data.current as UniversalDrop | undefined;
    if (!drag || !drop || !event.over) return;

    const game = useGameStore.getState().game;
    if (!game) return;
    let actions = resolveDropActions(drag, drop, game);

    if (actions.length === 0) {
      actions = getAllAvailableActions(drag, game);
      if (actions.length === 0) return;
    }

    /** Execute a single resolved action */
    const executeAction = (a: typeof actions[0]) => {
      if (a.onClick) {
        a.onClick();
      } else {
        getSocket().emit(a.action, a.payload);
      }
      // Stack-source drags: dismiss after placement
      if (drag.sourceZone === 'stack' && a.action !== 'action:cancel_stack_item') {
        getSocket().emit('action:dismiss_stack_item', { stackItemId: drag.instanceId });
      }
    };

    if (actions.length === 1) {
      executeAction(actions[0]);
      return;
    }

    const rect = event.over.rect;
    setContextMenu({
      x: rect.left + rect.width / 2 - 70,
      y: rect.top + rect.height / 2,
      actions,
      stackSourceId: drag.sourceZone === 'stack' ? drag.instanceId : undefined,
    });
  }, []);

  const handleDragCancel = useCallback(() => {
    setActiveDrag(null);
  }, []);

  useDragEdgeScroll(!!activeDrag, false);

  const ctxValue = useMemo(() => ({ activeDrag }), [activeDrag]);

  return (
    <DnDStateContext.Provider value={ctxValue}>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {children}
      </DndContext>
      {/* Portal-based drag ghost — renders at document level, bypassing all transforms */}
      {activeDrag && createPortal(
        <div
          style={{
            position: 'fixed',
            left: pointerRef.current.x,
            top: pointerRef.current.y,
            transform: 'translate(-50%, -50%) rotate(3deg)',
            pointerEvents: 'none',
            zIndex: 10000,
          }}
        >
          <DragPreview payload={activeDrag} />
        </div>,
        document.body,
      )}
    </DnDStateContext.Provider>
  );
}

function DragPreview({ payload }: { payload: UniversalDrag }) {
  // Sentinel: dragging a deck face — show the deck back image
  if (payload.cardId === DECK_TOP_SENTINEL && payload.sourceZoneId) {
    const backSrc = DECK_BACKS[payload.sourceZoneId] ?? '/card-back.png';
    return (
      <img
        src={backSrc}
        alt="deck"
        className="w-[120px] h-[165px] object-cover rounded shadow-2xl ring-2 ring-fs-gold/80 opacity-95"
        draggable={false}
      />
    );
  }

  const card = useCard(payload.cardId);
  if (!card) {
    return (
      <div className="w-[120px] h-[165px] rounded bg-fs-darker border-2 border-fs-gold/60 shadow-2xl opacity-90" />
    );
  }
  return (
    <img
      src={`${SERVER_URL}${card.imageUrl}`}
      alt={card.name}
      className="w-[120px] h-[165px] object-cover rounded shadow-2xl ring-2 ring-fs-gold/80 opacity-95"
      draggable={false}
    />
  );
}
