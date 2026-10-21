import type { FeatureCollection } from "geojson";
import { buildPip } from "./pip";
import { norm } from "./place";

export type RegionId = "state" | "county" | "eco_l1" | "eco_l2" | "eco_l3" | "eco_l4" | "gacc";
export type ImpactChoro = "incidents" | "destroyed" | "fatalities" | "injuries" | "evac" | "cost";
export type ChoroMetric = "n" | "acres" | "density" | ImpactChoro;

/** ics_inc column summed per region (null = count of incidents). */
export const IMPACT_CHORO: Record<ImpactChoro, string | null> = {
  incidents: null, destroyed: "str_destroyed", fatalities: "fatalities", injuries: "injuries", evac: "evac_peak", cost: "cost",
};
export const isImpact = (m: ChoroMetric): m is ImpactChoro => m in IMPACT_CHORO;

export interface RegionDef {
  id: RegionId;
  label: string;
  /** assigned per ignition by point-in-polygon (otherwise joined on STATE / COUNTY fields) */
  pip: boolean;
}

export const REGION_DEFS: RegionDef[] = [
  { id: "state", label: "State", pip: false },
  { id: "county", label: "County", pip: false },
  { id: "gacc", label: "GACC (NIFC)", pip: true },
  { id: "eco_l1", label: "EPA L1", pip: true },
  { id: "eco_l2", label: "EPA L2", pip: true },
  { id: "eco_l3", label: "EPA L3", pip: true },
  { id: "eco_l4", label: "EPA L4", pip: true },
];
export const regionDef = (id: RegionId) => REGION_DEFS.find((d) => d.id === id)!;

export const METRIC_LABEL: Record<ChoroMetric, string> = {
  n: "Fires", acres: "Acres burned", density: "Fires per 1,000 km²",
  incidents: "Incidents (ICS-209)", destroyed: "Structures destroyed", fatalities: "Fatalities", injuries: "Injuries", evac: "Peak evacuations", cost: "Suppression cost",
};

export interface Geo {
  id: RegionId;
  fc: FeatureCollection;
  /** feature id used for feature-state (also in properties.id) */
  ids: string[];
  /** join key per feature: state code, "state|county", or ecoregion / GACC code */
  keys: string[];
  names: string[];
  areaKm2: number[];
  pip?: (x: number, y: number) => number;
}

const cache = new Map<RegionId, Promise<Geo>>();

const R = 6371.0088;
function ringKm2(r: number[][]): number {
  let s = 0;
  for (let i = 0; i < r.length - 1; i++) {
    const [x1, y1] = r[i], [x2, y2] = r[i + 1];
    s += ((x2 - x1) * Math.PI / 180) * (2 + Math.sin((y1 * Math.PI) / 180) + Math.sin((y2 * Math.PI) / 180));
  }
  return Math.abs((s * R * R) / 2);
}
function featureKm2(g: FeatureCollection["features"][number]["geometry"]): number {
  const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
  let a = 0;
  for (const p of polys) p.forEach((r, i) => (a += i === 0 ? ringKm2(r) : -ringKm2(r)));
  return a;
}

export function loadGeo(id: RegionId): Promise<Geo> {
  let p = cache.get(id);
  if (!p) {
    p = (async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/boundaries/${id === "state" ? "states" : id === "county" ? "counties" : id}.geojson`);
      if (!res.ok) throw new Error(`Boundary file failed to load (${res.status}).`);
      const fc = (await res.json()) as FeatureCollection;
      const pr = (f: FeatureCollection["features"][number]) => (f.properties ?? {}) as Record<string, string>;
      const ids = fc.features.map((f) => String(id === "state" ? pr(f).state : id === "county" ? pr(f).fips : pr(f).code));
      fc.features.forEach((f, i) => (f.properties = { ...f.properties, id: ids[i] }));
      const keys = fc.features.map((f, i) => (id === "county" ? `${pr(f).state}|${norm(pr(f).name)}` : ids[i]));
      const names = fc.features.map((f) => {
        const q = pr(f);
        return id === "county" ? `${q.name}, ${q.state}` : id === "state" ? q.name : `${q.code} ${q.name}`;
      });
      return { id, fc, ids, keys, names, areaKm2: fc.features.map((f) => featureKm2(f.geometry)) } as Geo;
    })();
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return p;
}

/** Feature index per point (65535 = outside every polygon). Yields to the UI between chunks. */
export async function assignRegions(geo: Geo, x: ArrayLike<number>, y: ArrayLike<number>, say: (m: string) => void): Promise<Uint16Array> {
  const find = (geo.pip ??= buildPip(geo.fc));
  const n = x.length;
  const out = new Uint16Array(n);
  const step = 150_000;
  for (let s = 0; s < n; s += step) {
    const e = Math.min(n, s + step);
    for (let i = s; i < e; i++) {
      const f = find(x[i], y[i]);
      out[i] = f < 0 ? 65535 : f;
    }
    say(`Assigning ignitions to regions… ${Math.round((e / n) * 100)}%`);
    await new Promise((r) => setTimeout(r));
  }
  return out;
}

export interface RegionRow {
  key: string;
  n: number;
  acres: number;
  /** ICS-209 impact sums (incident metrics only) */
  imp?: Partial<Record<ImpactChoro, number>>;
}

export interface ChoroRes {
  layer: RegionId;
  metric: ChoroMetric;
  geo: Geo;
  /** metric value per feature */
  values: number[];
  n: number[];
  acres: number[];
  /** incidents per feature (impact metrics) */
  inc: number[];
  /** ascending class thresholds (5 classes) */
  breaks: number[];
  /** ignitions not matched to any region / total ignitions in the query */
  unmatched: number;
  total: number;
}

export function buildChoro(layer: RegionId, metric: ChoroMetric, geo: Geo, rows: RegionRow[], total: number): ChoroRes {
  const by = new Map<string, RegionRow>();
  for (const r of rows) {
    const c = by.get(r.key);
    if (c) {
      c.n += r.n;
      c.acres += r.acres;
      for (const k in r.imp) { const m = k as ImpactChoro; (c.imp ??= {})[m] = (c.imp[m] ?? 0) + (r.imp[m] ?? 0); }
    } else by.set(r.key, { ...r, imp: r.imp && { ...r.imp } });
  }
  let matched = 0;
  const n = geo.keys.map((k) => by.get(k)?.n ?? 0);
  const acres = geo.keys.map((k) => by.get(k)?.acres ?? 0);
  const inc = geo.keys.map((k) => by.get(k)?.imp?.incidents ?? 0);
  const values = geo.keys.map((k, i) =>
    isImpact(metric) ? by.get(k)?.imp?.[metric] ?? 0 : metric === "n" ? n[i] : metric === "acres" ? acres[i] : geo.areaKm2[i] > 0 ? (n[i] / geo.areaKm2[i]) * 1000 : 0,
  );
  for (const v of isImpact(metric) ? inc : n) matched += v;
  const pos = values.filter((v) => v > 0).sort((a, b) => a - b);
  const breaks: number[] = [];
  for (let q = 1; q < 5 && pos.length; q++) {
    const b = pos[Math.min(pos.length - 1, Math.floor((q / 5) * pos.length))];
    if (!breaks.length || b > breaks[breaks.length - 1]) breaks.push(b);
  }
  return { layer, metric, geo, values, n, acres, inc, breaks, unmatched: total - matched, total };
}
