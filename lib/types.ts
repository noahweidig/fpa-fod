export type ColorMode = "general" | "specific" | "year" | "sizeClass" | "month";
export type RadiusMode = "fixed" | "zoom" | "size";
export type Basemap = "light" | "dark" | "satellite";
export type Theme = "light" | "dark";
export type DimId = "general" | "specific" | "sizeClass" | "month" | "year" | "state";

export interface Filters {
  year: [number, number] | null;
  doy: [number, number] | null;
  general: string[];
  specific: string[];
  sizeClass: string[];
  acres: [number, number] | null;
  state: string[];
}

export interface LegendSel {
  isolate: string | null;
  hidden: string[];
}

export const OTHER = "__other__";

export interface FieldMap {
  year?: string;
  doy?: string;
  general?: string;
  specific?: string;
  size?: string;
  sizeClass?: string;
  state?: string;
  id?: string;
}

export interface AttrStats {
  min?: number;
  max?: number;
  values?: (string | number)[];
}

export interface TileMeta {
  url: string;
  layerId: string;
  layerFound: boolean;
  fields: Record<string, string>;
  fieldMap: FieldMap;
  stats: Record<string, AttrStats>;
  minzoom: number;
  maxzoom: number;
  bounds: [number, number, number, number] | null;
  name?: string;
  description?: string;
}

export interface Categories {
  general: string[];
  specific: string[];
  sizeClass: string[];
  state: string[];
  /** specific cause -> general causes seen with it */
  pairs: Record<string, string[]>;
  /** counts used for ranking (exact with Parquet, sampled otherwise) */
  counts: { general: Record<string, number>; specific: Record<string, number> };
}

export const emptyFilters = (): Filters => ({
  year: null,
  doy: null,
  general: [],
  specific: [],
  sizeClass: [],
  acres: null,
  state: [],
});

export const emptyCategories = (): Categories => ({
  general: [],
  specific: [],
  sizeClass: [],
  state: [],
  pairs: {},
  counts: { general: {}, specific: {} },
});
