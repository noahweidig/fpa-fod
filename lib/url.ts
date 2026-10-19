import { areaToStr, strToArea } from "./area";
import type { AppState } from "./store";
import { BASEMAP_IDS } from "./basemaps";
import type { Basemap, CatDim, ColorMode, Filters, RadiusMode } from "./types";
import { CAT_DIMS, COLOR_MODES, emptyFilters, emptyPicks } from "./types";

const enc = (a: string[]) => a.map(encodeURIComponent).join(",");
const dec = (s: string) => (s ? s.split(",").map(decodeURIComponent) : []);
const pair = (s?: string): [number, number] | null => {
  const m = s?.match(/^(-?\d+(?:\.\d+)?)_(-?\d+(?:\.\d+)?)$/);
  return m ? [Number(m[1]), Number(m[2])] : null;
};
const picksToStr = (p: Record<string, number> | null) =>
  p ? Object.entries(p).map(([k, v]) => `${v}~${encodeURIComponent(k)}`).join(",") : "";
const strToPicks = (s?: string) => {
  if (!s) return null;
  const o: Record<string, number> = {};
  for (const part of s.split(",")) {
    const i = part.indexOf("~");
    if (i > 0) o[decodeURIComponent(part.slice(i + 1))] = Number(part.slice(0, i));
  }
  return Object.keys(o).length ? o : null;
};

const RADIUS: RadiusMode[] = ["fixed", "zoom", "size"];
/** short query keys */
const FKEY: Record<CatDim, string> = {
  general: "gc", classification: "cl", ageCat: "ag", owner: "ow", agency: "ae", sourceType: "sy", sizeClass: "sz", state: "st", county: "co",
};

type UrlKeys = Pick<
  AppState,
  "filters" | "legend" | "colorMode" | "picks" | "radiusMode" | "heat" | "heatWeight" | "basemap" | "viewport" | "chartExtent" | "area" | "mtbsLayer"
>;

export function serialize(s: UrlKeys): string {
  const q: string[] = [];
  const add = (k: string, v: string) => v !== "" && q.push(`${k}=${v}`);
  const f = s.filters;
  if (f.year) add("y", `${f.year[0]}_${f.year[1]}`);
  if (f.doy) add("d", `${f.doy[0]}_${f.doy[1]}`);
  if (f.acres) add("ac", `${f.acres[0]}_${f.acres[1]}`);
  for (const d of CAT_DIMS) add(FKEY[d], enc(f.cats[d] ?? []));
  if (s.colorMode !== "general") add("cm", s.colorMode);
  if (s.legend.isolate) add("lg", encodeURIComponent(s.legend.isolate));
  add("hx", enc(s.legend.hidden));
  for (const d of CAT_DIMS) add(`p${FKEY[d]}`, picksToStr(s.picks[d]));
  if (s.radiusMode !== "zoom") add("rm", s.radiusMode);
  if (s.heat) add("heat", s.heatWeight === "size" ? "size" : "1");
  if (s.basemap !== "light") add("bm", s.basemap);
  if (s.chartExtent) add("ce", "1");
  if (s.mtbsLayer) add("ml", "1");
  if (f.mtbs) add("mt", f.mtbs.ids ? enc(f.mtbs.ids) : "1");
  if (s.area) {
    const a = areaToStr(s.area);
    if (a.length <= 4000) add("ar", a);
  }
  if (s.viewport) add("v", `${s.viewport.lng.toFixed(4)}_${s.viewport.lat.toFixed(4)}_${s.viewport.zoom.toFixed(2)}`);
  return q.join("&");
}

export function parse(search: string): Partial<UrlKeys> {
  const m = new Map<string, string>();
  for (const part of search.replace(/^\?/, "").split("&")) {
    const i = part.indexOf("=");
    if (i > 0) m.set(part.slice(0, i), part.slice(i + 1));
  }
  const filters: Filters = { ...emptyFilters(), year: pair(m.get("y")), doy: pair(m.get("d")), acres: pair(m.get("ac")), cats: {}, mtbs: null };
  const mt = m.get("mt");
  if (mt) filters.mtbs = { ids: mt === "1" ? null : dec(mt) };
  const picks = emptyPicks();
  for (const d of CAT_DIMS) {
    const v = dec(m.get(FKEY[d]) ?? "");
    if (v.length) filters.cats[d] = v;
    picks[d] = strToPicks(m.get(`p${FKEY[d]}`));
  }
  const out: Partial<UrlKeys> = { filters, picks };
  const cm = m.get("cm") as ColorMode;
  if (COLOR_MODES.includes(cm)) out.colorMode = cm;
  out.legend = { isolate: m.get("lg") ? decodeURIComponent(m.get("lg")!) : null, hidden: dec(m.get("hx") ?? "") };
  const rm = m.get("rm") as RadiusMode;
  if (RADIUS.includes(rm)) out.radiusMode = rm;
  if (m.has("heat")) {
    out.heat = true;
    out.heatWeight = m.get("heat") === "size" ? "size" : "count";
  }
  const bm = m.get("bm") as Basemap;
  if (BASEMAP_IDS.includes(bm)) out.basemap = bm;
  out.chartExtent = m.get("ce") === "1";
  out.mtbsLayer = m.get("ml") === "1";
  const ar = strToArea(m.get("ar"));
  if (ar) {
    out.area = ar;
  }
  const v = m.get("v")?.split("_").map(Number);
  if (v && v.length === 3 && v.every(Number.isFinite)) out.viewport = { lng: v[0], lat: v[1], zoom: v[2] };
  return out;
}
