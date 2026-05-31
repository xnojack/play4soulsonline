import React, { useState, useCallback, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  Modifier,
} from '@dnd-kit/core';
import { useBoardScale } from '../../context/BoardScaleContext';
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
import { DropContextMenu } from './DropContextMenu';
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
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    actions: { label: string; action: string; payload: Record<string, unknown>; onClick?: () => void }[];
    stackSourceId?: string;
  } | null>(null);

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

  const { scale, isPanning } = useBoardScale();

  // Compensate for CSS scale transform so drag translate inside the scaled
  // container moves at the correct speed relative to the pointer.
  const scaleModifier: Modifier = useCallback(
    ({ transform }) => ({
      ...transform,
      x: transform.x / scale,
      y: transform.y / scale,
    }),
    [scale],
  );

  useDragEdgeScroll(!!activeDrag, isPanning);

  const ctxValue = useMemo(() => ({ activeDrag }), [activeDrag]);

  return (
    <DnDStateContext.Provider value={ctxValue}>
      <DndContext
        sensors={sensors}
        modifiers={[scaleModifier]}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {children}
        <DragOverlay dropAnimation={null}>
          {activeDrag ? <DragPreview payload={activeDrag} /> : null}
        </DragOverlay>
      </DndContext>
      {contextMenu && (
        <DropContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          actions={contextMenu.actions}
          stackSource={!!contextMenu.stackSourceId}
          stackItemId={contextMenu.stackSourceId}
          onClose={() => setContextMenu(null)}
        />
      )}
    </DnDStateContext.Provider>
  );
}

function DragPreview({ payload }: { payload: UniversalDrag }) {
  // Sentinel: dragging a deck face — show the deck back image
  if (payload.cardId === DECK_TOP_SENTINEL && payload.sourceZoneId) {
    const backSrc = DECK_BACKS[payload.sourceZoneId] ?? '/card-back.png';
    return (
      <div className="rotate-3 pointer-events-none">
        <img
          src={backSrc}
          alt="deck"
          className="w-[100px] h-[137px] object-cover rounded shadow-2xl ring-2 ring-fs-gold/80 opacity-95"
          draggable={false}
        />
      </div>
    );
  }

  const card = useCard(payload.cardId);
  if (!card) {
    return (
      <div className="w-[78px] h-[107px] rounded bg-fs-darker border-2 border-fs-gold/60 shadow-2xl rotate-3 opacity-90" />
    );
  }
  return (
    <div className="rotate-3 pointer-events-none">
      <img
        src={`${SERVER_URL}${card.imageUrl}`}
        alt={card.name}
        className="w-[100px] h-[137px] object-cover rounded shadow-2xl ring-2 ring-fs-gold/80 opacity-95"
        draggable={false}
      />
    </div>
  );
}
