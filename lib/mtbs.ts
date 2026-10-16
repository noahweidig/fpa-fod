import maplibregl, { Popup } from "maplibre-gl";
import { getDuck } from "./backend";
import { MTBS_ID_FIELD } from "./config";
import { getMap } from "./mapInstance";
import { useStore } from "./store";

const fmt = (n: number) => Math.round(n).toLocaleString();

function button(label: string, onClick: () => void) {
  const b = document.createElement("button");
  b.textContent = label;
  b.className = "fod-popup-btn";
  b.onclick = onClick;
  return b;
}

/** Perimeter popup: attributes, plus the FOD ignitions that point to it via MTBS_ID. */
export function showMtbsPopup(map: maplibregl.Map, e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) {
  const f = e.features?.[0];
  if (!f) return;
  const props = f.properties ?? {};
  const id = String(props[MTBS_ID_FIELD] ?? "");
  useStore.setState({ mtbsHl: id || null });
  const root = document.createElement("div");
  root.className = "fod-popup";
  const h = document.createElement("div");
  h.style.fontWeight = "600";
  h.textContent = `MTBS perimeter: ${props.incid_name ?? ""}`;
  root.appendChild(h);
  const table = document.createElement("table");
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === "") continue;
    const tr = table.insertRow();
    const th = document.createElement("th");
    th.textContent = k;
    tr.appendChild(th);
    tr.insertCell().textContent = String(v);
  }
  const link = document.createElement("div");
  link.style.margin = "4px 0 6px";
  link.textContent = getDuck() ? "Looking up linked FOD ignitions…" : "Linked FOD counts need the Parquet data.";
  root.appendChild(link);
  root.appendChild(table);
  const popup = new Popup({ maxWidth: "340px" });
  popup.setLngLat(e.lngLat).setDOMContent(root).addTo(map);
  popup.on("close", () => {
    if (useStore.getState().mtbsHl === id) useStore.setState({ mtbsHl: null });
  });
  const d = getDuck();
  if (!d || !id) return;
  d.mtbsLinked(id).then((r) => {
    link.textContent = "";
    const t = document.createElement("div");
    t.textContent = r.n
      ? `${r.n.toLocaleString()} linked FOD ignition${r.n === 1 ? "" : "s"} (${fmt(r.acres)} ac recorded)`
      : "No FOD ignitions carry this MTBS_ID.";
    link.appendChild(t);
    if (r.n) {
      link.appendChild(
        button("Show only these ignitions", () => {
          const st = useStore.getState();
          st.patchFilters({ mtbs: { ids: [id] } });
          popup.remove();
        }),
      );
    }
  }).catch((err) => {
    console.error(err);
    link.textContent = "Could not look up linked ignitions.";
  });
}

/** Appended to a FOD point popup: link to the perimeter, when the fire has an MTBS_ID. */
export function appendMtbsLink(root: HTMLElement, fodId: unknown, point: [number, number], tileMtbsId?: unknown) {
  const d = getDuck();
  const direct = tileMtbsId ? String(tileMtbsId).trim() : "";
  const find = direct ? Promise.resolve(direct) : d && fodId != null ? d.mtbsFor(fodId as string | number) : Promise.resolve(null);
  find.then((id) => {
    if (!id) return;
    const box = document.createElement("div");
    box.style.marginTop = "6px";
    const t = document.createElement("div");
    t.textContent = `MTBS perimeter: ${id}`;
    box.appendChild(t);
    box.appendChild(
      button("Show perimeter", () => {
        const map = getMap();
        useStore.setState({ mtbsLayer: true, mtbsHl: id });
        if (map) map.flyTo({ center: point, zoom: Math.max(map.getZoom(), 9) });
      }),
    );
    root.appendChild(box);
  }).catch(() => {});
}
