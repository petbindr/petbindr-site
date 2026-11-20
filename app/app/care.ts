// Changing feeding times and medications from petbindr.com/app (owners and
// co-owners, e.g. on Android). Written the way the iPhone app writes them, so
// the app reads them unchanged:
//  - the feeding schedule (pets/{id}/feedingSchedule/schedule): scheduleItems
//    [{ id, time, portion, notes? }], feedingInfo.*, and mealDays.<mealId>
//    for meals that aren't every day (see MealRepeat in today.ts);
//  - medications (pets/{id}/medicationSchedules/{id}): the app's
//    MedicationSchedule fields (Models/MedicationSchedule.swift).
// Only what was changed here is written (field by field, meal by meal), and
// something changed both here and elsewhere since the editor opened stops the
// save with a message, like the app (FeedingStore.mergedChanges, FieldMerge).
import type { MealRepeat, Stamp } from "./today"; // types only: this file runs in node tests on its own

function toDate(v: Stamp): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  return typeof v.toDate === "function" ? v.toDate() : null;
}

export type Meal = { id: string; time?: Stamp | Date; portion?: string; notes?: string };
export type FeedingInfo = { foodName?: string; defaultPortion?: string; specialBowl?: string; feedingLocation?: string; specialInstructions?: string };
export type Schedule = { feedingInfo?: FeedingInfo; scheduleItems?: Meal[]; mealDays?: Record<string, MealRepeat> } | null;

/** Something changed here and elsewhere since the editor opened */
export class ChangedElsewhere extends Error {
  what: string;
  constructor(what: string) { super(`Someone else changed ${what} while you were editing.`); this.what = what; }
}

/** The app's frequency names (MedicationFrequency raw values); anything else won't load in the app */
export const FREQUENCIES = ["Daily", "Twice Daily", "Three Times Daily", "Every Other Day", "Every 3 Days", "Weekly", "Every 2 Weeks", "Monthly"] as const;
export type Frequency = (typeof FREQUENCIES)[number];
/** How many times a day each frequency expects (the app's timesPerDay) */
export function timesPerDay(f: string): number { return f === "Twice Daily" ? 2 : f === "Three Times Daily" ? 3 : 1; }

/** A new id, the app's style (Swift's UUID().uuidString) */
export function newId(): string {
  return (globalThis.crypto?.randomUUID?.() || `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`).toUpperCase();
}

/** "07:30" for a time input */
export function timeInput(t: Stamp | Date | undefined): string {
  const d = t instanceof Date ? t : toDate(t as Stamp);
  return d ? `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` : "";
}

/** A meal or dose time: the time of day in this browser's time zone. An existing
 *  one keeps its date (the app counts a meal from the day it was set); a new one is today. */
export function timeAt(hhmm: string, keepDateOf?: Stamp | Date, now = new Date()): Date | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  const base = (keepDateOf instanceof Date ? keepDateOf : toDate(keepDateOf as Stamp)) || now;
  const d = new Date(base);
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d;
}

/** A calendar day as the app's "every N days" counts it */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// --- comparing saved values -------------------------------------------------

function norm(v: unknown): unknown {
  if (v === undefined || v === null || v === "") return null;
  if (v instanceof Date) return v.getTime();
  if (typeof v === "object" && typeof (v as { toDate?: unknown }).toDate === "function") return (v as { toDate: () => Date }).toDate().getTime();
  if (Array.isArray(v)) return v.map(norm);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return Object.fromEntries(Object.keys(o).sort().map((k) => [k, norm(o[k])]).filter(([, x]) => x !== null));
  }
  return v;
}
export function same(a: unknown, b: unknown): boolean { return JSON.stringify(norm(a)) === JSON.stringify(norm(b)); }

/** A meal as stored: no empty notes (the app leaves notes out when there are none) */
function stored(m: Meal): Meal {
  const out: Meal = { id: m.id, time: m.time, portion: m.portion ?? "" };
  if (m.notes && m.notes.trim()) out.notes = m.notes;
  return out;
}

function mealLabel(m: Meal | undefined): string {
  const d = m && (m.time instanceof Date ? m.time : toDate(m.time as Stamp));
  return d ? `the ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} meal` : "a meal";
}

/** The fields to write for a schedule edited here (updateDoc), or the whole
 *  document when there's no schedule yet (`create`). Throws ChangedElsewhere. */
export function feedingChanges(opened: Schedule, mine: NonNullable<Schedule>, current: Schedule, deleteField: () => unknown):
  { create?: Record<string, unknown>; update?: Record<string, unknown> } {
  if (!current) {
    if (opened && (opened.scheduleItems || []).length) throw new ChangedElsewhere("the feeding schedule");
    const days = Object.fromEntries(Object.entries(mine.mealDays || {}).filter(([, r]) => r));
    return { create: {
      feedingInfo: { foodName: "", defaultPortion: "", ...(mine.feedingInfo || {}) },
      scheduleItems: (mine.scheduleItems || []).map(stored),
      ...(Object.keys(days).length ? { mealDays: days } : {}),
    } };
  }
  const changes: Record<string, unknown> = {};
  const o = opened || {}, c = current;

  // Food info, field by field
  const keys = new Set([...Object.keys(o.feedingInfo || {}), ...Object.keys(mine.feedingInfo || {})]);
  for (const k of keys) {
    const before = (o.feedingInfo as Record<string, unknown> | undefined)?.[k];
    const edited = (mine.feedingInfo as Record<string, unknown> | undefined)?.[k];
    const now = (c.feedingInfo as Record<string, unknown> | undefined)?.[k];
    if (same(edited, before) || same(edited, now)) continue;
    if (!same(now, before)) throw new ChangedElsewhere("the food info");
    changes[`feedingInfo.${k}`] = edited ?? "";
  }

  // Meals one by one (the app's FeedingStore.mergedChanges)
  const atOpen = new Map((o.scheduleItems || []).map((m) => [m.id, stored(m)]));
  const mineById = new Map((mine.scheduleItems || []).map((m) => [m.id, stored(m)]));
  const merged: Meal[] = [];
  for (const cur of (c.scheduleItems || []).map(stored)) {
    const before = atOpen.get(cur.id);
    if (!before) { merged.push(cur); continue; }                 // added elsewhere: kept
    const edited = mineById.get(cur.id);
    if (!edited) {                                              // removed here
      if (!same(before, cur)) throw new ChangedElsewhere(mealLabel(cur));
      continue;
    }
    if (same(edited, before) || same(edited, cur)) merged.push(cur);
    else if (same(before, cur)) merged.push(edited);
    else throw new ChangedElsewhere(mealLabel(cur));
  }
  const currentIds = new Set((c.scheduleItems || []).map((m) => m.id));
  for (const m of mine.scheduleItems || []) {
    if (atOpen.has(m.id) && !currentIds.has(m.id) && !same(stored(m), atOpen.get(m.id))) throw new ChangedElsewhere(mealLabel(m));
    if (!atOpen.has(m.id)) merged.push(stored(m));               // added here
  }
  if (!same(merged, (c.scheduleItems || []).map(stored))) changes.scheduleItems = merged;

  // Which days, meal by meal
  const ids = new Set([...Object.keys(o.mealDays || {}), ...Object.keys(mine.mealDays || {})]);
  for (const id of ids) {
    const before = o.mealDays?.[id] ?? null, edited = mine.mealDays?.[id] ?? null, now = c.mealDays?.[id] ?? null;
    if (same(edited, before) || same(edited, now)) continue;
    if (!same(now, before)) throw new ChangedElsewhere(mealLabel((c.scheduleItems || []).find((m) => m.id === id) || mineById.get(id)));
    changes[`mealDays.${id}`] = edited ?? deleteField();
  }
  return { update: changes };
}

// --- medications ------------------------------------------------------------

export type Medication = {
  id: string; petId?: string; medicationName?: string; dosage?: string; frequency?: string;
  scheduledTimes?: (Stamp | Date)[]; startDate?: Stamp | Date; endDate?: Stamp | Date | null; notes?: string; isActive?: boolean;
};
const MED_FIELDS = ["medicationName", "dosage", "frequency", "scheduledTimes", "startDate", "endDate", "notes", "isActive"] as const;

/** A new medication, every field the app expects */
export function newMedication(petId: string, m: Omit<Medication, "id" | "petId">, id = newId()): Medication & Record<string, unknown> {
  return {
    id, petId,
    medicationName: (m.medicationName || "").trim(), dosage: (m.dosage || "").trim(),
    frequency: FREQUENCIES.includes(m.frequency as Frequency) ? m.frequency : "Daily",
    scheduledTimes: m.scheduledTimes || [], startDate: m.startDate || new Date(),
    ...(m.endDate ? { endDate: m.endDate } : {}),
    notes: (m.notes || "").trim(), isActive: m.isActive !== false,
  };
}

/** The fields to write for a medication edited here. Throws ChangedElsewhere. */
export function medicationChanges(opened: Medication, mine: Medication, current: Medication | null, deleteField: () => unknown): Record<string, unknown> {
  if (!current) throw new ChangedElsewhere(`${opened.medicationName || "this medication"} (it was removed)`);
  const changes: Record<string, unknown> = {};
  for (const k of MED_FIELDS) {
    const before = opened[k], edited = mine[k], now = current[k];
    if (same(edited, before) || same(edited, now)) continue;
    if (!same(now, before)) throw new ChangedElsewhere(current.medicationName || "this medication");
    changes[k] = edited === undefined || edited === null ? (k === "endDate" ? deleteField() : "") : edited;
  }
  if (changes.frequency !== undefined && !FREQUENCIES.includes(changes.frequency as Frequency)) changes.frequency = "Daily";
  return changes;
}
