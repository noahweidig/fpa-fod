import { CITATION_DOI, CITATION_TEXT, RDS_URL } from "@/lib/config";

export default function Footer() {
  return (
    <footer className="text-xs leading-relaxed text-muted">
      <p>
        Data:{" "}
        <a className="underline" href={RDS_URL} target="_blank" rel="noreferrer">
          USFS Research Data Archive, RDS-2013-0009.7
        </a>
        .
      </p>
      <p className="mt-1">
        {CITATION_TEXT}{" "}
        <a className="underline" href={CITATION_DOI} target="_blank" rel="noreferrer">
          {CITATION_DOI}
        </a>
      </p>
    </footer>
  );
}
