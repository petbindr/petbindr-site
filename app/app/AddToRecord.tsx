"use client";

// Adding to a pet's record from petbindr.com/app (owners and co-owners, e.g.
// on Android): log a weight, add a vet visit, or change the pet's notes. The
// records are written exactly like the iPhone app's (HealthRecord in
// Models/HealthRecord.swift: same fields, "Weight" title, a visit titled by
// its reason, source "owner"), so they show up in the app, the Full Record and
// the Health Summary. The Firestore rules let owners and co-owners write
// pets/{petId}/healthRecords and change the pet's notes.
import { useState } from "react";
import { doc, setDoc, updateDoc } from "firebase/firestore";
import { firebase } from "./firebase";
import { healthRecordDoc, dayFromInput } from "./records";

type Mode = null | "weight" | "visit" | "notes";

function todayInput(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function AddToRecord({ petId, petName, uid, regularVet, lastUnit, notes }: {
  petId: string; petName: string; uid: string; regularVet: string; lastUnit: "lbs" | "kg"; notes: string;
}) {
  const [mode, setMode] = useState<Mode>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  // Weight
  const [weight, setWeight] = useState("");
  const [unit, setUnit] = useState<"lbs" | "kg">(lastUnit);
  // Visit
  const [clinic, setClinic] = useState(regularVet);
  const [reason, setReason] = useState("");
  const [vet, setVet] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [treatment, setTreatment] = useState("");
  // Shared
  const [day, setDay] = useState(todayInput());
  const [note, setNote] = useState("");
  const [petNotes, setPetNotes] = useState(notes);

  function open(next: Mode) {
    setMode(next);
    setError(null);
    setDone(null);
    setDay(todayInput());
    setNote("");
    if (next === "notes") setPetNotes(notes);
  }

  const weightValue = Number(weight.replace(",", "."));
  const weightOk = weight.trim() !== "" && Number.isFinite(weightValue) && weightValue > 0 && weightValue < 1000;
  const dayValue = dayFromInput(day);
  const canSave = mode === "weight" ? weightOk && !!dayValue
    : mode === "visit" ? !!dayValue && clinic.trim() !== "" && reason.trim() !== ""
    : mode === "notes" ? petNotes !== notes : false;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const { db } = firebase();
      if (mode === "notes") {
        await updateDoc(doc(db, "pets", petId), { notes: petNotes.trim().slice(0, 5000) });
        setDone("Notes saved.");
      } else if (mode === "weight") {
        const rec = healthRecordDoc(petId, uid, "Weight", dayValue!, {
          title: "Weight", notes: note, weightData: { weight: Math.round(weightValue * 10) / 10, unit },
        });
        await setDoc(doc(db, `pets/${petId}/healthRecords/${rec.id}`), rec.data);
        setDone("Weight saved.");
        setWeight("");
      } else if (mode === "visit") {
        const rec = healthRecordDoc(petId, uid, "Vet Visit", dayValue!, {
          title: reason.trim(), notes: note,
          vetVisitData: { clinicName: clinic.trim(), reason: reason.trim(), veterinarianName: vet.trim(), diagnosis: diagnosis.trim(), treatment: treatment.trim() },
        });
        await setDoc(doc(db, `pets/${petId}/healthRecords/${rec.id}`), rec.data);
        setDone("Vet visit saved.");
        setReason(""); setVet(""); setDiagnosis(""); setTreatment("");
      }
      setMode(null);
    } catch {
      setError("Couldn't save that. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  const input = "w-full rounded-lg px-3 py-2 font-inter text-[var(--charcoal)]";
  const inputStyle = { border: "1px solid var(--mist-gray)", background: "white", fontSize: "16px" };
  const label = "block font-inter text-[var(--slate-gray)] mb-1";

  return (
    <section className="rounded-2xl p-5 md:p-6" style={{ background: "var(--pure-white)", border: "1px solid var(--mist-gray)" }}>
      <h2 className="font-fraunces font-semibold mb-3" style={{ fontSize: "20px", color: "var(--bindr-navy)" }}>Add to {petName}&apos;s Record</h2>
      {mode === null && (
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" style={{ padding: "10px 16px" }} onClick={() => open("weight")}>Log a Weight</button>
          <button className="btn-ghost" style={{ padding: "10px 16px" }} onClick={() => open("visit")}>Add a Vet Visit</button>
          <button className="btn-ghost" style={{ padding: "10px 16px" }} onClick={() => open("notes")}>{notes ? "Edit Notes" : "Add Notes"}</button>
        </div>
      )}
      {done && mode === null && <p className="font-inter mt-3" style={{ fontSize: "15px", color: "var(--success-green)" }} role="status">✓ {done}</p>}

      {mode !== null && (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save(); }}>
          {mode !== "notes" && (
            <div>
              <label className={label} htmlFor="rec-day" style={{ fontSize: "14px" }}>{mode === "weight" ? "Date" : "Visit date"}</label>
              <input id="rec-day" type="date" className={input} style={inputStyle} value={day} max={todayInput()} onChange={(e) => setDay(e.target.value)} />
            </div>
          )}

          {mode === "weight" && (
            <div>
              <label className={label} htmlFor="rec-weight" style={{ fontSize: "14px" }}>Weight</label>
              <div className="flex gap-2">
                <input id="rec-weight" inputMode="decimal" className={input} style={inputStyle} value={weight} placeholder="e.g. 12.4"
                  onChange={(e) => setWeight(e.target.value)} autoFocus />
                <select className="rounded-lg px-3 font-inter" style={inputStyle} value={unit} onChange={(e) => setUnit(e.target.value as "lbs" | "kg")} aria-label="Unit">
                  <option value="lbs">lbs</option>
                  <option value="kg">kg</option>
                </select>
              </div>
            </div>
          )}

          {mode === "visit" && (
            <>
              <div>
                <label className={label} htmlFor="rec-clinic" style={{ fontSize: "14px" }}>Clinic</label>
                <input id="rec-clinic" className={input} style={inputStyle} value={clinic} onChange={(e) => setClinic(e.target.value)} />
              </div>
              <div>
                <label className={label} htmlFor="rec-reason" style={{ fontSize: "14px" }}>Reason for the visit</label>
                <input id="rec-reason" className={input} style={inputStyle} value={reason} placeholder="e.g. Annual checkup, ear infection"
                  onChange={(e) => setReason(e.target.value)} autoFocus />
              </div>
              <div>
                <label className={label} htmlFor="rec-vet" style={{ fontSize: "14px" }}>Veterinarian (optional)</label>
                <input id="rec-vet" className={input} style={inputStyle} value={vet} onChange={(e) => setVet(e.target.value)} />
              </div>
              <div>
                <label className={label} htmlFor="rec-diag" style={{ fontSize: "14px" }}>Diagnosis (optional)</label>
                <input id="rec-diag" className={input} style={inputStyle} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />
              </div>
              <div>
                <label className={label} htmlFor="rec-treat" style={{ fontSize: "14px" }}>Treatment (optional)</label>
                <input id="rec-treat" className={input} style={inputStyle} value={treatment} onChange={(e) => setTreatment(e.target.value)} />
              </div>
            </>
          )}

          {mode !== "notes" ? (
            <div>
              <label className={label} htmlFor="rec-note" style={{ fontSize: "14px" }}>Note (optional)</label>
              <textarea id="rec-note" className={input} style={inputStyle} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          ) : (
            <div>
              <label className={label} htmlFor="rec-petnotes" style={{ fontSize: "14px" }}>Notes about {petName} (everyone with access sees these)</label>
              <textarea id="rec-petnotes" className={input} style={inputStyle} rows={5} value={petNotes} onChange={(e) => setPetNotes(e.target.value)} autoFocus />
            </div>
          )}

          {error && <p className="font-inter" style={{ fontSize: "14px", color: "var(--error-red)" }} role="alert">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn-coral" style={{ padding: "10px 18px" }} disabled={!canSave || saving}>{saving ? "Saving…" : "Save"}</button>
            <button type="button" className="btn-ghost" style={{ padding: "10px 16px" }} onClick={() => setMode(null)} disabled={saving}>Cancel</button>
          </div>
        </form>
      )}
    </section>
  );
}
