"use client";

// Change feeding times and medications from petbindr.com/app (owners and
// co-owners, e.g. on Android). The writes and the "changed elsewhere" check are
// in care.ts; this is the form. The Firestore rules already let owners and
// co-owners write the feeding schedule and medications (sitters can't).
import { useState } from "react";
import { deleteField, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { firebase } from "./firebase";
import { repeatSummary, toDate, type MealRepeat } from "./today";
import {
  ChangedElsewhere, FREQUENCIES, dayKey, feedingChanges, medicationChanges, newId, newMedication, timeAt, timeInput, timesPerDay,
  type FeedingInfo, type Meal, type Medication, type Schedule,
} from "./care";

const input = "w-full rounded-lg px-3 py-2 font-inter text-(--charcoal)";
const inputStyle = { border: "1px solid var(--mist-gray)", background: "var(--input-bg, white)", fontSize: "16px" };
const label = "block font-inter text-(--slate-gray) mb-1";
const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function errorText(e: unknown): string {
  return e instanceof ChangedElsewhere
    ? `${e.message} Close this and open it again to see their change, then make yours.`
    : "Couldn't save that. Check your connection and try again.";
}

// MARK: - Feeding

type MealRow = { id: string; time: string; portion: string; notes: string; every: number; weekdays: number[]; start?: string; keepDateOf?: Meal["time"] };

function rowsFrom(s: Schedule): MealRow[] {
  return [...(s?.scheduleItems || [])]
    .sort((a, b) => timeInput(a.time).localeCompare(timeInput(b.time)))
    .map((m) => {
      const r = (s?.mealDays?.[m.id] || null) as { weekdays?: number[]; every?: number; start?: string } | null;
      const weekdays = Array.isArray(r?.weekdays) ? r!.weekdays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6) : [];
      const every = weekdays.length ? 0 : Number.isInteger(r?.every) && r!.every! >= 2 && typeof r?.start === "string" ? r!.every! : 1;
      return { id: m.id, time: timeInput(m.time), portion: m.portion || "", notes: m.notes || "", every, weekdays: weekdays.length ? weekdays : [1, 3, 5], start: r?.start, keepDateOf: m.time };
    });
}

function ruleFor(row: MealRow, before: MealRepeat): MealRepeat {
  if (row.every === 0) {
    const days = [...new Set(row.weekdays)].sort();
    return days.length && days.length < 7 ? { weekdays: days } : null;
  }
  if (row.every >= 2) {
    // Keep the day it counts from while the interval is unchanged
    const b = before as { every?: number; start?: string } | null | undefined;
    return { every: row.every, start: b && b.every === row.every && b.start ? b.start : dayKey(new Date()) };
  }
  return null;
}

export function FeedingEditor({ petId, schedule, onDone }: { petId: string; schedule: Schedule; onDone: (msg: string) => void }) {
  const [opened] = useState<Schedule>(schedule);
  const [food, setFood] = useState(schedule?.feedingInfo?.foodName || "");
  const [portion, setPortion] = useState(schedule?.feedingInfo?.defaultPortion || "");
  const [rows, setRows] = useState<MealRow[]>(rowsFrom(schedule));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (i: number, change: Partial<MealRow>) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...change } : row)));
  const valid = rows.every((r) => timeAt(r.time) && (r.every !== 0 || r.weekdays.length > 0));

  async function save() {
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      const { db } = firebase();
      const ref = doc(db, `pets/${petId}/feedingSchedule/schedule`);
      const info: FeedingInfo = { ...(opened?.feedingInfo || {}), foodName: food.trim(), defaultPortion: portion.trim() };
      const mealDays: Record<string, MealRepeat> = {};
      const meals: Meal[] = rows.map((r) => {
        const rule = ruleFor(r, opened?.mealDays?.[r.id]);
        if (rule) mealDays[r.id] = rule;
        const old = opened?.scheduleItems?.find((m) => m.id === r.id);
        // Unchanged time: the stored value as it was (same date), so it doesn't count as an edit
        const time = old && timeInput(old.time) === r.time ? old.time : timeAt(r.time, r.keepDateOf)!;
        return { id: r.id, time, portion: r.portion.trim(), ...(r.notes.trim() ? { notes: r.notes.trim() } : {}) };
      });
      // Read fresh before writing, to catch a change made since this opened
      const snap = await getDoc(ref);
      const current = snap.exists() ? (snap.data() as Schedule) : null;
      const out = feedingChanges(opened, { feedingInfo: info, scheduleItems: meals, mealDays }, current, deleteField);
      if (out.create) await setDoc(ref, out.create);
      else if (out.update && Object.keys(out.update).length) await updateDoc(ref, out.update);
      onDone("Feeding schedule saved.");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="feed-food" style={{ fontSize: "14px" }}>Food</label>
          <input id="feed-food" className={input} style={inputStyle} value={food} maxLength={200} onChange={(e) => setFood(e.target.value)} />
        </div>
        <div>
          <label className={label} htmlFor="feed-portion" style={{ fontSize: "14px" }}>Usual portion</label>
          <input id="feed-portion" className={input} style={inputStyle} value={portion} maxLength={200} onChange={(e) => setPortion(e.target.value)} />
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className={label} style={{ fontSize: "14px" }}>Feeding times</legend>
        {rows.length === 0 && <p className="font-inter text-(--slate-gray)" style={{ fontSize: "15px" }}>No feeding times yet.</p>}
        {rows.map((r, i) => (
          <div key={r.id} className="rounded-xl p-3 space-y-2" style={{ border: "1px solid var(--mist-gray)" }}>
            <div className="flex gap-2 items-center">
              <input type="time" aria-label="Time" className="rounded-lg px-3 py-2 font-inter" style={inputStyle} value={r.time} required
                onChange={(e) => update(i, { time: e.target.value })} />
              <input aria-label="Portion" placeholder="Portion" className={input} style={inputStyle} value={r.portion} maxLength={200}
                onChange={(e) => update(i, { portion: e.target.value })} />
              <button type="button" className="btn-ghost" style={{ padding: "8px 12px", minHeight: "44px" }} onClick={() => setRows(rows.filter((_, j) => j !== i))}
                aria-label={`Remove the ${r.time || "new"} feeding`}>Remove</button>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <label className="font-inter text-(--slate-gray)" style={{ fontSize: "14px" }} htmlFor={`rep-${r.id}`}>Repeats</label>
              <select id={`rep-${r.id}`} className="rounded-lg px-3 py-2 font-inter" style={inputStyle} value={r.every}
                onChange={(e) => update(i, { every: Number(e.target.value) })}>
                <option value={1}>Every day</option>
                <option value={2}>Every other day</option>
                {Array.from({ length: 28 }, (_, i) => i + 3).map((n) => <option key={n} value={n}>Every {n} days</option>)}
                <option value={0}>On chosen days</option>
              </select>
              {r.every >= 2 && (
                <span className="font-inter text-(--slate-gray)" style={{ fontSize: "14px" }}>
                  {r.start && opened?.mealDays?.[r.id] && (opened.mealDays[r.id] as { every?: number }).every === r.every ? `counting from ${r.start}` : "starting today"}
                </span>
              )}
            </div>
            {r.every === 0 && (
              <div className="flex gap-1" role="group" aria-label="Days">
                {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                  const on = r.weekdays.includes(d);
                  return (
                    <button key={d} type="button" aria-pressed={on} aria-label={DAY_NAMES[d]}
                      className="font-inter rounded-full" style={{ width: "44px", height: "44px", fontWeight: 600,
                        background: on ? "var(--navy-fill)" : "var(--mist-gray)", color: on ? "#fff" : "var(--charcoal)" }}
                      onClick={() => update(i, { weekdays: on ? r.weekdays.filter((x) => x !== d) : [...r.weekdays, d] })}>
                      {DAY_LETTERS[d]}
                    </button>
                  );
                })}
              </div>
            )}
            {r.every === 0 && r.weekdays.length === 0 && <p className="font-inter" style={{ fontSize: "14px", color: "var(--error-red, #b42318)" }}>Choose at least one day.</p>}
            <input aria-label="Notes for this feeding" placeholder="Notes for this feeding (optional)" className={input} style={inputStyle}
              value={r.notes} maxLength={500} onChange={(e) => update(i, { notes: e.target.value })} />
          </div>
        ))}
        <button type="button" className="btn-ghost" style={{ padding: "10px 16px" }}
          onClick={() => setRows([...rows, { id: newId(), time: rows.length ? "18:00" : "08:00", portion: "", notes: "", every: 1, weekdays: [1, 3, 5] }])}>
          Add a Feeding Time
        </button>
      </fieldset>

      {error && <p className="font-inter" role="alert" style={{ fontSize: "15px", color: "var(--error-red, #b42318)" }}>{error}</p>}
      <div className="flex gap-2">
        <button type="submit" className="btn-coral" style={{ padding: "10px 20px" }} disabled={saving || !valid}>{saving ? "Saving…" : "Save"}</button>
        <button type="button" className="btn-ghost" style={{ padding: "10px 20px" }} onClick={() => onDone("")}>Cancel</button>
      </div>
    </form>
  );
}

// MARK: - Medications

type MedForm = { name: string; dosage: string; frequency: string; times: string[]; start: string; end: string; notes: string };

function dateInput(t: Medication["startDate"]): string {
  const d = toDate(t as never);
  return d ? dayKey(d) : "";
}
function dayAtNoon(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12) : null;
}
/** Start of the day, as the app saves a start date (it compares whole days) */
function dayStart(key: string): Date | null {
  const d = dayAtNoon(key);
  if (d) d.setHours(0, 0, 0, 0);
  return d;
}

export function MedicationEditor({ petId, med, onDone }: { petId: string; med: Medication | null; onDone: (msg: string) => void }) {
  const [opened] = useState<Medication | null>(med);
  const [form, setForm] = useState<MedForm>(() => ({
    name: med?.medicationName || "", dosage: med?.dosage || "", frequency: med?.frequency || "Daily",
    times: (med?.scheduledTimes || []).map((t) => timeInput(t as never)).filter(Boolean),
    start: med ? dateInput(med.startDate) : dayKey(new Date()), end: med?.endDate ? dateInput(med.endDate) : "", notes: med?.notes || "",
  }));
  if (form.times.length === 0) form.times = ["08:00"];
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (change: Partial<MedForm>) => setForm((f) => ({ ...f, ...change }));
  const valid = form.name.trim() !== "" && form.times.every((t) => timeAt(t)) && !!dayStart(form.start)
    && (!form.end || (!!dayStart(form.end) && form.end >= form.start));

  function setFrequency(f: string) {
    // Twice / three times a day: offer that many times
    const want = timesPerDay(f);
    const defaults = ["08:00", "20:00", "14:00"];
    const times = [...form.times];
    while (times.length < want) times.push(defaults[times.length] || "12:00");
    set({ frequency: f, times: want > 1 ? times.slice(0, Math.max(want, times.length)) : times });
  }

  async function save(stop = false) {
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      const { db } = firebase();
      const times = form.times.map((t, i) => {
        const old = opened?.scheduledTimes?.[i];
        return old && timeInput(old as never) === t ? old : timeAt(t, old as never)!;
      });
      const startOld = opened && dateInput(opened.startDate) === form.start ? opened.startDate : dayStart(form.start)!;
      const endOld = opened?.endDate && dateInput(opened.endDate) === form.end ? opened.endDate : form.end ? dayAtNoon(form.end) : null;
      const mine: Omit<Medication, "id"> = {
        medicationName: form.name.trim(), dosage: form.dosage.trim(), frequency: form.frequency, scheduledTimes: times,
        startDate: startOld, endDate: endOld, notes: form.notes.trim(), isActive: stop ? false : (opened?.isActive !== false),
      };
      if (!opened) {
        const m = newMedication(petId, mine);
        await setDoc(doc(db, `pets/${petId}/medicationSchedules/${m.id}`), m);
        onDone(`${m.medicationName} added.`);
      } else {
        const ref = doc(db, `pets/${petId}/medicationSchedules/${opened.id}`);
        const snap = await getDoc(ref);
        const current = snap.exists() ? ({ ...(snap.data() as Medication), id: snap.id }) : null;
        const changes = medicationChanges(opened, { ...mine, id: opened.id }, current, deleteField);
        if (Object.keys(changes).length) await updateDoc(ref, changes);
        onDone(stop ? `${mine.medicationName} stopped.` : `${mine.medicationName} saved.`);
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="med-name" style={{ fontSize: "14px" }}>Medication</label>
          <input id="med-name" className={input} style={inputStyle} value={form.name} maxLength={200} required onChange={(e) => set({ name: e.target.value })} />
        </div>
        <div>
          <label className={label} htmlFor="med-dose" style={{ fontSize: "14px" }}>Dose</label>
          <input id="med-dose" className={input} style={inputStyle} value={form.dosage} maxLength={200} placeholder="e.g. 5 mg, 1 tablet" onChange={(e) => set({ dosage: e.target.value })} />
        </div>
      </div>
      <div>
        <label className={label} htmlFor="med-freq" style={{ fontSize: "14px" }}>How often</label>
        <select id="med-freq" className={input} style={inputStyle} value={form.frequency} onChange={(e) => setFrequency(e.target.value)}>
          {FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>
      <fieldset>
        <legend className={label} style={{ fontSize: "14px" }}>Times</legend>
        <div className="flex flex-wrap gap-2">
          {form.times.map((t, i) => (
            <span key={i} className="flex gap-1 items-center">
              <input type="time" aria-label={`Time ${i + 1}`} className="rounded-lg px-3 py-2 font-inter" style={inputStyle} value={t} required
                onChange={(e) => set({ times: form.times.map((x, j) => (j === i ? e.target.value : x)) })} />
              {form.times.length > 1 && (
                <button type="button" className="btn-ghost" style={{ padding: "8px 10px", minHeight: "44px" }} aria-label={`Remove time ${i + 1}`}
                  onClick={() => set({ times: form.times.filter((_, j) => j !== i) })}>✕</button>
              )}
            </span>
          ))}
          <button type="button" className="btn-ghost" style={{ padding: "8px 12px", minHeight: "44px" }} onClick={() => set({ times: [...form.times, "12:00"] })}>Add a time</button>
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="med-start" style={{ fontSize: "14px" }}>Start date</label>
          <input id="med-start" type="date" className={input} style={inputStyle} value={form.start} required onChange={(e) => set({ start: e.target.value })} />
        </div>
        <div>
          <label className={label} htmlFor="med-end" style={{ fontSize: "14px" }}>End date (optional)</label>
          <input id="med-end" type="date" className={input} style={inputStyle} value={form.end} min={form.start} onChange={(e) => set({ end: e.target.value })} />
        </div>
      </div>
      <div>
        <label className={label} htmlFor="med-notes" style={{ fontSize: "14px" }}>Notes</label>
        <textarea id="med-notes" className={input} style={inputStyle} rows={2} maxLength={1000} value={form.notes} placeholder="e.g. With food" onChange={(e) => set({ notes: e.target.value })} />
      </div>
      {error && <p className="font-inter" role="alert" style={{ fontSize: "15px", color: "var(--error-red, #b42318)" }}>{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-coral" style={{ padding: "10px 20px" }} disabled={saving || !valid}>{saving ? "Saving…" : opened ? "Save" : "Add Medication"}</button>
        {opened && opened.isActive !== false && (
          <button type="button" className="btn-ghost" style={{ padding: "10px 20px" }} disabled={saving || !valid} onClick={() => save(true)}>Stop Giving It</button>
        )}
        <button type="button" className="btn-ghost" style={{ padding: "10px 20px" }} onClick={() => onDone("")}>Cancel</button>
      </div>
    </form>
  );
}

// MARK: - The card on the pet's page

export default function CareEditor({ petId, petName, schedule, meds }: {
  petId: string; petName: string; schedule: Schedule; meds: Medication[];
}) {
  const [mode, setMode] = useState<null | "feeding" | { med: Medication | null }>(null);
  const [done, setDone] = useState<string | null>(null);
  const finish = (msg: string) => { setMode(null); setDone(msg || null); };
  const active = meds.filter((m) => m.isActive !== false).sort((a, b) => (a.medicationName || "").localeCompare(b.medicationName || ""));

  return (
    <section className="rounded-2xl p-5 md:p-6" style={{ background: "var(--pure-white)", border: "1px solid var(--mist-gray)" }}>
      <h2 className="font-fraunces font-semibold mb-3" style={{ fontSize: "20px", color: "var(--bindr-navy)" }}>Change {petName}&apos;s Care</h2>
      {mode === null && (
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" style={{ padding: "10px 16px" }} onClick={() => { setDone(null); setMode("feeding"); }}>
            {(schedule?.scheduleItems || []).length ? "Edit Feeding Times" : "Add Feeding Times"}
          </button>
          {active.map((m) => (
            <button key={m.id} className="btn-ghost" style={{ padding: "10px 16px" }} onClick={() => { setDone(null); setMode({ med: m }); }}>
              Edit {m.medicationName || "Medication"}
            </button>
          ))}
          <button className="btn-ghost" style={{ padding: "10px 16px" }} onClick={() => { setDone(null); setMode({ med: null }); }}>Add a Medication</button>
        </div>
      )}
      {done && mode === null && <p className="font-inter mt-3" style={{ fontSize: "15px", color: "var(--success-green)" }} role="status">✓ {done}</p>}
      {mode === "feeding" && <FeedingEditor petId={petId} schedule={schedule} onDone={finish} />}
      {mode !== null && mode !== "feeding" && <MedicationEditor petId={petId} med={mode.med} onDone={finish} />}
      {mode === null && (schedule?.scheduleItems || []).some((m) => repeatSummary(schedule?.mealDays?.[m.id])) && (
        <p className="font-inter mt-3 text-(--slate-gray)" style={{ fontSize: "14px" }}>
          Meals that aren&apos;t every day need the latest PetBindr iPhone app to show the right days there.
        </p>
      )}
    </section>
  );
}
