/** Helpers that keep `position` fields contiguous (0..n-1) after every reorder. */

export const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position;

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Returns a copy of `items` with `item` removed (if present) and inserted at `index` (clamped). */
export function insertAt<T>(items: readonly T[], item: T, index: number, eq: (a: T, b: T) => boolean = Object.is): T[] {
  const without = items.filter((x) => !eq(x, item));
  const at = clamp(Math.round(index), 0, without.length);
  return [...without.slice(0, at), item, ...without.slice(at)];
}

/** Produces an id → position map for an ordered array of ids. */
export function positionsOf(ids: readonly string[]): Map<string, number> {
  return new Map(ids.map((id, i) => [id, i]));
}
