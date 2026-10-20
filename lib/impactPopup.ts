import * as maplibregl from "maplibre-gl";
import { fmtImpact, incidentLinks, incidentsForFod, incidentsForMtbs, type Incident } from "./impact";
import { getMap } from "./mapInstance";
import { useStore } from "./store";

const n = (v: number | null) => (v == null ? "–" : Math.round(v).toLocaleString());
const plural = (k: number, w: string) => `${k.toLocaleString()} ${w}${k === 1 ? "" : "s"}`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, cls?: string) {
  const e = document.createElement(tag);
  if (text != null) e.textContent = text;
  if (cls) e.className = cls;
  return e;
}

function button(label: string, onClick: () => void) {
  const b = el("button", label, "fod-popup-btn");
  b.onclick = onClick;
  return b;
}

/** Zoom to an incident's linked ignitions (or its point of origin) and filter the map to them. */
export async function focusIncident(inc: Incident, filter: boolean) {
  const map = getMap();
  useStore.setState({ drawer: false });
  if (filter) useStore.getState().patchFilters({ incident: [inc.rootId] });
  try {
    const links = await incidentLinks(inc.rootId);
    if (map && links.fod.length > 1) {
      const b = new maplibregl.LngLatBounds();
      for (const f of links.fod) b.extend([f.lon, f.lat]);
      map.fitBounds(b, { padding: 80, maxZoom: 12, duration: 700 });
      return;
    }
    if (map && links.fod.length === 1) return void map.flyTo({ center: [links.fod[0].lon, links.fod[0].lat], zoom: Math.max(map.getZoom(), 12) });
  } catch (e) {
    console.error(e);
  }
  if (map && inc.lat != null && inc.lon != null) map.flyTo({ center: [inc.lon, inc.lat], zoom: Math.max(map.getZoom(), 10) });
}

const QA_TEXT: Record<string, string> = {
  complex_member: "Member of a complex; the complex reports its own totals, so do not add the two.",
  destroyed_vs_acres: "Many structures for very few acres. Likely a reporting error.",
  prescribed: "Prescribed burn.",
  sparse_reporting: "Before 2002 damage fields were reported sparsely.",
  location_from_fod: "Location taken from the largest linked ignition.",
};

/** One incident: impact figures, link counts and data-quality notes. `byName` resolves a complex's name. */
export function incidentBlock(inc: Incident, byName: Map<string, Incident>, actions: boolean): HTMLElement {
  const box = el("div");
  box.style.margin = "4px 0 8px";
  const head = el("div", `${inc.name || inc.id} (${inc.year}${inc.state ? ", " + inc.state : ""})`);
  head.style.fontWeight = "600";
  box.appendChild(head);
  const t = el("table");
  const row = (k: string, v: string) => {
    const tr = t.insertRow();
    tr.appendChild(el("th", k));
    tr.insertCell().textContent = v;
  };
  row("Structures destroyed", `${n(inc.destroyed)}${inc.destroyedRes != null ? ` (${n(inc.destroyedRes)} residential)` : ""}`);
  row("Structures damaged", n(inc.damaged));
  row("Fatalities", n(inc.fatalities));
  row("Injuries", n(inc.injuries));
  if (inc.evac) row("Peak evacuations", n(inc.evac));
  row("Management cost", fmtImpact("cost", inc.cost));
  row("Final acres", n(inc.acres));
  box.appendChild(t);
  const links = el("div", `Links: ${plural(inc.fodNRollup, "ignition")}, ${plural(inc.mtbsNRollup, "MTBS perimeter")}. Figures are for the whole incident.`);
  links.style.marginTop = "3px";
  box.appendChild(links);
  const parent = inc.parentId ? byName.get(inc.parentId) : null;
  if (parent) {
    const p = el("div", `Part of ${parent.name} (${n(parent.destroyed)} destroyed, ${n(parent.fatalities)} deaths). Use the complex for totals.`);
    p.style.marginTop = "3px";
    box.appendChild(p);
  }
  for (const f of inc.qa) {
    if (f === "complex_member" && parent) continue;
    const msg = QA_TEXT[f];
    if (!msg) continue;
    const q = el("div", msg);
    q.style.marginTop = "3px";
    q.style.opacity = "0.8";
    box.appendChild(q);
  }
  if (actions) {
    box.appendChild(button("Show only this incident's ignitions", () => void focusIncident(inc, true)));
  }
  return box;
}

function section(root: HTMLElement, title: string, incidents: Incident[], intro?: string) {
  const byId = new Map(incidents.map((i) => [i.id, i]));
  const wrap = el("div");
  wrap.style.marginTop = "8px";
  wrap.style.borderTop = "1px solid var(--line)";
  wrap.style.paddingTop = "6px";
  const h = el("div", title);
  h.style.fontWeight = "600";
  wrap.appendChild(h);
  if (intro) wrap.appendChild(el("div", intro));
  // show each complex or standalone incident once; its members are mentioned inside
  const roots = incidents.filter((i) => i.isRoot);
  const shown = roots.length ? roots : incidents;
  for (const inc of shown) wrap.appendChild(incidentBlock(inc, byId, true));
  root.appendChild(wrap);
}

/** Appended to a FOD point popup: the ICS-209-PLUS incident(s) that report on this ignition. */
export function appendFodImpact(root: HTMLElement, fodId: unknown) {
  if (fodId == null || !useStore.getState().parquet.ics) return;
  incidentsForFod(fodId as string | number)
    .then((rows) => {
      if (!rows.length) return;
      const roots = rows.filter((r) => r.isRoot);
      const intro =
        roots.length > 1
          ? `Listed under ${roots.length} incident reports (data quality: the same ignition appears in more than one). Do not add them.`
          : rows.some((r) => !r.isRoot)
            ? "This ignition belongs to a member fire of a complex."
            : undefined;
      section(root, "ICS-209-PLUS impact", rows, intro);
    })
    .catch(() => {});
}

/** Appended to an MTBS perimeter popup. */
export function appendMtbsImpact(root: HTMLElement, eventId: string) {
  if (!eventId || !useStore.getState().parquet.ics) return;
  incidentsForMtbs(eventId)
    .then((rows) => {
      if (!rows.length) return;
      const roots = rows.filter((r) => r.isRoot);
      const intro =
        roots.length > 1
          ? `${roots.length} incident reports link to this perimeter. Each reports its own totals; do not add them.`
          : roots[0] && roots[0].mtbsNRollup > 1
            ? `This incident spans ${roots[0].mtbsNRollup} MTBS perimeters, so its totals cover all of them.`
            : undefined;
      section(root, "ICS-209-PLUS impact", rows, intro);
    })
    .catch(() => {});
}

export function showIncidentPopup(map: maplibregl.Map, inc: Incident, at: [number, number]) {
  const root = el("div", undefined, "fod-popup");
  root.appendChild(incidentBlock(inc, new Map(), true));
  new maplibregl.Popup({ maxWidth: "340px" }).setLngLat(at).setDOMContent(root).addTo(map);
}
