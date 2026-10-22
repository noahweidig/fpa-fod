"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import AcresByYear from "./AcresByYear";
import BusiestDays from "./BusiestDays";
import Concentration from "./Concentration";
import ComparePanel from "./ComparePanel";
import ImpactByYear from "./ImpactByYear";
import ImpactNotes from "./ImpactNotes";
import ImpactTop from "./ImpactTop";
import LargestPerYear from "./LargestPerYear";
import SeasonCard from "./SeasonCard";
import SeasonProgress from "./SeasonProgress";
import SizeHistogram from "./SizeHistogram";
import SummaryTable from "./SummaryTable";
import TopFires from "./TopFires";
import TrendsCard from "./TrendsCard";
import WeekdayCard from "./WeekdayCard";

const SECTIONS = [
  { id: "time", label: "Over time", cards: [{ k: "trends", C: TrendsCard }, { k: "acres", C: AcresByYear }, { k: "largest", C: LargestPerYear }] },
  { id: "season", label: "Season", cards: [{ k: "season", C: SeasonCard }, { k: "progress", C: SeasonProgress }, { k: "weekday", C: WeekdayCard }, { k: "busiest", C: BusiestDays }] },
  { id: "breakdown", label: "Breakdown", cards: [{ k: "size", C: SizeHistogram }, { k: "concentration", C: Concentration }, { k: "summary", C: SummaryTable }, { k: "top", C: TopFires }] },
  { id: "compare", label: "Compare", cards: [{ k: "compare", C: ComparePanel }] },
  { id: "impact", label: "Impact", cards: [{ k: "notes", C: ImpactNotes }, { k: "top", C: ImpactTop }, { k: "byyear", C: ImpactByYear }] },
] as const;

export default function AnalyzePanel() {
  const exact = useStore((s) => s.parquet.status === "ready");
  const ics = useStore((s) => !!s.parquet.ics);
  const [id, setId] = useState<(typeof SECTIONS)[number]["id"]>("time");
  // impact needs the ICS tables, the trends card works without the Parquet, everything else needs the Parquet
  const available = (k: string) => {
    if (id === "impact") return ics;
    return exact || k === "trends";
  };
  const section = SECTIONS.find((s) => s.id === id) ?? SECTIONS[0];
  return (
    <div className="space-y-3">
      <nav className="flex flex-wrap gap-1" aria-label="Analyze sections">
        {SECTIONS.map((s) => (
          <button key={s.id} className="btn text-xs" aria-pressed={id === s.id} onClick={() => setId(s.id)}>{s.label}</button>
        ))}
      </nav>
      {exact ? (
        <p className="text-xs text-muted">Exact results over all fires in the Parquet, using the current filters and area.</p>
      ) : (
        <p className="text-xs text-muted">
          Only Trends works without the full Parquet file. The other cards query it. Set <code>NEXT_PUBLIC_FOD_PARQUET_URL</code> (or wait for it to finish loading).
        </p>
      )}
      {section.id === "impact" && exact && !ics && (
        <p className="text-xs text-muted">
          Impact needs the ICS-209-PLUS tables. Build them with <code>scripts/build-ics-link.py</code> and set <code>NEXT_PUBLIC_ICS_INCIDENTS_URL</code> and <code>NEXT_PUBLIC_ICS_LINKS_URL</code>.
        </p>
      )}
      {section.cards.map(({ k, C }) => (available(k) ? <C key={k} /> : null))}
    </div>
  );
}
