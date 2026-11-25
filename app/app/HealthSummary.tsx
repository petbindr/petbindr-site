"use client";

// The Health Summary on petbindr.com/app (2026-11-24, review #14): the same
// one page for the vet's front desk the iPhone app makes (PetBindr/HealthSummary.swift):
// allergies, current medications, each vaccine's latest dose and when it's next
// due, the weight over the last year, the last visit and the regular vet.
// Printed (or saved as a PDF) with the browser's own Print; the site's logo,
// footer and these buttons are left off the paper (print:hidden).
import { useEffect } from "react";
import { toDate, type HealthRecord } from "./health";

type Med = { id: string; medicationName?: string; dosage?: string; frequency?: string };
type Allergy = { id: string; allergenName?: string; severity?: string; symptoms?: string };
type Vet = { name?: string; veterinarianName?: string; phoneNumber?: string } | null | undefined;

const INK = "#1a1a1a", MUTED = "#666", RULE = "#d1d1d1", RED = "#bf1a1a", ORANGE = "#b35900", GREEN = "#1a8040";
const MAX = 12;
const DAY = 86_400_000;

function day(d: Date): string { return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }); }
function startOfDay(d: Date): number { return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }

/** As the app: "Rabies", "rabies  (3 year)" and "Rabies (1-year)" are the same vaccine */
export function vaccineKey(name: string): string {
  return name.toLowerCase().replace(/\([^)]*\)/g, " ").split(/\s+/).filter(Boolean).join(" ");
}

export function summaryVaccines(records: HealthRecord[]) {
  const seen = new Set<string>();
  const nameOf = (r: HealthRecord) => (r.vaccinationData?.vaccineName || "").trim() || r.title || "Vaccine";
  return records.filter((r) => r.type === "Vaccination")
    .sort((a, b) => (toDate(b.date)?.getTime() || 0) - (toDate(a.date)?.getTime() || 0))
    .filter((r) => { const k = vaccineKey(nameOf(r)); if (seen.has(k)) return false; seen.add(k); return true; })
    .map((r) => ({ id: r.id, name: nameOf(r), given: toDate(r.date), due: toDate(r.vaccinationData?.nextDueDate) }))
    .sort((a, b) => (a.due?.getTime() ?? Infinity) - (b.due?.getTime() ?? Infinity));
}

function dueText(due: Date | null, now: Date, deceased: boolean): [string, string] {
  if (!due) return ["No due date", MUTED];
  const days = Math.round((startOfDay(due) - startOfDay(now)) / DAY);
  if (deceased) return [`Due ${day(due)}`, MUTED];
  if (days < 0) return [`Past due (${day(due)})`, RED];
  if (days <= 30) return [`Due ${day(due)}`, ORANGE];
  return [`Up to date, next ${day(due)}`, GREEN];
}

function toUnit(value: number, from: string, to: string): number {
  if (from === to) return value;
  return to === "kg" ? value / 2.20462 : value * 2.20462;
}
function fmtW(v: number, unit: string): string { return `${Number(v.toFixed(1))} ${unit}`; }

export default function HealthSummary({ name, identity, chip, photo, allergies, meds, records, deceased, vet, onClose }: {
  name: string; identity: string; chip?: string; photo: string | null; allergies: Allergy[]; meds: Med[];
  records: HealthRecord[]; deceased: boolean; vet: Vet; onClose: () => void;
}) {
  const now = new Date();
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const shownAllergies = [...allergies].sort((a, b) => Number(b.severity === "Life-Threatening") - Number(a.severity === "Life-Threatening"));
  const shownMeds = deceased ? [] : [...meds].sort((a, b) => (a.medicationName || "").localeCompare(b.medicationName || ""));
  const vaccines = summaryVaccines(records);

  // Weight: the last year's weigh-ins (or the last one), in the latest one's unit
  const weighIns = records.filter((r) => r.type === "Weight" && (r.weightData?.weight || 0) > 0 && toDate(r.date))
    .sort((a, b) => toDate(a.date)!.getTime() - toDate(b.date)!.getTime());
  const unit = weighIns.length ? (weighIns[weighIns.length - 1].weightData!.unit || "lbs") : "lbs";
  const yearAgo = new Date(now); yearAgo.setFullYear(now.getFullYear() - 1);
  const recent = weighIns.filter((r) => toDate(r.date)! >= yearAgo);
  const points = (recent.length ? recent : weighIns.slice(-1))
    .map((r) => ({ date: toDate(r.date)!, value: toUnit(r.weightData!.weight!, r.weightData!.unit || "lbs", unit) }));
  const last = points[points.length - 1];
  const first = points[0];
  const change = points.length > 1 ? (() => {
    const delta = last.value - first.value;
    if (delta === 0) return `No change since ${day(first.date)}`;
    const pct = first.value > 0 ? Math.abs(delta / first.value * 100).toFixed(0) : "0";
    return `${delta > 0 ? "+" : "−"}${fmtW(Math.abs(delta), unit)} (${pct}%) since ${day(first.date)}`;
  })() : null;

  const visits = records.filter((r) => r.type === "Vet Visit" && toDate(r.date) && toDate(r.date)! <= now)
    .sort((a, b) => toDate(b.date)!.getTime() - toDate(a.date)!.getTime());
  const lastVisit = visits[0];
  const hasVet = !!(vet?.name || "").trim();

  const section = (title: string, body: React.ReactNode) => (
    <section style={{ breakInside: "avoid" }} className="space-y-1">
      <h2 style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: MUTED, borderBottom: `1px solid ${RULE}`, paddingBottom: 3 }}>{title.toUpperCase()}</h2>
      <div style={{ fontSize: 14 }} className="space-y-1">{body}</div>
    </section>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <button className="btn-ghost" style={{ padding: "8px 14px" }} onClick={onClose}>← Back to {name}</button>
        <button className="btn-coral ml-auto" style={{ padding: "10px 18px" }} onClick={() => window.print()}>Print or Save as PDF</button>
      </div>
      <p className="font-inter text-(--slate-gray) print:hidden" style={{ fontSize: "14px" }}>
        One page for the vet&apos;s front desk. Print it, or choose &ldquo;Save as PDF&rdquo; in the print window to email it.
      </p>

      <article className="font-inter rounded-2xl p-6 space-y-4 print:p-0 print:rounded-none"
        style={{ background: "white", color: INK, border: `1px solid var(--mist-gray)` }} aria-label={`Health Summary for ${name}`}>
        <header className="flex items-center gap-4" style={{ borderBottom: `1px solid ${RULE}`, paddingBottom: 10 }}>
          {photo && <img src={photo} alt="" width={72} height={72} style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover" }} />}
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: MUTED }}>HEALTH SUMMARY</p>
            <h1 style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.15 }}>{name}</h1>
            {identity && <p style={{ fontSize: 13 }}>{identity}</p>}
            {chip && <p style={{ fontSize: 12, color: MUTED }}>Microchip {chip}</p>}
          </div>
        </header>

        {section("Allergies", shownAllergies.length === 0 ? <p style={{ color: MUTED }}>None recorded</p> : shownAllergies.map((a) => (
          <p key={a.id} style={{ color: a.severity === "Life-Threatening" ? RED : INK, fontWeight: a.severity === "Life-Threatening" ? 700 : 400 }}>
            {a.allergenName}{a.severity && a.severity !== "Not specified" ? ` (${a.severity.toLowerCase()})` : ""}{a.symptoms?.trim() ? `: ${a.symptoms}` : ""}
          </p>
        )))}

        {section("Current Medications", shownMeds.length === 0 ? <p style={{ color: MUTED }}>None</p> : (
          <>
            {shownMeds.slice(0, MAX).map((m) => (
              <p key={m.id}><strong>{m.medicationName}</strong>{"  "}{[m.dosage, m.frequency].filter((x) => x && x.trim()).join(", ")}</p>
            ))}
            {shownMeds.length > MAX && <p style={{ color: MUTED }}>and {shownMeds.length - MAX} more (see the Full Record)</p>}
          </>
        ))}

        {section("Vaccines", vaccines.length === 0 ? <p style={{ color: MUTED }}>None recorded</p> : (
          <>
            {vaccines.slice(0, MAX).map((v) => {
              const [text, color] = dueText(v.due, now, deceased);
              return (
                <div key={v.id} className="sm:flex sm:gap-3" style={{ fontSize: 13.5 }}>
                  <span className="block sm:w-48 sm:shrink-0" style={{ fontWeight: 600 }}>{v.name}</span>
                  <span className="sm:w-36 sm:shrink-0" style={{ color: MUTED }}>{v.given ? `Given ${day(v.given)}  ` : ""}</span>
                  <span style={{ color, fontWeight: 600 }}>{text}</span>
                </div>
              );
            })}
            {vaccines.length > MAX && <p style={{ color: MUTED }}>and {vaccines.length - MAX} more (see the Full Record)</p>}
          </>
        ))}

        {last && section("Weight", (
          <>
            <p><strong>{fmtW(last.value, unit)}</strong> <span style={{ color: MUTED }}>on {day(last.date)}</span>{change && <span style={{ color: MUTED }}> · {change}</span>}</p>
            {points.length > 1 && <WeightChart points={points} />}
          </>
        ))}

        {(lastVisit || hasVet) && section("Vet", (
          <>
            {lastVisit && (
              <p><span style={{ color: MUTED }}>Last visit </span><strong>{day(toDate(lastVisit.date)!)}</strong>
                {`: ${(lastVisit.vetVisitData?.reason || "").trim() || lastVisit.title || ""}`}</p>
            )}
            {hasVet && (
              <p><span style={{ color: MUTED }}>Regular vet </span>
                {[vet!.name, vet!.veterinarianName || "", vet!.phoneNumber || ""].map((s) => (s || "").trim()).filter(Boolean).join(", ")}</p>
            )}
          </>
        ))}

        <p style={{ fontSize: 11, color: MUTED }}>
          From PetBindr, {day(now)}. Kept by the owner; check with them for anything not listed.
        </p>
      </article>
    </div>
  );
}

/** A small line of the last year's weigh-ins (the app draws the same with Charts) */
function WeightChart({ points }: { points: { date: Date; value: number }[] }) {
  const W = 480, H = 90, pad = 8;
  const t0 = points[0].date.getTime(), t1 = points[points.length - 1].date.getTime();
  const vs = points.map((p) => p.value);
  const lo = Math.min(...vs), hi = Math.max(...vs);
  const x = (t: number) => pad + (t1 === t0 ? 0.5 : (t - t0) / (t1 - t0)) * (W - 2 * pad);
  const y = (v: number) => H - pad - (hi === lo ? 0.5 : (v - lo) / (hi - lo)) * (H - 2 * pad);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(p.date.getTime()).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Weight over the last year" style={{ maxWidth: W }}>
      <line x1={pad} x2={W - pad} y1={H - pad} y2={H - pad} stroke={RULE} />
      <path d={path} fill="none" stroke={INK} strokeWidth={1.5} />
      {points.map((p, i) => <circle key={i} cx={x(p.date.getTime())} cy={y(p.value)} r={2.5} fill={INK} />)}
    </svg>
  );
}
