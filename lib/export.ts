import type { Feature, FeatureCollection, Point } from "geojson";
import { getDuck, getTileBackend, type Query } from "./backend";
import { PARQUET_URL, PMTILES_URL, RDS_URL } from "./config";
import { PARQUET_FILE } from "./duck";
import { getMap } from "./mapInstance";
import { qi, ql, whereClauses, whereSql } from "./sql";
import { useStore } from "./store";
import { CAT_DIMS, DIM_LABEL, OTHER } from "./types";

const stamp = () => new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);

export function saveBlob(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

export function describeFilters(q: Query): string[] {
  const f = q.filters;
  const out: string[] = [];
  if (f.year) out.push(`Fire year: ${f.year[0]} to ${f.year[1]}`);
  if (f.doy) out.push(`Day of year: ${f.doy[0]} to ${f.doy[1]}`);
  if (f.acres) out.push(`Fire size (acres): ${f.acres[0]} to ${f.acres[1]}`);
  for (const d of CAT_DIMS) if (f.cats[d]?.length) out.push(`${DIM_LABEL[d]}: ${f.cats[d]!.join(" | ")}`);
  const l = q.legend;
  const dim = q.legendCtx?.dim;
  if (dim && l?.isolate) out.push(`Legend isolate (${DIM_LABEL[dim]}): ${l.isolate === OTHER ? "Other / missing" : l.isolate}`);
  if (dim && l?.hidden.length) out.push(`Legend hidden (${DIM_LABEL[dim]}): ${l.hidden.map((h) => (h === OTHER ? "Other / missing" : h)).join(" | ")}`);
  if (q.extent) out.push(`Map extent (W,S,E,N): ${q.extent.map((n) => n.toFixed(4)).join(", ")}`);
  return out.length ? out : ["(none: all records)"];
}

export interface ExportMeta {
  generated: string;
  dataset: string;
  dataset_url: string;
  tiles: string;
  parquet: string | null;
  mode: "exact" | "approximate";
  rows: number;
  filters: string[];
  filters_json: unknown;
  notes: string[];
}

export function buildMeta(q: Query, rows: number, exact: boolean): ExportMeta {
  const s = useStore.getState();
  const b = s.bounds;
  return {
    generated: new Date().toISOString(),
    dataset: "Fire Program Analysis fire-occurrence database (FPA FOD), USFS RDS-2013-0009.7",
    dataset_url: RDS_URL,
    tiles: PMTILES_URL,
    parquet: exact ? PARQUET_URL : null,
    mode: exact ? "exact" : "approximate",
    rows,
    filters: describeFilters(q),
    filters_json: { filters: q.filters, legend: q.legend, extent: q.extent },
    notes: exact
      ? ["Records are filtered from the full Parquet file."]
      : [
          "Limited to features loaded in the map's current view; low zooms show a thinned sample of fires.",
          "Deduplicated by FOD_ID.",
          b ? `View (W,S,E,N): ${b.map((n) => n.toFixed(4)).join(", ")}` : "",
        ].filter(Boolean),
  };
}

const metaComment = (m: ExportMeta) =>
  [
    "# FPA-FOD export",
    `# generated: ${m.generated}`,
    `# source: ${m.dataset} (${m.dataset_url})`,
    `# data file: ${m.parquet ?? m.tiles}`,
    `# mode: ${m.mode}; rows: ${m.rows}`,
    ...m.filters.map((f) => `# filter: ${f}`),
    ...m.notes.map((n) => `# note: ${n}`),
    "",
  ].join("\n");

export const metaSidecar = (m: ExportMeta) => new Blob([JSON.stringify(m, null, 2)], { type: "application/json" });

/* ---------------- approximate (tiles) ---------------- */

const csvCell = (v: unknown) => {
  if (v == null) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function tileFeatures(q: Query): Feature<Point>[] {
  return getTileBackend().features(q);
}

export function featuresToCsv(feats: Feature<Point>[]): string {
  const cols: string[] = [];
  const seen = new Set<string>();
  for (const f of feats) for (const k of Object.keys(f.properties ?? {})) if (!seen.has(k)) (seen.add(k), cols.push(k));
  const head = [...cols, "tile_lon", "tile_lat"];
  const lines = [head.map(csvCell).join(",")];
  for (const f of feats) {
    const p = f.properties ?? {};
    lines.push([...cols.map((c) => csvCell(p[c])), f.geometry.coordinates[0].toFixed(6), f.geometry.coordinates[1].toFixed(6)].join(","));
  }
  return lines.join("\n") + "\n";
}

export function exportTiles(kind: "csv" | "geojson", q: Query, csvSidecar: boolean) {
  const feats = tileFeatures(q);
  const m = buildMeta(q, feats.length, false);
  const name = `fpa-fod_view_${stamp()}`;
  if (kind === "csv") {
    if (csvSidecar) {
      saveBlob(new Blob([featuresToCsv(feats)], { type: "text/csv" }), `${name}.csv`);
      saveBlob(metaSidecar(m), `${name}.metadata.json`);
    } else {
      saveBlob(new Blob([metaComment(m), featuresToCsv(feats)], { type: "text/csv" }), `${name}.csv`);
    }
  } else {
    const fc: FeatureCollection & { metadata: ExportMeta } = { type: "FeatureCollection", metadata: m, features: feats };
    saveBlob(new Blob([JSON.stringify(fc)], { type: "application/geo+json" }), `${name}.geojson`);
  }
  return feats.length;
}

/* ---------------- exact (DuckDB) ---------------- */

const bigintSafe = (_k: string, v: unknown) => (typeof v === "bigint" ? Number(v) : v);

export async function countExact(q: Query): Promise<number> {
  const d = getDuck();
  if (!d) return 0;
  const rows = await d.group([], q);
  return rows.reduce((a, r) => a + r.n, 0);
}

export async function exportDuck(kind: "csv" | "geojson" | "parquet", q: Query, csvSidecar: boolean, onStatus: (s: string) => void) {
  const d = getDuck();
  if (!d) throw new Error("Parquet backend is not ready");
  const { conn, db, cols } = d.h;
  const where = whereSql(whereClauses(q.filters, q.legend, q.legendCtx, cols, q.extent));
  const src = `SELECT * FROM read_parquet('${PARQUET_FILE}') ${where}`;
  onStatus("Counting rows…");
  const rows = await countExact(q);
  const m = buildMeta(q, rows, true);
  const name = `fpa-fod_${stamp()}`;

  if (kind === "csv") {
    onStatus("Reading Parquet and writing CSV…");
    await conn.query(`COPY (${src}) TO 'out.csv' (HEADER, DELIMITER ',')`);
    const buf = await db.copyFileToBuffer("out.csv");
    await db.dropFile("out.csv");
    if (csvSidecar) {
      saveBlob(new Blob([buf as BlobPart], { type: "text/csv" }), `${name}.csv`);
      saveBlob(metaSidecar(m), `${name}.metadata.json`);
    } else {
      saveBlob(new Blob([metaComment(m), buf as BlobPart], { type: "text/csv" }), `${name}.csv`);
    }
  } else if (kind === "parquet") {
    onStatus("Reading Parquet and writing Parquet…");
    const kv = `KV_METADATA {fpa_fod_export: ${ql(JSON.stringify(m))}}`;
    try {
      await conn.query(`COPY (${src}) TO 'out.parquet' (FORMAT PARQUET, COMPRESSION ZSTD, ${kv})`);
      const buf = await db.copyFileToBuffer("out.parquet");
      saveBlob(new Blob([buf as BlobPart], { type: "application/vnd.apache.parquet" }), `${name}.parquet`);
    } catch (e) {
      console.warn("KV_METADATA unsupported, writing a sidecar instead", e);
      await conn.query(`COPY (${src}) TO 'out.parquet' (FORMAT PARQUET, COMPRESSION ZSTD)`);
      const buf = await db.copyFileToBuffer("out.parquet");
      saveBlob(new Blob([buf as BlobPart], { type: "application/vnd.apache.parquet" }), `${name}.parquet`);
      saveBlob(metaSidecar(m), `${name}.metadata.json`);
    }
    await db.dropFile("out.parquet");
  } else {
    onStatus("Reading Parquet and writing GeoJSON…");
    const parts: BlobPart[] = [`{"type":"FeatureCollection","metadata":${JSON.stringify(m)},"features":[\n`];
    let first = true;
    let n = 0;
    const lon = qi(cols.lon!), lat = qi(cols.lat!);
    const reader = await conn.send(`SELECT * FROM read_parquet('${PARQUET_FILE}') ${where}`);
    for await (const batch of reader) {
      const chunk: string[] = [];
      for (const r of batch.toArray()) {
        const o = (r as { toJSON(): Record<string, unknown> }).toJSON();
        const feat = {
          type: "Feature",
          geometry: { type: "Point", coordinates: [Number(o[cols.lon!]), Number(o[cols.lat!])] },
          properties: o,
        };
        chunk.push(JSON.stringify(feat, bigintSafe));
        n++;
      }
      if (chunk.length) {
        parts.push((first ? "" : ",\n") + chunk.join(",\n"));
        first = false;
      }
      onStatus(`Writing GeoJSON… ${n.toLocaleString()} / ${rows.toLocaleString()}`);
    }
    void lon; void lat;
    parts.push("\n]}\n");
    saveBlob(new Blob(parts, { type: "application/geo+json" }), `${name}.geojson`);
  }
  return rows;
}

/* ---------------- PNG ---------------- */

export function exportPng(): Promise<void> {
  const map = getMap();
  if (!map) return Promise.reject(new Error("Map not ready"));
  return new Promise((resolve, reject) => {
    map.once("render", () => {
      try {
        const src = map.getCanvas();
        const attr = (document.querySelector(".maplibregl-ctrl-attrib-inner")?.textContent ?? "").replace(/\s+/g, " ").trim();
        const q = useStore.getState();
        const lines = [
          `FPA-FOD wildfire ignitions (USFS RDS-2013-0009.7) · ${new Date().toISOString().slice(0, 10)}`,
          attr,
        ];
        const scale = src.width / src.clientWidth || 1;
        const barH = Math.round(lines.length * 15 * scale + 8 * scale);
        const out = document.createElement("canvas");
        out.width = src.width;
        out.height = src.height + barH;
        const ctx = out.getContext("2d")!;
        ctx.drawImage(src, 0, 0);
        ctx.fillStyle = q.theme === "dark" ? "#1a1a19" : "#fcfcfb";
        ctx.fillRect(0, src.height, out.width, barH);
        ctx.fillStyle = q.theme === "dark" ? "#f0efec" : "#0b0b0b";
        ctx.font = `${Math.round(11 * scale)}px system-ui, sans-serif`;
        lines.forEach((t, i) => ctx.fillText(t.slice(0, 220), 8 * scale, src.height + (15 * (i + 1)) * scale - 2 * scale));
        out.toBlob((b) => {
          if (!b) return reject(new Error("PNG encoding failed"));
          saveBlob(b, `fpa-fod_map_${stamp()}.png`);
          resolve();
        }, "image/png");
      } catch (e) {
        reject(e);
      }
    });
    map.triggerRepaint();
  });
}
