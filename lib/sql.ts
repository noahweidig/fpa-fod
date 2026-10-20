import { areaSql, type Area } from "./area";
import { MONTH_STARTS, type LegendCtx } from "./expressions";
import type { CatDim, DimId, Filters, LegendSel } from "./types";
import { CAT_DIMS, OTHER } from "./types";

/** Actual Parquet column names for each role (resolved case-insensitively at load). */
export interface Cols extends Partial<Record<CatDim, string>> {
  year?: string;
  doy?: string;
  size?: string;
  id?: string;
  name?: string;
  mtbsId?: string;
  lon?: string;
  lat?: string;
}

export const qi = (id: string) => `"${id.replace(/"/g, '""')}"`;
export const ql = (s: string) => `'${s.replace(/'/g, "''")}'`;

const num = (col: string) => `COALESCE(TRY_CAST(${qi(col)} AS DOUBLE), 0)`;

export function monthSql(doy: string) {
  const c = `TRY_CAST(${qi(doy)} AS INTEGER)`;
  let e = "CASE";
  for (let m = 11; m >= 0; m--) e += ` WHEN ${c} >= ${MONTH_STARTS[m]} THEN ${m + 1}`;
  return e + " ELSE 0 END";
}

export function dimSql(d: DimId, c: Cols): string | undefined {
  const col = d === "month" ? c.doy : d === "year" ? c.year : c[d];
  if (!col) return undefined;
  if (d === "month") return monthSql(col);
  if (d === "year") return `CAST(${num(col)} AS INTEGER)`;
  return `COALESCE(CAST(${qi(col)} AS VARCHAR), '')`;
}

const lit = (d: DimId, v: string) => (d === "month" ? String(Number(v)) : ql(v));
const list = (d: DimId, vals: string[]) => vals.map((v) => lit(d, v)).join(", ");

export function whereClauses(
  f: Filters,
  legend: LegendSel | null,
  ctx: LegendCtx | null,
  c: Cols,
  extent: [number, number, number, number] | null,
  area: Area | null = null,
  areaExpr?: string,
): string[] {
  const w: string[] = [];
  const between = (e: string, r: [number, number]) => w.push(`${e} BETWEEN ${r[0]} AND ${r[1]}`);
  if (f.year && c.year) between(num(c.year), f.year);
  if (f.doy && c.doy) between(num(c.doy), f.doy);
  if (f.acres && c.size) between(num(c.size), f.acres);
  const inList = (d: DimId, vals: string[]) => {
    const e = dimSql(d, c);
    if (e && vals.length) w.push(`${e} IN (${list(d, vals)})`);
  };
  for (const d of CAT_DIMS) inList(d, f.cats[d] ?? []);

  if (legend && ctx?.dim && (legend.isolate || legend.hidden.length)) {
    const e = dimSql(ctx.dim, c);
    if (e) {
      if (legend.isolate) {
        w.push(legend.isolate === OTHER ? `${e} NOT IN (${list(ctx.dim, ctx.colored) || "NULL"})` : `${e} = ${lit(ctx.dim, legend.isolate)}`);
      }
      const hid = legend.hidden.filter((v) => v !== OTHER);
      if (hid.length) w.push(`${e} NOT IN (${list(ctx.dim, hid)})`);
      if (legend.hidden.includes(OTHER)) w.push(`${e} IN (${list(ctx.dim, ctx.colored) || "NULL"})`);
    }
  }
  if (extent && c.lon && c.lat) {
    w.push(`${qi(c.lon)} BETWEEN ${extent[0]} AND ${extent[2]}`, `${qi(c.lat)} BETWEEN ${extent[1]} AND ${extent[3]}`);
  }
  if (f.mtbs && c.mtbsId) {
    const m = `NULLIF(TRIM(CAST(${qi(c.mtbsId)} AS VARCHAR)), '')`;
    w.push(f.mtbs.ids ? `${m} IN (${f.mtbs.ids.map(ql).join(", ") || "NULL"})` : `${m} IS NOT NULL`);
  }
  if (f.incident?.length && c.id) {
    w.push(
      `TRY_CAST(${qi(c.id)} AS BIGINT) IN (SELECT fod_id FROM ics_link WHERE kind = 'fod' AND incident_id IN ` +
        `(SELECT incident_id FROM ics_inc WHERE root_id IN (${f.incident.map(ql).join(", ")})))`,
    );
  }
  if (area?.length && c.lon && c.lat) w.push(areaExpr ?? areaSql(area, qi(c.lon), qi(c.lat)));
  return w;
}

export const whereSql = (w: string[]) => (w.length ? "WHERE " + w.join(" AND ") : "");
