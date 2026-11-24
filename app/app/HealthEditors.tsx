"use client";

// Vaccines, allergies and reminders on petbindr.com/app for owners and
// co-owners (2026-11-24, review #14: web parity for Android co-owners). Written
// in the iPhone app's shapes (records.ts), so they show in the app, its
// calendar, the Full Record and the Health Summary. The Firestore rules already
// let owners and co-owners write pets/{petId}/healthRecords and allergies, and
// anyone their own customReminders (scripts/web-app-rules-test.mts checks it).
// Edits save only the fields changed, so a change made in the app meanwhile
// isn't put back (as the app's FieldMerge does).
import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, query, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";
import { firebase } from "./firebase";
import {
  vaccineDoc, vaccineChanges, allergyDoc, allergyChanges, reminderDoc, reminderChanges, nextOccurrence, nextReminderId, dayFromInput,
  ALLERGY_CATEGORIES, ALLERGY_SEVERITIES, REMINDER_CATEGORIES, REMINDER_REPEATS,
  type VaccineForm, type AllergyForm, type ReminderForm,
} from "./records";
import { toDate, fmtDay, type HealthRecord } from "./health";

const input = "w-full rounded-lg px-3 py-2 font-inter text-[var(--charcoal)]";
const inputStyle = { border: "1px solid var(--mist-gray)", background: "white", fontSize: "16px" };
const labelCls = "block font-inter text-[var(--slate-gray)] mb-1";
const SAVE_ERROR = "Couldn't save that. Check your connection and try again.";

function dayInput(d: Date | null): string {
  if (!d) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function timeInput(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl p-5 md:p-6" style={{ background: "var(--pure-white)", border: "1px solid var(--mist-gray)" }}>
      <h2 className="font-fraunces font-semibold mb-3" style={{ fontSize: "20px", color: "var(--bindr-navy)" }}>{title}</h2>
      {children}
    </section>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return <div><label className={labelCls} htmlFor={id} style={{ fontSize: "14px" }}>{label}</label>{children}</div>;
}

function Buttons({ saving, canSave, onCancel, onDelete, deleteLabel }: {
  saving: boolean; canSave: boolean; onCancel: () => void; onDelete?: () => void; deleteLabel?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button type="submit" className="btn-coral" style={{ padding: "10px 18px" }} disabled={!canSave || saving}>{saving ? "Saving…" : "Save"}</button>
      <button type="button" className="btn-ghost" style={{ padding: "10px 16px" }} onClick={onCancel} disabled={saving}>Cancel</button>
      {onDelete && (
        <button type="button" className="font-inter underline ml-auto" style={{ color: "var(--error-red)", fontSize: "15px" }} onClick={onDelete} disabled={saving}>
          {deleteLabel || "Delete"}
        </button>
      )}
    </div>
  );
}

function Done({ text }: { text: string | null }) {
  return text ? <p className="font-inter mt-3" style={{ fontSize: "15px", color: "var(--success-green)" }} role="status">✓ {text}</p> : null;
}
function Err({ text }: { text: string | null }) {
  return text ? <p className="font-inter" style={{ fontSize: "14px", color: "var(--error-red)" }} role="alert">{text}</p> : null;
}

// ---------------- Vaccines ----------------

export function VaccinesEditor({ petId, uid, records }: { petId: string; uid: string; records: HealthRecord[] }) {
  const vaccines = records.filter((r) => r.type === "Vaccination")
    .sort((a, b) => (toDate(b.date)?.getTime() || 0) - (toDate(a.date)?.getTime() || 0));
  const [editing, setEditing] = useState<null | "new" | HealthRecord>(null);
  const [opened, setOpened] = useState<VaccineForm | null>(null);
  const [name, setName] = useState("");
  const [given, setGiven] = useState("");
  const [nextDue, setNextDue] = useState("");
  const [by, setBy] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  function formOf(r: HealthRecord | null): VaccineForm {
    return {
      vaccineName: r ? (r.vaccinationData?.vaccineName || r.title || "") : "",
      given: (r && toDate(r.date)) || new Date(),
      nextDue: r ? toDate(r.vaccinationData?.nextDueDate) : null,
      administeredBy: (r?.vaccinationData?.administeredBy as string) || "",
      notes: r?.notes || "",
    };
  }
  function open(r: HealthRecord | null) {
    const f = formOf(r);
    setEditing(r || "new"); setOpened(f); setError(null); setDone(null);
    setName(f.vaccineName); setGiven(dayInput(f.given)); setNextDue(dayInput(f.nextDue)); setBy(f.administeredBy); setNotes(f.notes);
  }
  const givenDay = dayFromInput(given);
  const dueDay = nextDue ? dayFromInput(nextDue) : null;
  const canSave = name.trim() !== "" && !!givenDay && (!nextDue || !!dueDay);

  async function save() {
    if (!canSave || !editing) return;
    setSaving(true); setError(null);
    const edited: VaccineForm = { vaccineName: name, given: givenDay!, nextDue: dueDay, administeredBy: by, notes };
    try {
      const { db } = firebase();
      if (editing === "new") {
        const rec = vaccineDoc(petId, uid, edited);
        await setDoc(doc(db, `pets/${petId}/healthRecords/${rec.id}`), rec.data);
        setDone(`${edited.vaccineName.trim()} saved.`);
      } else {
        const changes = vaccineChanges(opened!, edited, editing.title || "");
        if (Object.keys(changes).length) await updateDoc(doc(db, `pets/${petId}/healthRecords/${editing.id}`), changes);
        setDone("Vaccine saved.");
      }
      setEditing(null);
    } catch { setError(SAVE_ERROR); } finally { setSaving(false); }
  }

  async function remove() {
    if (!editing || editing === "new") return;
    if (!window.confirm(`Delete this ${name.trim() || "vaccine"} record? This can't be undone.`)) return;
    setSaving(true); setError(null);
    try {
      await deleteDoc(doc(firebase().db, `pets/${petId}/healthRecords/${editing.id}`));
      setDone("Vaccine deleted."); setEditing(null);
    } catch { setError("Couldn't delete that. Check your connection and try again."); } finally { setSaving(false); }
  }

  const shown = showAll ? vaccines : vaccines.slice(0, 6);
  const hasFiles = editing && editing !== "new" && (editing.attachments || []).length > 0;
  return (
    <Shell title="Vaccines">
      {editing === null ? (
        <>
          {vaccines.length === 0 && <p className="font-inter text-[var(--slate-gray)] mb-3">None recorded yet.</p>}
          {vaccines.length > 0 && (
            <ul className="space-y-2 mb-3">
              {shown.map((r) => {
                const due = toDate(r.vaccinationData?.nextDueDate);
                return (
                  <li key={r.id} className="flex items-start gap-3 font-inter">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[var(--charcoal)]">{r.vaccinationData?.vaccineName || r.title}</p>
                      <p className="text-[var(--slate-gray)]" style={{ fontSize: "14px" }}>
                        Given {fmtDay(toDate(r.date))}{due ? ` · next due ${fmtDay(due)}` : ""}
                      </p>
                    </div>
                    <button className="underline text-[var(--bindr-navy)] shrink-0" style={{ fontSize: "15px" }} onClick={() => open(r)}
                      aria-label={`Edit ${r.vaccinationData?.vaccineName || r.title} given ${fmtDay(toDate(r.date))}`}>Edit</button>
                  </li>
                );
              })}
            </ul>
          )}
          {vaccines.length > 6 && (
            <button className="font-inter underline text-[var(--bindr-navy)] mb-3 block" style={{ fontSize: "15px" }} onClick={() => setShowAll(!showAll)}>
              {showAll ? "Show fewer" : `Show all ${vaccines.length}`}
            </button>
          )}
          <button className="btn-ghost" style={{ padding: "10px 16px" }} onClick={() => open(null)}>Add a Vaccine</button>
          <Done text={done} />
        </>
      ) : (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <Field id="vx-name" label="Vaccine">
            <input id="vx-name" className={input} style={inputStyle} value={name} placeholder="e.g. Rabies, DHPP, Bordetella"
              onChange={(e) => setName(e.target.value)} autoFocus={editing === "new"} />
          </Field>
          <Field id="vx-given" label="Date given">
            <input id="vx-given" type="date" className={input} style={inputStyle} value={given} max={dayInput(new Date())} onChange={(e) => setGiven(e.target.value)} />
          </Field>
          <Field id="vx-due" label="Next due (optional)">
            <input id="vx-due" type="date" className={input} style={inputStyle} value={nextDue} onChange={(e) => setNextDue(e.target.value)} />
          </Field>
          <Field id="vx-by" label="Given by (optional)">
            <input id="vx-by" className={input} style={inputStyle} value={by} placeholder="Vet or clinic" onChange={(e) => setBy(e.target.value)} />
          </Field>
          <Field id="vx-notes" label="Note (optional)">
            <textarea id="vx-notes" className={input} style={inputStyle} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          {hasFiles && <p className="font-inter text-[var(--slate-gray)]" style={{ fontSize: "14px" }}>This record has files attached. To delete it, use the iPhone app.</p>}
          <Err text={error} />
          <Buttons saving={saving} canSave={canSave} onCancel={() => setEditing(null)}
            onDelete={editing !== "new" && !hasFiles ? remove : undefined} />
        </form>
      )}
    </Shell>
  );
}

// ---------------- Allergies ----------------

export type AllergyDoc = { id: string; allergenName?: string; category?: string; severity?: string; symptoms?: string; notes?: string; isActive?: boolean };

export function AllergiesEditor({ petId, allergies }: { petId: string; allergies: AllergyDoc[] }) {
  const list = [...allergies].sort((a, b) => Number(b.isActive !== false) - Number(a.isActive !== false) ||
    (a.allergenName || "").localeCompare(b.allergenName || ""));
  const [editing, setEditing] = useState<null | "new" | AllergyDoc>(null);
  const [opened, setOpened] = useState<AllergyForm | null>(null);
  const [form, setForm] = useState<AllergyForm>({ allergenName: "", category: "Other", severity: "Moderate", symptoms: "", notes: "", isActive: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function open(a: AllergyDoc | null) {
    const f: AllergyForm = {
      allergenName: a?.allergenName || "", category: a?.category || "Other", severity: a?.severity || "Moderate",
      symptoms: a?.symptoms || "", notes: a?.notes || "", isActive: a ? a.isActive !== false : true,
    };
    setEditing(a || "new"); setOpened(f); setForm(f); setError(null); setDone(null);
  }
  const set = (k: keyof AllergyForm, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));
  const canSave = form.allergenName.trim() !== "";

  async function save() {
    if (!canSave || !editing) return;
    setSaving(true); setError(null);
    try {
      const { db } = firebase();
      if (editing === "new") {
        const a = allergyDoc(petId, form);
        await setDoc(doc(db, `pets/${petId}/allergies/${a.id}`), a.data);
      } else {
        const changes = allergyChanges(opened!, form);
        if (Object.keys(changes).length) await updateDoc(doc(db, `pets/${petId}/allergies/${editing.id}`), changes);
      }
      setDone(`${form.allergenName.trim()} saved.`); setEditing(null);
    } catch { setError(SAVE_ERROR); } finally { setSaving(false); }
  }
  async function remove() {
    if (!editing || editing === "new") return;
    if (!window.confirm(`Delete the ${form.allergenName.trim() || "allergy"} allergy? This can't be undone.`)) return;
    setSaving(true); setError(null);
    try {
      await deleteDoc(doc(firebase().db, `pets/${petId}/allergies/${editing.id}`));
      setDone("Allergy deleted."); setEditing(null);
    } catch { setError("Couldn't delete that. Check your connection and try again."); } finally { setSaving(false); }
  }

  return (
    <Shell title="Edit Allergies">
      {editing === null ? (
        <>
          {list.length === 0 && <p className="font-inter text-[var(--slate-gray)] mb-3">None recorded yet.</p>}
          {list.length > 0 && (
            <ul className="space-y-2 mb-3">
              {list.map((a) => (
                <li key={a.id} className="flex items-start gap-3 font-inter">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold" style={{ color: a.isActive === false ? "var(--slate-gray)" : "var(--charcoal)" }}>
                      {a.allergenName}{a.isActive === false ? " (no longer allergic)" : ""}
                    </p>
                    <p className="text-[var(--slate-gray)]" style={{ fontSize: "14px" }}>{[a.category, a.severity].filter(Boolean).join(" · ")}</p>
                  </div>
                  <button className="underline text-[var(--bindr-navy)] shrink-0" style={{ fontSize: "15px" }} onClick={() => open(a)}
                    aria-label={`Edit ${a.allergenName}`}>Edit</button>
                </li>
              ))}
            </ul>
          )}
          <button className="btn-ghost" style={{ padding: "10px 16px" }} onClick={() => open(null)}>Add an Allergy</button>
          <Done text={done} />
        </>
      ) : (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <Field id="al-name" label="Allergic to">
            <input id="al-name" className={input} style={inputStyle} value={form.allergenName} placeholder="e.g. Chicken, Penicillin, Fleas"
              onChange={(e) => set("allergenName", e.target.value)} autoFocus={editing === "new"} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="al-cat" label="Type">
              <select id="al-cat" className={input} style={inputStyle} value={form.category} onChange={(e) => set("category", e.target.value)}>
                {ALLERGY_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field id="al-sev" label="How serious">
              <select id="al-sev" className={input} style={inputStyle} value={form.severity} onChange={(e) => set("severity", e.target.value)}>
                {ALLERGY_SEVERITIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </div>
          <Field id="al-sym" label="Signs to watch for (optional)">
            <input id="al-sym" className={input} style={inputStyle} value={form.symptoms} placeholder="e.g. Itching, vomiting" onChange={(e) => set("symptoms", e.target.value)} />
          </Field>
          <Field id="al-notes" label="Note (optional)">
            <textarea id="al-notes" className={input} style={inputStyle} rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
          {editing !== "new" && (
            <label className="flex items-center gap-2 font-inter text-[var(--charcoal)]">
              <input type="checkbox" checked={!form.isActive} onChange={(e) => set("isActive", !e.target.checked)} />
              No longer allergic (keeps it in the record, hides it from sitters)
            </label>
          )}
          <Err text={error} />
          <Buttons saving={saving} canSave={canSave} onCancel={() => setEditing(null)} onDelete={editing !== "new" ? remove : undefined} />
        </form>
      )}
    </Shell>
  );
}

// ---------------- Reminders ----------------

type ReminderDoc = { id: string; ownerId: string; petId: string; title?: string; date?: { toDate(): Date }; category?: string; notes?: string;
  isCompleted?: boolean; isRecurring?: boolean; recurringFrequencyDays?: number | null };

export function RemindersEditor({ petId, uid, petName }: { petId: string; uid: string; petName: string }) {
  const [reminders, setReminders] = useState<ReminderDoc[]>([]);
  const [editing, setEditing] = useState<null | "new" | ReminderDoc>(null);
  const [opened, setOpened] = useState<ReminderForm | null>(null);
  const [title, setTitle] = useState("");
  const [day, setDay] = useState("");
  const [time, setTime] = useState("09:00");
  const [category, setCategory] = useState("Custom");
  const [notes, setNotes] = useState("");
  const [repeat, setRepeat] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // Same query as the app (CalendarStore): this person's reminders; this pet's kept here
  useEffect(() => {
    const { db } = firebase();
    return onSnapshot(query(collection(db, "customReminders"), where("ownerId", "==", uid)),
      (s) => setReminders(s.docs.map((d) => ({ ...(d.data() as ReminderDoc), id: d.id })).filter((r) => r.petId === petId)),
      () => setReminders([]));
  }, [uid, petId]);

  const upcoming = reminders.filter((r) => !r.isCompleted)
    .sort((a, b) => (a.date?.toDate().getTime() || 0) - (b.date?.toDate().getTime() || 0));

  function formOf(r: ReminderDoc | null): ReminderForm {
    const base = new Date(); base.setDate(base.getDate() + 1); base.setHours(9, 0, 0, 0);
    return {
      title: r?.title || "", date: r?.date?.toDate() || base, category: r?.category || "Custom",
      notes: r?.notes || "", repeatDays: r?.isRecurring ? (r.recurringFrequencyDays || 30) : null,
    };
  }
  function open(r: ReminderDoc | null) {
    const f = formOf(r);
    setEditing(r || "new"); setOpened(f); setError(null); setDone(null);
    setTitle(f.title); setDay(dayInput(f.date)); setTime(timeInput(f.date)); setCategory(f.category); setNotes(f.notes); setRepeat(f.repeatDays || 0);
  }
  const when = (() => {
    const d = dayFromInput(day);
    const m = /^(\d{2}):(\d{2})$/.exec(time);
    if (!d || !m) return null;
    d.setHours(Number(m[1]), Number(m[2]), 0, 0);
    return d;
  })();
  const canSave = title.trim() !== "" && !!when;

  async function save() {
    if (!canSave || !editing) return;
    setSaving(true); setError(null);
    const edited: ReminderForm = { title, date: when!, category, notes, repeatDays: repeat || null };
    try {
      const { db } = firebase();
      if (editing === "new") {
        const r = reminderDoc(uid, petId, edited);
        await setDoc(doc(db, `customReminders/${r.id}`), r.data);
      } else {
        const changes = reminderChanges(opened!, edited);
        if (Object.keys(changes).length) await updateDoc(doc(db, `customReminders/${editing.id}`), changes);
      }
      setDone(`${title.trim()} saved.`); setEditing(null);
    } catch { setError(SAVE_ERROR); } finally { setSaving(false); }
  }

  // As the app's completeReminder: a repeating one makes its next one (same ID
  // the app would give, so it's made once whichever checks it off)
  async function complete(r: ReminderDoc) {
    setError(null); setDone(null);
    try {
      const { db } = firebase();
      const batch = writeBatch(db);
      batch.update(doc(db, `customReminders/${r.id}`), { isCompleted: true });
      if (r.isRecurring && r.recurringFrequencyDays && r.date) {
        const nextId = await nextReminderId(r.id);
        if (!reminders.some((x) => x.id === nextId)) {
          const next = reminderDoc(uid, petId, {
            title: r.title || "", date: nextOccurrence(r.date.toDate(), r.recurringFrequencyDays), category: r.category || "Custom",
            notes: r.notes || "", repeatDays: r.recurringFrequencyDays,
          }, nextId);
          batch.set(doc(db, `customReminders/${next.id}`), next.data);
        }
      }
      await batch.commit();
      setDone(`${r.title} done.`);
    } catch { setError(SAVE_ERROR); }
  }

  async function remove() {
    if (!editing || editing === "new") return;
    if (!window.confirm(`Delete the reminder "${title.trim()}"?`)) return;
    setSaving(true); setError(null);
    try {
      await deleteDoc(doc(firebase().db, `customReminders/${editing.id}`));
      setDone("Reminder deleted."); setEditing(null);
    } catch { setError("Couldn't delete that. Check your connection and try again."); } finally { setSaving(false); }
  }

  const now = new Date();
  return (
    <Shell title="Your Reminders">
      {editing === null ? (
        <>
          <p className="font-inter text-[var(--slate-gray)] mb-3" style={{ fontSize: "14px" }}>
            Flea meds, grooming, a vet visit for {petName}. Yours only: they show in your calendar in the PetBindr app too.
          </p>
          {upcoming.length > 0 && (
            <ul className="space-y-2 mb-3">
              {upcoming.map((r) => {
                const d = r.date?.toDate();
                const late = d && d < now;
                const repeatLabel = r.isRecurring ? REMINDER_REPEATS.find(([n]) => n === r.recurringFrequencyDays)?.[1] || `Every ${r.recurringFrequencyDays} days` : "";
                return (
                  <li key={r.id} className="flex items-start gap-3 font-inter">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[var(--charcoal)]">{r.title}</p>
                      <p style={{ fontSize: "14px", color: late ? "var(--error-red)" : "var(--slate-gray)" }}>
                        {d ? `${late ? "Was due " : ""}${d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}, ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}
                        {repeatLabel ? ` · ${repeatLabel}` : ""}
                      </p>
                    </div>
                    <button className="underline text-[var(--bindr-navy)] shrink-0" style={{ fontSize: "15px" }} onClick={() => complete(r)}
                      aria-label={`Mark ${r.title} done`}>Done</button>
                    <button className="underline text-[var(--bindr-navy)] shrink-0" style={{ fontSize: "15px" }} onClick={() => open(r)}
                      aria-label={`Edit ${r.title}`}>Edit</button>
                  </li>
                );
              })}
            </ul>
          )}
          <button className="btn-ghost" style={{ padding: "10px 16px" }} onClick={() => open(null)}>Add a Reminder</button>
          <Err text={error} />
          <Done text={done} />
        </>
      ) : (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <Field id="rm-title" label="Reminder">
            <input id="rm-title" className={input} style={inputStyle} value={title} placeholder="e.g. Flea and tick dose"
              onChange={(e) => setTitle(e.target.value)} autoFocus={editing === "new"} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="rm-day" label="Date">
              <input id="rm-day" type="date" className={input} style={inputStyle} value={day} onChange={(e) => setDay(e.target.value)} />
            </Field>
            <Field id="rm-time" label="Time">
              <input id="rm-time" type="time" className={input} style={inputStyle} value={time} onChange={(e) => setTime(e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field id="rm-cat" label="Category">
              <select id="rm-cat" className={input} style={inputStyle} value={category} onChange={(e) => setCategory(e.target.value)}>
                {REMINDER_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field id="rm-repeat" label="Repeat">
              <select id="rm-repeat" className={input} style={inputStyle} value={repeat} onChange={(e) => setRepeat(Number(e.target.value))}>
                <option value={0}>Never</option>
                {REMINDER_REPEATS.map(([n, l]) => <option key={n} value={n}>{l}</option>)}
              </select>
            </Field>
          </div>
          <Field id="rm-notes" label="Note (optional)">
            <textarea id="rm-notes" className={input} style={inputStyle} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <Err text={error} />
          <Buttons saving={saving} canSave={canSave} onCancel={() => setEditing(null)} onDelete={editing !== "new" ? remove : undefined} />
        </form>
      )}
    </Shell>
  );
}
