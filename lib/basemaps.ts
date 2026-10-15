import type { StyleSpecification } from "maplibre-gl";
import type { Basemap } from "./types";

// All sources are free and keyless: OpenFreeMap (vector, OSM data) for light/dark,
// USGS The National Map imagery for satellite (U.S. coverage, public domain).
const LIGHT_STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

export const BASEMAP_LABELS: Record<Basemap, string> = { light: "Light", dark: "Dark", satellite: "Satellite" };

const FALLBACK = (color: string): StyleSpecification => ({
  version: 8,
  sources: {},
  layers: [{ id: "bg", type: "background", paint: { "background-color": color } }],
});

const SATELLITE: StyleSpecification = {
  version: 8,
  sources: {
    usgs: {
      type: "raster",
      tiles: ["https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      maxzoom: 16,
      attribution:
        'Imagery: <a href="https://www.usgs.gov/programs/national-geospatial-program/national-map" target="_blank" rel="noreferrer">USGS The National Map</a> (U.S. coverage)',
    },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#1b1d1f" } },
    { id: "usgs", type: "raster", source: "usgs" },
  ],
};

/* ---- dark variant: invert lightness of every color in the light style ---- */
function parseColor(s: string): [number, number, number, number] | null {
  let m = /^#([0-9a-f]{3,8})$/i.exec(s);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
    const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
    return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1];
  }
  m = /^rgba?\(([^)]+)\)$/i.exec(s);
  if (m) {
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return [p[0], p[1], p[2], p[3] ?? 1];
  }
  m = /^hsla?\(([^)]+)\)$/i.exec(s);
  if (m) {
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map((x) => parseFloat(x));
    const [h, sat, l] = [p[0] / 360, p[1] / 100, p[2] / 100];
    const f = (n: number) => {
      const k = (n + h * 12) % 12;
      return l - sat * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
    return [f(0) * 255, f(8) * 255, f(4) * 255, p[3] ?? 1];
  }
  return null;
}

function invertLightness(s: string): string {
  const c = parseColor(s);
  if (!c) return s;
  const [r, g, b, a] = [c[0] / 255, c[1] / 255, c[2] / 255, c[3]];
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let l = (max + min) / 2, h = 0, sat = 0;
  if (max !== min) {
    const d = max - min;
    sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  l = Math.min(0.88, Math.max(0.08, 1 - l));
  return `hsla(${h.toFixed(0)},${Math.min(sat, 0.6) * 100}%,${(l * 100).toFixed(1)}%,${a})`;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const walk = (v: any): any =>
  typeof v === "string" ? invertLightness(v) : Array.isArray(v) ? v.map(walk) : v;

export function darken(style: StyleSpecification): StyleSpecification {
  const out: any = JSON.parse(JSON.stringify(style));
  for (const layer of out.layers as any[]) {
    for (const k of Object.keys(layer.paint ?? {})) {
      if (k.endsWith("color")) layer.paint[k] = walk(layer.paint[k]);
    }
  }
  return out;
}

let lightPromise: Promise<StyleSpecification> | null = null;
const loadLight = () =>
  (lightPromise ??= fetch(LIGHT_STYLE_URL)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .catch((e) => {
      lightPromise = null;
      console.warn("Basemap style failed to load:", e);
      return null as unknown as StyleSpecification;
    }));

export async function getBasemapStyle(b: Basemap): Promise<StyleSpecification> {
  if (b === "satellite") return SATELLITE;
  const light = await loadLight();
  if (!light) return FALLBACK(b === "dark" ? "#16181a" : "#e9e9e6");
  return b === "dark" ? darken(light) : light;
}
