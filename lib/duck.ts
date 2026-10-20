import * as duckdb from "@duckdb/duckdb-wasm";
import { ICS_INCIDENTS_URL, ICS_LINKS_URL, PARQUET_URL } from "./config";
import { resolveFields } from "./fields";
import type { Cols } from "./sql";
import { qi } from "./sql";

export interface DuckHandle {
  db: duckdb.AsyncDuckDB;
  conn: duckdb.AsyncDuckDBConnection;
  cols: Cols;
  allColumns: string[];
  /** true when a narrow in-memory table was built; false when `fod` is a view on the remote file */
  materialized: boolean;
  rows: number;
  /** ICS-209-PLUS tables (`ics_inc`, `ics_link`) are loaded */
  ics: boolean;
}

const FILE = "fod.parquet";
const pick = (names: string[], cands: string[]) => {
  const lower = new Map(names.map((n) => [n.toLowerCase(), n]));
  for (const c of cands) if (lower.has(c)) return lower.get(c);
  return undefined;
};

export async function initDuck(onStatus: (m: string) => void): Promise<DuckHandle> {
  onStatus("Starting DuckDB…");
  const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());
  const workerUrl = URL.createObjectURL(new Blob([`importScripts("${bundle.mainWorker!}");`], { type: "text/javascript" }));
  const worker = new Worker(workerUrl);
  const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  URL.revokeObjectURL(workerUrl);
  await db.registerFileURL(FILE, PARQUET_URL, duckdb.DuckDBDataProtocol.HTTP, false);
  const conn = await db.connect();

  onStatus("Reading Parquet schema…");
  const desc = await conn.query(`DESCRIBE SELECT * FROM read_parquet('${FILE}')`);
  const allColumns = desc.toArray().map((r: { column_name: string }) => String(r.column_name));
  const roles = resolveFields(allColumns);
  const cols: Cols = {
    ...roles,
    name: pick(allColumns, ["fire_name", "name"]),
    mtbsId: pick(allColumns, ["mtbs_id"]),
    lon: pick(allColumns, ["lon", "longitude", "lng", "x"]),
    lat: pick(allColumns, ["lat", "latitude", "y"]),
  };
  if (!cols.lon || !cols.lat) throw new Error("Parquet needs lon and lat columns.");

  onStatus("Loading columns for exact counts…");
  const needed = [...new Set(Object.values(cols).filter(Boolean) as string[])];
  let materialized = true;
  try {
    await conn.query(`CREATE TABLE fod AS SELECT ${needed.map(qi).join(", ")} FROM read_parquet('${FILE}')`);
  } catch (e) {
    console.warn("Could not materialize Parquet columns, querying the file directly:", e);
    materialized = false;
    await conn.query(`CREATE OR REPLACE VIEW fod AS SELECT * FROM read_parquet('${FILE}')`);
  }
  const n = await conn.query(`SELECT COUNT(*) AS n FROM fod`);
  const rows = Number(n.toArray()[0].n);

  let ics = false;
  if (ICS_INCIDENTS_URL && ICS_LINKS_URL) {
    onStatus("Loading ICS-209-PLUS impact data…");
    try {
      await db.registerFileURL("ics_incidents.parquet", ICS_INCIDENTS_URL, duckdb.DuckDBDataProtocol.HTTP, false);
      await db.registerFileURL("ics_links.parquet", ICS_LINKS_URL, duckdb.DuckDBDataProtocol.HTTP, false);
      await conn.query(`CREATE TABLE ics_inc AS SELECT * FROM read_parquet('ics_incidents.parquet')`);
      await conn.query(`CREATE TABLE ics_link AS SELECT * FROM read_parquet('ics_links.parquet')`);
      ics = true;
    } catch (e) {
      console.warn("ICS-209-PLUS data unavailable, impact features are off:", e);
    }
  }
  return { db, conn, cols, allColumns, materialized, rows, ics };
}

export const PARQUET_FILE = FILE;
