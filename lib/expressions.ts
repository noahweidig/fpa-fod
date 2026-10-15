import { MONTH_COLORS, OTHER_COLOR, seqRamp } from "./palette";
import type { CatDim, ColorMode, DimId, FieldMap, Filters, LegendSel, RadiusMode } from "./types";
import { CAT_DIMS, OTHER } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Expr = any;

export const MONTH_STARTS = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335]; // non-leap
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const monthExpr = (doy: string): Expr => {
  const e: Expr[] = ["step", ["to-number", ["get", doy], 0], 0, 1, 1];
  for (let m = 1; m < 12; m++) e.push(MONTH_STARTS[m], m + 1);
  return e;
};

export const dimField = (d: DimId, fm: FieldMap): string | undefined =>
  d === "month" ? fm.doy : d === "year" ? fm.year : fm[d];

export function dimExpr(d: DimId, fm: FieldMap): Expr | undefined {
  const f = dimField(d, fm);
  if (!f) return undefined;
  if (d === "month") return monthExpr(f);
  if (d === "year") return ["to-number", ["get", f], 0];
  return ["to-string", ["get", f]];
}

export const colorModeDim = (m: ColorMode): DimId | null => (m === "year" ? null : m);

const legendValue = (d: DimId, v: string) => (d === "month" ? Number(v) : v);

export interface LegendCtx {
  dim: DimId | null;
  /** values that own a color (for the "Other" bucket) */
  colored: string[];
}

export function legendFilter(sel: LegendSel | null, ctx: LegendCtx | null, fm: FieldMap): Expr | null {
  if (!sel || !ctx?.dim || (!sel.isolate && !sel.hidden.length)) return null;
  const e = dimExpr(ctx.dim, fm);
  if (!e) return null;
  const lit = (vals: string[]) => ["literal", vals.map((v) => legendValue(ctx.dim!, v))];
  const parts: Expr[] = [];
  if (sel.isolate) {
    parts.push(sel.isolate === OTHER ? ["!", ["in", e, lit(ctx.colored)]] : ["==", e, legendValue(ctx.dim, sel.isolate)]);
  }
  const hid = sel.hidden.filter((v) => v !== OTHER);
  if (hid.length) parts.push(["!", ["in", e, lit(hid)]]);
  if (sel.hidden.includes(OTHER)) parts.push(["in", e, lit(ctx.colored)]);
  return parts.length === 1 ? parts[0] : ["all", ...parts];
}

export function baseFilter(f: Filters, fm: FieldMap): Expr | null {
  const p: Expr[] = [];
  const range = (e: Expr, r: [number, number]) => ["all", [">=", e, r[0]], ["<=", e, r[1]]];
  if (f.year && fm.year) p.push(range(dimExpr("year", fm), f.year));
  if (f.doy && fm.doy) p.push(range(["to-number", ["get", fm.doy], 0], f.doy));
  if (f.acres && fm.size) p.push(range(["to-number", ["get", fm.size], 0], f.acres));
  for (const d of CAT_DIMS) {
    const vals = f.cats[d];
    const e = dimExpr(d, fm);
    if (e && vals?.length) p.push(["in", e, ["literal", vals]]);
  }
  if (!p.length) return null;
  return p.length === 1 ? p[0] : ["all", ...p];
}

export function fullFilter(f: Filters, legend: LegendSel | null, ctx: LegendCtx | null, fm: FieldMap): Expr | undefined {
  const parts = [baseFilter(f, fm), legendFilter(legend, ctx, fm)].filter(Boolean);
  if (!parts.length) return undefined;
  return parts.length === 1 ? parts[0] : ["all", ...parts];
}

/* ---------- paint ---------- */

export interface ColorCtx {
  mode: ColorMode;
  fm: FieldMap;
  colors: Map<string, string>;
  yearRange: [number, number];
  dark: boolean;
}

export function colorExpr(c: ColorCtx): Expr {
  const { fm } = c;
  if (c.mode === "year") {
    if (!fm.year) return OTHER_COLOR;
    const [a, b] = c.yearRange;
    const r = seqRamp(5, c.dark);
    const e: Expr[] = ["interpolate", ["linear"], dimExpr("year", fm)];
    r.forEach((col, i) => e.push(a + ((b - a) * i) / 4, col));
    return b > a ? e : r[2];
  }
  if (c.mode === "month") {
    if (!fm.doy) return OTHER_COLOR;
    const e: Expr[] = ["match", monthExpr(fm.doy)];
    MONTH_COLORS.forEach((col, i) => e.push(i + 1, col));
    e.push(OTHER_COLOR);
    return e;
  }
  const field = fm[c.mode as CatDim];
  if (!field) return OTHER_COLOR;
  const entries = [...c.colors.entries()].filter(([k]) => k !== OTHER);
  if (!entries.length) return OTHER_COLOR;
  const e: Expr[] = ["match", ["to-string", ["get", field]]];
  for (const [k, col] of entries) e.push(k, col);
  e.push(OTHER_COLOR);
  return e;
}

export function radiusExpr(mode: RadiusMode, fm: FieldMap): Expr {
  if (mode === "fixed") return 3;
  const zoomScale = (k: number): Expr => [
    "interpolate", ["linear"], ["zoom"], 2, 1 * k, 6, 2 * k, 10, 3.5 * k, 14, 7 * k,
  ];
  if (mode === "zoom" || !fm.size) return zoomScale(1);
  const s: Expr = ["sqrt", ["max", 0, ["to-number", ["get", fm.size], 0]]];
  const at = (base: number, k: number, cap: number): Expr => ["min", cap, ["+", base, ["*", k, s]]];
  return [
    "interpolate", ["linear"], ["zoom"],
    2, at(1, 0.03, 6), 6, at(1.5, 0.08, 12), 10, at(2.5, 0.15, 22), 14, at(4, 0.3, 40),
  ];
}

export function heatWeightExpr(weight: "count" | "size", fm: FieldMap): Expr {
  if (weight === "count" || !fm.size) return 1;
  return ["interpolate", ["linear"], ["sqrt", ["max", 0, ["to-number", ["get", fm.size], 0]]], 0, 0.2, 30, 1];
}
