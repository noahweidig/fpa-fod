"use client";

import { BarChart3, Download, GitCompareArrows, Filter, GripVertical, Info, Moon, Palette, Sun, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useStore, type Tab } from "@/lib/store";
import CountBar from "./CountBar";
import AnalyzePanel from "./AnalyzePanel";
import ChartsPanel from "./ChartsPanel";
import FilterChips from "./FilterChips";
import ExportPanel from "./ExportPanel";
import Logo from "./Logo";
import FiltersPanel from "./FiltersPanel";
import Footer from "./Footer";
import PanelBoundary from "./PanelBoundary";
import StylePanel from "./StylePanel";

const PANELS: Record<Tab, React.ComponentType> = {
  style: StylePanel,
  filters: FiltersPanel,
  charts: ChartsPanel,
  analyze: AnalyzePanel,
  export: ExportPanel,
  about: Footer,
};

function toggleTheme() {
  const s = useStore.getState();
  const next = s.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem("fod-theme", next);
  } catch {
    /* storage may be unavailable */
  }
  useStore.setState({ theme: next, ...(s.basemap === "light" || s.basemap === "dark" ? { basemap: next } : {}) });
}

const MIN_W = 300, MAX_W = 800, DEF_W = 400;
const clampW = (w: number) => Math.min(MAX_W, Math.max(MIN_W, Math.min(w, window.innerWidth - 240)));

export default function Sidebar() {
  const [width, setWidth] = useState(DEF_W);
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    try {
      const v = Number(localStorage.getItem("fod-sidebar-w"));
      if (v) setWidth(clampW(v));
    } catch {
      /* storage may be unavailable */
    }
  }, []);
  const save = (w: number) => {
    try {
      localStorage.setItem("fod-sidebar-w", String(w));
    } catch {
      /* storage may be unavailable */
    }
  };
  const startDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const x0 = e.clientX, w0 = width;
    let w = w0;
    const move = (ev: PointerEvent) => {
      w = clampW(w0 + ev.clientX - x0);
      setWidth(w);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = document.body.style.userSelect = "";
      save(w);
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const onKey = (e: React.KeyboardEvent) => {
    const d = ({ ArrowLeft: -20, ArrowRight: 20 } as Record<string, number>)[e.key];
    if (!d) return;
    e.preventDefault();
    const w = clampW(width + d);
    setWidth(w);
    save(w);
  };
  const theme = useStore((s) => s.theme);
  const meta = useStore((s) => s.meta);
  const drawer = useStore((s) => s.drawer);
  const tab = useStore((s) => s.tab);
  const Panel = PANELS[tab];
  useEffect(() => {
    // braces on purpose: an effect must not return scrollTo's value, or React calls it as a cleanup
    bodyRef.current?.scrollTo(0, 0);
  }, [tab]);
  const tabs = [
    { id: "style", label: "Style", Icon: Palette },
    { id: "filters", label: "Filters", Icon: Filter },
    { id: "charts", label: "Charts", Icon: BarChart3 },
    { id: "analyze", label: "Analyze", Icon: GitCompareArrows },
    { id: "export", label: "Export", Icon: Download },
    { id: "about", label: "About", Icon: Info },
  ] as const;

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-30 flex w-[min(92vw,400px)] shrink-0 flex-col border-r border-line bg-panel transition-transform md:static md:w-[var(--sbw)] md:translate-x-0 ${drawer ? "translate-x-0" : "-translate-x-full"}`}
      aria-label="Controls"
      style={{ "--sbw": `${width}px` } as React.CSSProperties}
    >
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <h1 className="flex items-center gap-2 text-base font-semibold">
          <Logo />
          FPA-FOD ignitions
        </h1>
        <div className="flex gap-1">
          <button className="btn grid h-9 w-9 place-items-center p-0" onClick={toggleTheme} aria-label="Toggle dark and light theme" title="Toggle theme">
            {theme === "dark" ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
          </button>
          <button className="btn md:hidden" onClick={() => useStore.setState({ drawer: false })} aria-label="Close controls"><X size={16} aria-hidden /></button>
        </div>
      </header>
      <CountBar />
      <FilterChips />
      <nav className="@container flex border-b border-line" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id} role="tab" aria-selected={tab === t.id} aria-label={t.label} title={t.label}
            className={`min-w-0 flex-1 border-b-2 px-2 py-2 ${tab === t.id ? "border-accent font-semibold" : "border-transparent text-muted"}`}
            onClick={() => useStore.setState({ tab: t.id })}
          >
            <span className="inline-flex items-center justify-center gap-1"><t.Icon size={14} aria-hidden /><span className="@max-[420px]:hidden">{t.label}</span></span>
          </button>
        ))}
      </nav>
      <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto p-4">
        <PanelBoundary key={tab}>{meta ? <Panel /> : <p className="text-muted">Loading…</p>}</PanelBoundary>
      </div>
      <div // NOSONAR: window-splitter pattern
        role="separator" aria-orientation="vertical" aria-label="Resize controls panel" aria-valuenow={width} aria-valuemin={MIN_W} aria-valuemax={MAX_W}
        tabIndex={0} // NOSONAR: focusable separator is the WAI-ARIA window-splitter pattern
        onPointerDown={startDrag} onKeyDown={onKey}
        onDoubleClick={() => { setWidth(DEF_W); save(DEF_W); }}
        className="group absolute inset-y-0 -right-1.5 z-10 hidden w-3 cursor-col-resize items-center justify-center outline-none md:flex"
      >
        <span className="h-full w-px bg-transparent group-hover:bg-accent group-focus-visible:bg-accent" />
        <GripVertical size={14} aria-hidden className="absolute rounded bg-panel py-1 text-muted opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" />
      </div>
    </aside>
  );
}
