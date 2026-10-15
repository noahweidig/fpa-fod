"use client";

import { useStore } from "@/lib/store";
import CountBar from "./CountBar";
import ChartsPanel from "./ChartsPanel";
import ExportPanel from "./ExportPanel";
import FiltersPanel from "./FiltersPanel";
import Footer from "./Footer";
import StylePanel from "./StylePanel";

function toggleTheme() {
  const s = useStore.getState();
  const next = s.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem("fod-theme", next);
  } catch {
    /* storage may be unavailable */
  }
  useStore.setState({ theme: next, ...(s.basemap !== "satellite" ? { basemap: next } : {}) });
}

export default function Sidebar() {
  const theme = useStore((s) => s.theme);
  const meta = useStore((s) => s.meta);
  const drawer = useStore((s) => s.drawer);
  const tab = useStore((s) => s.tab);
  const tabs = [
    { id: "style", label: "Style" },
    { id: "filters", label: "Filters" },
    { id: "charts", label: "Charts" },
    { id: "export", label: "Export" },
  ] as const;

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-30 flex w-[min(92vw,400px)] shrink-0 flex-col border-r border-line bg-panel transition-transform md:static md:translate-x-0 ${drawer ? "translate-x-0" : "-translate-x-full"}`}
      aria-label="Controls"
    >
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <h1 className="text-base font-semibold">FPA-FOD ignitions</h1>
        <div className="flex gap-1">
          <button className="btn" onClick={toggleTheme} aria-label="Toggle dark and light theme" title="Toggle theme">
            {theme === "dark" ? "☀" : "☾"}
          </button>
          <button className="btn md:hidden" onClick={() => useStore.setState({ drawer: false })} aria-label="Close controls">✕</button>
        </div>
      </header>
      <CountBar />
      <nav className="flex border-b border-line" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id} role="tab" aria-selected={tab === t.id}
            className={`flex-1 border-b-2 px-2 py-2 ${tab === t.id ? "border-accent font-semibold" : "border-transparent text-muted"}`}
            onClick={() => useStore.setState({ tab: t.id })}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {!meta ? <p className="text-muted">Loading…</p> : tab === "style" ? <StylePanel /> : tab === "filters" ? <FiltersPanel /> : tab === "charts" ? <ChartsPanel /> : <ExportPanel />}
      </div>
      <Footer />
    </aside>
  );
}
