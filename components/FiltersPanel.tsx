"use client";

import { useStore } from "@/lib/store";
import RangeSlider from "./RangeSlider";

export default function FiltersPanel() {
  const meta = useStore((s) => s.meta)!;
  const yb = useStore((s) => s.yearBounds);
  const year = useStore((s) => s.filters.year);
  const patch = useStore((s) => s.patchFilters);
  return (
    <div className="space-y-5">
      {meta.fieldMap.year && yb && (
        <section>
          <div className="mb-1 flex justify-between text-xs font-semibold uppercase tracking-wide text-muted">
            <span>Year</span>
            <span className="normal-case tabular-nums text-ink">{(year ?? yb).join(" – ")}</span>
          </div>
          <RangeSlider
            label="Year range" min={yb[0]} max={yb[1]} value={year ?? yb}
            onChange={(v) => patch({ year: v[0] === yb[0] && v[1] === yb[1] ? null : v })}
          />
        </section>
      )}
    </div>
  );
}
