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

/** Payload attached to draggables — encodes what is being dragged. */
export type DragPayload =
  | { type: 'loot-hand'; cardId: string }
  | { type: 'item'; instanceId: string; cardId: string }
  | { type: 'character'; instanceId: string; cardId: string };

/** Payload attached to droppables — encodes what targets accept what. */
export type DropPayload =
  | { kind: 'play-loot' }
  | { kind: 'discard-loot' }
  | { kind: 'give-item'; toPlayerId: string }
  | { kind: 'attack-monster'; slotIndex: number };

interface DnDContextValue {
  activeDrag: DragPayload | null;
}

export const DnDStateContext = React.createContext<DnDContextValue>({ activeDrag: null });

export function useDragState() {
  return React.useContext(DnDStateContext);
}

/**
 * Global Drag-and-Drop provider for the game board.
 *
 * Activation constraint of 8px means clicks/taps still pass through to card popovers —
 * a true drag gesture must move the pointer 8px before DnD takes over.
 *
 * Drag types and accepted drop kinds:
 *   loot-hand → play-loot, discard-loot, give-item
 *   item      → give-item
 *   (attack-monster requires no draggable — uses character drag from PlayerArea — currently we
 *    expose attack-monster as a drop target only; no draggable currently maps to it. Reserved
 *    for future expansion.)
 */
export function DnDProvider({ children }: { children: React.ReactNode }) {
  const [activeDrag, setActiveDrag] = useState<DragPayload | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as DragPayload | undefined;
    if (data) setActiveDrag(data);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveDrag(null);
    const drag = event.active.data.current as DragPayload | undefined;
    const drop = event.over?.data.current as DropPayload | undefined;
    if (!drag || !drop) return;

    const socket = getSocket();

    // Loot card from hand
    if (drag.type === 'loot-hand') {
      if (drop.kind === 'play-loot') {
        socket.emit('action:play_loot', { cardId: drag.cardId, targets: [] });
        return;
      }
      if (drop.kind === 'discard-loot') {
        socket.emit('action:discard_loot', { cardId: drag.cardId });
        return;
      }
      if (drop.kind === 'give-item') {
        socket.emit('action:trade_card', {
          cardId: drag.cardId,
          toPlayerId: drop.toPlayerId,
          fromHand: true,
        });
        return;
      }
    }

    // Item card from player area
    if (drag.type === 'item') {
      if (drop.kind === 'give-item') {
        const myId = useGameStore.getState().game?.myPlayerId;
        if (drop.toPlayerId === myId) return; // can't give to self
        socket.emit('action:trade_card', {
          instanceId: drag.instanceId,
          toPlayerId: drop.toPlayerId,
          fromHand: false,
        });
        return;
      }
    }

    // Character card → declare attack on a monster
    if (drag.type === 'character') {
      if (drop.kind === 'attack-monster') {
        socket.emit('action:declare_attack', {
          targetType: 'monster_slot',
          targetSlotIndex: drop.slotIndex,
        });
        return;
      }
    }
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
    </DnDStateContext.Provider>
  );
}

/** Floating card preview that follows the cursor while dragging. */
function DragPreview({ payload }: { payload: DragPayload }) {
  const cardId = payload.cardId;
  const card = useCard(cardId);
  if (!card) {
    // Show a simple placeholder until the card data loads
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
