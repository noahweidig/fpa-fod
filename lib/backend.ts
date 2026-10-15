import type { Feature, Point } from "geojson";
import { fullFilter, MONTH_STARTS, type LegendCtx } from "./expressions";
import type { DuckHandle } from "./duck";
import { getMap } from "./mapInstance";
import { dimSql, whereClauses, whereSql } from "./sql";
import { useStore } from "./store";
import type { DimId, FieldMap, Filters, LegendSel } from "./types";

export type Extent = [number, number, number, number];

export interface Query {
  filters: Filters;
  legend: LegendSel | null;
  legendCtx: LegendCtx | null;
  /** [west, south, east, north]; null = whole dataset (exact backend only) */
  extent: Extent | null;
}

export interface GroupRow {
  keys: (string | number)[];
  n: number;
}

export interface Backend {
  kind: "exact" | "approx";
  group(dims: DimId[], q: Query): Promise<GroupRow[]>;
}

/* ---------------- tile (approximate) ---------------- */

export const monthOf = (doy: number) => {
  if (!(doy >= 1)) return 0;
  let m = 1;
  for (let i = 1; i < 12; i++) if (doy >= MONTH_STARTS[i]) m = i + 1;
  return m;
};

type Props = Record<string, unknown>;

function valueOf(d: DimId, p: Props, fm: FieldMap): string | number {
  if (d === "year") return fm.year ? Number(p[fm.year]) || 0 : 0;
  if (d === "month") return fm.doy ? monthOf(Number(p[fm.doy])) : 0;
  const f = fm[d];
  return f ? String(p[f] ?? "") : "";
}

export class TileBackend implements Backend {
  kind = "approx" as const;
  private cache = new Map<string, Feature<Point>[]>();

  /** Deduplicated features currently rendered (viewport), matching the filters. */
  features(q: Query): Feature<Point>[] {
    const map = getMap();
    const meta = useStore.getState().meta;
    if (!map || !meta || !map.getLayer("fod-query")) return [];
    const filter = fullFilter(q.filters, q.legend, q.legendCtx, meta.fieldMap);
    const key = JSON.stringify(filter) + map.getBounds().toString() + map.getZoom().toFixed(2) + useStore.getState().tileSeq;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const raw = map.queryRenderedFeatures(undefined, {
      layers: ["fod-query"],
      ...(filter ? { filter: filter as never } : {}),
    });
    const fm = meta.fieldMap;
    const seen = new Set<string>();
    const out: Feature<Point>[] = [];
    for (const f of raw) {
      const p = (f.properties ?? {}) as Props;
      const g = f.geometry as Point;
      const k = fm.id && p[fm.id] != null ? `id:${p[fm.id]}` : `${g.coordinates.join(",")}|${fm.year ? p[fm.year] : ""}|${fm.doy ? p[fm.doy] : ""}|${fm.size ? p[fm.size] : ""}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ type: "Feature", geometry: { type: "Point", coordinates: g.coordinates }, properties: p });
    }
    if (this.cache.size >= 3) this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(key, out);
    return out;
  }

  async group(dims: DimId[], q: Query): Promise<GroupRow[]> {
    const fm = useStore.getState().meta?.fieldMap;
    if (!fm) return [];
    const acc = new Map<string, GroupRow>();
    for (const f of this.features(q)) {
      const keys = dims.map((d) => valueOf(d, f.properties as Props, fm));
      const k = keys.join("\u0001");
      const row = acc.get(k);
      if (row) row.n++;
      else acc.set(k, { keys, n: 1 });
    }
    return [...acc.values()];
  }
}

/* ---------------- DuckDB (exact) ---------------- */

export class DuckBackend implements Backend {
  kind = "exact" as const;
  constructor(public h: DuckHandle) {}

  async group(dims: DimId[], q: Query): Promise<GroupRow[]> {
    const c = this.h.cols;
    const exprs = dims.map((d) => dimSql(d, c));
    if (exprs.some((e) => !e)) return [];
    const where = whereSql(whereClauses(q.filters, q.legend, q.legendCtx, c, q.extent));
    const sel = exprs.map((e, i) => `${e} AS d${i}`).join(", ");
    const sql = `SELECT ${sel ? sel + "," : ""} COUNT(*) AS n FROM fod ${where} ${dims.length ? "GROUP BY ALL" : ""}`;
    const t = await this.h.conn.query(sql);
    return t.toArray().map((r: Record<string, unknown>) => {
      const o = (r as { toJSON(): Record<string, unknown> }).toJSON();
      return { keys: dims.map((d, i) => (d === "year" || d === "month" ? Number(o[`d${i}`]) : String(o[`d${i}`] ?? ""))), n: Number(o.n) };
    });
  }
}

/* ---------------- selection ---------------- */

const tile = new TileBackend();
let duck: DuckBackend | null = null;
export const setDuckHandle = (h: DuckHandle | null) => {
  duck = h ? new DuckBackend(h) : null;
};
export const getDuck = () => duck;
export const getBackend = (): Backend => duck ?? tile;
export const getTileBackend = () => tile;
