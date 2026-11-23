// Blood glucose typed on a sitter link with a dose check-off (2026-11-23).
// Same rules as the app (GlucoseUnit in Models/MedicationSchedule.swift):
// shown and typed in mg/dL or mmol/L, always sent and stored as mg/dL, and a
// reading must be 10–1000 mg/dL (what the database rules and the function take).

export type GlucoseUnit = "mgdL" | "mmolL";
export type Reading = { kind: "empty" } | { kind: "valid"; mgdL: number } | { kind: "invalid" };

export const MG_PER_MMOL = 18;
export const unitLabel = (unit: GlucoseUnit) => (unit === "mgdL" ? "mg/dL" : "mmol/L");

// Regions that use US units, like the app's Locale.measurementSystem == .us
const US_UNIT_REGIONS = new Set(["US", "LR", "MM"]);

/** The owner's unit from the link if the app sent it, otherwise the browser's region */
export function glucoseUnitFor(fromLink: string | null | undefined, browserLocale: string | undefined): GlucoseUnit {
  if (fromLink === "mgdL" || fromLink === "mmolL") return fromLink;
  let region: string | undefined;
  try {
    region = browserLocale ? new Intl.Locale(browserLocale).maximize().region : undefined;
  } catch {
    region = undefined;
  }
  return !region || US_UNIT_REGIONS.has(region) ? "mgdL" : "mmolL";
}

/** "320", " 17,8 ", "320 mg/dL" (a unit after the number is ignored) */
export function parseGlucose(text: string, unit: GlucoseUnit): Reading {
  const trimmed = text.trim();
  if (!trimmed) return { kind: "empty" };
  const m = /^(\d+(?:[.,]\d+)?)\s*([A-Za-z/]*)$/.exec(trimmed);
  if (!m) return { kind: "invalid" };
  const value = Number(m[1].replace(",", "."));
  if (!Number.isFinite(value)) return { kind: "invalid" };
  const mgdL = unit === "mgdL" ? value : value * MG_PER_MMOL;
  return mgdL >= 10 && mgdL <= 1000 ? { kind: "valid", mgdL: Math.round(mgdL * 10) / 10 } : { kind: "invalid" };
}

/** "320 mg/dL", "17.8 mmol/L" */
export function glucoseText(mgdL: number, unit: GlucoseUnit): string {
  return unit === "mgdL" ? `${Math.round(mgdL)} mg/dL` : `${(mgdL / MG_PER_MMOL).toFixed(1)} mmol/L`;
}
