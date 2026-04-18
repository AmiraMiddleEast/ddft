/**
 * German Bundesländer used across the app for CoGS routing.
 * The key matches the CSV/JSON source and `behoerden_state.id` where applicable.
 */
export const BUNDESLAND_OPTIONS = [
  { key: "BW", name: "Baden-Württemberg" },
  { key: "BY", name: "Bayern" },
  { key: "BE", name: "Berlin" },
  { key: "BB", name: "Brandenburg" },
  { key: "HB", name: "Bremen" },
  { key: "HH", name: "Hamburg" },
  { key: "HE", name: "Hessen" },
  { key: "MV", name: "Mecklenburg-Vorpommern" },
  { key: "NI", name: "Niedersachsen" },
  { key: "NW", name: "Nordrhein-Westfalen" },
  { key: "RP", name: "Rheinland-Pfalz" },
  { key: "SL", name: "Saarland" },
  { key: "SN", name: "Sachsen" },
  { key: "ST", name: "Sachsen-Anhalt" },
  { key: "SH", name: "Schleswig-Holstein" },
  { key: "TH", name: "Thüringen" },
] as const;

export type BundeslandKey = (typeof BUNDESLAND_OPTIONS)[number]["key"];

export function bundeslandName(key: string): string {
  return (
    BUNDESLAND_OPTIONS.find((b) => b.key === key)?.name ?? key
  );
}
