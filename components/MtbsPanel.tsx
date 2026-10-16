"use client";

import { useEffect, useState } from "react";
import { getDuck } from "@/lib/backend";
import { useStore } from "@/lib/store";

/** MTBS perimeter layer + link filter (FOD MTBS_ID = MTBS event_id). */
export default function MtbsPanel() {
  const mtbsLayer = useStore((s) => s.mtbsLayer);
  const filter = useStore((s) => s.filters.mtbs);
  const status = useStore((s) => s.parquet.status);
  const patch = useStore((s) => s.patchFilters);
  const [linked, setLinked] = useState<number | null>(null);
  const hasCol = status === "ready" && !!getDuck()?.h.cols.mtbsId;

  useEffect(() => {
    if (!hasCol) return setLinked(null);
    let off = false;
    getDuck()!.mtbsLinkedCount().then((n) => !off && setLinked(n)).catch(() => {});
    return () => {
      off = true;
    };
  }, [hasCol]);

  return (
    <section>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">MTBS perimeters</div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={mtbsLayer} onChange={(e) => useStore.setState({ mtbsLayer: e.target.checked })} />
        Show burned-area perimeters
      </label>
      <label className={`mt-1 flex items-center gap-2 text-sm ${hasCol ? "" : "opacity-50"}`}>
        <input
          type="checkbox" disabled={!hasCol} checked={!!filter && !filter.ids}
          onChange={(e) => patch({ mtbs: e.target.checked ? { ids: null } : null })}
        />
        Only ignitions linked to a perimeter{linked != null ? ` (${linked.toLocaleString()})` : ""}
      </label>
      {filter?.ids && (
        <p className="mt-1 text-xs">
          Linked to: <b>{filter.ids.join(", ")}</b>{" "}
          <button className="underline" onClick={() => patch({ mtbs: null })}>clear</button>
        </p>
      )}
      <p className="mt-1 text-xs text-muted">
        Matches FOD <code>MTBS_ID</code> to MTBS <code>Event_ID</code>. Several ignitions can share one perimeter. Click a perimeter or a linked fire for details.
        {!hasCol && " Needs the Parquet data with an MTBS_ID column."}
      </p>
    </section>
  );
}
