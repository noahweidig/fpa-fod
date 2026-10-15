import type { Point } from "geojson";
import type maplibregl from "maplibre-gl";
import { resolveFields } from "./fields";
import { useStore } from "./store";
import type { Categories, TileMeta } from "./types";
import { emptyCategories } from "./types";

const asStr = (v: unknown) => (v == null ? "" : String(v));
const sortAlpha = (a: string[]) => [...a].sort((x, y) => x.localeCompare(y));

/** Seed categories/bounds from PMTiles tilestats (if the tiles carry it). */
export function initFromMeta(meta: TileMeta) {
  const { fieldMap: fm, stats } = meta;
  const vals = (f?: string) => (f && stats[f]?.values ? sortAlpha(stats[f].values!.map(asStr).filter(Boolean)) : []);
  const cats: Categories = {
    ...emptyCategories(),
    general: vals(fm.general),
    specific: vals(fm.specific),
    sizeClass: vals(fm.sizeClass),
    state: vals(fm.state),
  };
  const s = useStore.getState();
  const patch: Partial<ReturnType<typeof useStore.getState>> = { categories: cats };
  const y = fm.year ? stats[fm.year] : undefined;
  if (y && Number.isFinite(y.min) && Number.isFinite(y.max)) patch.yearBounds = [y.min!, y.max!];
  const a = fm.size ? stats[fm.size] : undefined;
  if (a && Number.isFinite(a.min) && Number.isFinite(a.max)) patch.acreBounds = [a.min!, a.max!];
  useStore.setState({ ...patch, anim: s.anim });
}

let ranked = false;
export const resetRanking = () => {
  ranked = false;
};

const rank = (counts: Record<string, number>, vals: string[]) =>
  [...vals].sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0) || a.localeCompare(b));

/**
 * Sample features from loaded tiles (no Parquet): discover fields/categories/ranges.
 * Order of causes is fixed by the first non-empty sample so colors stay stable afterward.
 */
export function sampleTiles(map: maplibregl.Map) {
  const st = useStore.getState();
  const meta = st.meta;
  if (!meta) return;
  const feats = map.querySourceFeatures("fod", { sourceLayer: meta.layerId });
  if (!feats.length) return;

  let fm = meta.fieldMap;
  if (!Object.keys(meta.fields).length) {
    const names = Object.keys(feats[0].properties ?? {});
    fm = resolveFields(names);
    useStore.setState({
      meta: { ...meta, fields: Object.fromEntries(names.map((n) => [n, "?"])), fieldMap: fm },
    });
  }

  const seen = new Set<string>();
  const tally = { general: {} as Record<string, number>, specific: {} as Record<string, number> };
  const sets = { sizeClass: new Set<string>(), state: new Set<string>(), general: new Set<string>(), specific: new Set<string>() };
  const pairs: Record<string, Set<string>> = {};
  let ymin = Infinity, ymax = -Infinity, amin = Infinity, amax = -Infinity;

  for (const f of feats) {
    const p = f.properties ?? {};
    const g = f.geometry as Point;
    const key = fm.id && p[fm.id] != null ? String(p[fm.id]) : `${g.coordinates?.join(",")}|${p[fm.year ?? ""]}|${p[fm.doy ?? ""]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const gen = fm.general ? asStr(p[fm.general]) : "";
    const spec = fm.specific ? asStr(p[fm.specific]) : "";
    if (gen) {
      tally.general[gen] = (tally.general[gen] ?? 0) + 1;
      sets.general.add(gen);
    }
    if (spec) {
      tally.specific[spec] = (tally.specific[spec] ?? 0) + 1;
      sets.specific.add(spec);
      if (gen) (pairs[spec] ??= new Set()).add(gen);
    }
    if (fm.sizeClass && p[fm.sizeClass] != null) sets.sizeClass.add(asStr(p[fm.sizeClass]));
    if (fm.state && p[fm.state] != null) sets.state.add(asStr(p[fm.state]));
    const y = fm.year ? Number(p[fm.year]) : NaN;
    if (Number.isFinite(y)) (ymin = Math.min(ymin, y)), (ymax = Math.max(ymax, y));
    const a = fm.size ? Number(p[fm.size]) : NaN;
    if (Number.isFinite(a)) (amin = Math.min(amin, a)), (amax = Math.max(amax, a));
  }

  const prev = st.categories;
  const merge = (old: string[], add: Set<string>, counts?: Record<string, number>) => {
    const all = new Set([...old, ...add]);
    if (!counts) return sortAlpha([...all]);
    if (!ranked) return rank(counts, [...all]);
    return [...old, ...[...all].filter((v) => !old.includes(v)).sort()]; // keep order stable, append new
  };
  const mergedPairs: Record<string, string[]> = { ...prev.pairs };
  for (const [k, v] of Object.entries(pairs)) mergedPairs[k] = [...new Set([...(mergedPairs[k] ?? []), ...v])];

  const categories: Categories = {
    general: merge(prev.general, sets.general, tally.general),
    specific: merge(prev.specific, sets.specific, tally.specific),
    sizeClass: sortAlpha([...new Set([...prev.sizeClass, ...sets.sizeClass])]),
    state: sortAlpha([...new Set([...prev.state, ...sets.state])]),
    pairs: mergedPairs,
    counts: tally,
  };
  if (sets.general.size || sets.specific.size) ranked = true;

  const patch: Partial<ReturnType<typeof useStore.getState>> = { categories };
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
