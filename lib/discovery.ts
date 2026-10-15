import type { Point } from "geojson";
import type maplibregl from "maplibre-gl";
import { resolveFields } from "./fields";
import { useStore } from "./store";
import type { CatDim, Categories, TileMeta } from "./types";
import { CAT_DIMS, emptyCategories } from "./types";

const asStr = (v: unknown) => (v == null ? "" : String(v));
const sortAlpha = (a: string[]) => [...a].sort((x, y) => x.localeCompare(y));
const rank = (counts: Record<string, number>, vals: string[]) =>
  [...vals].sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0) || a.localeCompare(b));

/** Seed categories/bounds from PMTiles tilestats (if the tiles carry it). */
export function initFromMeta(meta: TileMeta) {
  const { fieldMap: fm, stats } = meta;
  const cats = emptyCategories();
  for (const d of CAT_DIMS) {
    const f = fm[d];
    if (f && stats[f]?.values) cats.values[d] = sortAlpha(stats[f].values!.map(asStr).filter(Boolean));
  }
  const patch: Partial<ReturnType<typeof useStore.getState>> = { categories: cats };
  const y = fm.year ? stats[fm.year] : undefined;
  if (y && Number.isFinite(y.min) && Number.isFinite(y.max)) patch.yearBounds = [y.min!, y.max!];
  const a = fm.size ? stats[fm.size] : undefined;
  if (a && Number.isFinite(a.min) && Number.isFinite(a.max)) patch.acreBounds = [a.min!, a.max!];
  useStore.setState(patch);
}

let ranked = false;
let lastSample = 0;
const MAX_SAMPLE = 60_000;

/** Exact categories/counts from Parquet. */
export function applyExact(c: {
  counts: Record<CatDim, Record<string, number>>;
  pairs: Record<string, string[]>;
  yearBounds?: [number, number];
  acreBounds?: [number, number];
}) {
  const values = {} as Categories["values"];
  for (const d of CAT_DIMS) values[d] = rank(c.counts[d], Object.keys(c.counts[d]).filter(Boolean));
  ranked = true;
  useStore.setState({
    categories: { values, counts: c.counts, pairs: c.pairs },
    ...(c.yearBounds ? { yearBounds: c.yearBounds } : {}),
    ...(c.acreBounds ? { acreBounds: c.acreBounds } : {}),
  });
}

/**
 * Sample features from loaded tiles (no Parquet): discover fields/categories/ranges.
 * Cause order is fixed by the first non-empty sample so colors stay stable afterward.
 */
export function sampleTiles(map: maplibregl.Map) {
  const st = useStore.getState();
  const meta = st.meta;
  if (!meta) return;
  const now = Date.now();
  if (now - lastSample < 2500) return;
  lastSample = now;
  const feats = map.querySourceFeatures("fod", { sourceLayer: meta.layerId }).slice(0, MAX_SAMPLE);
  if (!feats.length) return;

  let fm = meta.fieldMap;
  if (!Object.keys(meta.fields).length) {
    const names = Object.keys(feats[0].properties ?? {});
    fm = resolveFields(names);
    useStore.setState({ meta: { ...meta, fields: Object.fromEntries(names.map((n) => [n, "?"])), fieldMap: fm } });
  }

  const seen = new Set<string>();
  const tally = Object.fromEntries(CAT_DIMS.map((d) => [d, {} as Record<string, number>])) as Record<CatDim, Record<string, number>>;
  const pairs: Record<string, Set<string>> = {};
  let ymin = Infinity, ymax = -Infinity, amin = Infinity, amax = -Infinity;

  for (const f of feats) {
    const p = f.properties ?? {};
    const g = f.geometry as Point;
    const key = fm.id && p[fm.id] != null ? String(p[fm.id]) : `${g.coordinates?.join(",")}|${p[fm.year ?? ""]}|${p[fm.doy ?? ""]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    for (const d of CAT_DIMS) {
      const fld = fm[d];
      if (!fld) continue;
      const v = asStr(p[fld]);
      if (v) tally[d][v] = (tally[d][v] ?? 0) + 1;
    }
    const gen = fm.general ? asStr(p[fm.general]) : "";
    const cls = fm.classification ? asStr(p[fm.classification]) : "";
    if (gen && cls) (pairs[gen] ??= new Set()).add(cls);
    const y = fm.year ? Number(p[fm.year]) : NaN;
    if (Number.isFinite(y)) (ymin = Math.min(ymin, y)), (ymax = Math.max(ymax, y));
    const a = fm.size ? Number(p[fm.size]) : NaN;
    if (Number.isFinite(a)) (amin = Math.min(amin, a)), (amax = Math.max(amax, a));
  }

  const prev = st.categories;
  const values = {} as Categories["values"];
  let any = false;
  for (const d of CAT_DIMS) {
    const found = Object.keys(tally[d]);
    if (found.length) any = true;
    const all = [...new Set([...prev.values[d], ...found])];
    const alpha = d === "county" || d === "state" || d === "sizeClass";
    if (alpha) values[d] = sortAlpha(all);
    else if (!ranked) values[d] = rank(tally[d], all);
    else values[d] = [...prev.values[d], ...all.filter((v) => !prev.values[d].includes(v)).sort()];
  }
  const mergedPairs: Record<string, string[]> = { ...prev.pairs };
  for (const [k, v] of Object.entries(pairs)) mergedPairs[k] = [...new Set([...(mergedPairs[k] ?? []), ...v])];
  if (any) ranked = true;

  const patch: Partial<ReturnType<typeof useStore.getState>> = {
    categories: { values, counts: tally, pairs: mergedPairs },
  };
  if (Number.isFinite(ymin)) {
    const b = st.yearBounds;
    patch.yearBounds = b ? [Math.min(b[0], ymin), Math.max(b[1], ymax)] : [ymin, ymax];
  }
  if (Number.isFinite(amin)) {
    const b = st.acreBounds;
    patch.acreBounds = b ? [Math.min(b[0], amin), Math.max(b[1], amax)] : [amin, amax];
  }
  useStore.setState(patch);
}
