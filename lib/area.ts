import type { Feature, FeatureCollection, Geometry } from "geojson";

export type Pt = [number, number];
/** One polygon = outer ring + optional holes (even-odd). An area is a union of polygons. */
export type Polygon = Pt[][];
export type Area = Polygon[];

export const MAX_VERTICES = 400;

export const rectArea = (a: Pt, b: Pt): Area => [
  [[[a[0], a[1]], [b[0], a[1]], [b[0], b[1]], [a[0], b[1]], [a[0], a[1]]]],
];

export const areaBbox = (area: Area): [number, number, number, number] => {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const poly of area) for (const ring of poly) for (const [x, y] of ring) {
    if (x < w) w = x;
    if (x > e) e = x;
    if (y < s) s = y;
    if (y > n) n = y;
  }
  return [w, s, e, n];
};

export const vertexCount = (area: Area) => area.reduce((a, p) => a + p.reduce((b, r) => b + r.length, 0), 0);

/* ---------------- simplification (Douglas-Peucker) ---------------- */

function dp(pts: Pt[], tol: number): Pt[] {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let max = 0, idx = -1;
    const [x1, y1] = pts[a], [x2, y2] = pts[b];
    const dx = x2 - x1, dy = y2 - y1, len2 = dx * dx + dy * dy;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i];
      let t = len2 ? ((px - x1) * dx + (py - y1) * dy) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
      if (d > max) (max = d, (idx = i));
    }
    if (idx >= 0 && max > tol) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

/** Reduce an area to at most `max` vertices so the SQL stays small. Returns the area and whether it changed. */
export function simplifyArea(area: Area, max = MAX_VERTICES): { area: Area; simplified: boolean } {
  if (vertexCount(area) <= max) return { area, simplified: false };
  let tol = 0.0005;
  let out = area;
  for (let i = 0; i < 24; i++) {
    out = area
      .map((poly) => poly.map((ring) => dp(ring, tol)).filter((r) => r.length >= 4))
      .filter((p) => p.length > 0);
    if (vertexCount(out) <= max) break;
    tol *= 1.6;
  }
  return { area: out, simplified: true };
}

/* ---------------- GeoJSON in ---------------- */

const closeRing = (r: Pt[]): Pt[] => {
  const f = r[0], l = r[r.length - 1];
  return f[0] === l[0] && f[1] === l[1] ? r : [...r, [f[0], f[1]]];
};
const cleanRing = (r: number[][]): Pt[] => closeRing(r.map((p) => [Number(p[0]), Number(p[1])] as Pt));

function fromGeometry(g: Geometry | null | undefined, out: Area) {
  if (!g) return;
  if (g.type === "Polygon") out.push(g.coordinates.map(cleanRing));
  else if (g.type === "MultiPolygon") for (const p of g.coordinates) out.push(p.map(cleanRing));
  else if (g.type === "GeometryCollection") for (const x of g.geometries) fromGeometry(x, out);
}

/** Polygon/MultiPolygon features from any GeoJSON object (WGS84 lon/lat). */
export function areaFromGeoJSON(gj: unknown): Area {
  const out: Area = [];
  const walk = (o: unknown) => {
    if (Array.isArray(o)) return o.forEach(walk);
    const t = o as Feature | FeatureCollection | Geometry;
    if (!t || typeof t !== "object") return;
    if (t.type === "FeatureCollection") t.features.forEach(walk);
    else if (t.type === "Feature") fromGeometry(t.geometry, out);
    else fromGeometry(t as Geometry, out);
  };
  walk(gj);
  const ok = out.filter((p) => p.length && p[0].length >= 4 && p.every((r) => r.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))));
  const bad = ok.some((p) => p[0].some(([x, y]) => Math.abs(x) > 180 || Math.abs(y) > 90));
  if (bad) throw new Error("Coordinates are not lon/lat (WGS84). Reproject the file to EPSG:4326.");
  return ok;
}

/* ---------------- SQL ---------------- */

const n = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(6));

/** Boolean SQL expression: point (lon, lat) is inside the area (even-odd per polygon, union across polygons). */
export function areaSql(area: Area, lon: string, lat: string): string {
  const L = `CAST(${lon} AS DOUBLE)`, A = `CAST(${lat} AS DOUBLE)`;
  const polys = area.map((poly) => {
    const bb = areaBbox([poly]);
    const terms: string[] = [];
    for (const ring of poly) {
      for (let i = 0; i < ring.length - 1; i++) {
        const [x1, y1] = ring[i], [x2, y2] = ring[i + 1];
        if (y1 === y2) continue;
        terms.push(`(CASE WHEN (${y1 > y2 ? `${A} < ${n(y1)} AND ${A} >= ${n(y2)}` : `${A} < ${n(y2)} AND ${A} >= ${n(y1)}`}) AND ${L} < ${n(x1)} + (${n(x2 - x1)}) * (${A} - ${n(y1)}) / ${n(y2 - y1)} THEN 1 ELSE 0 END)`);
      }
    }
    if (!terms.length) return "FALSE";
    return `(${L} BETWEEN ${n(bb[0])} AND ${n(bb[2])} AND ${A} BETWEEN ${n(bb[1])} AND ${n(bb[3])} AND (${terms.join(" + ")}) % 2 = 1)`;
  });
  return polys.length ? `(${polys.join(" OR ")})` : "FALSE";
}

/* ---------------- URL ---------------- */

const r4 = (v: number) => String(Number(v.toFixed(4)));
export const areaToStr = (a: Area) => a.map((p) => p.map((r) => r.map((q) => `${r4(q[0])}_${r4(q[1])}`).join(",")).join("~")).join("!");
export function strToArea(s?: string): Area | null {
  if (!s) return null;
  try {
    const a: Area = s.split("!").map((p) =>
      p.split("~").map((r) =>
        r.split(",").map((q) => {
          const [x, y] = q.split("_").map(Number);
          if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error("bad");
          return [x, y] as Pt;
        }),
      ),
    );
    return a.length ? a : null;
  } catch {
    return null;
  }
}
