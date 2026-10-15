import maplibregl from "maplibre-gl";
import { PMTiles, Protocol } from "pmtiles";
import { PREFERRED_LAYER } from "./config";
import { resolveFields } from "./fields";
import type { AttrStats, TileMeta } from "./types";

const g = globalThis as unknown as { __pmProtocol?: Protocol };

/** Register the pmtiles:// protocol exactly once per page load. */
export function getProtocol(): Protocol {
  if (!g.__pmProtocol) {
    g.__pmProtocol = new Protocol();
    maplibregl.addProtocol("pmtiles", g.__pmProtocol.tile);
  }
  return g.__pmProtocol;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function loadMeta(url: string): Promise<TileMeta> {
  const p = new PMTiles(url);
  getProtocol().add(p);
  const [header, raw] = await Promise.all([p.getHeader(), p.getMetadata() as Promise<any>]);
  let md: any = raw ?? {};
  if (typeof md.json === "string") {
    try {
      md = { ...md, ...JSON.parse(md.json) };
    } catch {
      /* ignore */
    }
  }
  const layers: any[] = md.vector_layers ?? [];
  const layer = layers.find((l) => l.id === PREFERRED_LAYER) ?? layers[0];
  const layerId: string = layer?.id ?? PREFERRED_LAYER;
  const fields: Record<string, string> = layer?.fields ?? {};

  const stats: Record<string, AttrStats> = {};
  const tl = md.tilestats?.layers?.find((l: any) => l.layer === layerId);
  for (const a of tl?.attributes ?? []) {
    stats[a.attribute] = { min: a.min, max: a.max, values: a.values };
  }

  return {
    url,
    layerId,
    layerFound: !!layer,
    fields,
    fieldMap: resolveFields(Object.keys(fields)),
    stats,
    minzoom: layer?.minzoom ?? header.minZoom,
    maxzoom: layer?.maxzoom ?? header.maxZoom,
    name: md.name,
    description: md.description,
  };
}
