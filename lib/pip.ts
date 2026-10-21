import type { FeatureCollection, Geometry } from "geojson";

type Ring = number[][];
interface Poly {
  fi: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** horizontal bands over [y0, y1]; each holds x1,y1,x2,y2 for the edges crossing it */
  bands: Float64Array[];
  bh: number;
}

const CELL = 0.5;
const cellKey = (x: number, y: number) => Math.floor((x + 180) / CELL) * 1024 + Math.floor((y + 90) / CELL);

function polysOf(g: Geometry): Ring[][] {
  if (g.type === "Polygon") return [g.coordinates];
  if (g.type === "MultiPolygon") return g.coordinates;
  return [];
}

function buildPoly(fi: number, rings: Ring[]): Poly {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, ne = 0;
  for (const r of rings) {
    for (const [x, y] of r) {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    ne += r.length - 1;
  }
  const nb = Math.min(256, Math.max(1, Math.floor(ne / 16)));
  const bh = (y1 - y0) / nb || 1;
  const lists: number[][] = Array.from({ length: nb }, () => []);
  for (const r of rings) {
    for (let i = 0; i < r.length - 1; i++) {
      const [ax, ay] = r[i], [bx, by] = r[i + 1];
      if (ay === by) continue;
      const lo = Math.max(0, Math.min(nb - 1, Math.floor((Math.min(ay, by) - y0) / bh)));
      const hi = Math.max(0, Math.min(nb - 1, Math.floor((Math.max(ay, by) - y0) / bh)));
      for (let b = lo; b <= hi; b++) lists[b].push(ax, ay, bx, by);
    }
  }
  return { fi, x0, y0, x1, y1, bands: lists.map((l) => Float64Array.from(l)), bh };
}

function inside(p: Poly, x: number, y: number): boolean {
  const e = p.bands[Math.max(0, Math.min(p.bands.length - 1, Math.floor((y - p.y0) / p.bh)))];
  let c = false;
  for (let i = 0; i < e.length; i += 4) {
    const ay = e[i + 1], by = e[i + 3];
    if (ay > y !== by > y) {
      const ax = e[i];
      if (x < ax + ((y - ay) * (e[i + 2] - ax)) / (by - ay)) c = !c;
    }
  }
  return c;
}

/** Point-in-polygon lookup over a polygon FeatureCollection: returns the feature index, or -1. */
export function buildPip(fc: FeatureCollection) {
  const polys: Poly[] = [];
  fc.features.forEach((f, fi) => {
    for (const rings of polysOf(f.geometry)) polys.push(buildPoly(fi, rings));
  });
  const grid = new Map<number, Poly[]>();
  for (const p of polys) {
    for (let ix = Math.floor((p.x0 + 180) / CELL); ix <= Math.floor((p.x1 + 180) / CELL); ix++) {
      for (let iy = Math.floor((p.y0 + 90) / CELL); iy <= Math.floor((p.y1 + 90) / CELL); iy++) {
        const k = ix * 1024 + iy;
        const l = grid.get(k);
        if (l) l.push(p);
        else grid.set(k, [p]);
      }
    }
  }
  const exact = (x: number, y: number) => {
    const l = grid.get(cellKey(x, y));
    if (l) for (const p of l) if (x >= p.x0 && x <= p.x1 && y >= p.y0 && y <= p.y1 && inside(p, x, y)) return p.fi;
    return -1;
  };
  // simplified coastlines can leave shoreline points just outside: probe a few nearby offsets
  const PROBES = [0.03, 0.06].flatMap((d) => [[d, 0], [-d, 0], [0, d], [0, -d], [d, d], [-d, -d], [d, -d], [-d, d]]);
  return (x: number, y: number): number => {
    if (!(x >= -180 && x <= 180 && y >= -90 && y <= 90)) return -1;
    const r = exact(x, y);
    if (r >= 0) return r;
    for (const [dx, dy] of PROBES) {
      const q = exact(x + dx, y + dy);
      if (q >= 0) return q;
    }
    return -1;
  };
}
