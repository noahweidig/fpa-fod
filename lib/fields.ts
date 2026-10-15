import type { FieldMap } from "./types";

const CANDIDATES: Record<keyof FieldMap, string[]> = {
  year: ["FIRE_YEAR"],
  doy: ["DISCOVERY_DOY"],
  general: ["NWCG_GENERAL_CAUSE"],
  specific: ["STAT_CAUSE_DESCR"],
  size: ["FIRE_SIZE"],
  sizeClass: ["FIRE_SIZE_CLASS"],
  state: ["STATE"],
  id: ["FOD_ID"],
};

/** Match semantic roles to real field names (case-insensitive). Missing roles stay undefined. */
export function resolveFields(names: string[]): FieldMap {
  const lower = new Map(names.map((n) => [n.toLowerCase(), n]));
  const out: FieldMap = {};
  for (const role of Object.keys(CANDIDATES) as (keyof FieldMap)[]) {
    for (const c of CANDIDATES[role]) {
      const hit = lower.get(c.toLowerCase());
      if (hit) {
        out[role] = hit;
        break;
      }
    }
  }
  return out;
}
