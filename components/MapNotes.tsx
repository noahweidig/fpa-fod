"use client";

import { Check, Compass, Layers } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { FULL_DETAIL_ZOOM, REGIONS } from "@/lib/config";
import { getMap } from "@/lib/mapInstance";
import { BASEMAP_LABELS } from "@/lib/basemaps";
import { useStore } from "@/lib/store";
import type { Basemap } from "@/lib/types";

export default function MapNotes() {
  const [open, setOpen] = useState(false);
  const [baseOpen, setBaseOpen] = useState(false);
  const baseRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!baseOpen) return;
    const down = (e: PointerEvent) => {
      if (!baseRef.current?.contains(e.target as Node)) setBaseOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setBaseOpen(false);
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
    };
  }, [baseOpen]);
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
        <span className="inline-flex items-center gap-1"><Compass size={16} aria-hidden /> Map</span>
      </button>
      <div ref={baseRef} className="absolute left-3 top-[6.1rem] z-10 md:top-3">
        <button
          className="btn shadow" onClick={() => setBaseOpen(!baseOpen)}
          aria-expanded={baseOpen} aria-haspopup="true" aria-label="Basemap" title="Basemap"
        >
          <Layers size={16} aria-hidden />
        </button>
        {baseOpen && (
          <div className="absolute left-0 top-full mt-1 min-w-32 overflow-hidden rounded-md border border-line bg-panel py-1 shadow" role="group" aria-label="Basemap">
            {(Object.keys(BASEMAP_LABELS) as Basemap[]).map((b) => (
              <button
                key={b} className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-xs hover:bg-line/50 ${basemap === b ? "font-semibold" : ""}`}
                aria-pressed={basemap === b} onClick={() => { useStore.setState({ basemap: b }); setBaseOpen(false); }}
              >
                {BASEMAP_LABELS[b]}
                {basemap === b && <Check size={14} aria-hidden />}
              </button>
            ))}
          </div>
        )}
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
      <div className={`absolute right-14 top-2.5 z-10 flex max-md:left-14 max-md:right-auto max-md:top-[6.1rem] overflow-hidden rounded-md border border-line bg-panel shadow ${hide}`} role="group" aria-label="Jump to region">
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
