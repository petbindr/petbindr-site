// Health records in the iPhone app's format (Swift HealthRecord), written from
// petbindr.com/app (AddToRecord). Plain TypeScript so tests can import it.
import { Timestamp } from "firebase/firestore";

/** A record in the app's format (Swift HealthRecord) */
export function healthRecordDoc(petId: string, uid: string, type: "Weight" | "Vet Visit", day: Date, fields: {
  title: string; notes?: string;
  weightData?: { weight: number; unit: "lbs" | "kg" };
  vetVisitData?: { clinicName: string; reason: string; veterinarianName?: string; diagnosis?: string; treatment?: string };
}, now = new Date(), id = crypto.randomUUID().toUpperCase()) {
  const clean = <T extends Record<string, unknown>>(o: T) =>
    Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== "")) as T;
  return {
    id,
    data: {
      id, petId, type,
      date: Timestamp.fromDate(day),
      title: fields.title,
      notes: (fields.notes || "").trim(),
      source: "owner",
      createdAt: Timestamp.fromDate(now),
      createdBy: uid,
      attachments: [],
      ...(fields.weightData ? { weightData: fields.weightData } : {}),
      ...(fields.vetVisitData ? { vetVisitData: clean(fields.vetVisitData) } : {}),
    },
  };
}

/** "2026-11-12" from a date input → that day at noon, local time (clear of time-zone edges) */
export function dayFromInput(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
  return isNaN(d.getTime()) ? null : d;
}

