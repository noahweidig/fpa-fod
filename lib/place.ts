/** US state name -> USPS code (FPA-FOD STATE values). */
export const STATE_CODES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO", connecticut: "CT", delaware: "DE",
  "district of columbia": "DC", florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN",
  mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ",
  "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR",
  pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT",
  vermont: "VT", virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY", "puerto rico": "PR",
};

const norm = (s: string) =>
  s.toLowerCase().replace(/\b(county|parish|borough|census area|municipality|city and borough)\b/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/** Find the data value for a place name (exact, then normalized) among known category values. */
export function matchValue(name: string, values: string[]): string | undefined {
  const lower = name.toLowerCase();
  const exact = values.find((v) => v.toLowerCase() === lower);
  if (exact) return exact;
  const t = norm(name);
  return values.find((v) => norm(v) === t);
}

export function stateValue(name: string, values: string[]): string | undefined {
  const code = STATE_CODES[name.toLowerCase()];
  return (code && matchValue(code, values)) || matchValue(name, values);
}
