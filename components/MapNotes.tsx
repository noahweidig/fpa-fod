"use client";

import { Check, Layers, LocateFixed, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { FULL_DETAIL_ZOOM, REGIONS } from "@/lib/config";
import { getMap } from "@/lib/mapInstance";
import { BASEMAP_LABELS } from "@/lib/basemaps";
import { useStore } from "@/lib/store";
import type { Basemap } from "@/lib/types";

/** Square icon button (same height as the search box) with a dismissable popup menu. */
function IconMenu({ Icon, label, className, menuClass, items }: {
  Icon: LucideIcon;
  label: string;
  className: string;
  menuClass: string;
  items: { id: string; label: string; checked?: boolean; onPick: () => void }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <div ref={ref} className={`absolute z-10 ${className}`}>
      <button
        className="btn grid h-9 w-9 place-items-center p-0 shadow" onClick={() => setOpen(!open)}
        aria-expanded={open} aria-haspopup="true" aria-label={label} title={label}
      >
        <Icon size={16} aria-hidden />
      </button>
      {open && (
        <div className={`absolute top-full mt-1 min-w-32 overflow-hidden rounded-md border border-line bg-panel py-1 shadow ${menuClass}`} role="menu" aria-label={label}>
          {items.map((it) => (
            <button
              key={it.id} className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-xs hover:bg-line/50 ${it.checked ? "font-semibold" : ""}`}
              role={it.checked === undefined ? "menuitem" : "menuitemradio"} aria-checked={it.checked}
              onClick={() => { it.onPick(); setOpen(false); }}
            >
              {it.label}
              {it.checked && <Check size={14} aria-hidden />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MapNotes() {
  const zoom = useStore((s) => s.zoom);
  const basemap = useStore((s) => s.basemap);
  const loading = useStore((s) => s.tilesLoading);
  const empty = useStore((s) => s.stats.total === 0 && !s.stats.loading);
  return (
    <>
      <IconMenu
        Icon={Layers} label="Basemap" className="left-3 top-14 md:top-3" menuClass="left-0"
        items={(Object.keys(BASEMAP_LABELS) as Basemap[]).map((b) => ({
          id: b, label: BASEMAP_LABELS[b], checked: basemap === b, onPick: () => useStore.setState({ basemap: b }),
        }))}
      />
      <IconMenu
        Icon={LocateFixed} label="Jump to region" className="left-14 top-14 md:left-auto md:right-14 md:top-3" menuClass="max-md:left-0 md:right-0"
        items={REGIONS.map((r) => ({
          id: r.id, label: r.label, onPick: () => getMap()?.flyTo({ center: [r.lng, r.lat], zoom: r.zoom, duration: 900 }),
        }))}
      />
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
    </>
  );
}
