import type { AppState } from "./store";
import type { Basemap, ColorMode, Filters, RadiusMode } from "./types";
import { emptyFilters } from "./types";

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

const COLOR_MODES: ColorMode[] = ["general", "specific", "year", "sizeClass", "month"];
const RADIUS: RadiusMode[] = ["fixed", "zoom", "size"];
const BASEMAPS: Basemap[] = ["light", "dark", "satellite"];

type UrlKeys = Pick<
  AppState,
  "filters" | "legend" | "colorMode" | "picks" | "radiusMode" | "heat" | "heatWeight" | "basemap" | "viewport" | "chartExtent"
>;

export function serialize(s: UrlKeys): string {
  const q: string[] = [];
  const add = (k: string, v: string) => v !== "" && q.push(`${k}=${v}`);
  const f = s.filters;
  if (f.year) add("y", `${f.year[0]}_${f.year[1]}`);
  if (f.doy) add("d", `${f.doy[0]}_${f.doy[1]}`);
  if (f.acres) add("ac", `${f.acres[0]}_${f.acres[1]}`);
  add("gc", enc(f.general));
  add("sc", enc(f.specific));
  add("sz", enc(f.sizeClass));
  add("st", enc(f.state));
  if (s.colorMode !== "general") add("cm", s.colorMode);
  if (s.legend.isolate) add("lg", encodeURIComponent(s.legend.isolate));
  add("hx", enc(s.legend.hidden));
  add("pg", picksToStr(s.picks.general));
  add("ps", picksToStr(s.picks.specific));
  if (s.radiusMode !== "zoom") add("rm", s.radiusMode);
  if (s.heat) add("heat", s.heatWeight === "size" ? "size" : "1");
  if (s.basemap !== "light") add("bm", s.basemap);
  if (s.chartExtent) add("ce", "1");
  if (s.viewport) add("v", `${s.viewport.lng.toFixed(4)}_${s.viewport.lat.toFixed(4)}_${s.viewport.zoom.toFixed(2)}`);
  return q.join("&");
}

export function parse(search: string): Partial<UrlKeys> {
  const m = new Map<string, string>();
  for (const part of search.replace(/^\?/, "").split("&")) {
    const i = part.indexOf("=");
    if (i > 0) m.set(part.slice(0, i), part.slice(i + 1));
  }
  const filters: Filters = {
    ...emptyFilters(),
    year: pair(m.get("y")),
    doy: pair(m.get("d")),
    acres: pair(m.get("ac")),
    general: dec(m.get("gc") ?? ""),
    specific: dec(m.get("sc") ?? ""),
    sizeClass: dec(m.get("sz") ?? ""),
    state: dec(m.get("st") ?? ""),
  };
  const out: Partial<UrlKeys> = { filters };
  const cm = m.get("cm") as ColorMode;
  if (COLOR_MODES.includes(cm)) out.colorMode = cm;
  out.legend = {
    isolate: m.get("lg") ? decodeURIComponent(m.get("lg")!) : null,
    hidden: dec(m.get("hx") ?? ""),
  };
  out.picks = { general: strToPicks(m.get("pg")), specific: strToPicks(m.get("ps")) };
  const rm = m.get("rm") as RadiusMode;
  if (RADIUS.includes(rm)) out.radiusMode = rm;
  if (m.has("heat")) {
    out.heat = true;
    out.heatWeight = m.get("heat") === "size" ? "size" : "count";
  }
  const bm = m.get("bm") as Basemap;
  if (BASEMAPS.includes(bm)) out.basemap = bm;
  out.chartExtent = m.get("ce") === "1";
  const v = m.get("v")?.split("_").map(Number);
  if (v && v.length === 3 && v.every(Number.isFinite)) out.viewport = { lng: v[0], lat: v[1], zoom: v[2] };
  return out;
}
