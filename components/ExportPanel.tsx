"use client";

import { useState } from "react";
import type { Query } from "@/lib/backend";
import { EXPORT_WARN_ROWS } from "@/lib/config";
import { exportDuck, exportPng, exportTiles, tileFeatures } from "@/lib/export";
import { useStore } from "@/lib/store";
import { useColorModel } from "@/lib/useColorModel";

export default function ExportPanel() {
  const applied = useStore((s) => s.applied);
  const parquet = useStore((s) => s.parquet);
  const stats = useStore((s) => s.stats);
  const cm = useColorModel();
  const [sidecar, setSidecar] = useState(false);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const exact = parquet.status === "ready";
  const total = stats.total ?? 0;
  const big = exact && total > EXPORT_WARN_ROWS;
  const query = (): Query => ({
    filters: applied.filters,
    legend: applied.legend,
    legendCtx: cm.legendCtx,
    extent: exact && useStore.getState().chartExtent ? useStore.getState().bounds : null,
  });

  const run = async (label: string, fn: () => Promise<string | void> | string | void) => {
    setBusy(label);
    setErr(null);
    setMsg(null);
    try {
      const r = await fn();
      setMsg(r ?? "Done.");
    } catch (e) {
      console.error(e);
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const disabled = !!busy || (big && !ack) || total === 0;
  const dl = (kind: "csv" | "geojson" | "parquet") => () =>
    run(kind, async () => {
      if (exact) {
        const n = await exportDuck(kind, query(), sidecar, (s) => setMsg(s));
        return `Exported ${n.toLocaleString()} rows.`;
      }
      if (kind === "parquet") throw new Error("Parquet export needs NEXT_PUBLIC_FOD_PARQUET_URL.");
      return `Exported ${exportTiles(kind, query(), sidecar).toLocaleString()} features.`;
    });

  return (
    <div className="space-y-4">
      {exact ? (
        <p className="text-sm">
          Exports <b className="tabular-nums">{total.toLocaleString()}</b> records matching the current filters, from the full Parquet file.
        </p>
      ) : (
        <div className="rounded border border-line bg-warnbg p-3 text-xs text-warn">
          <b>Limited to loaded tiles.</b> Without a Parquet file, exports contain only the features currently rendered in the map view (about{" "}
          {tileFeatures(query()).length.toLocaleString()} now), deduplicated by FOD_ID. Low zooms show a thinned sample; zoom in for complete records.
        </div>
      )}
      {big && (
        <div className="rounded border border-line bg-warnbg p-3 text-xs text-warn">
          <b>Large export:</b> {total.toLocaleString()} rows (over {EXPORT_WARN_ROWS.toLocaleString()}). This can take minutes and use a lot of memory; GeoJSON is the heaviest.
          <label className="mt-2 flex items-center gap-2">
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /> I understand, export anyway
          </label>
        </div>
      )}
      <fieldset className="space-y-2">
        <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Data</legend>
        <div className="flex flex-wrap gap-1">
          <button className="btn" disabled={disabled} onClick={dl("csv")}>CSV</button>
          <button className="btn" disabled={disabled} onClick={dl("geojson")}>GeoJSON</button>
          <button className="btn" disabled={disabled || !exact} onClick={dl("parquet")} title={exact ? "" : "Requires NEXT_PUBLIC_FOD_PARQUET_URL"}>Parquet</button>
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={sidecar} onChange={(e) => setSidecar(e.target.checked)} />
          Write CSV metadata to a separate .json file (default: “#” comment lines at the top)
        </label>
        <p className="text-xs text-muted">
          Every export records filters, generation date and source: CSV header comments (or sidecar), a GeoJSON <code>metadata</code> member, Parquet key-value metadata.
        </p>
      </fieldset>
      <fieldset>
        <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Map image</legend>
        <button className="btn" disabled={!!busy} onClick={() => run("png", async () => (await exportPng(), "Saved PNG."))}>
          Download PNG
        </button>
      </fieldset>
      {busy && <p className="text-xs text-muted" role="status">Working… {msg}</p>}
      {!busy && msg && <p className="text-xs text-muted" role="status">{msg}</p>}
      {err && <p className="text-xs text-err" role="alert">{err}</p>}
    </div>
  );
}
