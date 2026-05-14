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
} from '@dnd-kit/core';
import { useGameStore } from '../../store/gameStore';
import { getSocket } from '../../socket/client';
import { useCard } from '../board/CardResolver';
import { SERVER_URL } from '../../config';
import {
  UniversalDrag,
  UniversalDrop,
  resolveDropActions,
  getAllAvailableActions,
} from './DropActionResolver';

export type { UniversalDrag, UniversalDrop };
import { DropContextMenu } from './DropContextMenu';

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
    actions: { label: string; action: string; payload: Record<string, unknown> }[];
    stackSourceId?: string; // set when drag source is 'stack', triggers resolve_top after action
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
    if (actions.length === 1) {
      getSocket().emit(actions[0].action, actions[0].payload);
      // Stack-source drags: dismiss the stack item (no side effects) after placement
      if (drag.sourceZone === 'stack' && actions[0].action !== 'action:cancel_stack_item') {
        getSocket().emit('action:dismiss_stack_item', { stackItemId: drag.instanceId });
      }
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
