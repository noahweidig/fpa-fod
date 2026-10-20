"use client";

import { Circle, Pentagon, Square, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { areaFromGeoJSON, simplifyArea, vertexCount } from "@/lib/area";
import { commitArea, startDraw } from "@/lib/areaLayer";
import { getDuck } from "@/lib/backend";
import { getMap } from "@/lib/mapInstance";
import { useStore } from "@/lib/store";
import { areaBbox } from "@/lib/area";

interface Summary {
  n: number;
  acres: number;
  maxAcres: number;
  years: [number, number] | null;
}

async function readFile(f: File): Promise<unknown> {
  if (/\.zip$/i.test(f.name)) {
    const shp = (await import("shpjs")).default;
    return shp(await f.arrayBuffer());
  }
  return JSON.parse(await f.text());
}

export default function AreaPanel() {
  const area = useStore((s) => s.area);
  const label = useStore((s) => s.areaLabel);
  const applied = useStore((s) => s.applied);
  const status = useStore((s) => s.parquet.status);
  const exact = status === "ready";
  const [sum, setSum] = useState<Summary | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [radius, setRadius] = useState(25);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const d = getDuck();
    if (!exact || !d || !area) {
      setSum(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      d.summary({ filters: applied.filters, legend: null, legendCtx: null, extent: null, area: applied.area })
        .then((r) => !cancelled && setSum(r))
        .catch((e) => console.error(e));
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [exact, area, applied]);

  const upload = async (f: File) => {
    setErr(null);
    setMsg(null);
    try {
      const raw = areaFromGeoJSON(await readFile(f));
      if (!raw.length) throw new Error("No polygon features found. Upload a GeoJSON or zipped shapefile with polygons.");
      const { area: a, simplified } = simplifyArea(raw);
      commitArea(a, f.name);
      setMsg(
        `${a.length} polygon${a.length === 1 ? "" : "s"}${simplified ? `, simplified from ${vertexCount(raw).toLocaleString()} to ${vertexCount(a).toLocaleString()} vertices` : ""}.`,
      );
      const b = areaBbox(a);
      getMap()?.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 60, duration: 600 });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <section>
      <div className="mb-1 flex justify-between text-xs font-semibold uppercase tracking-wide text-muted">
        <span>Area</span>
        {label && <span className="max-w-[60%] truncate normal-case text-ink" title={label}>{label}</span>}
      </div>
      {!exact && <p className="mb-2 text-xs text-muted">Area selection needs the Parquet data{status === "loading" ? " (still loading)" : ""}.</p>}
      <div className="flex flex-wrap gap-1">
        <button className="btn" disabled={!exact} onClick={() => startDraw("rect")}><span className="inline-flex items-center gap-1"><Square size={14} aria-hidden /> Rectangle</span></button>
        <button className="btn" disabled={!exact} onClick={() => startDraw("poly")}><span className="inline-flex items-center gap-1"><Pentagon size={14} aria-hidden /> Polygon</span></button>
        <button className="btn" disabled={!exact} onClick={() => startDraw("circle", radius)}><span className="inline-flex items-center gap-1"><Circle size={14} aria-hidden /> Circle</span></button>
        <button className="btn" disabled={!exact} onClick={() => file.current?.click()}><span className="inline-flex items-center gap-1"><Upload size={14} aria-hidden /> Upload…</span></button>
        <button className="btn" disabled={!area} onClick={() => { useStore.setState({ area: null, areaLabel: null }); setMsg(null); setErr(null); }}><span className="inline-flex items-center gap-1"><Trash2 size={14} aria-hidden /> Clear</span></button>
      </div>
      <label className="mt-1 flex items-center gap-1 text-xs text-muted">
        <span>Circle radius</span>
        <input type="number" min={1} max={500} className="w-16 rounded border border-line bg-panel px-1 py-0.5 tabular-nums text-ink" value={radius} onChange={(e) => setRadius(Math.min(500, Math.max(1, Math.round(Number(e.target.value)) || 1)))} aria-label="Circle radius in miles" />
        <span>mi</span>
      </label>
      <input
        ref={file} type="file" accept=".geojson,.json,.zip,application/geo+json,application/json,application/zip" className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void upload(f);
        }}
      />
      <p className="mt-1 text-xs text-muted">Counts, charts and exports below follow the selected area. Upload GeoJSON or a zipped shapefile (polygons).</p>
      {area && sum && (
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 rounded border border-line p-2 text-xs">
          <dt className="text-muted">Ignitions</dt><dd className="text-right tabular-nums">{sum.n.toLocaleString()}</dd>
          <dt className="text-muted">Acres burned</dt><dd className="text-right tabular-nums">{Math.round(sum.acres).toLocaleString()}</dd>
          <dt className="text-muted">Largest fire (ac)</dt><dd className="text-right tabular-nums">{Math.round(sum.maxAcres).toLocaleString()}</dd>
          {sum.years && (<><dt className="text-muted">Years</dt><dd className="text-right tabular-nums">{sum.years[0]} – {sum.years[1]}</dd></>)}
        </dl>
      )}
      {msg && <p className="mt-1 text-xs text-muted">{msg}</p>}
      {err && <p className="mt-1 text-xs text-err" role="alert">{err}</p>}
    </section>
  );
}
