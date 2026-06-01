import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const BOARD_WIDTH = 4000;
const BOARD_HEIGHT = 2000;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

interface BoardScaleContextValue {
  totalScale: number;
  fitScale: number;
  zoomLevel: number;
  panX: number;
  panY: number;
  setZoom: (level: number, originX?: number, originY?: number, canvasRect?: DOMRect) => void;
  startPan: (x: number, y: number) => void;
  movePan: (x: number, y: number) => void;
  endPan: () => void;
  panBy: (dx: number, dy: number) => void;
  recalcFit: () => void;
  resetView: () => void;
  isPanning: boolean;
  setIsPanning: (v: boolean) => void;
}

export const BoardScaleContext = createContext<BoardScaleContextValue>({
  totalScale: 1,
  fitScale: 1,
  zoomLevel: 1,
  panX: 0,
  panY: 0,
  setZoom: () => {},
  startPan: () => {},
  movePan: () => {},
  endPan: () => {},
  panBy: () => {},
  recalcFit: () => {},
  resetView: () => {},
  isPanning: false,
  setIsPanning: () => {},
});

export function useBoardScale() {
  return useContext(BoardScaleContext);
}

/** Canvas viewport rect — updated by BoardCanvas via ResizeObserver */
const canvasRectRef = { x: 0, y: 0, width: 0, height: 0 };

/** Exposed zoom ref so wheel handler can read current zoom without stale closures */
const _zoomLevelRef: React.MutableRefObject<number> = { current: 1 };
export { _zoomLevelRef as zoomLevelRef };

export function updateCanvasRect(rect: DOMRect) {
  canvasRectRef.x = rect.x;
  canvasRectRef.y = rect.y;
  canvasRectRef.width = rect.width;
  canvasRectRef.height = rect.height;
}

/** Calculate the fit scale that makes the full board visible in the canvas area */
function calcFitScale(): number {
  const vw = canvasRectRef.width || window.innerWidth;
  const vh = canvasRectRef.height || window.innerHeight;
  return Math.min(vw / BOARD_WIDTH, vh / BOARD_HEIGHT);
}

/** Clamp pan so the board edges stay within the viewport; center when board fits */
function clampPan(panX: number, panY: number, totalScale: number, canvasRect?: DOMRect): [number, number] {
  const rect = canvasRect || canvasRectRef;
  const vw = rect.width || window.innerWidth;
  const vh = rect.height || window.innerHeight;
  const boardW = BOARD_WIDTH * totalScale;
  const boardH = BOARD_HEIGHT * totalScale;

  let cx = panX, cy = panY;

  if (boardW <= vw) {
    cx = (vw - boardW) / 2;  // center horizontally
  } else {
    cx = Math.max(-(boardW - vw), Math.min(0, cx));
  }

  if (boardH <= vh) {
    cy = (vh - boardH) / 2;  // center vertically
  } else {
    cy = Math.max(-(boardH - vh), Math.min(0, cy));
  }

  return [cx, cy];
}

export function BoardScaleProvider({ children }: { children: React.ReactNode }) {
  const [fitScale, setFitScale] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  // Refs for stale-closure-safe access
  const panXRef = useRef(panX);
  const panYRef = useRef(panY);
  const zoomLevelRef = useRef(zoomLevel);
  const fitRef = useRef(fitScale);
  panXRef.current = panX;
  panYRef.current = panY;
  zoomLevelRef.current = zoomLevel;
  fitRef.current = fitScale;
  _zoomLevelRef.current = zoomLevel;

  const totalScale = useMemo(() => fitScale * zoomLevel, [fitScale, zoomLevel]);

  /** Recalculate fit scale on resize — keeps board center stable */
  const recalcFit = useCallback(() => {
    const newFit = calcFitScale();
    if (Math.abs(newFit - fitRef.current) < 0.0001) return;
    const ratio = newFit / fitRef.current;
    setFitScale(newFit);
    setPanX((px) => px * ratio);
    setPanY((py) => py * ratio);
  }, []);

  /** Set zoom level (1–3), optionally around a cursor origin */
  const setZoom = useCallback((level: number, originX?: number, originY?: number, canvasRect?: DOMRect) => {
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, level));
    const prev = zoomLevelRef.current;
    if (originX !== undefined && originY !== undefined && prev !== clamped) {
      const rect = canvasRect || canvasRectRef;
      const oldTotal = fitRef.current * prev;
      const newTotal = fitRef.current * clamped;
      // Cursor position relative to board top-left (in board-local coords)
      const boardX = (originX - rect.x - panXRef.current) / oldTotal;
      const boardY = (originY - rect.y - panYRef.current) / oldTotal;
      // New pan to keep that board point under the cursor
      const newPanX = originX - rect.x - boardX * newTotal;
      const newPanY = originY - rect.y - boardY * newTotal;
      const [cx, cy] = clampPan(newPanX, newPanY, newTotal, canvasRect);
      setPanX(cx);
      setPanY(cy);
      // Update refs synchronously so rapid wheel events read correct accumulated state
      panXRef.current = cx;
      panYRef.current = cy;
    }
    zoomLevelRef.current = clamped;
    setZoomLevel(clamped);
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
    const [cx, cy] = clampPan(
      panStart.current.panX + dx,
      panStart.current.panY + dy,
      totalScale,
    );
    setPanX(cx);
    setPanY(cy);
  }, [totalScale]);

  const endPan = useCallback(() => {
    setIsPanning(false);
    panStart.current = null;
  }, []);

  const panBy = useCallback((dx: number, dy: number) => {
    const [cx, cy] = clampPan(panXRef.current + dx, panYRef.current + dy, totalScale);
    setPanX(cx);
    setPanY(cy);
  }, [totalScale]);

  const resetView = useCallback(() => {
    zoomLevelRef.current = 1;
    panXRef.current = 0;
    panYRef.current = 0;
    setZoomLevel(1);
    setPanX(0);
    setPanY(0);
  }, []);

  const value = useMemo(
    () => ({
      totalScale, fitScale, zoomLevel, panX, panY,
      setZoom, startPan, movePan, endPan, panBy, recalcFit, resetView,
      isPanning, setIsPanning,
    }),
    [totalScale, fitScale, zoomLevel, panX, panY, setZoom, startPan, movePan, endPan, panBy, recalcFit, resetView, isPanning],
  );

  return <BoardScaleContext.Provider value={value}>{children}</BoardScaleContext.Provider>;
}
