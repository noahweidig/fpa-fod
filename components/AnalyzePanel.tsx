"use client";

import { useStore } from "@/lib/store";
import AcresByYear from "./AcresByYear";
import BusiestDays from "./BusiestDays";
import ComparePanel from "./ComparePanel";
import SeasonCard from "./SeasonCard";
import SummaryTable from "./SummaryTable";
import TopFires from "./TopFires";
import TrendsCard from "./TrendsCard";
import WeekdayCard from "./WeekdayCard";

export default function AnalyzePanel() {
  const exact = useStore((s) => s.parquet.status === "ready");
  return (
    <div className="space-y-3">
      <TrendsCard />
      {exact ? (
        <>
          <p className="text-xs text-muted">Exact results over all fires in the Parquet, using the current filters and area.</p>
          <AcresByYear />
          <SeasonCard />
          <WeekdayCard />
          <BusiestDays />
          <SummaryTable />
          <TopFires />
          <ComparePanel />
        </>
      ) : (
        <p className="text-xs text-muted">
          The summary table, top fires and period compare query the full Parquet file. Set <code>NEXT_PUBLIC_FOD_PARQUET_URL</code> (or wait for it to finish loading).
        </p>
      )}
    </div>
  );
}
