/**
 * Returns true when the primary pointing device is coarse (touch / stylus).
 * Uses the W3C pointer media feature — reliable, synchronous, no event needed.
 * Safe to call at module load time and during render.
 */
export function isTouchDevice(): boolean {
  return typeof window !== 'undefined' &&
    window.matchMedia('(pointer: coarse)').matches;
}
