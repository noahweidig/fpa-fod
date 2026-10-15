// Single place for data locations and tile facts. Swap URLs here (or via env) when moving to a custom domain.
// The files are public and read-only: the app never needs R2 credentials.
export const PMTILES_URL = process.env.NEXT_PUBLIC_FOD_PMTILES_URL ?? "";
export const PARQUET_URL = process.env.NEXT_PUBLIC_FOD_PARQUET_URL ?? "";

export const PREFERRED_LAYER = "fod";
/** Tiles hold data to z12; the map may zoom further (overzoom). */
export const SOURCE_MAXZOOM = 12;
export const MAP_MAXZOOM = 16;
/** Continental U.S. start view. PMTiles bounds/center are deliberately ignored (they wrap the antimeridian). */
export const START_VIEW = { lng: -98, lat: 39, zoom: 3.5 };
export const REGIONS: { id: string; label: string; lng: number; lat: number; zoom: number }[] = [
  { id: "conus", label: "Lower 48", ...START_VIEW },
  { id: "ak", label: "Alaska", lng: -152, lat: 64.2, zoom: 3.4 },
  { id: "hi", label: "Hawaii", lng: -157.5, lat: 20.6, zoom: 6.2 },
  { id: "pr", label: "Puerto Rico", lng: -66.4, lat: 18.2, zoom: 7.6 },
];
/** Below this zoom tiles are thinned (tippecanoe size limits); show the "sample" note. */
export const FULL_DETAIL_ZOOM = Number(process.env.NEXT_PUBLIC_FOD_FULL_DETAIL_ZOOM ?? 9);

export const RDS_URL = "https://www.fs.usda.gov/rds/archive/catalog/RDS-2013-0009.7";
export const CITATION_TEXT =
  "Short, Karen C. 2026. Spatial wildfire occurrence data for the United States, 1992-2024 [FPA_FOD_20260615]. 7th Edition. Fort Collins, CO: Forest Service Research Data Archive.";
export const CITATION_DOI = "https://doi.org/10.2737/RDS-2013-0009.7";
export const EXPORT_WARN_ROWS = 500_000;
