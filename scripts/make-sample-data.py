#!/usr/bin/env python3
"""Generate SYNTHETIC FPA-FOD-like data (not real fires) to try the app without the real dataset.

  pip install numpy mapbox-vector-tile pmtiles pyarrow
  python3 scripts/make-sample-data.py [--n 150000] [--no-tilestats]

Writes dev-data/fod.pmtiles (layer "fod", thinned below z8) and dev-data/fod.parquet (with LATITUDE/LONGITUDE).
Serve them with: node scripts/serve-range.mjs dev-data
"""
import argparse, gzip, json, math, os
import numpy as np
import pyarrow as pa, pyarrow.parquet as pq
import mapbox_vector_tile as mvt
from shapely.geometry import Point
from pmtiles.tile import Compression, TileType, zxy_to_tileid
from pmtiles.writer import write

ap = argparse.ArgumentParser()
ap.add_argument("--n", type=int, default=150000)
ap.add_argument("--no-tilestats", action="store_true")
ap.add_argument("--out", default="dev-data")
a = ap.parse_args()
os.makedirs(a.out, exist_ok=True)
rng = np.random.default_rng(7)
n = a.n

GEN = {  # general cause -> classification
    "Natural": "Natural", "Human": "Human", "Debris and open burning": "Human", "Arson/incendiarism": "Human",
    "Equipment and vehicle use": "Human", "Smoking": "Human", "Fireworks": "Human", "Railroad operations and maintenance": "Human",
    "Missing data/not specified/undetermined": "Missing data/not specified/undetermined",
}
gen_names = list(GEN)
gen_w = np.array([0.30, 0.1, 0.2, 0.08, 0.1, 0.03, 0.01, 0.02, 0.16]); gen_w /= gen_w.sum()
OWNERS = ["USFS", "PRIVATE", "BLM", "STATE OR PRIVATE", "NPS", "BIA", "MISSING/NOT SPECIFIED", "FWS", "STATE", "COUNTY", "MUNICIPAL/LOCAL", "DOD", "TRIBAL", "OTHER FEDERAL"]
AGENCIES = ["FS", "ST/C&L", "BLM", "NPS", "BIA", "FWS", "BOR", "DOD"]
SRC_TYPES = ["FED", "NONFED", "INTERAGCY"]
STATES = {"CA": (-120, 37), "OR": (-122, 44), "WA": (-120.5, 47.5), "ID": (-114.5, 44), "MT": (-110, 47),
          "TX": (-99, 31), "FL": (-82, 28), "GA": (-83.5, 32.5), "NC": (-80, 35.5), "AZ": (-111.5, 34),
          "NM": (-106, 34.5), "CO": (-105.5, 39), "UT": (-111.5, 39.5), "NY": (-75, 43)}
st_names = list(STATES)
st_i = rng.integers(0, len(st_names), n)
cx = np.array([STATES[s][0] for s in st_names])[st_i]; cy = np.array([STATES[s][1] for s in st_names])[st_i]
lon = np.clip(cx + rng.normal(0, 1.6, n), -124.5, -67); lat = np.clip(cy + rng.normal(0, 1.2, n), 25, 49)
gi = rng.choice(len(gen_names), n, p=gen_w)
gen = np.array(gen_names)[gi]
cls_ = np.array([GEN[g] for g in gen])
age = np.where(cls_ == "Natural", "Natural", np.where(rng.random(n) < 0.5, "Human", "Undetermined"))
owner = rng.choice(OWNERS, n); agency = rng.choice(AGENCIES, n); srct = rng.choice(SRC_TYPES, n)
county = np.array([f"{st_names[i]} County {rng.integers(1, 40)}" for i in st_i])
year = rng.integers(1992, 2021, n); doy = np.clip(rng.normal(190, 70, n), 1, 366).astype(int)
size = np.round(np.exp(rng.normal(-0.2, 2.2, n)) , 2) + 0.01
def cls(s):
    for c, t in zip("ABCDEFG", [0.25, 10, 100, 300, 1000, 5000]):
        if s < t: return c
    return "G"
sc = np.array([cls(s) for s in size])
ids = np.arange(1, n + 1)
state = np.array(st_names)[st_i]
date = np.array([f"{y}-{(d-1)//31+1:02d}-{(d-1)%28+1:02d}" for y, d in zip(year, doy)])
props = [dict(FOD_ID=int(ids[i]), FIRE_YEAR=int(year[i]), DISCOVERY_DOY=int(doy[i]), DISCOVERY_DATE=str(date[i]),
              NWCG_GENERAL_CAUSE=str(gen[i]), NWCG_CAUSE_CLASSIFICATION=str(cls_[i]), NWCG_CAUSE_AGE_CATEGORY=str(age[i]),
              OWNER_DESCR=str(owner[i]), NWCG_REPORTING_AGENCY=str(agency[i]), SOURCE_SYSTEM_TYPE=str(srct[i]),
              FIRE_SIZE=float(size[i]), FIRE_SIZE_CLASS=str(sc[i]), STATE=str(state[i]), COUNTY=str(county[i]),
              LATITUDE=float(lat[i]), LONGITUDE=float(lon[i])) for i in range(n)]

pq.write_table(pa.table({k: [p[k] for p in props] for k in props[0]}), f"{a.out}/fod.parquet",
               compression="zstd", row_group_size=100000)

R = 6378137.0
def merc(lo, la): return lo * math.pi / 180 * R, math.log(math.tan(math.pi / 4 + la * math.pi / 360)) * R
mx = np.array([merc(l, 0)[0] for l in lon]); my = np.array([merc(0, l)[1] for l in lat])
MAXZ = 8; CAP = {0: 800, 1: 800, 2: 1500, 3: 2500, 4: 4000, 5: 6000, 6: 9000, 7: 14000}
W = 2 * math.pi * R
tiles = []
for z in range(MAXZ + 1):
    n_t = 2 ** z
    tx = np.clip(((mx + W / 2) / W * n_t).astype(int), 0, n_t - 1); ty = np.clip(((W / 2 - my) / W * n_t).astype(int), 0, n_t - 1)
    key = tx.astype(np.int64) * n_t + ty
    order = np.argsort(key, kind="stable"); ks = key[order]
    bounds = np.flatnonzero(np.diff(ks)) + 1
    for grp in np.split(order, bounds):
        if not len(grp): continue
        if z in CAP and len(grp) > CAP[z]: grp = rng.choice(grp, CAP[z], replace=False)
        x, y = int(tx[grp[0]]), int(ty[grp[0]])
        tw = W / n_t
        b = (-W / 2 + x * tw, W / 2 - (y + 1) * tw, -W / 2 + (x + 1) * tw, W / 2 - y * tw)
        feats = [{"geometry": Point(mx[i], my[i]), "properties": props[i]} for i in grp]
        data = mvt.encode([{"name": "fod", "features": feats}], default_options={"quantize_bounds": b, "extents": 4096})
        tiles.append((zxy_to_tileid(z, x, y), gzip.compress(data, mtime=0)))
tiles.sort()

num = ["FOD_ID", "FIRE_YEAR", "DISCOVERY_DOY", "FIRE_SIZE", "LATITUDE", "LONGITUDE"]
fields = {k: ("Number" if k in num else "String") for k in props[0]}
md = {"name": "fod", "format": "pbf", "version": "2",
      "vector_layers": [{"id": "fod", "minzoom": 0, "maxzoom": MAXZ, "fields": fields}]}
if not a.no_tilestats:
    attrs = []
    for k in fields:
        col = [p[k] for p in props]
        if k in num:
            attrs.append({"attribute": k, "count": len(set(col)), "type": "number", "min": min(col), "max": max(col),
                          "values": sorted(set(col))[:100]})
        else:
            attrs.append({"attribute": k, "count": len(set(col)), "type": "string", "values": sorted(set(col))[:100]})
    md["tilestats"] = {"layerCount": 1, "layers": [{"layer": "fod", "count": n, "geometry": "Point", "attributeCount": len(attrs), "attributes": attrs}]}
hdr = {"tile_type": TileType.MVT, "tile_compression": Compression.GZIP,
       "min_lon_e7": int(lon.min() * 1e7), "min_lat_e7": int(lat.min() * 1e7), "max_lon_e7": int(lon.max() * 1e7), "max_lat_e7": int(lat.max() * 1e7),
       "center_zoom": 3, "center_lon_e7": int(-98 * 1e7), "center_lat_e7": int(39 * 1e7)}
with write(f"{a.out}/fod.pmtiles") as w:
    for tid, d in tiles: w.write_tile(tid, d)
    w.finalize(hdr, md)
print(f"wrote {len(tiles)} tiles, {n} rows to {a.out}/")
