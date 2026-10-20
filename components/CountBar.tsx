"use client";

import { RotateCcw } from "lucide-react";
import { useStore } from "@/lib/store";

export const hasFilters = (s: ReturnType<typeof useStore.getState>) => {
  const f = s.filters;
  return !!(f.year || f.doy || f.acres || f.mtbs || f.incident?.length || Object.values(f.cats).some((v) => v?.length) || s.legend.isolate || s.legend.hidden.length || s.anim.year != null || s.area);
};

export default function CountBar() {
  const stats = useStore((s) => s.stats);
  const parquet = useStore((s) => s.parquet);
  const dirty = useStore(hasFilters);
  const reset = useStore((s) => s.resetFilters);
  return (
    <div className="border-b border-line px-4 py-2">
      <div className="flex items-center justify-between gap-2">
        <div aria-live="polite">
          <span className="text-lg font-semibold tabular-nums">
            {stats.total == null ? "…" : (stats.exact ? "" : "≈ ") + stats.total.toLocaleString()}
          </span>{" "}
          <span className="text-xs text-muted">{stats.exact ? "fires match" : "fires in view (approximate)"}</span>
          {stats.loading && <span className="ml-1 text-xs text-muted">updating…</span>}
        </div>
        <button className="btn text-xs" onClick={reset} disabled={!dirty}>
          <span className="inline-flex items-center gap-1"><RotateCcw size={12} aria-hidden />Reset</span>
        </button>
      </div>
      {stats.total === 0 && !stats.loading && <p className="mt-1 text-xs text-warn">No fires match. Widen the filters or reset.</p>}
      {parquet.status === "loading" && <p className="mt-1 text-xs text-muted">Loading exact data (DuckDB): {parquet.message}</p>}
      {parquet.status === "error" && (
        <p className="mt-1 text-xs text-warn">Exact mode unavailable ({parquet.message}). Showing approximate results.</p>
      )}
    </div>
  );
}
