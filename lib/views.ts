import { getMap } from "./mapInstance";
import { useStore } from "./store";
import { parse, serialize } from "./url";

const KEY = "fod-saved-views";

export interface SavedView {
  name: string;
  /** URL query string, same format as the share link */
  q: string;
  at: string;
}

export function loadViews(): SavedView[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x?.name === "string" && typeof x?.q === "string") : [];
  } catch {
    return [];
  }
}

function store(v: SavedView[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* storage may be unavailable */
  }
}

/** Saves the current view under `name` (replaces a view with the same name). */
export function saveView(name: string): SavedView[] {
  const s = useStore.getState();
  const q = serialize(s);
  const next = [{ name, q, at: new Date().toISOString() }, ...loadViews().filter((v) => v.name !== name)];
  store(next);
  return next;
}

export function deleteView(name: string): SavedView[] {
  const next = loadViews().filter((v) => v.name !== name);
  store(next);
  return next;
}

/** Restores a saved view: filters, colors, area, basemap and map position. */
export function applyView(v: SavedView) {
  const init = parse(v.q);
  const s = useStore.getState();
  useStore.setState({
    colorMode: "general", radiusMode: "zoom", heat: false, heatWeight: "count", basemap: s.theme, chartExtent: false, mtbsLayer: false,
    area: null, areaLabel: null, drawMode: null, draft: [], mtbsHl: null,
    anim: { ...s.anim, year: null, playing: false },
    ...init,
  });
  if (init.viewport) getMap()?.jumpTo({ center: [init.viewport.lng, init.viewport.lat], zoom: init.viewport.zoom });
}
