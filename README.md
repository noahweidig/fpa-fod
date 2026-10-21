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
| `NEXT_PUBLIC_ICS_INCIDENTS_URL`, `NEXT_PUBLIC_ICS_LINKS_URL` | no | ICS-209-PLUS impact and links (Parquet, built by `scripts/build-ics-link.py`). Needs the FOD Parquet. Turns on the Impact features, see [docs/ics-linkage.md](docs/ics-linkage.md). |
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

- Color by general cause, cause classification, age category, owner, reporting agency, source system type, size class, year, month. Top 13 values get palette colors (first 11 validated for colorblind separation); the rest are "Other / missing". Choose which values get colors; colors stay with their value.
- Hovering a point shows year, general cause and acres; click for the full popup.
- Clickable legend: click isolates, shift-click (or the ● button) hides; counts follow the current filters.
- Radius: fixed, zoom-scaled, or by fire size (√acres, capped). Heatmap weighted by count or size.
- Filters: year, day of year/month, cause classification and general cause (classification narrows the cause list), age category, size class, acreage (log slider), state, county (searchable), owner, agency, source type. Filter expressions are mirrored as SQL for the Parquet backend. Everything, plus basemap and viewport, is in the URL.
- Charts: fires per year by category (stacked), month × category heatmap, ranking, size-class distribution; optional limit to map extent; year animation (sidebar) with speed and cumulative mode.
- Downloads: CSV, GeoJSON, Parquet (with Parquet), PNG. Each export records filters, date and source (CSV `#` header lines or a sidecar JSON; GeoJSON `metadata` member; Parquet key-value metadata). A warning appears above 500k rows.

## Analyze tab (needs Parquet)

Cards are grouped into Over time, Season, Breakdown and Compare. The year animation lives in the sidebar under the match count.

- **Trends** (also without Parquet): fires per year by category with a sparkline and linear change per decade.
- **Summary table**: fires, acres, mean and largest fire, and human-caused share by any categorical field (state, county, owner, agency, cause…). Sortable; click a name to filter to it; CSV with the usual provenance header.
- **Top fires**: the largest or most recent N fires (10-100) over the full Parquet for the current filters and area. Click a name to zoom to it.
- **Acres burned by year**: total acres per year for the current filters and area (the year filter is ignored).
- **Fire season**: fires per day of year, 7-day average, with the peak day (the day-of-year filter is ignored).
- **Fires by weekday**: counts per weekday (derived from year + day of year) with the human-caused share in the tooltip.
- **Busiest days**: the single dates, or days of year pooled over all years, with the most ignitions. Click a row to filter to that day.
- **Fire size distribution**: fires by acres in log bins; buttons under the chart filter to that size range.
- **Largest fire each year**: the biggest fire per year for the current filters and area; click a name to zoom to it.
- **Compare two periods**: set year ranges A and B (the year filter is replaced; other filters and the area apply to both). Paired bars by any categorical field or month, as fires or acres, optionally per year (periods can differ in length), with % change.

## Impact: wildfire destructiveness (ICS-209-PLUS)

Needs the two Parquet files from `scripts/build-ics-link.py` (see [docs/ics-linkage.md](docs/ics-linkage.md) for the keys, the data-quality findings and the rules the numbers follow).

- **Analyze → Impact**: most destructive incidents (structures destroyed, fatalities, injuries, peak evacuations, suppression cost, acres), with a button per incident to show only its ignitions and perimeters; impact per year. Complexes are counted once, members are opt-in.
- **Filters → Destructive incidents**: overlay of incidents sized by impact, at their point of origin. Click a marker for the damage figures and links.
- **Popups**: a FOD ignition or an MTBS perimeter shows the incident(s) that report on it, whether the figures cover several ignitions or perimeters, and the complex it belongs to.
- The incident filter (chip "Incident: …") also drives counts, charts and exports, and is part of the share link.

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

## Overview site (GitHub Pages)

`site/` is a separate Astro project: a static landing page that links to the app. Deployed by `.github/workflows/pages.yml` on pushes to `main` that touch `site/`.

```bash
cd site && npm install && npm run dev   # http://localhost:4321/fpa-fod
```

- One-time: repo Settings → Pages → Source: **GitHub Actions**.
- App link: defaults to `https://fpa-fod.vercel.app/`; override with the repo variable `APP_URL` (Settings → Variables) or `PUBLIC_APP_URL` locally.
- Custom domain: build with `BASE=/ SITE=https://your.domain`.
- Vercel: keep the project root at the repo root. `site/` is not part of the Next build.

## Area, place filter, share

**Export → Saved views** keeps named views (position, filters, colors, area) in this browser's localStorage.


- **Area** (Filters tab, needs Parquet; the summary also lists the top 5 causes in the area): draw a rectangle or polygon, click a center for a circle of 1-500 mi, or upload GeoJSON / a zipped shapefile (WGS84 polygons). Counts, charts and exports follow the area. Uploads are simplified to ~400 vertices. Multi-polygon uploads are a union; holes are respected.
- **Search → Filter**: a state or county result filters on the `STATE`/`COUNTY` fields; other places select their bounding box.
- **Export → Share**: copies a link with map position, filters and area (area is dropped from the link above ~4 kB). The PNG includes the legend and area outline.

## MTBS perimeters

`NEXT_PUBLIC_MTBS_PMTILES_URL` (default: the R2 `mtbs.pmtiles`, layer `mtbs`, fields lowercase, `event_id` as key). FOD `MTBS_ID` joins to MTBS `event_id`; many ignitions can share one perimeter.

- Filters tab: show perimeters; "Only ignitions linked to a perimeter" (exact mode, needs an `MTBS_ID` column in the Parquet).
- Click a perimeter: attributes, number of linked FOD ignitions and acres, "Show only these ignitions".
- Click a linked fire: "Show perimeter" highlights it.

## Choropleth boundaries (in repo)

`public/boundaries/*.geojson` (~6.5 MB raw, ~2.4 MB gzipped total) is served from the app origin, no R2. Load with `fetch('/boundaries/<name>.geojson')` and join stats on `properties.code` (or `fips`/`state`).

| File | Features | Key | Source |
|---|---|---|---|
| `states` | 52 | `state` (USPS) | Census cb_2023 20m |
| `counties` | 3,222 | `fips`, `state`+`name` | Census cb_2023 20m |
| `eco_l1` / `eco_l2` | 10 / 20 | `code` (e.g. `7`, `7.1`) | EPA, dissolved from L3 |
| `eco_l3` / `eco_l4` | 85 / 967 | `code` (`US_L3CODE`, `US_L4CODE`) | EPA `us_eco_l3`, `us_eco_l4_no_st` |
| `gacc` | 10 | `code` (AICC, NWCC...) | NIFC National GACC Boundaries |

EPA ecoregions cover CONUS only. Geometry is simplified (visual use, not analysis). Rebuild with `scripts/build-boundaries.sh <raw_dir>` (mapshaper); the header lists the inputs.

**In the app:** Style tab → Choropleth (state, county, GACC, EPA L1-L4; metric = fires, acres, or fires per 1,000 km²). Needs the Parquet. It follows the current filters and area. State and county join on the `STATE` / `COUNTY` fields (county by normalized name). GACC and ecoregions assign each ignition to a polygon in the browser on first use (`lib/pip.ts`, a few seconds per 2.5M fires, cached as a `reg_*` column); fires outside every polygon are counted in the legend note.
