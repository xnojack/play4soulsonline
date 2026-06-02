import React, { useCallback, useEffect, useRef, WheelEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useBoardScale, updateCanvasRect, zoomLevelRef } from '../../context/BoardScaleContext';
import { useDragState } from './DnDProvider';

const ZOOM_SENSITIVITY = 0.001;
const MIDDLE_BUTTON = 1;
const RIGHT_BUTTON = 2;
const KEYBOARD_PAN_SPEED = 16;

interface BoardCanvasProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Wraps the 3-band board layout in a CSS transform (scale + translate).
 * The board is a fixed 4000x2000 surface. A fit scale makes it fill the viewport.
 * Zoom (1x-3x) is applied on top. Pan keeps the board within the viewport.
 *
 * Interactions:
 *  - Wheel: zoom in/out around cursor (1x-3x)
 *  - Right-click drag: pan
 *  - Middle-click drag: pan
 *  - Space + left-click drag: pan
 *  - Two-finger touch drag: pan
 *  - WASD/arrow keys: keyboard pan (independent, Escape to stop)
 *  - Double-click on background: reset view
 *
 * DnD is unaffected: PointerSensor gets raw viewport coords; the
 * scale modifier in DnDProvider compensates for scale inside Draggable.
 */
export function BoardCanvas({
  children,
  className = '',
  style,
}: BoardCanvasProps) {
  const { totalScale, zoomLevel, panX, panY, setZoom, startPan, movePan, endPan, panBy, resetView, isPanning, setIsPanning, recalcFit } =
    useBoardScale();
  const { activeDrag } = useDragState();

  const canvasRef = useRef<HTMLDivElement>(null);
  const spaceDown = useRef(false);
  const mousePanActive = useRef(false);
  const suppressMouseUp = useRef(false);
  const touchPanActive = useRef(false);
  const pinchState = useRef<{
    initialDist: number;
    initialZoom: number;
    startPanX: number;
    startPanY: number;
  } | null>(null);
  const keyboardKeys = useRef(new Set<string>());
  const keyboardRaf = useRef<number | null>(null);

  // Track canvas viewport rect + recalc fit on resize
  useEffect(() => {
    if (!canvasRef.current) return;
    let rafId: number | null = null;
    const update = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        updateCanvasRect(canvasRef.current!.getBoundingClientRect());
        recalcFit();
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(canvasRef.current);
    return () => {
      observer.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [recalcFit]);

  // ── Keyboard pan loop (WASD/arrows, independent) ──────────────────────────
  const tickKeyboard = useCallback(() => {
    const keys = keyboardKeys.current;
    let dx = 0, dy = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) dy += KEYBOARD_PAN_SPEED;
    if (keys.has('KeyS') || keys.has('ArrowDown')) dy -= KEYBOARD_PAN_SPEED;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) dx += KEYBOARD_PAN_SPEED;
    if (keys.has('KeyD') || keys.has('ArrowRight')) dx -= KEYBOARD_PAN_SPEED;
    if (dx !== 0 || dy !== 0) {
      panBy(dx, dy);
    }
    if (keyboardKeys.current.size > 0) {
      keyboardRaf.current = requestAnimationFrame(tickKeyboard);
    } else {
      keyboardRaf.current = null;
    }
  }, [panBy]);

  const startKeyboardLoop = useCallback(() => {
    if (!keyboardRaf.current) {
      setIsPanning(true);
      keyboardRaf.current = requestAnimationFrame(tickKeyboard);
    }
  }, [tickKeyboard, setIsPanning]);

  const stopKeyboardLoop = useCallback(() => {
    if (keyboardRaf.current) {
      cancelAnimationFrame(keyboardRaf.current);
      keyboardRaf.current = null;
    }
  }, []);

  // ── Wheel zoom ────────────────────────────────────────────────────────────
  const onWheel = useCallback(
    (e: WheelEvent<HTMLDivElement>) => {
      if (activeDrag) return;
      e.preventDefault();
      const currentZoom = zoomLevelRef.current;
      const delta = -e.deltaY * ZOOM_SENSITIVITY * currentZoom;
      const rect = canvasRef.current?.getBoundingClientRect();
      setZoom(currentZoom + delta, e.clientX, e.clientY, rect);
    },
    [activeDrag, setZoom],
  );

  // ── Mouse pan: right-click drag, middle-click drag, space+left drag ───────
  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (activeDrag) return;
      const isRight = e.button === RIGHT_BUTTON;
      const isMiddle = e.button === MIDDLE_BUTTON;
      const isSpaceLeft = spaceDown.current && e.button === 0;
      if (!isRight && !isMiddle && !isSpaceLeft) return;
      e.preventDefault();
      mousePanActive.current = true;
      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
      startPan(e.clientX, e.clientY);
    },
    [activeDrag, startPan],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!mousePanActive.current) return;
      movePan(e.clientX, e.clientY);
    },
    [movePan],
  );

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!mousePanActive.current) return;
      mousePanActive.current = false;
      endPan();
      (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
    },
    [endPan],
  );

  // ── Global listeners: contextmenu suppression, keyboard ────────────────────
  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      if (canvasRef.current?.contains(e.target as Node)) {
        e.preventDefault();
        suppressMouseUp.current = true;
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === RIGHT_BUTTON && suppressMouseUp.current) {
        suppressMouseUp.current = false;
        return;
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        spaceDown.current = true;
      }

      if (e.code === 'Escape') {
        keyboardKeys.current.clear();
        stopKeyboardLoop();
        setIsPanning(false);
        return;
      }

      if (e.code === 'KeyW' || e.code === 'KeyS' || e.code === 'KeyA' || e.code === 'KeyD' ||
          e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        e.preventDefault();
        keyboardKeys.current.add(e.code);
        startKeyboardLoop();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceDown.current = false;
        if (mousePanActive.current) {
          mousePanActive.current = false;
          endPan();
        }
      }

      if (keyboardKeys.current.has(e.code)) {
        keyboardKeys.current.delete(e.code);
        if (keyboardKeys.current.size === 0) {
          stopKeyboardLoop();
          setIsPanning(false);
        }
      }
    };

    window.addEventListener('contextmenu', onContextMenu, true);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      window.removeEventListener('contextmenu', onContextMenu, true);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [endPan, startKeyboardLoop, stopKeyboardLoop, setIsPanning]);

  // ── Two-finger touch: pinch-to-zoom + pan simultaneously ──────────────────
  useEffect(() => {
    const el = document.querySelector('[data-board-canvas]') as HTMLElement | null;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (activeDrag || e.touches.length !== 2) return;
      e.preventDefault();
      touchPanActive.current = true;
      const dist = touchDistance(e.touches[0], e.touches[1]);
      pinchState.current = {
        initialDist: dist,
        initialZoom: zoomLevelRef.current,
        startPanX: 0,
        startPanY: 0,
      };
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      startPan(cx, cy);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!touchPanActive.current || e.touches.length !== 2) return;
      e.preventDefault();
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;

      // Pan
      movePan(cx, cy);

      // Pinch zoom
      const state = pinchState.current;
      if (!state) return;
      const dist = touchDistance(e.touches[0], e.touches[1]);
      const ratio = dist / state.initialDist;
      const newZoom = state.initialZoom * ratio;
      const rect = canvasRef.current?.getBoundingClientRect();
      setZoom(newZoom, cx, cy, rect);
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!touchPanActive.current) return;
      if (e.touches.length < 2) {
        touchPanActive.current = false;
        pinchState.current = null;
        endPan();
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: false });
    el.addEventListener('touchcancel', onTouchEnd, { passive: false });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [activeDrag, startPan, movePan, endPan, setZoom]);

  // ── Double-click to reset ─────────────────────────────────────────────────
  const onDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest('[data-board-card]')) return;
      resetView();
    },
    [resetView],
  );

  // Helper: calculate distance between two touch points
  const touchDistance = (t1: Touch, t2: Touch) => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const cursorClass = isPanning ? 'cursor-grabbing' : 'cursor-grab';

  return (
    <div
      ref={canvasRef}
      data-board-canvas
      className={`w-full h-full overflow-hidden ${className} ${cursorClass}`}
      style={style}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
    >
      <div
        style={{
          width: `${4000}px`,
          height: `${2000}px`,
          transformOrigin: '0 0',
          transform: `scale(${totalScale}) translate(${panX / totalScale}px, ${panY / totalScale}px)`,
          willChange: 'transform',
          position: 'relative',
        }}
      >
        {/* Table background */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'url(/bg/table.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundColor: '#0a0a0c',
          }}
        />
        <div className="absolute inset-0 bg-black/30 pointer-events-none" />
        <div className="relative w-full h-full">{children}</div>
      </div>
    </div>
  );
}
