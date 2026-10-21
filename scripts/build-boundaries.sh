#!/usr/bin/env bash
# Builds simplified choropleth boundaries into public/boundaries/*.geojson.
# Usage: scripts/build-boundaries.sh <raw_dir>   (needs mapshaper on PATH, e.g. npx mapshaper)
# <raw_dir> holds: cty/ st/ (Census cb_2023_us_{county,state}_20m shp), l3/ l4/ (EPA us_eco_l3, us_eco_l4_no_st shp), gacc.geojson (NIFC National GACC Boundaries).
set -euo pipefail
R=${1:?raw dir}
O="$(dirname "$0")/../public/boundaries"
M=${MAPSHAPER:-mapshaper}
mkdir -p "$O"
out() { $M "$@" -o "$O/$OUT.geojson" format=geojson precision=0.001 force; }

OUT=states   out "$R/st/cb_2023_us_state_20m.shp" -filter-fields STUSPS,NAME -rename-fields state=STUSPS,name=NAME -simplify 40% keep-shapes
OUT=counties out "$R/cty/cb_2023_us_county_20m.shp" -filter-fields GEOID,NAME,STUSPS -rename-fields fips=GEOID,name=NAME,state=STUSPS -simplify 40% keep-shapes
OUT=gacc     out "$R/gacc.geojson" -filter-fields GACCAbbreviation,GACCName -rename-fields code=GACCAbbreviation,name=GACCName -simplify 0.7% keep-shapes

E3="$R/l3/us_eco_l3.shp"; E4="$R/l4/us_eco_l4_no_st.shp"
OUT=eco_l1 out "$E3" -proj wgs84 -dissolve NA_L1CODE copy-fields=NA_L1NAME -rename-fields code=NA_L1CODE,name=NA_L1NAME -simplify 1% keep-shapes
OUT=eco_l2 out "$E3" -proj wgs84 -dissolve NA_L2CODE copy-fields=NA_L2NAME -rename-fields code=NA_L2CODE,name=NA_L2NAME -simplify 1.5% keep-shapes
OUT=eco_l3 out "$E3" -proj wgs84 -dissolve US_L3CODE copy-fields=US_L3NAME -rename-fields code=US_L3CODE,name=US_L3NAME -simplify 2% keep-shapes
OUT=eco_l4 out "$E4" -proj wgs84 -dissolve US_L4CODE copy-fields=US_L4NAME -rename-fields code=US_L4CODE,name=US_L4NAME -simplify 1.5% keep-shapes
