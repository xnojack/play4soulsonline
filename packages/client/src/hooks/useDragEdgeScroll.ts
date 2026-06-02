import { useEffect, useRef } from 'react';

const EDGE_ZONE = 50;
const SCROLL_AMOUNT = 2;
const TICK_MS = 16;

/**
 * Edge-scrolling during drag.
 * Uses a global pointermove listener to track absolute pointer position.
 * When the pointer is within EDGE_ZONE px of any viewport edge,
 * scrolls the main scroll container in that direction.
 */
export function useDragEdgeScroll(isDragging: boolean, isPanning = false) {
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isDragging || isPanning) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      pointerRef.current = null;
      scrollContainerRef.current = null;
      return;
    }

    // Find the main scrollable container
    scrollContainerRef.current = document.querySelector(
      '.flex-1.overflow-y-auto.min-w-0'
    ) as HTMLElement | null;
    if (!scrollContainerRef.current) {
      scrollContainerRef.current = document.documentElement;
    }

    // Track absolute pointer position
    const onPointerMove = (e: PointerEvent) => {
      pointerRef.current = { x: e.clientX, y: e.clientY };
    };
    document.addEventListener('pointermove', onPointerMove);

    // Poll for edge scrolling
    intervalRef.current = setInterval(() => {
      if (!pointerRef.current) return;
      const container = scrollContainerRef.current;
      if (!container) return;

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const { x, y } = pointerRef.current;

      let scrollX = 0;
      let scrollY = 0;

      if (x < EDGE_ZONE) scrollX = -SCROLL_AMOUNT;
      else if (x > vw - EDGE_ZONE) scrollX = SCROLL_AMOUNT;

      if (y < EDGE_ZONE) scrollY = -SCROLL_AMOUNT;
      else if (y > vh - EDGE_ZONE) scrollY = SCROLL_AMOUNT;

      if (scrollX !== 0 || scrollY !== 0) {
        // Clamp: don't scroll past board boundaries (keep at least 50% of content visible)
        const maxX = Math.max(0, container.scrollWidth - vw * 0.5);
        const maxY = Math.max(0, container.scrollHeight - vh * 0.5);
        const newLeft = Math.max(0, Math.min(container.scrollLeft + scrollX, maxX));
        const newTop = Math.max(0, Math.min(container.scrollTop + scrollY, maxY));
        container.scrollTo(newLeft, newTop);
      }
    }, TICK_MS);

    return () => {
      document.removeEventListener('pointermove', onPointerMove);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isDragging, isPanning]);
}
