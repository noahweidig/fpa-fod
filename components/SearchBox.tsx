"use client";

import maplibregl from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { getDuck } from "@/lib/backend";
import { getMap } from "@/lib/mapInstance";
import { rectArea } from "@/lib/area";
import { commitArea } from "@/lib/areaLayer";
import { matchValue, stateValue } from "@/lib/place";
import { qi, ql } from "@/lib/sql";
import { useStore } from "@/lib/store";

interface Hit {
  kind: "place" | "fire";
  label: string;
  sub: string;
  lon: number;
  lat: number;
  bbox?: [number, number, number, number];
  ptype?: string;
  state?: string;
  country?: string;
}

const PHOTON = "https://photon.komoot.io/api/";

async function searchPlaces(q: string, signal: AbortSignal): Promise<Hit[]> {
  const r = await fetch(`${PHOTON}?limit=5&lang=en&q=${encodeURIComponent(q)}`, { signal });
  if (!r.ok) return [];
  const j = await r.json();
  return (j.features ?? []).map((f: any): Hit => {
    const p = f.properties ?? {};
    const [lon, lat] = f.geometry.coordinates;
    return {
      kind: "place",
      label: p.name ?? p.street ?? q,
      sub: [p.city, p.county, p.state, p.country].filter((v, i, a) => v && v !== p.name && a.indexOf(v) === i).join(", "),
      lon, lat,
      ptype: p.type,
      state: p.state,
      country: p.countrycode,
      bbox: p.extent ? [p.extent[0], p.extent[3], p.extent[2], p.extent[1]] : undefined,
    };
  });
}

async function searchFires(q: string): Promise<Hit[]> {
  const d = getDuck();
  if (!d) return [];
  const { cols, conn } = d.h;
  const t = q.replace(/[%_\\]/g, "").trim();
  if (!t) return [];
  const conds: string[] = [];
  if (cols.name) conds.push(`lower(CAST(${qi(cols.name)} AS VARCHAR)) LIKE ${ql(`%${t.toLowerCase()}%`)}`);
  if (cols.id && /^\d+$/.test(t)) conds.push(`CAST(${qi(cols.id)} AS VARCHAR) = ${ql(t)}`);
  if (!conds.length) return [];
  const sel = (c: string | undefined, a: string) => (c ? `CAST(${qi(c)} AS VARCHAR)` : `''`) + ` AS ${a}`;
  const res = await conn.query(
    `SELECT ${sel(cols.name, "n")}, ${sel(cols.id, "i")}, ${sel(cols.year, "y")}, ${sel(cols.state, "s")}, ${sel(cols.size, "a")},
       CAST(${qi(cols.lon!)} AS DOUBLE) AS lon, CAST(${qi(cols.lat!)} AS DOUBLE) AS lat
     FROM fod WHERE ${conds.join(" OR ")}
     ORDER BY ${cols.size ? `TRY_CAST(${qi(cols.size)} AS DOUBLE) DESC NULLS LAST` : "1"} LIMIT 8`,
  );
  return res.toArray().map((r: unknown) => {
    const o = (r as { toJSON(): Record<string, unknown> }).toJSON();
    const acres = Number(o.a);
    return {
      kind: "fire" as const,
      label: String(o.n || `Fire ${o.i}`),
      sub: [o.y, o.s, Number.isFinite(acres) && o.a !== "" ? `${acres.toLocaleString()} ac` : "", o.i ? `ID ${o.i}` : ""].filter(Boolean).join(" · "),
      lon: Number(o.lon),
      lat: Number(o.lat),
    };
  });
}

/** Filter fires to a state/county via the data fields, or to the place's bounding box. Returns a status line. */
function filterToPlace(h: Hit): string {
  const st = useStore.getState();
  const vals = st.categories.values;
  const us = h.country === "US";
  if (us && h.ptype === "state" && vals.state.length) {
    const v = stateValue(h.label, vals.state);
    if (v) {
      st.patchFilters({ cats: { ...st.filters.cats, state: [v], county: [] } });
      return `Filtered to state ${v}.`;
    }
  }
  if (us && h.ptype === "county" && h.state && vals.state.length && vals.county.length) {
    const s = stateValue(h.state, vals.state);
    const c = matchValue(h.label, vals.county);
    if (s && c) {
      st.patchFilters({ cats: { ...st.filters.cats, state: [s], county: [c] } });
      return `Filtered to ${c} County, ${s}.`;
    }
  }
  if (h.bbox && st.parquet.status === "ready") {
    commitArea(rectArea([h.bbox[0], h.bbox[1]], [h.bbox[2], h.bbox[3]]), `Box: ${h.label}`);
    return "No matching state/county value in the data; selected the place's bounding box instead.";
  }
  return "Could not filter to this place (no match in the data and no Parquet for an area).";
}

export default function SearchBox() {
  const parquet = useStore((s) => s.parquet.status);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const marker = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 3) {
      setHits([]);
      setBusy(false);
      return;
    }
    const ac = new AbortController();
    setBusy(true);
    const t = setTimeout(async () => {
      const [fires, places] = await Promise.all([
        searchFires(term).catch(() => []),
        searchPlaces(term, ac.signal).catch(() => []),
      ]);
      if (ac.signal.aborted) return;
      setHits([...fires, ...places]);
      setBusy(false);
    }, 350);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [q, parquet]);

  useEffect(() => () => void marker.current?.remove(), []);

  const go = (h: Hit) => {
    const map = getMap();
    if (!map) return;
    marker.current?.remove();
    marker.current = new maplibregl.Marker({ color: "#2a78d6" }).setLngLat([h.lon, h.lat]).addTo(map);
    if (h.bbox) map.fitBounds([[h.bbox[0], h.bbox[1]], [h.bbox[2], h.bbox[3]]], { padding: 60, maxZoom: 14 });
    else map.flyTo({ center: [h.lon, h.lat], zoom: Math.max(map.getZoom(), h.kind === "fire" ? 12 : 10) });
    setQ(h.label);
    setOpen(false);
  };

  return (
    <div className="absolute left-28 right-14 top-3 z-10 md:left-3 md:right-auto md:top-12 md:w-80">
      <input
        type="search"
        value={q}
        placeholder={parquet === "ready" ? "Search place, fire name or ID" : "Search place"}
        aria-label="Search places and fires"
        className="w-full rounded-md border border-line bg-panel px-3 py-1.5 shadow"
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          if (e.key === "Enter" && hits[0]) go(hits[0]);
        }}
      />
      {note && (
        <p className="mt-1 rounded-md border border-line bg-panel px-2 py-1 text-xs shadow" role="status">
          {note} <button className="underline" onClick={() => setNote(null)}>dismiss</button>
        </p>
      )}
      {open && q.trim().length >= 3 && (
        <ul className="mt-1 max-h-80 overflow-auto rounded-md border border-line bg-panel shadow" role="listbox">
          {hits.map((h, i) => (
            <li key={i} className="flex items-center">
              <button className="block min-w-0 flex-1 px-3 py-1.5 text-left hover:bg-bg" onClick={() => go(h)}>
                <span className="mr-1 text-xs text-muted">{h.kind === "fire" ? "🔥" : "📍"}</span>
                {h.label}
                {h.sub && <span className="block truncate text-xs text-muted">{h.sub}</span>}
              </button>
              {h.kind === "place" && (h.ptype === "state" || h.ptype === "county" || h.bbox) && (
                <button
                  className="btn mr-2 shrink-0 text-xs"
                  title="Limit counts, charts and exports to this place"
                  onClick={() => { go(h); setNote(filterToPlace(h)); }}
                >
                  Filter
                </button>
              )}
            </li>
          ))}
          {!hits.length && <li className="px-3 py-1.5 text-xs text-muted">{busy ? "Searching…" : "No results"}</li>}
        </ul>
      )}
    </div>
  );
}
