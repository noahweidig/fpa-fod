import { CATEGORICAL } from "./palette";

/**
 * value -> color. Colors follow the entity: with explicit `picks` (value -> slot) a pick keeps its
 * slot when others change; otherwise the top-N values by rank take slots 0..N-1.
 */
export function assignColors(order: string[], picks?: Record<string, number> | null): Map<string, string> {
  const m = new Map<string, string>();
  if (picks) {
    for (const [k, slot] of Object.entries(picks)) m.set(k, CATEGORICAL[slot % CATEGORICAL.length]);
    return m;
  }
  order.slice(0, CATEGORICAL.length).forEach((v, i) => m.set(v, CATEGORICAL[i]));
  return m;
}

export function defaultPicks(order: string[]): Record<string, number> {
  const o: Record<string, number> = {};
  order.slice(0, CATEGORICAL.length).forEach((v, i) => (o[v] = i));
  return o;
}

export function nextFreeSlot(picks: Record<string, number>): number {
  const used = new Set(Object.values(picks));
  for (let i = 0; i < CATEGORICAL.length; i++) if (!used.has(i)) return i;
  return -1;
}
