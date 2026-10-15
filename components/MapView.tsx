"use client";

import type { Point } from "geojson";

import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { getBasemapStyle } from "@/lib/basemaps";
import { MAP_MAXZOOM, RDS_URL, SOURCE_MAXZOOM, START_VIEW } from "@/lib/config";
import { sampleTiles } from "@/lib/discovery";
import {
  baseFilter, colorExpr, fullFilter, heatWeightExpr, radiusExpr,
} from "@/lib/expressions";
import { setMap } from "@/lib/mapInstance";
import { effectiveFilters, useStore } from "@/lib/store";
import { useColorModel } from "@/lib/useColorModel";

const SRC = "fod";

function showPopup(map: maplibregl.Map, e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) {
  const f = e.features?.[0];
  if (!f) return;
  const root = document.createElement("div");
  root.className = "fod-popup";
  const table = document.createElement("table");
  for (const [k, v] of Object.entries(f.properties ?? {})) {
    const tr = table.insertRow();
    const th = document.createElement("th");
    th.textContent = k;
    tr.appendChild(th);
    tr.insertCell().textContent = v == null ? "" : String(v);
  }
  root.appendChild(table);
  new maplibregl.Popup({ maxWidth: "340px", closeButton: true })
    .setLngLat((f.geometry as Point).coordinates as [number, number])
    .setDOMContent(root)
    .addTo(map);
}

export default function MapView() {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [epoch, setEpoch] = useState(0);
  const ready = epoch > 0;

  const meta = useStore((s) => s.meta);
  const applied = useStore((s) => s.applied);
  const anim = useStore((s) => s.anim);
  const basemap = useStore((s) => s.basemap);
  const radiusMode = useStore((s) => s.radiusMode);
  const heat = useStore((s) => s.heat);
  const heatWeight = useStore((s) => s.heatWeight);
  const cm = useColorModel();

  /* create map once metadata is known */
  useEffect(() => {
    if (!meta || !el.current || mapRef.current) return;
    let cancelled = false;
    let map: maplibregl.Map | null = null;
    let sampleTimer: ReturnType<typeof setTimeout>;

    const addFodLayers = (m: maplibregl.Map) => {
      if (m.getSource(SRC)) return;
      m.addSource(SRC, {
        type: "vector",
        url: "pmtiles://" + meta.url,
        maxzoom: Math.min(SOURCE_MAXZOOM, meta.maxzoom ?? SOURCE_MAXZOOM),
        attribution: `<a href="${RDS_URL}" target="_blank" rel="noreferrer">USFS FPA-FOD (RDS-2013-0009.7)</a>`,
      });
      const sl = meta.layerId;
      m.addLayer({
        id: "fod-heat", type: "heatmap", source: SRC, "source-layer": sl, maxzoom: 11,
        layout: { visibility: "none" },
        paint: {
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 2, 4, 6, 12, 10, 24],
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 2, 0.6, 10, 2],
          "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 8, 0.9, 11, 0],
          "heatmap-color": [
            "interpolate", ["linear"], ["heatmap-density"],
            0, "rgba(255,200,120,0)", 0.2, "rgba(253,184,99,0.55)", 0.5, "rgba(240,120,40,0.8)",
            0.8, "rgba(200,40,30,0.9)", 1, "rgba(120,0,20,1)",
          ],
        },
      });
      m.addLayer({
        id: "fod-circles", type: "circle", source: SRC, "source-layer": sl,
        paint: { "circle-color": "#888", "circle-radius": 3, "circle-opacity": 0.8, "circle-stroke-width": 0.5, "circle-stroke-color": "rgba(255,255,255,0.7)" },
      });
      // invisible twin used for approximate counts/exports (carries the filters minus legend selection)
      m.addLayer({
        id: "fod-query", type: "circle", source: SRC, "source-layer": sl,
        paint: { "circle-opacity": 0, "circle-stroke-opacity": 0, "circle-radius": 4 },
      });
    };

    (async () => {
      const st = useStore.getState();
      const style = await getBasemapStyle(st.basemap);
      if (cancelled || !el.current) return;
      map = new maplibregl.Map({
        container: el.current,
        style,
        center: st.viewport ? [st.viewport.lng, st.viewport.lat] : [START_VIEW.lng, START_VIEW.lat],
        zoom: st.viewport?.zoom ?? START_VIEW.zoom,
        maxZoom: MAP_MAXZOOM,
        attributionControl: { compact: true },
        maxPitch: 0,
        dragRotate: false,
        pitchWithRotate: false,
      });
      const m = map;
      mapRef.current = m;
      setMap(m);
      m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      m.addControl(new maplibregl.ScaleControl({ unit: "imperial" }), "bottom-right");

      m.on("style.load", () => {
        addFodLayers(m);
        setEpoch((e) => e + 1);
      });
      m.on("click", "fod-circles", (e) => showPopup(m, e));
      m.on("mouseenter", "fod-circles", () => (m.getCanvas().style.cursor = "pointer"));
      m.on("mouseleave", "fod-circles", () => (m.getCanvas().style.cursor = ""));
      m.on("moveend", () => {
        const c = m.getCenter();
        const b = m.getBounds();
        useStore.setState({
          viewport: { lng: c.lng, lat: c.lat, zoom: m.getZoom() },
          bounds: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()],
        });
      });
      m.on("zoom", () => useStore.setState({ zoom: m.getZoom() }));
      useStore.setState({ zoom: m.getZoom() });

      m.on("dataloading", (e) => {
        if ((e as { dataType?: string }).dataType === "source" && !useStore.getState().tilesLoading) useStore.setState({ tilesLoading: true });
      });
      m.on("idle", () => {
        if (useStore.getState().tilesLoading) useStore.setState({ tilesLoading: false });
        clearTimeout(sampleTimer);
        sampleTimer = setTimeout(() => {
          if (useStore.getState().parquet.status !== "ready" && m.getSource(SRC)) sampleTiles(m);
          useStore.setState((s) => ({ tileSeq: s.tileSeq + 1 }));
        }, 200);
      });
    })();

    return () => {
      cancelled = true;
      clearTimeout(sampleTimer);
      map?.remove();
      mapRef.current = null;
      setMap(null);
      setEpoch(0);
    };
  }, [meta]);

  /* basemap switch: swap the style, FOD layers are re-added on style.load */
  const lastBasemap = useRef(basemap);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || lastBasemap.current === basemap) return;
    lastBasemap.current = basemap;
    getBasemapStyle(basemap).then((style) => {
      if (mapRef.current === map) map.setStyle(style, { diff: false });
    });
  }, [basemap]);

  /* paint: color, radius, heat */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !cm.colorCtx) return;
    map.setPaintProperty("fod-circles", "circle-color", colorExpr(cm.colorCtx));
    map.setPaintProperty("fod-circles", "circle-stroke-color", cm.dark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.75)");
  }, [epoch, cm.colorCtx, cm.dark]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !meta) return;
    map.setPaintProperty("fod-circles", "circle-radius", radiusExpr(radiusMode, meta.fieldMap));
    map.setPaintProperty("fod-heat", "heatmap-weight", heatWeightExpr(heatWeight, meta.fieldMap));
    map.setLayoutProperty("fod-heat", "visibility", heat ? "visible" : "none");
    map.setLayerZoomRange("fod-circles", heat ? 9 : 0, 24);
  }, [epoch, meta, radiusMode, heat, heatWeight]);

  /* filters (debounced snapshot; animation overrides year) */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !meta) return;
    const f = applied.filters;
    const fm = meta.fieldMap;
    const full = fullFilter(f, applied.legend, cm.legendCtx, fm) ?? null;
    const base = baseFilter(f, fm) ?? null;
    map.setFilter("fod-circles", full as never);
    map.setFilter("fod-heat", full as never);
    map.setFilter("fod-query", base as never);
  }, [epoch, meta, applied, cm.legendCtx]);

  return (
    <div className="absolute inset-0">
      <div ref={el} className="h-full w-full" />
    </div>
  );
}
