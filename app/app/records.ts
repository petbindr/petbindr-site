// Health records in the iPhone app's format (Swift HealthRecord), written from
// petbindr.com/app (AddToRecord). Plain TypeScript so tests can import it.
import { Timestamp } from "firebase/firestore";

/** A record in the app's format (Swift HealthRecord) */
export function healthRecordDoc(petId: string, uid: string, type: "Weight" | "Vet Visit" | "Vaccination", day: Date, fields: {
  title: string; notes?: string;
  weightData?: { weight: number; unit: "lbs" | "kg" };
  vaccinationData?: { vaccineName: string; nextDueDate?: Date | null; administeredBy?: string };
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
      ...(fields.vaccinationData ? { vaccinationData: vaccinationFields(fields.vaccinationData) } : {}),
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


/** Saving the pet's notes from petbindr.com/app: true when someone (the app,
 * another tab, a co-owner) changed them after this editor opened, and the
 * change isn't the same text being saved. Saving anyway would erase theirs. */
export function notesChangedSinceOpened(opened: string, latest: string, mine: string): boolean {
  return latest !== opened && latest.trim() !== mine.trim();
}


// ---- Vaccines, allergies and reminders on petbindr.com/app (2026-11-24, review #14) ----
// Same shapes the iPhone app decodes (Swift VaccinationData, Allergy, CustomReminder):
// every field it needs is always written, optional ones are left out when empty.

function vaccinationFields(v: { vaccineName: string; nextDueDate?: Date | null; administeredBy?: string }) {
  return {
    vaccineName: v.vaccineName.trim(),
    ...(v.nextDueDate ? { nextDueDate: Timestamp.fromDate(v.nextDueDate) } : {}),
    ...(v.administeredBy && v.administeredBy.trim() ? { administeredBy: v.administeredBy.trim() } : {}),
  };
}

export type VaccineForm = { vaccineName: string; given: Date; nextDue: Date | null; administeredBy: string; notes: string };

/** A new vaccine record, titled by the vaccine's name (as the app does when no title is typed) */
export function vaccineDoc(petId: string, uid: string, f: VaccineForm, now = new Date(), id?: string) {
  return healthRecordDoc(petId, uid, "Vaccination", f.given, {
    title: f.vaccineName.trim(), notes: f.notes,
    vaccinationData: { vaccineName: f.vaccineName, nextDueDate: f.nextDue, administeredBy: f.administeredBy },
  }, now, id);
}

const sameDay = (a: Date | null, b: Date | null) => (a ? a.getTime() : null) === (b ? b.getTime() : null);

/** Only what changed, as field paths (keeps the manufacturer, lot number and
 * attachments the app may have added, and a co-owner's other edits) */
export function vaccineChanges(opened: VaccineForm, edited: VaccineForm, openedTitle = ""): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const name = edited.vaccineName.trim();
  if (name !== opened.vaccineName.trim()) {
    out["vaccinationData.vaccineName"] = name;
    // The title follows the name only when it was the name (a title typed in
    // the app, like "Annual Rabies Booster", stays)
    if (!openedTitle.trim() || openedTitle.trim() === opened.vaccineName.trim()) out.title = name;
  }
  if (!sameDay(opened.given, edited.given)) out.date = Timestamp.fromDate(edited.given);
  if (!sameDay(opened.nextDue, edited.nextDue)) {
    out["vaccinationData.nextDueDate"] = edited.nextDue ? Timestamp.fromDate(edited.nextDue) : null;
  }
  if (edited.administeredBy.trim() !== opened.administeredBy.trim()) {
    out["vaccinationData.administeredBy"] = edited.administeredBy.trim() || null;
  }
  if (edited.notes.trim() !== opened.notes.trim()) out.notes = edited.notes.trim();
  return out;
}

export const ALLERGY_CATEGORIES = ["Food", "Environmental", "Medication", "Insect/Flea", "Contact", "Other"] as const;
export const ALLERGY_SEVERITIES = ["Mild", "Moderate", "Severe", "Life-Threatening", "Not specified"] as const;
export type AllergyForm = { allergenName: string; category: string; severity: string; symptoms: string; notes: string; isActive: boolean };

export function allergyDoc(petId: string, f: AllergyForm, id = crypto.randomUUID().toUpperCase()) {
  return {
    id,
    data: {
      id, petId,
      allergenName: f.allergenName.trim(),
      category: (ALLERGY_CATEGORIES as readonly string[]).includes(f.category) ? f.category : "Other",
      severity: (ALLERGY_SEVERITIES as readonly string[]).includes(f.severity) ? f.severity : "Moderate",
      symptoms: f.symptoms.trim(),
      notes: f.notes.trim(),
      isActive: f.isActive,
    },
  };
}

export function allergyChanges(opened: AllergyForm, edited: AllergyForm): Record<string, unknown> {
  const next = allergyDoc("", edited, "").data as Record<string, unknown>;
  const before = allergyDoc("", opened, "").data as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of ["allergenName", "category", "severity", "symptoms", "notes", "isActive"]) {
    if (next[k] !== before[k]) out[k] = next[k];
  }
  return out;
}

// Reminders are each person's own (customReminders, ownerId = who made it), as
// in the app: a co-owner's reminders show in their own app and on their web page.
export const REMINDER_CATEGORIES = ["Feeding", "Vet Visit", "Vaccination", "Medication", "Supplies", "Grooming", "Health", "Custom"] as const;
export const REMINDER_REPEATS: [number, string][] = [
  [1, "Daily"], [7, "Weekly"], [14, "Every 2 weeks"], [21, "Every 3 weeks"], [28, "Every 4 weeks"], [30, "Monthly"],
  [42, "Every 6 weeks"], [60, "Every 2 months"], [90, "Every 3 months"], [180, "Every 6 months"], [365, "Yearly"],
];
export type ReminderForm = { title: string; date: Date; category: string; notes: string; repeatDays: number | null };

export function reminderDoc(uid: string, petId: string, f: ReminderForm, id = crypto.randomUUID().toUpperCase()) {
  return {
    id,
    data: {
      id, ownerId: uid, petId,
      title: f.title.trim(),
      date: Timestamp.fromDate(f.date),
      category: (REMINDER_CATEGORIES as readonly string[]).includes(f.category) ? f.category : "Custom",
      notes: f.notes.trim(),
      isCompleted: false,
      isRecurring: !!f.repeatDays,
      ...(f.repeatDays ? { recurringFrequencyDays: f.repeatDays } : {}),
    },
  };
}

export function reminderChanges(opened: ReminderForm, edited: ReminderForm): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (edited.title.trim() !== opened.title.trim()) out.title = edited.title.trim();
  if (edited.date.getTime() !== opened.date.getTime()) out.date = Timestamp.fromDate(edited.date);
  if (edited.category !== opened.category) out.category = edited.category;
  if (edited.notes.trim() !== opened.notes.trim()) out.notes = edited.notes.trim();
  if ((edited.repeatDays || null) !== (opened.repeatDays || null)) {
    out.isRecurring = !!edited.repeatDays;
    out.recurringFrequencyDays = edited.repeatDays || null;
  }
  return out;
}

/** The app's CalendarStore.nextOccurrence: months for 30/60/90/180/365, else days;
 * counted from the original date, always after now */
export function nextOccurrence(date: Date, days: number, now = new Date()): Date {
  const months: Record<number, number> = { 30: 1, 60: 2, 90: 3, 180: 6, 365: 12 };
  const at = (count: number) => {
    const d = new Date(date);
    if (months[days]) {
      const day = d.getDate();
      d.setDate(1);
      d.setMonth(d.getMonth() + months[days] * count);
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(day, last)); // Jan 31 + 1 month = Feb 28, like Calendar
      return d;
    }
    d.setDate(d.getDate() + Math.max(days, 1) * count);
    return d;
  };
  let count = 1;
  let next = at(count);
  while (next <= now && count < 5000) next = at(++count);
  return next;
}

/** The app's CalendarStore.nextReminderId: the next one's ID comes from this one's,
 * so checking off in the app and on the web (or twice) makes it once */
export async function nextReminderId(id: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`next:${id}`)));
  const hex = Array.from(digest.slice(0, 16)).map((b) => b.toString(16).padStart(2, "0").toUpperCase()).join("");
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20, 32)].join("-");
}
