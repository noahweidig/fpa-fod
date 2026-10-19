import { BookOpen, Database, FileText, Layers, Link2, Scale, TriangleAlert } from "lucide-react";
import { CITATION_DOI, CITATION_TEXT, RDS_URL } from "@/lib/config";
import Collapsible from "./Collapsible";

const RDS_PRODUCTS = "https://www.fs.usda.gov/rds/archive/products/RDS-2013-0009.7";
const A = ({ href, children }: Readonly<{ href: string; children: React.ReactNode }>) => (
  <a className="underline" href={href} target="_blank" rel="noreferrer">{children}</a>
);
const Dl = ({ rows }: Readonly<{ rows: [string, string][] }>) => (
  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
    {rows.map(([k, v]) => (
      <div key={k} className="contents">
        <dt className="font-semibold text-ink">{k}</dt>
        <dd>{v}</dd>
      </div>
    ))}
  </dl>
);

const SIZE_CLASSES: [string, string][] = [
  ["A", "greater than 0 but ≤ 0.25 acres"],
  ["B", "0.26–9.9 acres"],
  ["C", "10.0–99.9 acres"],
  ["D", "100–299 acres"],
  ["E", "300–999 acres"],
  ["F", "1,000–4,999 acres"],
  ["G", "5,000 acres or greater"],
];

const EDITIONS: [string, string][] = [
  ["1st", "1992–2011"], ["2nd", "1992–2012"], ["3rd", "1992–2013"], ["4th", "1992–2015"],
  ["5th", "1992–2018"], ["6th", "1992–2020"], ["7th", "1992–2024 (this app)"],
];

export default function Footer() {
  return (
    <div className="space-y-2 text-xs leading-relaxed text-muted">
      <p>
        Everything below comes from the official{" "}
        <A href={RDS_URL}>USFS Research Data Archive catalog page</A> and its{" "}
        <A href={`${RDS_PRODUCTS}/_metadata_RDS-2013-0009.7.html`}>metadata record</A>, read on 2026-10-19. The Forest Service may update either page.
      </p>

      <Collapsible id="about-data" title="The dataset" Icon={Database} defaultOpen>
        <Dl rows={[
          ["Title", "Spatial wildfire occurrence data for the United States, 1992-2024 [FPA_FOD_20260615]"],
          ["Author", "Karen C. Short, USDA Forest Service, Rocky Mountain Research Station"],
          ["Edition", "7th (publication year 2026)"],
          ["Size", "2.66 million geo-referenced wildfire records; 209 million acres burned over 33 years"],
        ]} />
        <p>
          A spatial database of wildfires in the United States, originally generated to support the national Fire Program Analysis (FPA) system.
          Records come from the reporting systems of federal, state and local fire organizations. A record needed a discovery date, a final fire size and a
          point location at least as precise as a Public Land Survey System section (a 1-square-mile grid).
        </p>
        <p>
          Data were transformed to follow National Wildfire Coordinating Group (NWCG) standards where possible, including the wildfire-cause standard updated in
          August 2020. Basic error-checking was done and redundant records were removed to the degree possible. Identifiers link each point to published
          large-fire perimeters (MTBS) and operational situation reports (ICS-209-PLUS).
        </p>
      </Collapsible>

      <Collapsible id="about-limits" title="Limits and quality" Icon={TriangleAlert}>
        <p>
          Viable state and local (nonfederal) records were not available from all states for all years, so counts may underrepresent actual wildfire activity in some
          areas and periods. Area burned is less affected than fire counts, because very large fires account for most acreage and are usually reported by several agencies.
        </p>
        <p>
          The authors scored states by comparing the database to published estimates by state and year. High-scoring states include most of the Great Lakes,
          Southeastern and Western regions (including Alaska), plus a few others.
        </p>
        <p>
          Attributes are subject to the inaccuracies of the original datasets. State and county come from the fire report, not from a spatial overlay.
          The seventh edition adds data from states and territories (for example Guam) and years that were previously underrepresented.
        </p>
      </Collapsible>

      <Collapsible id="about-fields" title="Field guide" Icon={FileText}>
        <div>
          <div className="mb-1 font-semibold text-ink">Fire size class (acres in the final perimeter)</div>
          <Dl rows={SIZE_CLASSES} />
        </div>
        <div>
          <div className="mb-1 font-semibold text-ink">Cause classification</div>
          <p>Human, Natural, or Missing data/not specified/undetermined.</p>
        </div>
        <div>
          <div className="mb-1 font-semibold text-ink">General cause</div>
          <p>
            Arson/incendiarism; Debris and open burning; Equipment and vehicle use; Firearms and explosives use; Fireworks; Misuse of fire by a minor; Natural;
            Power generation/transmission/distribution; Railroad operations and maintenance; Recreation and ceremony; Smoking; Other causes; Missing data/not specified/undetermined.
          </p>
        </div>
        <div>
          <div className="mb-1 font-semibold text-ink">Cause age category</div>
          <p>Set to Minor when the cause is attributed to children (0–12) or adolescents (13–17); otherwise empty.</p>
        </div>
        <div>
          <div className="mb-1 font-semibold text-ink">Other fields</div>
          <p>
            Source system type is FED, NONFED or INTERAGCY. Reporting agency uses NWCG unit identifiers (BIA, BLM, BOR, DOD, DOE, FS, FWS, IA, NPS, ST/C&amp;L, TRIBE).
            Locations are decimal degrees on NAD83.
          </p>
        </div>
      </Collapsible>

      <Collapsible id="about-editions" title="Editions" Icon={Layers}>
        <Dl rows={EDITIONS} />
        <p>
          Earlier editions are listed on the <A href={`${RDS_URL}/related`}>related publications</A> page. All editions follow the methods in Short (2014).
        </p>
      </Collapsible>

      <Collapsible id="about-use" title="Use and citation" Icon={Scale}>
        <p>
          These data were collected with U.S. Government funding and can be used without additional permissions or fees. If you use them in a publication,
          presentation or other research product, cite:
        </p>
        <p className="text-ink">
          {CITATION_TEXT} <A href={CITATION_DOI}>{CITATION_DOI}</A>
        </p>
        <p>
          Methods paper: Short, Karen C. 2014. A spatial database of wildfires in the United States, 1992-2011. Earth System Science Data 6: 1-27.{" "}
          <A href="https://doi.org/10.5194/essd-6-1-2014">doi:10.5194/essd-6-1-2014</A>
        </p>
      </Collapsible>

      <Collapsible id="about-links" title="Official links" Icon={Link2}>
        <ul className="list-disc space-y-1 pl-4">
          <li><A href={RDS_URL}>Catalog page</A> (abstract, files, checksums)</li>
          <li><A href={`${RDS_PRODUCTS}/_metadata_RDS-2013-0009.7.html`}>Full metadata</A> (HTML)</li>
          <li><A href={`${RDS_PRODUCTS}/_fileindex_RDS-2013-0009.7.html`}>File index</A> (HTML)</li>
          <li><A href="https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_FireOccurrenceCurrentEdition_01/MapServer">Forest Service map service</A></li>
          <li><A href="https://www.mtbs.gov/">MTBS</A>, the large-fire perimeters linked by MTBS_ID</li>
        </ul>
        <p>The catalog offers downloads as ACCDB, GDB, GPKG and SQLite; each format holds the same data.</p>
      </Collapsible>

      <Collapsible id="about-app" title="About this viewer" Icon={BookOpen}>
        <p>
          Basemaps: OpenFreeMap (OpenStreetMap data) and USGS The National Map (U.S. coverage). Neither needs an API key.
        </p>
      </Collapsible>
    </div>
  );
}
