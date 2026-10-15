"use client";

import { useEffect } from "react";
import { getBackend, type Query } from "@/lib/backend";
import { useStore } from "@/lib/store";
import { OTHER } from "@/lib/types";
import { useColorModel } from "@/lib/useColorModel";

/** Computes the live count and legend counts for the applied (debounced) filters. */
export default function StatsRunner() {
  const applied = useStore((s) => s.applied);
  const status = useStore((s) => s.parquet.status);
  const bounds = useStore((s) => s.bounds);
  const tileSeq = useStore((s) => s.tileSeq);
  const meta = useStore((s) => s.meta);
  const cm = useColorModel();

  const exact = status === "ready";
  useEffect(() => {
    if (!meta) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const be = getBackend();
      useStore.setState((s) => ({ stats: { ...s.stats, loading: true, exact: be.kind === "exact" } }));
      try {
        const q: Query = { filters: applied.filters, legend: applied.legend, legendCtx: cm.legendCtx, extent: null };
        const total = (await be.group([], q)).reduce((a, r) => a + r.n, 0);
        const legendCounts: Record<string, number> = {};
        if (cm.dim && cm.dim !== "year") {
          const colored = new Set(cm.legendCtx.colored);
          for (const r of await be.group([cm.dim], { ...q, legend: null })) {
            const k = String(r.keys[0]);
            if (cm.dim === "month" && k === "0") continue;
            const key = colored.has(k) ? k : OTHER;
            legendCounts[key] = (legendCounts[key] ?? 0) + r.n;
          }
        }
        if (!cancelled) useStore.setState({ stats: { total, exact: be.kind === "exact", loading: false, legendCounts } });
      } catch (e) {
        console.error(e);
        if (!cancelled) useStore.setState((s) => ({ stats: { ...s.stats, loading: false } }));
      }
    }, exact ? 0 : 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // approximate counts follow the viewport; exact counts do not
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, applied, cm.legendCtx, cm.dim, exact, exact ? 0 : bounds, exact ? 0 : tileSeq]);

  return null;
}
