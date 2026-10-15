"use client";

import { FULL_DETAIL_ZOOM_OVERRIDE } from "@/lib/config";
import { lowZoomThreshold } from "@/lib/expressions";
import { useStore } from "@/lib/store";

export default function MapNotes() {
  const meta = useStore((s) => s.meta)!;
  const zoom = useStore((s) => s.zoom);
  const thr = FULL_DETAIL_ZOOM_OVERRIDE ?? lowZoomThreshold(meta);
  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-10 flex -translate-x-1/2 flex-col items-center gap-1">
      {zoom < thr && (
        <div className="rounded-md bg-panel/90 px-3 py-1 text-xs text-muted shadow">Low zooms show a sample of fires.</div>
      )}
    </div>
  );
}
