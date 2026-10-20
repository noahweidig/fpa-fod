#!/usr/bin/env python3
"""Link ICS-209-PLUS wildfire incidents to FPA-FOD ignitions and MTBS fires.

Inputs
  --ics  folder from ics209plus-wildfire.zip (figshare 10.6084/m9.figshare.19858927), needs
         ics209-plus-wf_incidents_1999to2020.csv and ics209-plus-wf_complex_associations_1999to2020.csv
  --fod  the FPA-FOD Parquet the app uses (needs FOD_ID, MTBS_ID, ICS_209_PLUS_INCIDENT_JOIN_ID, lon/lat)
Outputs (in --out)
  ics_incidents.parquet  one row per incident, impact fields plus link counts and QA flags
  ics_links.parquet      incident <-> FOD point and incident <-> MTBS event edges, with the source of each edge
  ics_link_report.json   counts behind the data-quality notes in docs/ics-linkage.md

pip install duckdb
"""
import argparse
import ast
import json
import re
from pathlib import Path

import duckdb

EVENT_STD = re.compile(r"^[A-Z]{2}[0-9]{19}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ics", required=True, type=Path)
    ap.add_argument("--fod", required=True, type=Path)
    ap.add_argument("--out", required=True, type=Path)
    a = ap.parse_args()
    a.out.mkdir(parents=True, exist_ok=True)
    c = duckdb.connect()
    q = lambda s: c.execute(s).fetchall()
    rep: dict = {}

    csv = lambda name: (
        f"read_csv('{a.ics / name}', header=true, sample_size=-1, ignore_errors=true)"
    )
    c.execute(f"CREATE TABLE inc AS SELECT * FROM {csv('ics209-plus-wf_incidents_1999to2020.csv')}")
    c.execute(f"CREATE TABLE cplx AS SELECT * FROM {csv('ics209-plus-wf_complex_associations_1999to2020.csv')}")
    c.execute(f"CREATE VIEW fod AS SELECT * FROM read_parquet('{a.fod}')")

    rep["incidents"] = q("SELECT COUNT(*), COUNT(DISTINCT INCIDENT_ID) FROM inc")[0]
    assert rep["incidents"][0] == rep["incidents"][1], "INCIDENT_ID is expected to be unique"

    # ---- complex membership (only edges where both ends are incidents in the table) ----
    c.execute(
        """CREATE TABLE mem AS SELECT DISTINCT CPLX_INCIDENT_ID AS parent, MEMBER_INCIDENT_ID AS member
           FROM cplx WHERE CPLX_INCIDENT_ID <> MEMBER_INCIDENT_ID
             AND CPLX_INCIDENT_ID IN (SELECT INCIDENT_ID FROM inc)
             AND MEMBER_INCIDENT_ID IN (SELECT INCIDENT_ID FROM inc)"""
    )
    # The roll-up below assumes a member has one parent and complexes are not nested. Verify, do not assume.
    assert q("SELECT COUNT(*) FROM (SELECT member FROM mem GROUP BY 1 HAVING COUNT(*) > 1)")[0][0] == 0
    assert q("SELECT COUNT(*) FROM mem WHERE parent IN (SELECT member FROM mem)")[0][0] == 0
    rep["membership_edges"] = q("SELECT COUNT(*) FROM mem")[0][0]

    # ---- incident -> FOD points ----
    fod_edges: dict[tuple[str, int], dict] = {}
    for iid, s in q("SELECT INCIDENT_ID, FOD_FIRE_LIST FROM inc WHERE FOD_FIRE_LIST IS NOT NULL"):
        for d in ast.literal_eval(s):
            fod_edges.setdefault((iid, int(d["ID"])), {"list": True, "join": False})
    c.execute("CREATE TABLE fl(incident_id VARCHAR, fod_id BIGINT, in_list BOOLEAN)")
    c.executemany("INSERT INTO fl VALUES (?,?,TRUE)", [(i, f) for (i, f) in fod_edges])
    rep["fod_list_pairs"] = len(fod_edges)
    rep["fod_list_pairs_missing_from_fod"] = q(
        "SELECT COUNT(*) FROM fl WHERE fod_id NOT IN (SELECT FOD_ID FROM fod)"
    )[0][0]
    c.execute(
        """CREATE TABLE fod_links AS
           SELECT COALESCE(l.incident_id, j.incident_id) AS incident_id, COALESCE(l.fod_id, j.fod_id) AS fod_id,
                  CASE WHEN l.fod_id IS NOT NULL AND j.fod_id IS NOT NULL THEN 'both'
                       WHEN l.fod_id IS NOT NULL THEN 'ics' ELSE 'fod' END AS src
           FROM (SELECT DISTINCT incident_id, fod_id FROM fl WHERE fod_id IN (SELECT FOD_ID FROM fod)) l
           FULL JOIN (SELECT ICS_209_PLUS_INCIDENT_JOIN_ID AS incident_id, FOD_ID AS fod_id FROM fod
                      WHERE ICS_209_PLUS_INCIDENT_JOIN_ID IN (SELECT INCIDENT_ID FROM inc)) j
             ON l.incident_id = j.incident_id AND l.fod_id = j.fod_id"""
    )
    rep["fod_links_by_src"] = q("SELECT src, COUNT(*) FROM fod_links GROUP BY 1 ORDER BY 1")
    rep["fod_points_in_more_than_one_incident"] = q(
        "SELECT COUNT(*) FROM (SELECT fod_id FROM fod_links GROUP BY 1 HAVING COUNT(DISTINCT incident_id) > 1)"
    )[0][0]
    rep["fod_join_ids_beyond_ics_coverage"] = q(
        "SELECT COUNT(*) FROM fod WHERE ICS_209_PLUS_INCIDENT_JOIN_ID IS NOT NULL "
        "AND ICS_209_PLUS_INCIDENT_JOIN_ID NOT IN (SELECT INCIDENT_ID FROM inc)"
    )[0][0]

    # ---- incident -> MTBS events ----
    # MTBS event ids are mostly STATE+lat+lon+date (21 chars) but 480 FOD rows carry agency-style ids
    # (e.g. BLM-WASPD-P408-19920926). ICS MTBS_FIRE_LIST entries are "<event id>-<fire name>", so resolve each
    # entry against the ids actually present on FOD rows (longest prefix), then fall back to the standard pattern.
    c.execute("CREATE TABLE known AS SELECT DISTINCT MTBS_ID AS id FROM fod WHERE MTBS_ID IS NOT NULL")
    known = sorted((r[0] for r in q("SELECT id FROM known")), key=len, reverse=True)
    known_set = set(known)

    def resolve(raw: str) -> str | None:
        raw = str(raw)
        if raw in known_set:
            return raw
        for k in known:
            if raw.startswith(k + "-") or raw.startswith(k + "("):
                return k
        m = EVENT_STD.match(raw)
        return m.group(0) if m else None

    mtbs_edges: set[tuple[str, str]] = set()
    unresolved = 0
    for iid, s in q("SELECT INCIDENT_ID, MTBS_FIRE_LIST FROM inc WHERE MTBS_FIRE_LIST IS NOT NULL"):
        for raw in ast.literal_eval(s):
            ev = resolve(raw)
            if ev:
                mtbs_edges.add((iid, ev))
            else:
                unresolved += 1
    rep["mtbs_list_unresolved"] = unresolved
    c.execute("CREATE TABLE ml(incident_id VARCHAR, mtbs_id VARCHAR)")
    c.executemany("INSERT INTO ml VALUES (?,?)", sorted(mtbs_edges))
    c.execute(
        """CREATE TABLE mtbs_links AS
           SELECT COALESCE(l.incident_id, v.incident_id) AS incident_id, COALESCE(l.mtbs_id, v.mtbs_id) AS mtbs_id,
                  CASE WHEN l.mtbs_id IS NOT NULL AND v.mtbs_id IS NOT NULL THEN 'both'
                       WHEN l.mtbs_id IS NOT NULL THEN 'ics' ELSE 'fod' END AS src
           FROM (SELECT DISTINCT incident_id, mtbs_id FROM ml) l
           FULL JOIN (SELECT DISTINCT fl2.incident_id, f.MTBS_ID AS mtbs_id FROM fod_links fl2
                      JOIN fod f ON f.FOD_ID = fl2.fod_id WHERE f.MTBS_ID IS NOT NULL) v
             ON l.incident_id = v.incident_id AND l.mtbs_id = v.mtbs_id"""
    )
    rep["mtbs_links_by_src"] = q("SELECT src, COUNT(*) FROM mtbs_links GROUP BY 1 ORDER BY 1")
    rep["mtbs_events_in_more_than_one_incident"] = q(
        "SELECT COUNT(*) FROM (SELECT mtbs_id FROM mtbs_links GROUP BY 1 HAVING COUNT(DISTINCT incident_id) > 1)"
    )[0][0]
    rep["mtbs_events_in_more_than_one_root_incident"] = q(
        """SELECT COUNT(*) FROM (SELECT mtbs_id FROM mtbs_links
           WHERE incident_id NOT IN (SELECT member FROM mem) GROUP BY 1 HAVING COUNT(DISTINCT incident_id) > 1)"""
    )[0][0]
    rep["incidents_with_more_than_one_mtbs_event"] = q(
        "SELECT COUNT(*) FROM (SELECT incident_id FROM mtbs_links GROUP BY 1 HAVING COUNT(DISTINCT mtbs_id) > 1)"
    )[0][0]
    rep["mtbs_events_with_more_than_one_fod_point"] = q(
        "SELECT COUNT(*) FROM (SELECT MTBS_ID FROM fod WHERE MTBS_ID IS NOT NULL GROUP BY 1 HAVING COUNT(*) > 1)"
    )[0][0]
    rep["fod_with_mtbs_id_and_no_incident"] = q(
        "SELECT COUNT(*) FROM fod WHERE MTBS_ID IS NOT NULL AND FOD_ID NOT IN (SELECT fod_id FROM fod_links)"
    )[0][0]

    # ---- incident table ----
    c.execute(
        """CREATE TABLE out_inc AS
           SELECT i.INCIDENT_ID AS incident_id, i.INCIDENT_NAME AS name, CAST(i.START_YEAR AS INTEGER) AS year,
                  i.POO_STATE AS state, i.POO_COUNTY AS county, i.INCTYP_ABBREVIATION AS inctyp, i.CAUSE AS cause,
                  COALESCE(i.COMPLEX, FALSE) AS complex,
                  p.parent AS parent_id,
                  (SELECT COUNT(*) FROM mem m WHERE m.parent = i.INCIDENT_ID) AS n_members,
                  COALESCE(p.parent, i.INCIDENT_ID) AS root_id,
                  p.parent IS NULL AS is_root,
                  i.FINAL_ACRES AS acres,
                  i.STR_DESTROYED_TOTAL AS str_destroyed, i.STR_DESTROYED_RES_TOTAL AS str_destroyed_res,
                  i.STR_DESTROYED_COMM_TOTAL AS str_destroyed_comm, i.STR_DAMAGED_TOTAL AS str_damaged,
                  i.STR_THREATENED_MAX AS str_threatened,
                  i.FATALITIES AS fatalities, i.FATALITIES_PUBLIC AS fatalities_public,
                  i.FATALITIES_RESPONDER AS fatalities_responder, i.INJURIES_TOTAL AS injuries,
                  i.PEAK_EVACUATIONS AS evac_peak, i.PROJECTED_FINAL_IM_COST AS cost,
                  i.WF_PEAK_PERSONNEL AS personnel_peak, i.WF_GROWTH_DURATION AS growth_days,
                  CASE WHEN i.POO_LATITUDE BETWEEN 17 AND 72 AND i.POO_LONGITUDE BETWEEN -180 AND -60
                       THEN i.POO_LATITUDE END AS lat_poo,
                  CASE WHEN i.POO_LATITUDE BETWEEN 17 AND 72 AND i.POO_LONGITUDE BETWEEN -180 AND -60
                       THEN i.POO_LONGITUDE END AS lon_poo,
                  CASE WHEN i.LRGST_FOD_LATITUDE BETWEEN 17 AND 72 AND i.LRGST_FOD_LONGITUDE BETWEEN -180 AND -60
                       THEN i.LRGST_FOD_LATITUDE END AS lat_fod,
                  CASE WHEN i.LRGST_FOD_LATITUDE BETWEEN 17 AND 72 AND i.LRGST_FOD_LONGITUDE BETWEEN -180 AND -60
                       THEN i.LRGST_FOD_LONGITUDE END AS lon_fod
           FROM inc i LEFT JOIN mem p ON p.member = i.INCIDENT_ID"""
    )
    c.execute(
        """CREATE TABLE out_inc2 AS
           SELECT o.* EXCLUDE (lat_poo, lon_poo, lat_fod, lon_fod),
                  COALESCE(lat_poo, lat_fod) AS lat, COALESCE(lon_poo, lon_fod) AS lon,
                  CASE WHEN lat_poo IS NOT NULL THEN 'poo' WHEN lat_fod IS NOT NULL THEN 'fod' END AS loc_src,
                  (SELECT COUNT(DISTINCT fod_id) FROM fod_links f WHERE f.incident_id = o.incident_id) AS fod_n,
                  (SELECT COUNT(DISTINCT mtbs_id) FROM mtbs_links m WHERE m.incident_id = o.incident_id) AS mtbs_n,
                  -- a complex often has no links of its own; its members carry them
                  GREATEST((SELECT COUNT(DISTINCT fod_id) FROM fod_links WHERE incident_id = o.incident_id),
                           (SELECT COUNT(DISTINCT f.fod_id) FROM fod_links f JOIN out_inc r ON r.incident_id = f.incident_id
                             WHERE r.root_id = o.incident_id)) AS fod_n_rollup,
                  GREATEST((SELECT COUNT(DISTINCT mtbs_id) FROM mtbs_links WHERE incident_id = o.incident_id),
                           (SELECT COUNT(DISTINCT m.mtbs_id) FROM mtbs_links m JOIN out_inc r ON r.incident_id = m.incident_id
                             WHERE r.root_id = o.incident_id)) AS mtbs_n_rollup
           FROM out_inc o"""
    )
    # QA flags: things a reader should not take at face value.
    c.execute(
        """CREATE TABLE out_inc3 AS
           SELECT *, concat_ws(',',
             CASE WHEN lat IS NULL THEN 'no_location' END,
             CASE WHEN loc_src = 'fod' THEN 'location_from_fod' END,
             CASE WHEN str_destroyed > 100 AND COALESCE(acres, 0) < 100 THEN 'destroyed_vs_acres' END,
             CASE WHEN inctyp = 'RX' THEN 'prescribed' END,
             CASE WHEN fod_n_rollup = 0 THEN 'no_fod' END,
             CASE WHEN mtbs_n_rollup = 0 THEN 'no_mtbs' END,
             CASE WHEN NOT is_root THEN 'complex_member' END,
             CASE WHEN year < 2002 THEN 'sparse_reporting' END) AS qa
           FROM out_inc2"""
    )
    rep["roots"] = q("SELECT COUNT(*) FROM out_inc3 WHERE is_root")[0][0]
    rep["destroyed_all_vs_roots"] = q(
        "SELECT SUM(str_destroyed), SUM(str_destroyed) FILTER (WHERE is_root) FROM out_inc3"
    )[0]
    rep["fatalities_all_vs_roots"] = q("SELECT SUM(fatalities), SUM(fatalities) FILTER (WHERE is_root) FROM out_inc3")[0]
    rep["qa_flag_counts"] = {
        f: q(f"SELECT COUNT(*) FROM out_inc3 WHERE qa LIKE '%{f}%'")[0][0]
        for f in ("no_location", "location_from_fod", "destroyed_vs_acres", "prescribed", "no_fod", "no_mtbs", "complex_member", "sparse_reporting")
    }

    c.execute("COPY (SELECT * FROM out_inc3 ORDER BY year, incident_id) TO '%s' (FORMAT PARQUET, COMPRESSION ZSTD)" % (a.out / "ics_incidents.parquet"))
    c.execute(
        """COPY (SELECT incident_id, 'fod' AS kind, fod_id, NULL::VARCHAR AS mtbs_id, src FROM fod_links
                 UNION ALL SELECT incident_id, 'mtbs', NULL, mtbs_id, src FROM mtbs_links
                 ORDER BY kind, incident_id) TO '%s' (FORMAT PARQUET, COMPRESSION ZSTD)""" % (a.out / "ics_links.parquet")
    )
    (a.out / "ics_link_report.json").write_text(json.dumps(rep, indent=2, default=str))
    print(json.dumps(rep, indent=2, default=str))


if __name__ == "__main__":
    main()
