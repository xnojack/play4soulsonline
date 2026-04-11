/**
 * Clamp an unknown value to a safe integer range.
 * Returns `fallback` if the value is not a finite number.
 */
export function clampInt(val: unknown, min: number, max: number, fallback: number): number {
  const n = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}
