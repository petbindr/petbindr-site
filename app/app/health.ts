// Health records for the web pet page (petbindr.com/app): the same
// pets/{petId}/healthRecords the iPhone app writes, readable by owners and
// co-owners (firestore rules). Plain functions so they can be tested.
// Costs are never shown (as in the app's Full Record PDF).
// (Self-contained, so the checks in scripts/health-test.mts run with plain node)
type Stamp = { toDate(): Date } | Date | null | undefined;
export function toDate(v: Stamp): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  return typeof v.toDate === "function" ? v.toDate() : null;
}
function startOfDay(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

export type Attachment = { id?: string; fileName?: string; fileType?: string; storagePath?: string };

export type HealthRecord = {
  id: string;
  type?: string; // "Vet Visit" | "Vaccination" | "Weight" | "Medication" | "Lab Result" | "Dental" | "Document"
  date?: Stamp;
  title?: string;
  notes?: string;
  attachments?: Attachment[];
  vetVisitData?: { clinicName?: string; veterinarianName?: string | null; reason?: string; diagnosis?: string | null; treatment?: string | null; followUpDate?: Stamp };
  vaccinationData?: { vaccineName?: string; nextDueDate?: Stamp; administeredBy?: string | null };
  weightData?: { weight?: number; unit?: string };
  medicationData?: { medicationName?: string; dosage?: string; frequency?: string; startDate?: Stamp; endDate?: Stamp; prescribedBy?: string | null; reason?: string | null };
  labResultData?: { testName?: string; labName?: string | null; resultSummary?: string | null; isAbnormal?: boolean };
  dentalData?: { procedureType?: string; clinicName?: string; extractionsPerformed?: number | null; nextRecommendedDate?: Stamp };
};

export type VaccineStatus = "pastDue" | "dueSoon" | "upToDate" | "noDate";

export type VaccineLine = {
  id: string; name: string; given: Date | null; nextDue: Date | null; status: VaccineStatus; attachments: Attachment[];
};

const DAY = 86_400_000;

/** Each vaccine's latest dose (by name, any case), soonest due first */
export function latestVaccines(records: HealthRecord[], now: Date, deceased = false): VaccineLine[] {
  const seen = new Set<string>();
  const lines: VaccineLine[] = [];
  const byNewest = records.filter((r) => r.type === "Vaccination")
    .sort((a, b) => (toDate(b.date)?.getTime() || 0) - (toDate(a.date)?.getTime() || 0));
  for (const r of byNewest) {
    const name = (r.vaccinationData?.vaccineName || "").trim() || r.title || "Vaccine";
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const nextDue = toDate(r.vaccinationData?.nextDueDate);
    let status: VaccineStatus = "noDate";
    if (nextDue && !deceased) {
      const days = Math.round((startOfDay(nextDue).getTime() - startOfDay(now).getTime()) / DAY);
      status = days < 0 ? "pastDue" : days <= 30 ? "dueSoon" : "upToDate";
    }
    lines.push({ id: r.id, name, given: toDate(r.date), nextDue, status, attachments: r.attachments || [] });
  }
  const rank = (l: VaccineLine) => l.nextDue?.getTime() ?? Number.MAX_SAFE_INTEGER;
  return lines.sort((a, b) => rank(a) - rank(b));
}

export type WeightSummary = {
  latest: { value: number; unit: string; date: Date | null };
  change: { amount: number; percent: number; since: Date | null } | null;
  recent: { value: number; unit: string; date: Date | null }[]; // newest first, up to 6
};

/** Latest weight, the change over the last year (in the latest unit), and the last few */
export function weightSummary(records: HealthRecord[], now: Date): WeightSummary | null {
  const all = records.filter((r) => r.type === "Weight" && typeof r.weightData?.weight === "number")
    .map((r) => ({ value: r.weightData!.weight!, unit: r.weightData!.unit || "lbs", date: toDate(r.date) }))
    .sort((a, b) => (a.date?.getTime() || 0) - (b.date?.getTime() || 0));
  if (!all.length) return null;
  const latest = all[all.length - 1];
  const inUnit = (w: { value: number; unit: string }) =>
    w.unit === latest.unit ? w.value : latest.unit === "kg" ? w.value / 2.20462 : w.value * 2.20462;
  const yearAgo = new Date(now.getTime() - 365 * DAY);
  const first = all.find((w) => (w.date?.getTime() || 0) >= yearAgo.getTime());
  let change: WeightSummary["change"] = null;
  if (first && first !== latest) {
    const from = inUnit(first);
    const amount = latest.value - from;
    change = { amount, percent: from > 0 ? (amount / from) * 100 : 0, since: first.date };
  }
  return { latest, change, recent: all.slice(-6).reverse() };
}

/** Records of one type, newest first */
export function newest(records: HealthRecord[], type: string, limit = 5): HealthRecord[] {
  return records.filter((r) => r.type === type)
    .sort((a, b) => (toDate(b.date)?.getTime() || 0) - (toDate(a.date)?.getTime() || 0))
    .slice(0, limit);
}

export function fmtDay(d: Date | null | undefined): string {
  return d ? d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : "";
}

export function fmtWeight(value: number, unit: string): string {
  return `${Number(value.toFixed(1))} ${unit}`;
}
