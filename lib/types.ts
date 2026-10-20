/** Categorical dimensions (each maps to one tile field, resolved from metadata). */
export type CatDim =
  | "general" | "classification" | "ageCat" | "owner" | "agency" | "sourceType" | "sizeClass" | "state" | "county";
export type DimId = CatDim | "month" | "year";
export type ColorMode = Exclude<CatDim, "state" | "county"> | "year" | "month";
export type RadiusMode = "fixed" | "zoom" | "size";
export type Basemap = "light" | "dark" | "liberty" | "bright" | "topo" | "satellite" | "hybrid" | "relief";
export type Theme = "light" | "dark";

export const CAT_DIMS: CatDim[] = [
  "general", "classification", "ageCat", "owner", "agency", "sourceType", "sizeClass", "state", "county",
];

export const DIM_LABEL: Record<DimId, string> = {
  general: "General cause",
  classification: "Cause classification",
  ageCat: "Cause age category",
  owner: "Land owner",
  agency: "Reporting agency",
  sourceType: "Source system type",
  sizeClass: "Fire size class",
  state: "State",
  county: "County",
  month: "Discovery month",
  year: "Fire year",
};

export const COLOR_MODES: ColorMode[] = [
  "general", "classification", "ageCat", "owner", "agency", "sourceType", "sizeClass", "year", "month",
];

export interface Filters {
  year: [number, number] | null;
  doy: [number, number] | null;
  acres: [number, number] | null;
  cats: Partial<Record<CatDim, string[]>>;
  /** null = off; {ids:null} = any ignition linked to an MTBS perimeter; {ids:[...]} = linked to these events */
  mtbs: { ids: string[] | null } | null;
  /** ICS-209-PLUS root incident ids: only ignitions linked to these incidents (or to their complex members) */
  incident: string[] | null;
}

export interface LegendSel {
  isolate: string | null;
  hidden: string[];
}

export const OTHER = "__other__";

export interface FieldMap extends Partial<Record<CatDim, string>> {
  year?: string;
  doy?: string;
  size?: string;
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
  name?: string;
  description?: string;
}

export interface Categories {
  values: Record<CatDim, string[]>;
  /** counts used for ranking (exact with Parquet, sampled otherwise) */
  counts: Record<CatDim, Record<string, number>>;
  /** general cause -> classifications seen with it (narrows the cause list) */
  pairs: Record<string, string[]>;
}

const emptyDimMap = <T,>(f: () => T) => Object.fromEntries(CAT_DIMS.map((d) => [d, f()])) as Record<CatDim, T>;

export const emptyFilters = (): Filters => ({ year: null, doy: null, acres: null, cats: {}, mtbs: null, incident: null });
export const emptyCategories = (): Categories => ({
  values: emptyDimMap(() => []),
  counts: emptyDimMap(() => ({})),
  pairs: {},
});
export const emptyPicks = () => emptyDimMap<Record<string, number> | null>(() => null);
