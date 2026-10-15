import { RDS_URL } from "@/lib/config";

export default function Footer() {
  return (
    <footer className="border-t border-line px-4 py-3 text-[11px] leading-snug text-muted">
      Data: Fire Program Analysis fire-occurrence database (FPA FOD),{" "}
      <a className="underline" href={RDS_URL} target="_blank" rel="noreferrer">
        USFS Research Data Archive, RDS-2013-0009.7
      </a>
      .
      {/* CITATION PLACEHOLDER: paste the official citation from the archive page above. Not invented here. */}
      <span className="mt-1 block rounded border border-dashed border-line px-2 py-1" data-placeholder="citation">
        [CITATION PLACEHOLDER: add the official citation from the archive page]
      </span>
    </footer>
  );
}
