import { create } from "zustand";
import type {
  Basemap, CatDim, Categories, ColorMode, Filters, LegendSel, RadiusMode, Theme, TileMeta,
} from "./types";
import { emptyCategories, emptyFilters, emptyPicks } from "./types";

export interface Viewport {
  lng: number;
  lat: number;
  zoom: number;
}

export type ParquetStatus = "off" | "loading" | "ready" | "error";
export type Tab = "style" | "filters" | "charts" | "export";

export interface AnimState {
  /** null = animation inactive */
  year: number | null;
  playing: boolean;
  /** years per second */
  speed: number;
  cumulative: boolean;
}

export interface AppState {
  meta: TileMeta | null;
  metaError: string | null;
  categories: Categories;
  yearBounds: [number, number] | null;
  acreBounds: [number, number] | null;

  filters: Filters;
  legend: LegendSel;
  colorMode: ColorMode;
  /** user-chosen colored values per categorical view: value -> palette slot (null = most frequent) */
  picks: Record<CatDim, Record<string, number> | null>;
  radiusMode: RadiusMode;
  heat: boolean;
  heatWeight: "count" | "size";
  basemap: Basemap;
  theme: Theme;
  viewport: Viewport | null;
  bounds: [number, number, number, number] | null;
  /** bumped when rendered tiles settle (approximate counts re-run) */
  tileSeq: number;
  stats: { total: number | null; exact: boolean; loading: boolean; legendCounts: Record<string, number> };
  chartExtent: boolean;
  anim: AnimState;

  parquet: { status: ParquetStatus; message?: string; rows?: number };
  /** debounced snapshot used for counts/charts/exports */
  applied: { filters: Filters; legend: LegendSel; seq: number };

  tab: Tab;
  drawer: boolean;
  zoom: number;

  set: (p: Partial<AppState>) => void;
  patchFilters: (p: Partial<Filters>) => void;
  resetFilters: () => void;
}

export const useStore = create<AppState>((set) => ({
  meta: null,
  metaError: null,
  categories: emptyCategories(),
  yearBounds: null,
  acreBounds: null,

  filters: emptyFilters(),
  legend: { isolate: null, hidden: [] },
  colorMode: "general",
  picks: emptyPicks(),
  radiusMode: "zoom",
  heat: false,
  heatWeight: "count",
  basemap: "light",
  theme: "light",
  viewport: null,
  bounds: null,
  tileSeq: 0,
  stats: { total: null, exact: false, loading: false, legendCounts: {} },
  chartExtent: false,
  anim: { year: null, playing: false, speed: 2, cumulative: false },

  parquet: { status: "off" },
  applied: { filters: emptyFilters(), legend: { isolate: null, hidden: [] }, seq: 0 },

  tab: "style",
  drawer: false,
  zoom: 3,

  set: (p) => set(p),
  patchFilters: (p) => set((s) => ({ filters: { ...s.filters, ...p } })),
  resetFilters: () =>
    set({ filters: emptyFilters(), legend: { isolate: null, hidden: [] }, anim: { ...useStore.getState().anim, year: null, playing: false } }),
}));

/** Filters with the year animation applied. */
export function effectiveFilters(f: Filters, anim: AnimState): Filters {
  if (anim.year == null) return f;
  const start = anim.cumulative ? (f.year?.[0] ?? -Infinity) : anim.year;
  return { ...f, year: [Math.max(start, -9999), anim.year] };
}
