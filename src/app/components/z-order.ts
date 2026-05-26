/**
 * Shared z-index counter for playground items (sticky notes + polaroid cards).
 * Cycles within [200, 260] so it never grows unbounded.
 * All values sit above the playground-section base (z-index: 100)
 * and well below the expanded polaroid dialog (z-index: 9000+).
 */
let zCounter = 200;

export function nextZ(): number {
  zCounter = zCounter >= 260 ? 201 : zCounter + 1;
  return zCounter;
}
