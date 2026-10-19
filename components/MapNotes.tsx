"use client";

import { Layers } from "lucide-react";
import { useState } from "react";
import { FULL_DETAIL_ZOOM, REGIONS } from "@/lib/config";
import { getMap } from "@/lib/mapInstance";
import { BASEMAP_LABELS } from "@/lib/basemaps";
import { useStore } from "@/lib/store";
import type { Basemap } from "@/lib/types";

export default function MapNotes() {
  const [open, setOpen] = useState(false);
  const hide = open ? "" : "max-md:hidden";
  const zoom = useStore((s) => s.zoom);
  const basemap = useStore((s) => s.basemap);
  const loading = useStore((s) => s.tilesLoading);
  const empty = useStore((s) => s.stats.total === 0 && !s.stats.loading);
  return (
    <>
      <button
        className="btn absolute left-3 top-14 z-10 shadow md:hidden" onClick={() => setOpen(!open)}
        aria-expanded={open} aria-label="Map options"
      >
        <span className="inline-flex items-center gap-1"><Layers size={16} aria-hidden /> Map</span>
      </button>
      <div className={`absolute left-3 top-[6.1rem] z-10 flex overflow-hidden rounded-md border border-line bg-panel shadow md:top-3 ${hide}`} role="group" aria-label="Basemap">
        {(Object.keys(BASEMAP_LABELS) as Basemap[]).map((b) => (
          <button
            key={b} className={`border-r border-line px-2 py-1 text-xs last:border-r-0 ${basemap === b ? "bg-accent text-accent-ink" : "hover:bg-line/50"}`}
            aria-pressed={basemap === b} onClick={() => useStore.setState({ basemap: b })}
          >
            {BASEMAP_LABELS[b]}
          </button>
        ))}
      </div>
      {loading && (
        <div className="pointer-events-none absolute left-1/2 top-12 z-10 -translate-x-1/2 rounded-full bg-panel/90 px-3 py-1 text-xs text-muted shadow" role="status">
          Loading tiles…
        </div>
      )}
      {empty && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
          <div className="rounded-lg bg-panel/95 px-4 py-3 text-center text-sm shadow">
            No fires match the current filters.
            <div className="text-xs text-muted">Widen a filter or press Reset.</div>
          </div>
        </div>
      )}
      <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 max-md:hidden">
        {zoom < FULL_DETAIL_ZOOM && (
          <div className="rounded-md bg-panel/90 px-3 py-1 text-xs text-muted shadow">Low zooms show a sample of fires.</div>
        )}
      </div>
      <div className={`absolute right-14 top-2.5 z-10 flex max-md:left-3 max-md:right-auto max-md:top-[8.6rem] overflow-hidden rounded-md border border-line bg-panel shadow ${hide}`} role="group" aria-label="Jump to region">
        {REGIONS.map((r) => (
          <button
            key={r.id}
            className="border-r border-line px-2 py-1 text-xs last:border-r-0 hover:bg-line/50"
            onClick={() => getMap()?.flyTo({ center: [r.lng, r.lat], zoom: r.zoom, duration: 900 })}
          >
            {r.label}
          </button>
        ))}
      </div>
    </>
  );
}
