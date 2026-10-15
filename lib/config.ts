export const PMTILES_URL = process.env.NEXT_PUBLIC_FOD_PMTILES_URL ?? "";
export const PARQUET_URL = process.env.NEXT_PUBLIC_FOD_PARQUET_URL ?? "";
export const PREFERRED_LAYER = "fod";
// Zoom at/above which tiles are assumed to hold every fire (below: tippecanoe thinning).
export const FULL_DETAIL_ZOOM_OVERRIDE = process.env.NEXT_PUBLIC_FOD_FULL_DETAIL_ZOOM
  ? Number(process.env.NEXT_PUBLIC_FOD_FULL_DETAIL_ZOOM)
  : undefined;
export const RDS_URL = "https://www.fs.usda.gov/rds/archive/catalog/RDS-2013-0009.7";
export const EXPORT_WARN_ROWS = 500_000;
