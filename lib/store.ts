import type { ImpactMetric } from "./impact";
import { create } from "zustand";
import type {
  Basemap, CatDim, Categories, ColorMode, Filters, LegendSel, RadiusMode, Theme, TileMeta,
} from "./types";
import type { Area, Pt } from "./area";
import { emptyCategories, emptyFilters, emptyPicks } from "./types";

export interface Viewport {
  lng: number;
  lat: number;
  zoom: number;
}

export type ParquetStatus = "off" | "loading" | "ready" | "error";
export type Tab = "style" | "filters" | "charts" | "analyze" | "export" | "about";

export interface AnimState {
  /** null = animation inactive */
  year: number | null;
  playing: boolean;
  /** years per second */
  speed: number;
  cumulative: boolean;
}

export interface CompareState {
  a: [number, number];
  b: [number, number];
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
  tilesLoading: boolean;
  stats: { total: number | null; exact: boolean; loading: boolean; legendCounts: Record<string, number> };
  chartExtent: boolean;
  /** user-selected region (drawn, uploaded or from a place); null = none */
  /** show MTBS perimeters */
  mtbsLayer: boolean;
  /** MTBS event_id highlighted on the map */
  mtbsHl: string | null;
  /** ICS-209-PLUS destructiveness overlay on the map */
  impact: { on: boolean; metric: ImpactMetric; min: number; members: boolean };
  area: Area | null;
  areaLabel: string | null;
  drawMode: "rect" | "poly" | "circle" | null;
  draft: Pt[];
  anim: AnimState;
  /** period compare ranges; null = defaults from the data's year bounds */
  compare: CompareState | null;

  parquet: { status: ParquetStatus; message?: string; rows?: number; ics?: boolean };
  /** debounced snapshot used for counts/charts/exports */
  applied: { filters: Filters; legend: LegendSel; area: Area | null; seq: number };

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
  tilesLoading: true,
  stats: { total: null, exact: false, loading: false, legendCounts: {} },
  chartExtent: false,
  mtbsLayer: false,
  mtbsHl: null,
  impact: { on: false, metric: "str_destroyed", min: 10, members: false },
  area: null,
  areaLabel: null,
  drawMode: null,
  draft: [],
  anim: { year: null, playing: false, speed: 2, cumulative: false },
  compare: null,

  parquet: { status: "off" },
  applied: { filters: emptyFilters(), legend: { isolate: null, hidden: [] }, area: null, seq: 0 },

  tab: "style",
  drawer: false,
  zoom: 3,

  set: (p) => set(p),
  patchFilters: (p) => set((s) => ({ filters: { ...s.filters, ...p } })),
  resetFilters: () =>
    set({ mtbsHl: null, area: null, areaLabel: null, drawMode: null, draft: [], filters: emptyFilters(), legend: { isolate: null, hidden: [] }, anim: { ...useStore.getState().anim, year: null, playing: false } }),
}));

/** Filters with the year animation applied. */
export function effectiveFilters(f: Filters, anim: AnimState): Filters {
  if (anim.year == null) return f;
  const start = anim.cumulative ? (f.year?.[0] ?? -Infinity) : anim.year;
  return { ...f, year: [Math.max(start, -9999), anim.year] };
}
