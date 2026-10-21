import type * as maplibregl from "maplibre-gl";
import { rampColors, type RampId } from "./palette";
import { isImpact, METRIC_LABEL, type ChoroMetric, type ChoroRes } from "./regions";
import { useStore } from "./store";

const SRC = "choro";
const FILL = "choro-fill";
const LINE = "choro-line";
const EMPTY = { type: "FeatureCollection", features: [] } as const;

let shown: { layer: string; res: ChoroRes | null } = { layer: "", res: null };

const trim = (v: number) => v.toFixed(1).replace(/\.0$/, "");
export const fmtNum = (v: number) =>
  v >= 1e6 ? trim(v / 1e6) + "M" : v >= 1e3 ? trim(v / 1e3) + "k" : v >= 100 ? Math.round(v).toString() : v >= 1 ? trim(v) : v.toPrecision(2);

export const fmtChoro = (m: ChoroMetric, v: number) => (m === "cost" ? "$" : "") + fmtNum(v);

/** Class ranges for the legend: [lo, hi] per class, plus its color. */
export function choroClasses(res: ChoroRes, dark: boolean, ramp: RampId, reverse: boolean) {
  const colors = rampColors(ramp, reverse, dark);
  const edges = [0, ...res.breaks];
  return edges.map((lo, i) => ({ lo, hi: i + 1 < edges.length ? edges[i + 1] : null, color: colors[i] }));
}

/** Call from style.load: adds the (empty) choropleth layers beneath the MTBS / ignition layers. */
export function installChoroLayer(m: maplibregl.Map) {
  if (m.getSource(SRC)) return;
  shown = { layer: "", res: null };
  const before = m.getLayer("mtbs-fill") ? "mtbs-fill" : undefined;
  m.addSource(SRC, { type: "geojson", data: EMPTY as never, promoteId: "id" });
  m.addLayer({ id: FILL, type: "fill", source: SRC, layout: { visibility: "none" }, paint: { "fill-color": "#ccc", "fill-opacity": 0.75 } }, before);
  m.addLayer({
    id: LINE, type: "line", source: SRC, layout: { visibility: "none" },
    paint: { "line-color": "#6b6b66", "line-opacity": 0.55, "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.3, 8, 1] },
  }, before);
}

/** Push the current result into the map (call on result / style / theme changes). */
export function syncChoro(m: maplibregl.Map, res: ChoroRes | null) {
  const src = m.getSource(SRC) as maplibregl.GeoJSONSource | undefined;
  if (!src || !m.getLayer(FILL)) return;
  const vis = res ? "visible" : "none";
  m.setLayoutProperty(FILL, "visibility", vis);
  m.setLayoutProperty(LINE, "visibility", vis);
  if (!res) {
    shown = { layer: "", res: null };
    return;
  }
  const dark = useStore.getState().theme === "dark";
  const { ramp, reverse } = useStore.getState().choro;
  const colors = rampColors(ramp, reverse, dark);
  const step: unknown[] = ["step", ["coalesce", ["feature-state", "v"], -1], "#9a9a94", 0, colors[0]];
  res.breaks.forEach((b, i) => step.push(b, colors[i + 1]));
  m.setPaintProperty(FILL, "fill-color", step as never);
  if (shown.layer !== res.layer) {
    src.setData(res.geo.fc);
    shown.layer = res.layer;
  }
  shown.res = res;
  m.removeFeatureState({ source: SRC });
  res.geo.ids.forEach((id, i) => m.setFeatureState({ source: SRC, id }, { v: res.values[i] }));
}

/** Hover tooltip for the choropleth. */
export function attachChoroHover(m: maplibregl.Map, Popup: typeof maplibregl.Popup) {
  const tip = new Popup({ closeButton: false, closeOnClick: false, offset: 8, className: "fod-hover", maxWidth: "260px" });
  m.on("mousemove", FILL, (e) => {
    const res = shown.res;
    const id = e.features?.[0]?.properties?.id as string | undefined;
    const st = useStore.getState();
    if (!res || id == null || st.drawMode || m.queryRenderedFeatures(e.point, { layers: ["fod-circles"] }).length) return tip.remove();
    const i = res.geo.ids.indexOf(id);
    if (i < 0) return tip.remove();
    const v = `${fmtChoro(res.metric, res.values[i])} ${METRIC_LABEL[res.metric].toLowerCase()}`;
    const extra = isImpact(res.metric) ? `${res.inc[i].toLocaleString()} incidents` : res.metric === "n" ? `${Math.round(res.acres[i]).toLocaleString()} acres` : `${res.n[i].toLocaleString()} fires`;
    tip.setLngLat(e.lngLat).setText(`${res.geo.names[i]}: ${v} (${extra})`).addTo(m);
  });
  m.on("mouseleave", FILL, () => tip.remove());
}
