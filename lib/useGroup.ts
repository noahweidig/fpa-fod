import { useEffect, useState } from "react";
import { getBackend, type GroupRow, type Query } from "./backend";
import { useColorModel } from "./useColorModel";
import { useStore } from "./store";
import type { DimId } from "./types";

export interface GroupResult {
  rows: GroupRow[] | null;
  loading: boolean;
  exact: boolean;
}

/** Group counts for the applied filters (optionally ignoring the year filter / limited to the map extent). */
export function useGroup(dims: DimId[], opts: { ignoreYear?: boolean; enabled?: boolean } = {}): GroupResult {
  const applied = useStore((s) => s.applied);
  const status = useStore((s) => s.parquet.status);
  const bounds = useStore((s) => s.bounds);
  const tileSeq = useStore((s) => s.tileSeq);
  const chartExtent = useStore((s) => s.chartExtent);
  const meta = useStore((s) => s.meta);
  const cm = useColorModel();
  const [res, setRes] = useState<GroupResult>({ rows: null, loading: true, exact: false });
  const exact = status === "ready";
  const key = dims.join(",");
  const enabled = opts.enabled ?? true;

  useEffect(() => {
    if (!meta || !enabled) return;
    let cancelled = false;
    setRes((r) => ({ ...r, loading: true }));
    const t = setTimeout(async () => {
      const be = getBackend();
      const filters = opts.ignoreYear ? { ...applied.filters, year: null } : applied.filters;
      const q: Query = { filters, legend: applied.legend, legendCtx: cm.legendCtx, extent: be.kind === "exact" && chartExtent ? bounds : null };
      try {
        const rows = await be.group(dims, q);
        if (!cancelled) setRes({ rows, loading: false, exact: be.kind === "exact" });
      } catch (e) {
        console.error(e);
        if (!cancelled) setRes({ rows: [], loading: false, exact: be.kind === "exact" });
      }
    }, exact ? 50 : 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, enabled, key, applied, cm.legendCtx, exact, chartExtent, opts.ignoreYear, exact && !chartExtent ? 0 : bounds, exact ? 0 : tileSeq]);

  return res;
}
