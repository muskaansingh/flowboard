import { createAppStore } from '@/store/appStore';
import { createSeed, IDS } from '@/data/seed';

/** Fresh, isolated, non-persisted store with deterministic time and ids. */
export function makeStore(userId: string = IDS.alice) {
  let n = 0;
  const now = new Date('2026-06-01T10:00:00.000Z');
  return createAppStore({
    seed: createSeed(now),
    persist: false,
    latencyMs: 0,
    now: () => now,
    newId: (p) => `${p}_t${++n}`,
    initialUserId: userId,
  });
}

/** Flattens a visible tree into "type:name" strings for readable assertions. */
export function flattenTree(node: { container: { type: string; name: string }; children: unknown[] } | null): string[] {
  if (!node) return [];
  const out: string[] = [];
  const walk = (n: { container: { type: string; name: string }; children: unknown[] }) => {
    out.push(`${n.container.type}:${n.container.name}`);
    (n.children as typeof n[]).forEach(walk);
  };
  walk(node);
  return out;
}

export { IDS };
