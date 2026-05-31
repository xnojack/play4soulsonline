import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const MIN_SCALE = 0.9;
const MAX_SCALE = 3.0;

interface BoardScaleContextValue {
  scale: number;
  panX: number;
  panY: number;
  setScaleAndClamp: (next: number, originX?: number, originY?: number) => void;
  startPan: (x: number, y: number) => void;
  movePan: (x: number, y: number) => void;
  endPan: () => void;
  panBy: (dx: number, dy: number) => void;
  resetView: () => void;
  isPanning: boolean;
  setIsPanning: (v: boolean) => void;
}

export const BoardScaleContext = createContext<BoardScaleContextValue>({
  scale: 1,
  panX: 0,
  panY: 0,
  setScaleAndClamp: () => {},
  startPan: () => {},
  movePan: () => {},
  endPan: () => {},
  panBy: () => {},
  resetView: () => {},
  isPanning: false,
  setIsPanning: () => {},
});

export function useBoardScale() {
  return useContext(BoardScaleContext);
}

/** Canvas viewport rect — updated by BoardCanvas via ResizeObserver */
const canvasRectRef = { x: 0, y: 0, width: 0, height: 0 };

export function updateCanvasRect(rect: DOMRect) {
  canvasRectRef.x = rect.x;
  canvasRectRef.y = rect.y;
  canvasRectRef.width = rect.width;
  canvasRectRef.height = rect.height;
}

function clampPan(panX: number, panY: number, scale: number): [number, number] {
  const vw = canvasRectRef.width || window.innerWidth;
  const vh = canvasRectRef.height || window.innerHeight;

  if (scale <= 1) return [0, 0];

  const maxPanX = Math.max(0, (vw * scale - vw) / 2);
  const maxPanY = Math.max(0, (vh * scale - vh) / 2);

  return [
    Math.max(-maxPanX, Math.min(maxPanX, panX)),
    Math.max(-maxPanY, Math.min(maxPanY, panY)),
  ];
}

export function BoardScaleProvider({ children }: { children: React.ReactNode }) {
  const [scale, setScale] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  // Refs so panBy always reads current values without stale closures
  const panXRef = useRef(panX);
  const panYRef = useRef(panY);
  const scaleRef = useRef(scale);
  panXRef.current = panX;
  panYRef.current = panY;
  scaleRef.current = scale;

  const setScaleAndClamp = useCallback((next: number, originX?: number, originY?: number) => {
    const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, next));

    setScale((prev) => {
      if (originX !== undefined && originY !== undefined) {
        const vw = canvasRectRef.width || window.innerWidth;
        const vh = canvasRectRef.height || window.innerHeight;
        const dx = (originX - canvasRectRef.x - vw / 2) * (1 - clamped / prev);
        const dy = (originY - canvasRectRef.y - vh / 2) * (1 - clamped / prev);

        setPanX((px) => clampPan(px + dx, 0, clamped)[0]);
        setPanY((py) => clampPan(0, py + dy, clamped)[1]);
      } else {
        setPanX((px) => clampPan(px, 0, clamped)[0]);
        setPanY((py) => clampPan(0, py, clamped)[1]);
      }
      return clamped;
    });
  }, []);

  const startPan = useCallback((x: number, y: number) => {
    setIsPanning(true);
    panStart.current = { x, y, panX: 0, panY: 0 };
    setPanX((px) => { if (panStart.current) panStart.current.panX = px; return px; });
    setPanY((py) => { if (panStart.current) panStart.current.panY = py; return py; });
  }, []);

  const movePan = useCallback((x: number, y: number) => {
    if (!panStart.current) return;
    const dx = x - panStart.current.x;
    const dy = y - panStart.current.y;
    setScale((sc) => {
      const [cx, cy] = clampPan(
        panStart.current!.panX + dx,
        panStart.current!.panY + dy,
        sc,
      );
      setPanX(cx);
      setPanY(cy);
      return sc;
    });
  }, []);

  const endPan = useCallback(() => {
    setIsPanning(false);
    panStart.current = null;
  }, []);

  const panBy = useCallback((dx: number, dy: number) => {
    const [cx, cy] = clampPan(panXRef.current + dx, panYRef.current + dy, scaleRef.current);
    setPanX(cx);
    setPanY(cy);
  }, []);

  const resetView = useCallback(() => {
    setScale(1);
    setPanX(0);
    setPanY(0);
  }, []);

  const value = useMemo(
    () => ({ scale, panX, panY, setScaleAndClamp, startPan, movePan, endPan, panBy, resetView, isPanning, setIsPanning: setIsPanning }),
    [scale, panX, panY, setScaleAndClamp, startPan, movePan, endPan, panBy, resetView, isPanning],
  );

  return <BoardScaleContext.Provider value={value}>{children}</BoardScaleContext.Provider>;
}
