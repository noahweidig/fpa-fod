# Linking ICS-209-PLUS, FPA-FOD and MTBS

Sources

- **ICS-209-PLUS wildfire incidents 1999-2020** (St. Denis et al., figshare 10.6084/m9.figshare.19858927 v3, CC BY 4.0). The incident summary table has the damage fields and the link fields. The daily sitreps carry only `INCIDENT_ID`.
- **FPA-FOD 1992-2024** (the Parquet the app reads). It has `FOD_ID`, `MTBS_ID` and `ICS_209_PLUS_INCIDENT_JOIN_ID`.
- **MTBS perimeters** (the `mtbs.pmtiles` layer, key `event_id`).

## Keys

| Link | Where it comes from |
|---|---|
| incident to FOD ignitions | the incident's `FOD_FIRE_LIST` (list of `{ID, COORDS, MTBS_ID, ...}`), and FOD's `ICS_209_PLUS_INCIDENT_JOIN_ID` |
| incident to MTBS events | the incident's `MTBS_FIRE_LIST` (`<event id>-<name>`) |
| FOD to MTBS | FOD's `MTBS_ID` (equals MTBS `event_id`) |
| complex to member fires | the complex associations table (`CPLX_INCIDENT_ID`, `MEMBER_INCIDENT_ID`) |

`FOD_ID` in the ICS lists is the same `FOD_ID` as in the current FOD edition: for the 33,674 listed ignitions found in the Parquet, coordinates match for 99.9%, size for 99.99% and day of year for 100% (the coordinate differences are Hawaii updates).

## Build

```bash
pip install duckdb
# run from a folder that holds the data: paths must be inside the current directory
cd data
python3 ../scripts/build-ics-link.py --ics ics209plus-wildfire --fod fod.parquet --out out
```

This writes `ics_incidents.parquet` (one row per incident, 1.6 MB), `ics_links.parquet` (edges, 0.6 MB) and `ics_link_report.json`. Upload the two Parquet files next to `fod.parquet` and set `NEXT_PUBLIC_ICS_INCIDENTS_URL` and `NEXT_PUBLIC_ICS_LINKS_URL`. No new PMTiles are needed.

## What the data looks like (build report, FOD 2026 edition)

- 34,622 incidents, `INCIDENT_ID` unique. 33,578 link to at least one FOD ignition (counting a complex's members) and 9,501 to at least one MTBS perimeter. 34,219 have a usable location.
- FOD links: 31,702 are listed by both sides, 3,702 only by FOD's join id, 1,972 only by the incident's list. All are kept, and `ics_links.src` records which.
- MTBS links: 9,889 from both the incident's list and the linked ignitions, 138 only via an ignition's `MTBS_ID`, 34 only from the incident's list. All 9,923 list entries resolved to an event id.

## Data quality issues and how they are handled

**One incident, many ignitions and perimeters.** Median 1 ignition per incident, up to 57. 306 incidents link to more than one MTBS event (up to 14). 432 MTBS events carry more than one FOD point (up to 28). Impact is reported per incident, so it is never summed over ignitions or perimeters; popups say "figures are for the whole incident".

**One ignition or perimeter, many incidents.** 124 FOD points are listed under more than one incident (nested complex reports such as Selway / Elk City / Red River). 130 MTBS events link to more than one incident, 96 of them to more than one root incident. The popups list every linked incident and warn not to add them.

**Complexes and their members both report damage.** 310 member incidents sit under 107 complexes (checked: every member has one parent, no nesting, no cycles). A member usually reports less than its complex (Tubbs 576 structures destroyed against 7,010 for the Central LNU complex). Summing all incidents gives 109,016 structures and 543 deaths, counting complexes once gives 106,062 and 530. Rankings, totals and the by-year chart count roots only (`is_root`). "Include complex members" is opt-in and warns that totals overlap.

**A complex often has no links of its own.** Its members hold the FOD and MTBS links, so `fod_n_rollup` and `mtbs_n_rollup` count the members' links. Filtering to a complex includes its members' ignitions.

**MTBS ids are not always the 21-character form.** 480 FOD rows carry agency-style ids such as `BLM-WASPD-P408-19920926`. A regex would drop them, so list entries are resolved against the ids that exist on FOD rows (longest prefix), with the standard pattern as fallback.

**FOD ids that no longer exist.** 58 listed ignitions are not in the 2026 Parquet and are dropped. 8,700 FOD rows carry a join id for an incident that is not in the table, mostly fires after 2020 (ICS-209-PLUS ends in 2020). Those ignitions are unlinked, not wrong.

**Suspect values (flags in `qa`).**

| Flag | Count | Meaning |
|---|---|---|
| `no_location` | 403 | No valid point of origin. 443 incidents had coordinates outside the U.S., which are ignored. |
| `location_from_fod` | 462 | Point of origin missing, location taken from the largest linked ignition. |
| `destroyed_vs_acres` | 3 | More than 100 structures destroyed on fewer than 100 acres. `GLENDALE` 2016 (OK) reports 3,000 destroyed on 4 acres, almost certainly an entry error. It is flagged, not removed. |
| `prescribed` | 144 | Prescribed burn incidents. |
| `no_fod` / `no_mtbs` | 1,044 / 25,121 | Nothing linked. Most incidents are too small for MTBS. |
| `complex_member` | 310 | Counted through its complex. |
| `sparse_reporting` | 3,028 | Before 2002, damage fields were reported sparsely, so early years read low. |

**Field coverage.** Cost is missing for about a third of incidents and is nominal dollars. Peak evacuations are filled for few incidents, mostly 2014 onward, and a 0 does not mean none (Camp reports 0), so zero is hidden. Structures, fatalities and injuries are filled for every incident (zero means none reported).

**Low-zoom tiles drop the biggest fires.** The current `fod_fast.pmtiles` thins by density, not size, so the 153,336-acre Camp ignition is absent below zoom 12. The impact overlay is drawn from the incident table, so large incidents are visible at every zoom. See the README's tile rebuild notes for an importance-based rebuild.

Known gaps: the year, state and area filters apply to the impact cards, but cause, size and other categorical filters do not, because incidents have their own cause field. ICS-209-PLUS ends in 2020, so there is no impact data for 2021-2024 fires.
