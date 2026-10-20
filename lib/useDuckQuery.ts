import { useEffect, useState } from "react";
import { getDuck, type DuckBackend, type Query } from "./backend";
import { useStore } from "./store";
import { useColorModel } from "./useColorModel";

/** Runs an exact (Parquet) query for the applied filters/area; `deps` are extra inputs of `run`. */
export function useDuckQuery<T>(run: (be: DuckBackend, q: Query) => Promise<T>, deps: unknown[]) {
  const applied = useStore((s) => s.applied);
  const status = useStore((s) => s.parquet.status);
  const cm = useColorModel();
  const [res, setRes] = useState<{ data: T | null; loading: boolean }>({ data: null, loading: true });

  useEffect(() => {
    const be = getDuck();
    if (!be) {
      setRes({ data: null, loading: false });
      return;
    }
    let cancelled = false;
    setRes((r) => ({ ...r, loading: true }));
    const t = setTimeout(async () => {
      const q: Query = { filters: applied.filters, legend: applied.legend, legendCtx: cm.legendCtx, extent: null, area: applied.area };
      try {
        const data = await run(be, q);
        if (!cancelled) setRes({ data, loading: false });
      } catch (e) {
        console.error(e);
        if (!cancelled) setRes({ data: null, loading: false });
      }
    }, 50);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied, cm.legendCtx, status, ...deps]);

  return res;
}
