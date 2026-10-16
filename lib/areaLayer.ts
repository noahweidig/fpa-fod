import type { FeatureCollection } from "geojson";
import type maplibregl from "maplibre-gl";
import { rectArea, type Area, type Pt } from "./area";
import { getMap } from "./mapInstance";
import { useStore } from "./store";

const SRC = "fod-area";
const ACCENT = "#e8590c";

function collection(): FeatureCollection {
  const { area, draft, drawMode } = useStore.getState();
  const features: FeatureCollection["features"] = [];
  for (const poly of area ?? []) features.push({ type: "Feature", properties: { k: "area" }, geometry: { type: "Polygon", coordinates: poly } });
  if (drawMode && draft.length) {
    if (drawMode === "rect" && draft.length === 2) {
      features.push({ type: "Feature", properties: { k: "draft" }, geometry: { type: "Polygon", coordinates: rectArea(draft[0], draft[1])[0] } });
    } else if (draft.length > 1) {
      features.push({ type: "Feature", properties: { k: "draft" }, geometry: { type: "LineString", coordinates: draft } });
    }
    for (const p of draft) features.push({ type: "Feature", properties: { k: "vtx" }, geometry: { type: "Point", coordinates: p } });
  }
  return { type: "FeatureCollection", features };
}

export function syncArea() {
  const src = getMap()?.getSource(SRC) as maplibregl.GeoJSONSource | undefined;
  src?.setData(collection());
}

/** Call from style.load: (re)adds the selection layers above the data layers. */
export function installAreaLayers(m: maplibregl.Map) {
  if (m.getSource(SRC)) return;
  m.addSource(SRC, { type: "geojson", data: collection() });
  m.addLayer({ id: "fod-area-fill", type: "fill", source: SRC, filter: ["==", ["get", "k"], "area"], paint: { "fill-color": ACCENT, "fill-opacity": 0.1 } });
  m.addLayer({ id: "fod-area-line", type: "line", source: SRC, filter: ["==", ["get", "k"], "area"], paint: { "line-color": ACCENT, "line-width": 2 } });
  m.addLayer({
    id: "fod-draft-fill", type: "fill", source: SRC, filter: ["all", ["==", ["get", "k"], "draft"], ["==", ["geometry-type"], "Polygon"]],
    paint: { "fill-color": ACCENT, "fill-opacity": 0.08 },
  });
  m.addLayer({
    id: "fod-draft-line", type: "line", source: SRC, filter: ["==", ["get", "k"], "draft"],
    paint: { "line-color": ACCENT, "line-width": 2, "line-dasharray": [2, 2] },
  });
  m.addLayer({
    id: "fod-draft-vtx", type: "circle", source: SRC, filter: ["==", ["get", "k"], "vtx"],
    paint: { "circle-radius": 4, "circle-color": "#fff", "circle-stroke-color": ACCENT, "circle-stroke-width": 2 },
  });
}

useStore.subscribe((s, p) => {
  if (s.area !== p.area || s.draft !== p.draft || s.drawMode !== p.drawMode) syncArea();
});

/* ---------------- drawing ---------------- */

let cleanup: (() => void) | null = null;

export function stopDraw() {
  cleanup?.();
  cleanup = null;
  useStore.setState({ drawMode: null, draft: [] });
}

/** true while the last draft point is just the cursor rubber band */
let hover = false;
const committed = () => {
  const d = useStore.getState().draft;
  return hover ? d.slice(0, -1) : d;
};

export function undoPoint() {
  useStore.setState({ draft: committed().slice(0, -1) });
  hover = false;
}

export function finishPoly() {
  const { drawMode } = useStore.getState();
  const draft = committed();
  if (drawMode !== "poly" || draft.length < 3) return;
  const ring: Pt[] = [...draft, draft[0]];
  commitArea([[ring]], "Drawn polygon");
}

export function commitArea(area: Area, label: string) {
  cleanup?.();
  cleanup = null;
  useStore.setState({ area, areaLabel: label, drawMode: null, draft: [] });
}

export function startDraw(mode: "rect" | "poly") {
  const m = getMap();
  if (!m) return;
  stopDraw();
  hover = false;
  useStore.setState({ drawMode: mode, draft: [], drawer: false });
  const canvas = m.getCanvas();
  const prevCursor = canvas.style.cursor;
  canvas.style.cursor = "crosshair";
  const offs: (() => void)[] = [];
  const on = <T extends keyof maplibregl.MapEventType>(t: T, fn: (e: maplibregl.MapEventType[T]) => void) => {
    m.on(t, fn as never);
    offs.push(() => m.off(t, fn as never));
  };
  const pt = (e: { lngLat: { lng: number; lat: number } }): Pt => [e.lngLat.lng, e.lngLat.lat];

  if (mode === "rect") {
    m.dragPan.disable();
    let start: Pt | null = null;
    let last: Pt | null = null;
    const down = (e: maplibregl.MapMouseEvent | maplibregl.MapTouchEvent) => {
      start = last = pt(e);
      useStore.setState({ draft: [start, start] });
    };
    const move = (e: maplibregl.MapMouseEvent | maplibregl.MapTouchEvent) => {
      if (!start) return;
      last = pt(e);
      useStore.setState({ draft: [start, last] });
    };
    const up = () => {
      if (!start || !last) return;
      const [a, b] = [start, last];
      if (Math.abs(a[0] - b[0]) < 1e-5 || Math.abs(a[1] - b[1]) < 1e-5) {
        start = last = null;
        useStore.setState({ draft: [] });
        return;
      }
      commitArea(rectArea(a, b), "Drawn rectangle");
    };
    on("mousedown", down);
    on("touchstart", down);
    on("mousemove", move);
    on("touchmove", move);
    on("mouseup", up);
    on("touchend", up);
    offs.push(() => m.dragPan.enable());
  } else {
    m.doubleClickZoom.disable();
    on("click", (e) => {
      useStore.setState({ draft: [...committed(), pt(e)] });
      hover = false;
    });
    on("mousemove", (e) => {
      const c = committed();
      if (!c.length) return;
      useStore.setState({ draft: [...c, pt(e)] });
      hover = true;
    });
    on("dblclick", () => {
      useStore.setState({ draft: committed() });
      hover = false;
      finishPoly();
    });
  }

  const key = (e: KeyboardEvent) => {
    if (e.key === "Escape") stopDraw();
    else if (e.key === "Enter") finishPoly();
    else if (e.key === "Backspace" && useStore.getState().drawMode === "poly") undoPoint();
  };
  window.addEventListener("keydown", key);
  offs.push(() => window.removeEventListener("keydown", key));
  offs.push(() => {
    canvas.style.cursor = prevCursor;
    m.doubleClickZoom.enable();
  });
  cleanup = () => offs.forEach((f) => f());
}
