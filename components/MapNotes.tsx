"use client";

import { FULL_DETAIL_ZOOM, REGIONS } from "@/lib/config";
import { getMap } from "@/lib/mapInstance";
import { useStore } from "@/lib/store";

export default function MapNotes() {
  const zoom = useStore((s) => s.zoom);
  return (
    <>
      <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2">
        {zoom < FULL_DETAIL_ZOOM && (
          <div className="rounded-md bg-panel/90 px-3 py-1 text-xs text-muted shadow">Low zooms show a sample of fires.</div>
        )}
      </div>
      <div className="absolute right-14 top-2.5 z-10 flex overflow-hidden rounded-md border border-line bg-panel shadow" role="group" aria-label="Jump to region">
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
