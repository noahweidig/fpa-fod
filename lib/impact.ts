import { areaSql } from "./area";
import { getDuck, type Query } from "./backend";
import { assignRegions, IMPACT_CHORO, type Geo, type ImpactChoro, type RegionDef, type RegionRow } from "./regions";
import { norm, STATE_CODES } from "./place";
import { qi, ql, whereSql } from "./sql";

/* ICS-209-PLUS incident impact, queried from the `ics_inc` / `ics_link` tables (see scripts/build-ics-link.py).
   Rules that keep the numbers honest:
   - An incident is the unit that reports damage. FOD ignitions and MTBS perimeters only carry links to it, so impact
     is never summed over FOD points or perimeters (one incident links to many of both).
   - A complex and its member fires are both incidents and both report damage. Totals count roots only (is_root)
     unless the caller opts into members. */

export type ImpactMetric = "str_destroyed" | "fatalities" | "injuries" | "evac_peak" | "cost" | "acres";

export const IMPACT_METRICS: { id: ImpactMetric; label: string; unit: string; min: number; note?: string }[] = [
  { id: "str_destroyed", min: 10, label: "Structures destroyed", unit: "structures" },
  { id: "fatalities", min: 1, label: "Fatalities", unit: "deaths" },
  { id: "injuries", min: 5, label: "Injuries", unit: "injuries" },
  { id: "evac_peak", min: 100, label: "Peak evacuations", unit: "people", note: "Reported on few incidents (mostly 2014 onward)." },
  { id: "cost", min: 1000000, label: "Suppression cost", unit: "USD", note: "Projected final management cost, nominal dollars, missing for about a third of incidents." },
  { id: "acres", min: 10000, label: "Acres burned", unit: "acres" },
];

export const impactLabel = (m: ImpactMetric) => IMPACT_METRICS.find((x) => x.id === m)!;

function fmtCost(v: number) {
  if (v < 1e6) return "$" + Math.round(v).toLocaleString();
  return "$" + (v / 1e6).toFixed(v >= 1e8 ? 0 : 1) + "M";
}

export function fmtImpact(m: ImpactMetric, v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return "–";
  return m === "cost" ? fmtCost(v) : Math.round(v).toLocaleString();
}

export interface Incident {
  id: string;
  name: string;
  year: number;
  state: string;
  county: string;
  inctyp: string;
  cause: string;
  acres: number | null;
  destroyed: number | null;
  destroyedRes: number | null;
  destroyedComm: number | null;
  damaged: number | null;
  fatalities: number | null;
  fatalitiesPublic: number | null;
  fatalitiesResponder: number | null;
  injuries: number | null;
  evac: number | null;
  cost: number | null;
  lat: number | null;
  lon: number | null;
  isRoot: boolean;
  parentId: string | null;
  rootId: string;
  nMembers: number;
  fodN: number;
  mtbsN: number;
  fodNRollup: number;
  mtbsNRollup: number;
  qa: string[];
}

const COLS = `incident_id, name, year, state, county, inctyp, cause, acres, str_destroyed, str_destroyed_res, str_destroyed_comm,
  str_damaged, fatalities, fatalities_public, fatalities_responder, injuries, evac_peak, cost, lat, lon, is_root, parent_id,
  root_id, n_members, fod_n, mtbs_n, fod_n_rollup, mtbs_n_rollup, qa`;

const METRIC_COL: Record<ImpactMetric, string> = {
  str_destroyed: "str_destroyed", fatalities: "fatalities", injuries: "injuries", evac_peak: "evac_peak", cost: "cost", acres: "acres",
};

const num = (v: unknown) => (v == null ? null : Number(v));

/** Parquet text columns arrive as strings (or null); anything else is treated as empty. */
function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "bigint") return String(v);
  return "";
}

function toIncident(o: Record<string, unknown>): Incident {
  return {
    id: str(o.incident_id), name: str(o.name), year: Number(o.year), state: str(o.state), county: str(o.county),
    inctyp: str(o.inctyp), cause: str(o.cause), acres: num(o.acres), destroyed: num(o.str_destroyed),
    destroyedRes: num(o.str_destroyed_res), destroyedComm: num(o.str_destroyed_comm), damaged: num(o.str_damaged),
    fatalities: num(o.fatalities), fatalitiesPublic: num(o.fatalities_public), fatalitiesResponder: num(o.fatalities_responder),
    injuries: num(o.injuries), evac: num(o.evac_peak), cost: num(o.cost), lat: num(o.lat), lon: num(o.lon),
    isRoot: Boolean(o.is_root), parentId: str(o.parent_id) || null, rootId: str(o.root_id),
    nMembers: Number(o.n_members), fodN: Number(o.fod_n), mtbsN: Number(o.mtbs_n),
    fodNRollup: Number(o.fod_n_rollup), mtbsNRollup: Number(o.mtbs_n_rollup),
    qa: str(o.qa).split(",").filter(Boolean),
  };
}

async function run(sql: string): Promise<Record<string, unknown>[]> {
  const d = getDuck();
  if (!d?.h.ics) return [];
  const t = await d.h.conn.query(sql);
  return t.toArray().map((r: unknown) => {
    const o = (r as { toJSON(): Record<string, unknown> }).toJSON();
    for (const k of Object.keys(o)) if (typeof o[k] === "bigint") o[k] = Number(o[k]);
    return o;
  });
}

/** The year, state and area filters apply to incidents (they have their own year, state and point of origin). */
function incidentWhere(q: Query, members: boolean, extra: string[] = []) {
  const w: string[] = [];
  if (!members) w.push("is_root");
  if (q.filters.year) w.push(`year BETWEEN ${q.filters.year[0]} AND ${q.filters.year[1]}`);
  const st = q.filters.cats.state;
  if (st?.length) w.push(`state IN (${st.map(ql).join(", ")})`);
  if (q.area?.length) w.push(`lat IS NOT NULL AND ${areaSql(q.area, "lon", "lat")}`);
  return whereSql([...w, ...extra]);
}

export async function impactTop(q: Query, metric: ImpactMetric, limit: number, members: boolean): Promise<Incident[]> {
  const col = METRIC_COL[metric];
  const where = incidentWhere(q, members, [`${col} > 0`]);
  const rows = await run(`SELECT ${COLS} FROM ics_inc ${where} ORDER BY ${col} DESC, incident_id LIMIT ${Math.max(1, Math.floor(limit))}`);
  return rows.map(toIncident);
}

export interface YearImpact {
  year: number;
  incidents: number;
  destroyed: number;
  fatalities: number;
  injuries: number;
  cost: number;
  acres: number;
}

export async function impactByYear(q: Query, members: boolean): Promise<YearImpact[]> {
  const where = incidentWhere(q, members);
  const s = (c: string) => `COALESCE(SUM(${c}), 0)`;
  const rows = await run(
    `SELECT year, COUNT(*) AS n, ${s("str_destroyed")} AS d, ${s("fatalities")} AS f, ${s("injuries")} AS i, ${s("cost")} AS c, ${s("acres")} AS a ` +
      `FROM ics_inc ${where} GROUP BY year ORDER BY year`,
  );
  return rows.map((o) => ({
    year: Number(o.year), incidents: Number(o.n), destroyed: Number(o.d), fatalities: Number(o.f), injuries: Number(o.i), cost: Number(o.c), acres: Number(o.a),
  }));
}

/** Incidents with a point of origin and a non-zero value, for the map overlay. */
export async function impactPoints(q: Query, metric: ImpactMetric, members: boolean, min: number): Promise<Incident[]> {
  const col = METRIC_COL[metric];
  const where = incidentWhere(q, members, ["lat IS NOT NULL", `${col} >= ${Math.max(min, 1e-9)}`]);
  const rows = await run(`SELECT ${COLS} FROM ics_inc ${where} ORDER BY ${col} DESC LIMIT 30000`);
  return rows.map(toIncident);
}

/** Incidents linked to one FOD ignition, plus the complex each belongs to. */
export async function incidentsForFod(fodId: string | number): Promise<Incident[]> {
  const id = Number(fodId);
  if (!Number.isFinite(id)) return [];
  const linked = `SELECT incident_id FROM ics_link WHERE kind = 'fod' AND fod_id = ${id}`;
  const rows = await run(
    `SELECT ${COLS} FROM ics_inc WHERE incident_id IN (${linked}) OR incident_id IN (SELECT root_id FROM ics_inc WHERE incident_id IN (${linked})) ORDER BY is_root, incident_id`,
  );
  return rows.map(toIncident);
}

/** Incidents linked to one MTBS event, plus their complexes. */
export async function incidentsForMtbs(eventId: string): Promise<Incident[]> {
  const linked = `SELECT incident_id FROM ics_link WHERE kind = 'mtbs' AND mtbs_id = ${ql(eventId)}`;
  const rows = await run(
    `SELECT ${COLS} FROM ics_inc WHERE incident_id IN (${linked}) OR incident_id IN (SELECT root_id FROM ics_inc WHERE incident_id IN (${linked})) ORDER BY is_root, incident_id`,
  );
  return rows.map(toIncident);
}

export interface IncidentLinks {
  fod: { id: number; lon: number; lat: number }[];
  mtbs: string[];
}

/** Everything linked to an incident and, for a complex, to its members. */
export async function incidentLinks(rootId: string): Promise<IncidentLinks> {
  const d = getDuck();
  if (!d?.h.ics || !d.h.cols.id || !d.h.cols.lon || !d.h.cols.lat) return { fod: [], mtbs: [] };
  const inc = `SELECT incident_id FROM ics_inc WHERE root_id = ${ql(rootId)}`;
  const f = await run(
    `SELECT l.fod_id AS id, f.${qi(d.h.cols.lon)} AS lon, f.${qi(d.h.cols.lat)} AS lat FROM ics_link l JOIN fod f ON TRY_CAST(f.${qi(d.h.cols.id)} AS BIGINT) = l.fod_id ` +
      `WHERE l.kind = 'fod' AND l.incident_id IN (${inc})`,
  );
  const m = await run(`SELECT DISTINCT mtbs_id FROM ics_link WHERE kind = 'mtbs' AND incident_id IN (${inc})`);
  return {
    fod: f.map((o) => ({ id: Number(o.id), lon: Number(o.lon), lat: Number(o.lat) })),
    mtbs: m.map((o) => String(o.mtbs_id)),
  };
}

/** MTBS event ids linked to the given root incidents (for outlining perimeters while an incident filter is on). */
export async function incidentMtbsIds(rootIds: string[]): Promise<string[]> {
  if (!rootIds.length) return [];
  const rows = await run(
    `SELECT DISTINCT mtbs_id FROM ics_link WHERE kind = 'mtbs' AND incident_id IN (SELECT incident_id FROM ics_inc WHERE root_id IN (${rootIds.map(ql).join(", ")}))`,
  );
  return rows.map((o) => String(o.mtbs_id));
}

/** FOD_IDs linked to the given root incidents (for the map filter; the SQL filter covers counts and charts). */
export async function incidentFodIds(rootIds: string[]): Promise<number[]> {
  if (!rootIds.length) return [];
  const rows = await run(
    `SELECT DISTINCT fod_id FROM ics_link WHERE kind = 'fod' AND incident_id IN (SELECT incident_id FROM ics_inc WHERE root_id IN (${rootIds.map(ql).join(", ")})) LIMIT 60000`,
  );
  return rows.map((o) => Number(o.fod_id));
}

/** Link quality counts for the info panel. */
export async function linkStats() {
  const [r] = await run(
    `SELECT COUNT(*) AS n, COUNT(*) FILTER (WHERE is_root) AS roots, COUNT(*) FILTER (WHERE fod_n_rollup > 0) AS with_fod,
            COUNT(*) FILTER (WHERE mtbs_n_rollup > 0) AS with_mtbs, MIN(year) AS y0, MAX(year) AS y1 FROM ics_inc`,
  );
  return r ? { incidents: Number(r.n), roots: Number(r.roots), withFod: Number(r.with_fod), withMtbs: Number(r.with_mtbs), years: [Number(r.y0), Number(r.y1)] as [number, number] } : null;
}

/** Root incidents summed per region (state / county by name, others by point of origin). `total` counts incidents in the query. */
export async function impactRegionRows(def: RegionDef, geo: Geo, q: Query, say: (m: string) => void): Promise<{ rows: RegionRow[]; total: number }> {
  if (!getDuck()?.h.ics) throw new Error("Impact metrics need the ICS-209-PLUS tables.");
  const ms = Object.entries(IMPACT_CHORO).filter((e): e is [ImpactChoro, string] => e[1] != null);
  const pip = def.pip;
  say("Reading incidents…");
  const rows = await run(
    `SELECT state, county, lon, lat, ${ms.map(([k, c]) => `${c} AS ${k}`).join(", ")} FROM ics_inc ${incidentWhere(q, false, pip ? ["lat IS NOT NULL"] : [])}`,
  );
  const reg = pip ? await assignRegions(geo, rows.map((o) => Number(o.lon)), rows.map((o) => Number(o.lat)), say) : null;
  const by = new Map<string, RegionRow>();
  rows.forEach((o, i) => {
    let key = "";
    if (reg) key = reg[i] < 65535 ? geo.keys[reg[i]] ?? "" : "";
    else {
      const st = String(o.state ?? "").trim();
      const code = st.length === 2 ? st.toUpperCase() : STATE_CODES[st.toLowerCase()] ?? "";
      key = def.id === "state" ? code : `${code}|${norm(String(o.county ?? ""))}`;
    }
    let r = by.get(key);
    if (!r) by.set(key, (r = { key, n: 0, acres: 0, imp: { incidents: 0 } }));
    r.imp!.incidents! += 1;
    for (const [k] of ms) r.imp![k] = (r.imp![k] ?? 0) + (Number(o[k]) || 0);
  });
  return { rows: [...by.values()], total: rows.length };
}
