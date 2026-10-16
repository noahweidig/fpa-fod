import type { Feature, Point } from "geojson";
import { areaSql, type Area } from "./area";
import { fullFilter, MONTH_STARTS, type LegendCtx } from "./expressions";
import type { DuckHandle } from "./duck";
import { getMap } from "./mapInstance";
import { dimSql, qi, ql, whereClauses, whereSql } from "./sql";
import { useStore } from "./store";
import { emptyFilters, type DimId, type FieldMap, type Filters, type LegendSel } from "./types";

export type Extent = [number, number, number, number];

export interface Query {
  filters: Filters;
  legend: LegendSel | null;
  legendCtx: LegendCtx | null;
  /** [west, south, east, north]; null = whole dataset (exact backend only) */
  extent: Extent | null;
  /** exact backend only */
  area?: Area | null;
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

  private areaKey = "";
  private job: Promise<void> = Promise.resolve();

  /** Flag rows inside the area once per area (table builds only); later queries just read the column. */
  private async prepare(area: Area | null | undefined): Promise<string | undefined> {
    const c = this.h.cols;
    if (!area?.length || !c.lon || !c.lat || !this.h.materialized) return undefined;
    const key = JSON.stringify(area);
    this.job = this.job.then(async () => {
      if (this.areaKey === key) return;
      await this.h.conn.query(`ALTER TABLE fod ADD COLUMN IF NOT EXISTS in_area BOOLEAN`);
      await this.h.conn.query(`UPDATE fod SET in_area = COALESCE(${areaSql(area, qi(c.lon!), qi(c.lat!))}, FALSE)`);
      this.areaKey = key;
    });
    await this.job;
    return this.areaKey === key ? "in_area" : undefined;
  }

  private async where(q: Query) {
    const areaExpr = await this.prepare(q.area);
    return whereSql(whereClauses(q.filters, q.legend, q.legendCtx, this.h.cols, q.extent, q.area ?? null, areaExpr));
  }

  /** MTBS_ID/name for a FOD record, if linked. */
  async mtbsFor(fodId: string | number): Promise<string | null> {
    const c = this.h.cols;
    if (!c.mtbsId || !c.id) return null;
    const t = await this.h.conn.query(
      `SELECT NULLIF(TRIM(CAST(${qi(c.mtbsId)} AS VARCHAR)), '') AS m FROM fod WHERE CAST(${qi(c.id)} AS VARCHAR) = ${ql(String(fodId))} LIMIT 1`,
    );
    const r = t.toArray()[0] as { toJSON(): Record<string, unknown> } | undefined;
    const m = r?.toJSON().m;
    return m ? String(m) : null;
  }

  /** FOD ignitions linked to one MTBS event. */
  async mtbsLinked(eventId: string): Promise<{ n: number; acres: number }> {
    const c = this.h.cols;
    if (!c.mtbsId) return { n: 0, acres: 0 };
    const sz = c.size ? `COALESCE(TRY_CAST(${qi(c.size)} AS DOUBLE), 0)` : "0";
    const t = await this.h.conn.query(
      `SELECT COUNT(*) AS n, SUM(${sz}) AS a FROM fod WHERE NULLIF(TRIM(CAST(${qi(c.mtbsId)} AS VARCHAR)), '') = ${ql(eventId)}`,
    );
    const o = (t.toArray()[0] as { toJSON(): Record<string, unknown> }).toJSON();
    return { n: Number(o.n), acres: Number(o.a) || 0 };
  }

  /** FOD_IDs matching the MTBS filter (for the map filter), capped. */
  async mtbsFodIds(f: Filters["mtbs"]): Promise<(string | number)[]> {
    const c = this.h.cols;
    if (!f || !c.mtbsId || !c.id) return [];
    const w = whereSql(whereClauses({ ...emptyFilters(), mtbs: f }, null, null, c, null));
    const t = await this.h.conn.query(`SELECT ${qi(c.id)} AS i FROM fod ${w} LIMIT 60000`);
    return t.toArray().map((r: unknown) => {
      const v = (r as { toJSON(): Record<string, unknown> }).toJSON().i;
      return typeof v === "bigint" ? Number(v) : (v as number | string);
    });
  }

  async mtbsLinkedCount(): Promise<number> {
    const c = this.h.cols;
    if (!c.mtbsId) return 0;
    const t = await this.h.conn.query(`SELECT COUNT(*) AS n FROM fod WHERE NULLIF(TRIM(CAST(${qi(c.mtbsId)} AS VARCHAR)), '') IS NOT NULL`);
    return Number((t.toArray()[0] as { toJSON(): Record<string, unknown> }).toJSON().n);
  }

  async summary(q: Query): Promise<{ n: number; acres: number; maxAcres: number; years: [number, number] | null }> {
    const c = this.h.cols;
    const where = await this.where(q);
    const sz = c.size ? `TRY_CAST(${qi(c.size)} AS DOUBLE)` : "NULL";
    const yr = c.year ? `TRY_CAST(${qi(c.year)} AS INTEGER)` : "NULL";
    const t = await this.h.conn.query(`SELECT COUNT(*) AS n, SUM(${sz}) AS a, MAX(${sz}) AS m, MIN(${yr}) AS y0, MAX(${yr}) AS y1 FROM fod ${where}`);
    const o = (t.toArray()[0] as { toJSON(): Record<string, unknown> }).toJSON();
    return {
      n: Number(o.n), acres: Number(o.a) || 0, maxAcres: Number(o.m) || 0,
      years: o.y0 != null && o.y1 != null ? [Number(o.y0), Number(o.y1)] : null,
    };
  }

  async group(dims: DimId[], q: Query): Promise<GroupRow[]> {
    const c = this.h.cols;
    const exprs = dims.map((d) => dimSql(d, c));
    if (exprs.some((e) => !e)) return [];
    const where = await this.where(q);
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
