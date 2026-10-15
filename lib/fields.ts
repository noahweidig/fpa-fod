import type { FieldMap } from "./types";

const CANDIDATES: Record<keyof FieldMap, string[]> = {
  year: ["FIRE_YEAR"],
  doy: ["DISCOVERY_DOY"],
  size: ["FIRE_SIZE"],
  id: ["FOD_ID"],
  general: ["NWCG_GENERAL_CAUSE"],
  classification: ["NWCG_CAUSE_CLASSIFICATION"],
  ageCat: ["NWCG_CAUSE_AGE_CATEGORY"],
  owner: ["OWNER_DESCR"],
  agency: ["NWCG_REPORTING_AGENCY"],
  sourceType: ["SOURCE_SYSTEM_TYPE"],
  sizeClass: ["FIRE_SIZE_CLASS"],
  state: ["STATE"],
  county: ["COUNTY"],
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
