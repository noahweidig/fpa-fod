"use client";

import type { Point } from "geojson";

import * as maplibregl from "maplibre-gl";
import { installAreaLayers } from "@/lib/areaLayer";
import { attachChoroHover, installChoroLayer, syncChoro } from "@/lib/choroLayer";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { getBasemapStyle } from "@/lib/basemaps";
import { MAP_MAXZOOM, MTBS_ID_FIELD, MTBS_LAYER, MTBS_URL, RDS_URL, SOURCE_MAXZOOM, START_VIEW } from "@/lib/config";
import { sampleTiles } from "@/lib/discovery";
import {
  baseFilter, colorExpr, fullFilter, heatWeightExpr, radiusExpr,
} from "@/lib/expressions";
import { setMap } from "@/lib/mapInstance";
import { getDuck } from "@/lib/backend";
import { appendFodImpact, showIncidentPopup } from "@/lib/impactPopup";
import { IMPACT_LAYER, installImpactLayer, shownIncidents, syncImpact } from "@/lib/impactLayer";
import { incidentFodIds, incidentMtbsIds } from "@/lib/impact";
import { appendMtbsLink, showMtbsPopup } from "@/lib/mtbs";
import { effectiveFilters, useStore } from "@/lib/store";
import { useColorModel } from "@/lib/useColorModel";

// maplibre-gl 6 loads its worker from a URL; scripts/copy-maplibre-worker.mjs puts it in /public on install
maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

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
  const fm = useStore.getState().meta?.fieldMap;
  const p = f.properties ?? {};
  const mtbsKey = Object.keys(p).find((k) => k.toLowerCase() === "mtbs_id");
  appendFodImpact(root, fm?.id ? p[fm.id] : undefined);
  appendMtbsLink(root, fm?.id ? p[fm.id] : undefined, (f.geometry as Point).coordinates as [number, number], mtbsKey ? p[mtbsKey] : undefined);
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
      m.addSource("mtbs", {
        type: "vector",
        url: "pmtiles://" + MTBS_URL,
        attribution: '<a href="https://www.mtbs.gov/" target="_blank" rel="noreferrer">MTBS</a>',
      });
      const vis = useStore.getState().mtbsLayer ? "visible" : "none";
      m.addLayer({
        id: "mtbs-fill", type: "fill", source: "mtbs", "source-layer": MTBS_LAYER, layout: { visibility: vis },
        paint: { "fill-color": "#c2410c", "fill-opacity": 0.12 },
      });
      m.addLayer({
        id: "mtbs-line", type: "line", source: "mtbs", "source-layer": MTBS_LAYER, layout: { visibility: vis },
        paint: { "line-color": "#c2410c", "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.3, 10, 1.2], "line-opacity": 0.8 },
      });
      m.addLayer({
        id: "mtbs-hl", type: "line", source: "mtbs", "source-layer": MTBS_LAYER, layout: { visibility: vis },
        filter: ["==", ["get", MTBS_ID_FIELD], useStore.getState().mtbsHl ?? ""],
        paint: { "line-color": "#111", "line-width": 3 },
      });
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
      const collapseAttrib = () => {
        const a = m.getContainer().querySelector(".maplibregl-ctrl-attrib");
        a?.classList.remove("maplibregl-compact-show");
        a?.removeAttribute("open");
      };
      collapseAttrib();
      m.once("load", collapseAttrib);
      m.addControl(new maplibregl.ScaleControl({ unit: "imperial" }), "bottom-right");

      m.on("style.load", () => {
        addFodLayers(m);
        installChoroLayer(m);
        installImpactLayer(m);
        installAreaLayers(m);
        setEpoch((e) => e + 1);
      });
      attachChoroHover(m, maplibregl.Popup);
      const hoverTip = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8, className: "fod-hover", maxWidth: "260px" });
      m.on("click", "mtbs-fill", (e) => {
        if (useStore.getState().drawMode) return;
        if (m.queryRenderedFeatures(e.point, { layers: ["fod-circles"] }).length) return;
        if (m.getLayer(IMPACT_LAYER) && m.queryRenderedFeatures(e.point, { layers: [IMPACT_LAYER] }).length) return;
        showMtbsPopup(m, e);
      });
      m.on("click", IMPACT_LAYER, (e) => {
        if (useStore.getState().drawMode) return;
        const id = e.features?.[0]?.properties?.id as string | undefined;
        const inc = id ? shownIncidents.get(id) : undefined;
        if (inc?.lat != null && inc.lon != null) showIncidentPopup(m, inc, [inc.lon, inc.lat]);
      });
      m.on("click", "fod-circles", (e) => {
        if (useStore.getState().drawMode) return;
        // an incident marker on top of the ignition handles the click
        if (m.getLayer(IMPACT_LAYER) && m.queryRenderedFeatures(e.point, { layers: [IMPACT_LAYER] }).length) return;
        hoverTip.remove();
        showPopup(m, e);
      });
      m.on("mouseenter", IMPACT_LAYER, () => (m.getCanvas().style.cursor = "pointer"));
      m.on("mouseleave", IMPACT_LAYER, () => (m.getCanvas().style.cursor = ""));
      m.on("mouseenter", "fod-circles", () => (m.getCanvas().style.cursor = "pointer"));
      m.on("mousemove", "fod-circles", (e) => {
        const f = e.features?.[0];
        const st = useStore.getState();
        if (!f || st.drawMode || m.getContainer().querySelector(".fod-popup")) return;
        const fm = st.meta?.fieldMap;
        const p = f.properties ?? {};
        const acres = fm?.size ? Number(p[fm.size]) : Number.NaN;
        const text = [fm?.year && p[fm.year], fm?.general && p[fm.general], Number.isFinite(acres) && `${acres.toLocaleString(undefined, { maximumFractionDigits: 1 })} ac`]
          .filter(Boolean)
          .join(" · ");
        if (text) hoverTip.setLngLat((f.geometry as Point).coordinates as [number, number]).setText(text).addTo(m);
      });
      m.on("mouseleave", "fod-circles", () => {
        m.getCanvas().style.cursor = "";
        hoverTip.remove();
      });
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

  /* MTBS layer visibility + highlight */
  const parquetStatusEarly = useStore((s) => s.parquet.status);
  const mtbsLayer = useStore((s) => s.mtbsLayer);
  const mtbsHl = useStore((s) => s.mtbsHl);
  const mtbsFilter = applied.filters.mtbs;
  const incidentFilter = applied.filters.incident;
  const [incidentMtbs, setIncidentMtbs] = useState<string[] | null>(null);
  useEffect(() => {
    if (!incidentFilter?.length || !getDuck()) return setIncidentMtbs(null);
    let cancelled = false;
    incidentMtbsIds(incidentFilter).then((ids) => !cancelled && setIncidentMtbs(ids)).catch(() => !cancelled && setIncidentMtbs([]));
    return () => {
      cancelled = true;
    };
  }, [incidentFilter, parquetStatusEarly]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.getLayer("mtbs-fill")) return;
    const showAll = mtbsLayer || !!mtbsFilter || !!mtbsHl || !!incidentMtbs?.length;
    for (const id of ["mtbs-fill", "mtbs-line", "mtbs-hl"]) map.setLayoutProperty(id, "visibility", showAll ? "visible" : "none");
    // with a link filter active, only the linked perimeters are outlined (the layer toggle shows all)
    const ids = incidentMtbs?.length ? incidentMtbs : mtbsFilter?.ids;
    map.setLayerZoomRange("mtbs-fill", 0, 24);
    const only = !mtbsLayer && ids ? ["in", ["get", MTBS_ID_FIELD], ["literal", ids]] : null;
    map.setFilter("mtbs-fill", (only ?? null) as never);
    map.setFilter("mtbs-line", (only ?? null) as never);
    map.setFilter("mtbs-hl", ["==", ["get", MTBS_ID_FIELD], mtbsHl ?? ""] as never);
  }, [epoch, mtbsLayer, mtbsHl, mtbsFilter, incidentMtbs]);

  /* FOD points linked to MTBS: filter the map by FOD_ID list (needs Parquet) */
  const [mtbsIds, setMtbsIds] = useState<(string | number)[] | null>(null);
  const parquetStatus = useStore((s) => s.parquet.status);
  const [incidentIds, setIncidentIds] = useState<number[] | null>(null);
  useEffect(() => {
    if (!incidentFilter?.length || !getDuck()) return setIncidentIds(null);
    let cancelled = false;
    incidentFodIds(incidentFilter).then((ids) => !cancelled && setIncidentIds(ids)).catch(() => !cancelled && setIncidentIds([]));
    return () => {
      cancelled = true;
    };
  }, [incidentFilter, parquetStatus]);
  useEffect(() => {
    const d = getDuck();
    if (!mtbsFilter || !d) {
      setMtbsIds(null);
      return;
    }
    let cancelled = false;
    d.mtbsFodIds(mtbsFilter).then((ids) => !cancelled && setMtbsIds(ids)).catch(() => !cancelled && setMtbsIds([]));
    return () => {
      cancelled = true;
    };
  }, [mtbsFilter, parquetStatus]);

  /* filters (debounced snapshot; animation overrides year) */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !meta) return;
    const f = applied.filters;
    const fm = meta.fieldMap;
    const full = fullFilter(f, applied.legend, cm.legendCtx, fm) ?? null;
    const base = baseFilter(f, fm) ?? null;
    const idField = fm.id;
    const links = [mtbsIds, incidentIds]
      .filter((ids): ids is (string | number)[] => !!ids && !!idField)
      .map((ids) => ["in", ["get", idField!], ["literal", ids]]);
    const withLink = links.length ? ["all", ...(full ? [full] : []), ...links] : full;
    map.setFilter("fod-circles", withLink as never);
    map.setFilter("fod-heat", withLink as never);
    map.setFilter("fod-query", base as never);
  }, [epoch, meta, applied, cm.legendCtx, mtbsIds, incidentIds]);

  /* choropleth */
  const choroRes = useStore((s) => s.choroRes);
  const theme = useStore((s) => s.theme);
  useEffect(() => {
    const map = mapRef.current;
    if (map && ready) syncChoro(map, choroRes);
  }, [ready, epoch, choroRes, theme]);

  /* destructiveness overlay (ICS-209-PLUS incidents) */
  const impact = useStore((s) => s.impact);
  const icsReady = useStore((s) => !!s.parquet.ics);
  useEffect(() => {
    if (!ready) return;
    syncImpact(applied).catch((e) => console.error(e));
  }, [ready, epoch, impact, icsReady, applied]);

  return (
    <div className="absolute inset-0">
      <div ref={el} className="h-full w-full" />
    </div>
  );
}
