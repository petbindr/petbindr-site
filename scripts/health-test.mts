// Checks for app/app/health.ts (web pet page health records). Run: node scripts/health-test.mts
import { latestVaccines, weightSummary, newest } from "../app/app/health.ts";

let ok = 0, bad = 0;
const check = (label: string, cond: boolean) => { cond ? ok++ : bad++; console.log(cond ? "ok   " : "WRONG", label); };
const now = new Date(2026, 10, 12, 12);
const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);
const ts = (date: Date) => ({ toDate: () => date }); // like a Firestore Timestamp

const records = [
  { id: "r1", type: "Vaccination", date: ts(d(2025, 10, 1)), vaccinationData: { vaccineName: "Rabies", nextDueDate: ts(d(2026, 10, 1)) } },
  { id: "r2", type: "Vaccination", date: ts(d(2026, 10, 2)), vaccinationData: { vaccineName: "rabies", nextDueDate: ts(d(2029, 10, 2)) } },
  { id: "r3", type: "Vaccination", date: ts(d(2025, 11, 1)), vaccinationData: { vaccineName: "DHPP", nextDueDate: ts(d(2026, 11, 1)) } },
  { id: "r4", type: "Vaccination", date: ts(d(2026, 1, 1)), vaccinationData: { vaccineName: "Bordetella", nextDueDate: ts(d(2026, 12, 1)) } },
  { id: "r5", type: "Vaccination", date: ts(d(2026, 2, 1)), title: "Lepto", vaccinationData: { vaccineName: "" } },
  { id: "w1", type: "Weight", date: ts(d(2025, 6, 1)), weightData: { weight: 9, unit: "lbs" } },
  { id: "w2", type: "Weight", date: ts(d(2025, 12, 1)), weightData: { weight: 10, unit: "lbs" } },
  { id: "w3", type: "Weight", date: ts(d(2026, 11, 1)), weightData: { weight: 11, unit: "lbs" } },
  { id: "v1", type: "Vet Visit", date: ts(d(2026, 3, 1)) },
  { id: "v2", type: "Vet Visit", date: ts(d(2026, 9, 1)) },
];

const v = latestVaccines(records, now);
check("one line per vaccine, names in any case", v.length === 4);
check("rabies uses the newer dose", v.find((x) => x.name.toLowerCase() === "rabies")?.id === "r2");
check("DHPP past due", v.find((x) => x.name === "DHPP")?.status === "pastDue");
check("Bordetella due within 30 days", v.find((x) => x.name === "Bordetella")?.status === "dueSoon");
check("rabies up to date", v.find((x) => x.id === "r2")?.status === "upToDate");
check("no name: uses the title, no due date", v.find((x) => x.id === "r5")?.name === "Lepto" && v.find((x) => x.id === "r5")?.status === "noDate");
check("soonest due first, no date last", v[0].name === "DHPP" && v[v.length - 1].id === "r5");
check("deceased pet: nothing past due", latestVaccines(records, now, true).every((x) => x.status === "noDate"));

const w = weightSummary(records, now)!;
check("latest weight", w.latest.value === 11);
check("change counts from a year back (10 → 11, +10%)", Math.abs(w.change!.amount - 1) < 1e-9 && Math.round(w.change!.percent) === 10);
check("recent newest first", w.recent.map((x) => x.value).join(",") === "11,10,9");
check("mixed units converted", Math.round(weightSummary([{ id: "a", type: "Weight", date: ts(d(2026, 1, 1)), weightData: { weight: 5, unit: "kg" } }, { id: "b", type: "Weight", date: ts(d(2026, 6, 1)), weightData: { weight: 11.02, unit: "lbs" } }], now)!.change!.amount * 10) === 0);
check("no weights: nothing", weightSummary([], now) === null);
check("one weight: no change", weightSummary([records[7]], now)!.change === null);
check("visits newest first, limited", newest(records, "Vet Visit", 1).map((r) => r.id).join() === "v2");

console.log(`\n${ok} ok, ${bad} wrong`);
process.exit(bad ? 1 : 0);
