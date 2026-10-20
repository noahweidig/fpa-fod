// maplibre-gl 6 ships its web worker as separate files. Bundlers do not emit them, so serve them from /public.
import { copyFileSync, mkdirSync } from "node:fs";

const from = new URL("../node_modules/maplibre-gl/dist/", import.meta.url);
const to = new URL("../public/maplibre/", import.meta.url);
mkdirSync(to, { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) copyFileSync(new URL(f, from), new URL(f, to));
