# FPA-FOD wildfire ignitions

Next.js (App Router, TypeScript, Tailwind) + MapLibre GL JS + `pmtiles`. Shows FPA-FOD ignition points from a PMTiles file (layer `fod`) and lets you color, filter, chart and download by ignition cause. No backend, no hex binning.

Data: USFS Research Data Archive, [RDS-2013-0009.7](https://www.fs.usda.gov/rds/archive/catalog/RDS-2013-0009.7). The footer and every export carry the citation (set in `lib/config.ts`): Short, Karen C. 2026. Spatial wildfire occurrence data for the United States, 1992-2024 [FPA_FOD_20260615]. 7th Edition. Fort Collins, CO: Forest Service Research Data Archive. <https://doi.org/10.2737/RDS-2013-0009.7>

## Run locally

```bash
npm install
cp .env.example .env.local     # then edit
npm run dev                    # http://localhost:3000
npm run build && npm start     # production check
```

## Data URLs

All data locations live in [`lib/config.ts`](lib/config.ts) (read from env), so moving to a custom domain is a one-line change.

| Env var | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_FOD_PMTILES_URL` | yes | Public PMTiles file (layer `fod`, zoom 0–12). |
| `NEXT_PUBLIC_FOD_PARQUET_URL` | no | Parquet of the same records with lon/lat (`lon`/`lat` or `LONGITUDE`/`LATITUDE`). Turns on exact counts, charts and Parquet/CSV/GeoJSON exports via DuckDB-WASM. |
| `NEXT_PUBLIC_FOD_FULL_DETAIL_ZOOM` | no | Zoom below which the "sample of fires" note shows (default 9). |

Current tiles: `https://pub-55bcb774b88f4b619636500860a70cb0.r2.dev/fod_fast.pmtiles`.

Without the Parquet URL the app runs in **approximate** mode: counts, charts and exports come from `queryRenderedFeatures` on the current view, are labelled approximate, and low zooms are thinned samples. Exports then contain only loaded tiles, deduplicated by `FOD_ID`.

Field names are read from the PMTiles metadata (`vector_layers`, `tilestats`). Controls whose field is missing are hidden. Category lists come from tilestats, Parquet distinct values, or sampled tile features. Month is derived from `DISCOVERY_DOY` with fixed non-leap month boundaries (off by up to a day in leap years); date strings are not used.

### R2 CORS

The browser reads the files directly with Range requests, so the bucket needs CORS. Dashboard: R2 → bucket → Settings → CORS policy:

```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["range", "if-match"],
    "ExposeHeaders": ["etag", "content-range", "content-length", "accept-ranges"],
    "MaxAgeSeconds": 3000
  }
]
```

If you use the Parquet file too, also allow `if-none-match` and `content-type` in `AllowedHeaders`, and expose `last-modified`. Restrict `AllowedOrigins` to your Vercel domain once it is stable. If the map is blank, check the network tab for CORS errors or non-206 responses to Range requests.

### Re-uploading a tile file with rclone

The app only reads public files and never needs R2 credentials. Upload keys stay on your machine in your rclone config, never in the repo, `.env*`, Vercel env vars, or client code (anything in `NEXT_PUBLIC_*` is shipped to every visitor's browser).

```bash
rclone config   # new remote "r2": type s3, provider Cloudflare, endpoint https://<ACCOUNT_ID>.r2.cloudflarestorage.com, access key + secret from an R2 API token scoped to this bucket
rclone copyto fod_fast.pmtiles r2:fpa-fod/fod_fast_v2.pmtiles --s3-chunk-size 64M --progress
```

Upload under a new key and change the URL, rather than overwriting. PMTiles clients send `If-Match` with the file's ETag, so replacing a file in place breaks sessions that have it cached.

## Deploy to Vercel

1. Push this repo and import it in Vercel (framework: Next.js, defaults are fine).
2. Settings → Environment Variables: add `NEXT_PUBLIC_FOD_PMTILES_URL` (and optionally `NEXT_PUBLIC_FOD_PARQUET_URL`) for Production, Preview and Development.
3. Redeploy (`NEXT_PUBLIC_*` values are inlined at build time).

DuckDB-WASM loads its worker and wasm from jsDelivr at runtime. Nothing paid beyond Vercel and Cloudflare is used.

## Basemaps

Light/dark: [OpenFreeMap](https://openfreemap.org) (OpenStreetMap data, no key; the dark style is derived in code from the light one). Satellite: USGS The National Map imagery (U.S. coverage, to zoom 16). Carto raster tiles were dropped because they now require an API key.

## Features

- Color by general cause, cause classification, age category, owner, reporting agency, source system type, size class, year, month. Top 11 values get palette colors (validated for colorblind separation); the rest are "Other / missing". Choose which values get colors; colors stay with their value.
- Clickable legend: click isolates, shift-click (or the ● button) hides; counts follow the current filters.
- Radius: fixed, zoom-scaled, or by fire size (√acres, capped). Heatmap weighted by count or size.
- Filters: year, day of year/month, cause classification and general cause (classification narrows the cause list), age category, size class, acreage (log slider), state, county (searchable), owner, agency, source type. Filter expressions are mirrored as SQL for the Parquet backend. Everything, plus basemap and viewport, is in the URL.
- Charts: fires per year by category (stacked), month × category heatmap, ranking, size-class distribution; optional limit to map extent; year animation with speed and cumulative mode.
- Downloads: CSV, GeoJSON, Parquet (with Parquet), PNG. Each export records filters, date and source (CSV `#` header lines or a sidecar JSON; GeoJSON `metadata` member; Parquet key-value metadata). A warning appears above 500k rows.

## Rebuilding tiles with more points (optional)

The current tiles were built with `--drop-densest-as-needed --maximum-tile-bytes=400000 --maximum-tile-features=60000` (see the file's `generator_options`), so low zooms keep only a thin sample (z0 holds about 45 points). Two changes show far more:

1. **Slim the tile attributes.** Each point carries 37 attributes, which is what fills the 400 KB tile budget. Keep only the fields the app styles and filters on, and rely on the Parquet file for the rest.
2. **Thin by importance, not density.** Give each point a `tippecanoe.minzoom` from its size class, so the biggest fires show at every zoom and small ones appear as you zoom in. Raise the tile limits.

```sql
-- DuckDB: newline-delimited GeoJSON with a per-feature minzoom (check class counts first)
COPY (
  SELECT 'Feature' AS type,
    {'type':'Point','coordinates':[LONGITUDE, LATITUDE]} AS geometry,
    {'FOD_ID':FOD_ID,'FIRE_YEAR':FIRE_YEAR,'DISCOVERY_DOY':DISCOVERY_DOY,
     'NWCG_GENERAL_CAUSE':NWCG_GENERAL_CAUSE,'NWCG_CAUSE_CLASSIFICATION':NWCG_CAUSE_CLASSIFICATION,
     'NWCG_CAUSE_AGE_CATEGORY':NWCG_CAUSE_AGE_CATEGORY,'OWNER_DESCR':OWNER_DESCR,
     'NWCG_REPORTING_AGENCY':NWCG_REPORTING_AGENCY,'SOURCE_SYSTEM_TYPE':SOURCE_SYSTEM_TYPE,
     'FIRE_SIZE':round(FIRE_SIZE,2),'FIRE_SIZE_CLASS':FIRE_SIZE_CLASS,'STATE':STATE,'COUNTY':COUNTY} AS properties,
    {'minzoom': CASE FIRE_SIZE_CLASS WHEN 'G' THEN 0 WHEN 'F' THEN 3 WHEN 'E' THEN 5
                WHEN 'D' THEN 7 WHEN 'C' THEN 9 ELSE 10 END} AS tippecanoe
  FROM 'fod.parquet'
) TO 'fod.geojsonl' (FORMAT JSON);
```

```bash
tippecanoe -o fod_v2.pmtiles -l fod -Z0 -z12 -P --force \
  --drop-densest-as-needed \
  --maximum-tile-bytes=1000000 --maximum-tile-features=200000 \
  fod.geojsonl
```

Importance thinning changes what a count-weighted heatmap shows at low zoom (mostly large fires). Upload under a new key and update the URL (see rclone above).

## Sample data (optional)

`scripts/make-sample-data.py` generates synthetic points with the same schema, and `scripts/serve-range.mjs` serves them with CORS and Range support:

```bash
pip install numpy mapbox-vector-tile pmtiles pyarrow shapely
python3 scripts/make-sample-data.py --n 120000
node scripts/serve-range.mjs dev-data   # http://localhost:8787/fod.pmtiles, fod.parquet
```
