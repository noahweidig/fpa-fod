// Single place for data locations and tile facts. Swap URLs here (or via env) when moving to a custom domain.
// The files are public and read-only: the app never needs R2 credentials.
/** ICS-209-PLUS incident impact and its links to FOD and MTBS (built by scripts/build-ics-link.py). Both optional. */
export const ICS_INCIDENTS_URL = process.env.NEXT_PUBLIC_ICS_INCIDENTS_URL ?? "";
export const ICS_LINKS_URL = process.env.NEXT_PUBLIC_ICS_LINKS_URL ?? "";
export const ICS_CITATION = "St. Denis, L. A., et al. 2023. All-hazards dataset mined from the US National Incident Management System 1999-2020 (ICS-209-PLUS). Scientific Data 10, 112. https://doi.org/10.6084/m9.figshare.19858927";
export const PMTILES_URL = process.env.NEXT_PUBLIC_FOD_PMTILES_URL ?? "";
export const PARQUET_URL = process.env.NEXT_PUBLIC_FOD_PARQUET_URL ?? "";

/** MTBS burned-area perimeters (layer "mtbs"); joined to FOD by MTBS_ID = event_id. */
export const MTBS_URL = process.env.NEXT_PUBLIC_MTBS_PMTILES_URL ?? "https://pub-55bcb774b88f4b619636500860a70cb0.r2.dev/mtbs.pmtiles";
export const MTBS_LAYER = "mtbs";
export const MTBS_ID_FIELD = "event_id";

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
