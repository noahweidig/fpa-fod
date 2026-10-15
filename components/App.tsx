"use client";

import { useEffect } from "react";
import { PMTILES_URL } from "@/lib/config";
import { initFromMeta } from "@/lib/discovery";
import { loadMeta } from "@/lib/pm";
import { effectiveFilters, useStore } from "@/lib/store";
import { parse, serialize } from "@/lib/url";
import Legend from "./Legend";
import MapView from "./MapView";
import Sidebar from "./Sidebar";
import MapNotes from "./MapNotes";

export default function App() {
  const meta = useStore((s) => s.meta);
  const metaError = useStore((s) => s.metaError);
  const drawer = useStore((s) => s.drawer);

  /* boot: URL state + theme + metadata */
  useEffect(() => {
    const init = parse(window.location.search);
    const theme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    useStore.setState({ ...init, theme, basemap: init.basemap ?? (theme === "dark" ? "dark" : "light") });
    if (!PMTILES_URL) {
      useStore.setState({ metaError: "NEXT_PUBLIC_FOD_PMTILES_URL is not set. See README.md." });
      return;
    }
    loadMeta(PMTILES_URL)
      .then((m) => {
        useStore.setState({ meta: m });
        initFromMeta(m);
      })
      .catch((e) =>
        useStore.setState({ metaError: `Could not read PMTiles metadata: ${e?.message ?? e}. Check the URL and R2 CORS settings.` }),
      );
  }, []);

  /* debounced snapshot for map filters, counts, charts */
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const apply = () => {
      const s = useStore.getState();
      useStore.setState({
        applied: { filters: effectiveFilters(s.filters, s.anim), legend: s.legend, seq: s.applied.seq + 1 },
      });
    };
    const unsub = useStore.subscribe((s, p) => {
      if (s.filters !== p.filters || s.legend !== p.legend || s.anim !== p.anim) {
        clearTimeout(t);
        t = setTimeout(apply, 150);
      }
    });
    apply();
    return () => {
      unsub();
      clearTimeout(t);
    };
  }, []);

  /* URL sync */
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    return useStore.subscribe((s) => {
      clearTimeout(t);
      t = setTimeout(() => {
        const q = serialize(s);
        window.history.replaceState(null, "", q ? `?${q}` : window.location.pathname);
      }, 400);
    });
  }, []);

  return (
    <div className="relative flex h-dvh w-full overflow-hidden">
      <Sidebar />
      {drawer && <div className="fixed inset-0 z-20 bg-black/40 md:hidden" onClick={() => useStore.setState({ drawer: false })} />}
      <main className="relative min-w-0 flex-1">
        {meta && <MapView />}
        {!meta && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            {metaError ? <p className="max-w-md text-err">{metaError}</p> : <p className="text-muted">Reading tile metadata…</p>}
          </div>
        )}
        {meta && <Legend />}
        {meta && <MapNotes />}
        <button
          className="btn absolute left-3 top-3 z-10 shadow md:hidden"
          onClick={() => useStore.setState({ drawer: !drawer })}
          aria-expanded={drawer}
        >
          ☰ Controls
        </button>
      </main>
    </div>
  );
}
