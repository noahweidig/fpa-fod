import type { FeatureCollection } from "geojson";
import type * as maplibregl from "maplibre-gl";
import { fmtImpact, impactPoints, impactLabel, type Incident, type ImpactMetric } from "./impact";
import { getMap } from "./mapInstance";
import { useStore } from "./store";

const SRC = "ics-impact";
export const IMPACT_LAYER = "ics-impact-circles";
const COLOR = "#b91c1c";

/** Incident points the overlay is currently showing, by id (for click popups). */
export const shownIncidents = new Map<string, Incident>();

export function installImpactLayer(m: maplibregl.Map) {
  if (m.getSource(SRC)) return;
  m.addSource(SRC, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  m.addLayer({
    id: IMPACT_LAYER, type: "circle", source: SRC, layout: { visibility: useStore.getState().impact.on ? "visible" : "none" },
    paint: {
      "circle-color": COLOR,
      "circle-opacity": 0.35,
      "circle-stroke-color": COLOR,
      "circle-stroke-width": 1.2,
      "circle-radius": ["get", "r"],
    },
  });
}

/** Radius from the value: area-proportional (sqrt), 4 to 28 px. */
const radius = (v: number, max: number) => 3 + 22 * Math.sqrt(Math.max(v, 0) / Math.max(max, 1e-9));

export async function syncImpact(applied: { filters: import("./types").Filters; area: import("./area").Area | null }) {
  const map = getMap();
  const src = map?.getSource(SRC) as maplibregl.GeoJSONSource | undefined;
  if (!map || !src) return;
  const { on, metric, min, members } = useStore.getState().impact;
  if (map.getLayer(IMPACT_LAYER)) map.setLayoutProperty(IMPACT_LAYER, "visibility", on && useStore.getState().parquet.ics ? "visible" : "none");
  shownIncidents.clear();
  if (!on || !useStore.getState().parquet.ics) {
    src.setData({ type: "FeatureCollection", features: [] });
    return;
  }
  const rows = await impactPoints({ filters: applied.filters, legend: null, legendCtx: null, extent: null, area: applied.area }, metric, members, min);
  const val = (i: Incident) => valueOf(i, metric);
  const max = Math.max(1, ...rows.map(val));
  const fc: FeatureCollection = {
    type: "FeatureCollection",
    features: rows.map((i) => {
      shownIncidents.set(i.id, i);
      return {
        type: "Feature",
        properties: { id: i.id, r: radius(val(i), max), label: `${i.name} ${i.year}: ${fmtImpact(metric, val(i))} ${impactLabel(metric).unit}` },
        geometry: { type: "Point", coordinates: [i.lon as number, i.lat as number] },
      };
    }),
  };
  src.setData(fc);
}

export function valueOf(i: Incident, m: ImpactMetric): number {
  const v = { str_destroyed: i.destroyed, fatalities: i.fatalities, injuries: i.injuries, evac_peak: i.evac, cost: i.cost, acres: i.acres }[m];
  return v ?? 0;
}
