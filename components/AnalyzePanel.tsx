"use client";

import { useStore } from "@/lib/store";
import ComparePanel from "./ComparePanel";
import TopFires from "./TopFires";

export default function AnalyzePanel() {
  const exact = useStore((s) => s.parquet.status === "ready");
  if (!exact) {
    return (
      <p className="text-xs text-muted">
        Top fires and period compare query the full Parquet file. Set <code>NEXT_PUBLIC_FOD_PARQUET_URL</code> (or wait for it to finish loading).
      </p>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">Exact results over all fires in the Parquet, using the current filters and area.</p>
      <TopFires />
      <ComparePanel />
    </div>
  );
}
