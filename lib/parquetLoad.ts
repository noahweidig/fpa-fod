import { applyExact } from "./discovery";
import { initDuck, type DuckHandle } from "./duck";
import { setDuckHandle } from "./backend";
import { qi } from "./sql";
import { useStore } from "./store";
import { CAT_DIMS, type CatDim } from "./types";

const patchParquet = (p: Partial<ReturnType<typeof useStore.getState>["parquet"]>) =>
  useStore.setState((s) => ({ parquet: { ...s.parquet, ...p } }));

async function discoverExact(h: DuckHandle) {
  const counts = Object.fromEntries(CAT_DIMS.map((d) => [d, {}])) as Record<CatDim, Record<string, number>>;
  for (const d of CAT_DIMS) {
    const col = h.cols[d];
    if (!col) continue;
    const t = await h.conn.query(`SELECT COALESCE(CAST(${qi(col)} AS VARCHAR), '') AS v, COUNT(*) AS n FROM fod GROUP BY 1`);
    for (const r of t.toArray()) {
      const o = (r as { toJSON(): Record<string, unknown> }).toJSON();
      counts[d][String(o.v)] = Number(o.n);
    }
  }
  const pairs: Record<string, string[]> = {};
  if (h.cols.general && h.cols.classification) {
    const t = await h.conn.query(
      `SELECT DISTINCT CAST(${qi(h.cols.general)} AS VARCHAR) AS g, CAST(${qi(h.cols.classification)} AS VARCHAR) AS c FROM fod`,
    );
    for (const r of t.toArray()) {
      const o = (r as { toJSON(): Record<string, unknown> }).toJSON();
      (pairs[String(o.g)] ??= []).push(String(o.c));
    }
  }
  const range = async (col?: string): Promise<[number, number] | undefined> => {
    if (!col) return undefined;
    const t = await h.conn.query(`SELECT MIN(TRY_CAST(${qi(col)} AS DOUBLE)) AS a, MAX(TRY_CAST(${qi(col)} AS DOUBLE)) AS b FROM fod`);
    const o = (t.toArray()[0] as { toJSON(): Record<string, unknown> }).toJSON();
    return Number.isFinite(Number(o.a)) ? [Number(o.a), Number(o.b)] : undefined;
  };
  applyExact({ counts, pairs, yearBounds: await range(h.cols.year), acreBounds: await range(h.cols.size) });
}

export async function loadParquet() {
  patchParquet({ status: "loading", message: "Starting…" });
  try {
    const h = await initDuck((message) => patchParquet({ message }));
    patchParquet({ message: "Reading categories…" });
    await discoverExact(h);
    setDuckHandle(h);
    patchParquet({ status: "ready", message: undefined, rows: h.rows });
  } catch (e) {
    console.error("Parquet/DuckDB unavailable, using approximate mode:", e);
    setDuckHandle(null);
    patchParquet({ status: "error", message: e instanceof Error ? e.message : String(e) });
  }
}
