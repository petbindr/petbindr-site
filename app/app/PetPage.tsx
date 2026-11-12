"use client";

// A pet's page on petbindr.com/app (co-owners): what someone looking after
// the pet needs, read live from the same data as the app. Read-only for now;
// changes are made in the iPhone app. Leaves out what a co-owner can't read
// in the app either: the owner's household (home codes, Wi-Fi, emergency
// contacts) stays theirs.

import { useEffect, useState } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { firebase } from "./firebase";
import { toDate, type MedicationSchedule } from "./today";

type Stamp = Parameters<typeof toDate>[0];
type Vet = { name?: string; veterinarianName?: string; phoneNumber?: string; address?: string; city?: string; state?: string; zipCode?: string };
type PetData = {
  name?: string; species?: string; breed?: string; gender?: string; isFixed?: boolean; birthday?: Stamp;
  photoURL?: string; allergies?: string[]; foodInstructions?: string; quirks?: string; notes?: string;
  primaryVetClinic?: Vet | null; emergencyVetClinic?: Vet | null; secondaryEmergencyVetClinic?: Vet | null;
  microchipInfo?: { chipNumber?: string; provider?: string; registryPhone?: string } | null;
  insuranceInfo?: { provider?: string; policyNumber?: string; phone?: string } | null;
  routinesAndBehaviors?: Record<string, string> | null;
};
type Allergy = { id: string; allergenName?: string; severity?: string; symptoms?: string; isActive?: boolean };
type Feeding = {
  feedingInfo?: { foodName?: string; defaultPortion?: string; specialBowl?: string; feedingLocation?: string; specialInstructions?: string };
  scheduleItems?: { id: string; time?: Stamp; portion?: string; notes?: string }[];
} | null;

export default function PetPage({ petId, onBack }: { petId: string; onBack: () => void }) {
  const { db } = firebase();
  const [pet, setPet] = useState<PetData | null | undefined>(undefined);
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [meds, setMeds] = useState<MedicationSchedule[]>([]);
  const [feeding, setFeeding] = useState<Feeding>(null);
  const [photo, setPhoto] = useState<string | null>(null);

  useEffect(() => {
    const base = `pets/${petId}`;
    const stops = [
      onSnapshot(doc(db, base), (s) => setPet(s.exists() ? (s.data() as PetData) : null), () => setPet(null)),
      onSnapshot(collection(db, `${base}/allergies`), (s) => setAllergies(s.docs.map((d) => ({ ...(d.data() as Allergy), id: d.id }))), () => {}),
      onSnapshot(collection(db, `${base}/medicationSchedules`), (s) => setMeds(s.docs.map((d) => ({ ...(d.data() as MedicationSchedule), id: d.id }))), () => {}),
      onSnapshot(doc(db, `${base}/feedingSchedule/schedule`), (s) => setFeeding(s.exists() ? (s.data() as Feeding) : null), () => {}),
    ];
    return () => stops.forEach((s) => s());
  }, [db, petId]);

  // The app saves a Storage download link (with its token). Only people who
  // can read the pet (Firestore rules) ever see it, so it's shown as is.
  useEffect(() => {
    const url = pet?.photoURL;
    setPhoto(url && /^https:\/\/firebasestorage\.googleapis\.com\//.test(url) ? url : null);
  }, [pet?.photoURL]);

  useEffect(() => { window.scrollTo(0, 0); }, [petId]);

  if (pet === undefined) return <p className="font-inter text-[var(--slate-gray)]">Loading…</p>;
  if (pet === null) {
    return (
      <div className="space-y-4">
        <BackButton onBack={onBack} />
        <Card title="Not available"><p className="font-inter">This pet isn&apos;t shared with you anymore.</p></Card>
      </div>
    );
  }

  const name = pet.name || "Pet";
  const activeAllergies = [
    ...allergies.filter((a) => a.isActive !== false),
    // Allergies from first-pet setup, stored on the pet before the allergy list existed
    ...(pet.allergies || []).filter((n) => n.trim() && !allergies.some((a) => (a.allergenName || "").toLowerCase() === n.trim().toLowerCase()))
      .map((n, i) => ({ id: `legacy-${i}`, allergenName: n.trim() } as Allergy)),
  ].sort((a, b) => Number(b.severity === "Life-Threatening") - Number(a.severity === "Life-Threatening"));
  const activeMeds = meds.filter((m) => m.isActive !== false).sort((a, b) => (a.medicationName || "").localeCompare(b.medicationName || ""));
  const vets: [string, Vet | null | undefined][] = [
    ["Regular vet", pet.primaryVetClinic], ["Emergency vet", pet.emergencyVetClinic], ["Backup emergency vet", pet.secondaryEmergencyVetClinic],
  ];
  const shownVets = vets.filter(([, v]) => v && (v.name || "").trim());
  const routines = routineRows(pet.routinesAndBehaviors);
  const info = feeding?.feedingInfo;
  const items = [...(feeding?.scheduleItems || [])].sort((a, b) => minutes(toDate(a.time)) - minutes(toDate(b.time)));

  return (
    <div className="space-y-5">
      <BackButton onBack={onBack} />

      <header className="flex items-center gap-4">
        <div className="shrink-0 rounded-full overflow-hidden flex items-center justify-center"
          style={{ width: 88, height: 88, background: "var(--mist-gray)" }}>
          {photo
            ? <img src={photo} alt={name} width={88} height={88} style={{ objectFit: "cover", width: 88, height: 88 }} />
            : <span className="font-fraunces text-[var(--bindr-navy)]" style={{ fontSize: 34 }}>{name.slice(0, 1)}</span>}
        </div>
        <div className="min-w-0">
          <h1 className="font-fraunces font-semibold text-[var(--bindr-navy)]" style={{ fontSize: "clamp(26px, 6vw, 34px)" }}>{name}</h1>
          <p className="font-inter text-[var(--charcoal)]">{[pet.species, pet.breed].filter(Boolean).join(" · ")}</p>
          {details(pet) && <p className="font-inter text-[var(--slate-gray)]" style={{ fontSize: "15px" }}>{details(pet)}</p>}
        </div>
      </header>

      {activeAllergies.length > 0 && (
        <Card title="Allergies" tone={activeAllergies.some((a) => a.severity === "Life-Threatening") ? "alert" : undefined}>
          <ul className="space-y-2">
            {activeAllergies.map((a) => (
              <li key={a.id} className="font-inter">
                <span className="font-semibold" style={{ color: a.severity === "Life-Threatening" ? "var(--error-red)" : "var(--charcoal)" }}>
                  {a.allergenName}{a.severity && a.severity !== "Unspecified" ? ` (${a.severity.toLowerCase()})` : ""}
                </span>
                {a.symptoms && <span className="text-[var(--slate-gray)]"> · Signs: {a.symptoms}</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {activeMeds.length > 0 && (
        <Card title="Medications">
          <ul className="space-y-3">
            {activeMeds.map((m) => (
              <li key={m.id} className="font-inter">
                <p className="font-semibold text-[var(--charcoal)]">{m.medicationName}</p>
                <p className="text-[var(--charcoal)]" style={{ fontSize: "15px" }}>{medLine(m)}</p>
                {(m as { notes?: string }).notes && <p className="text-[var(--slate-gray)]" style={{ fontSize: "14px" }}>{(m as { notes?: string }).notes}</p>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {(items.length > 0 || info?.foodName || pet.foodInstructions) && (
        <Card title="Feeding">
          <div className="space-y-3 font-inter">
            {info?.foodName && <p className="font-semibold text-[var(--charcoal)]">Food: {info.foodName}</p>}
            {items.length > 0 && (
              <ul className="space-y-2">
                {items.map((it) => (
                  <li key={it.id} className="flex gap-3">
                    <span className="w-20 shrink-0 text-[var(--slate-gray)]" style={{ fontSize: "15px" }}>{fmtTime(toDate(it.time))}</span>
                    <span className="text-[var(--charcoal)]">
                      {it.portion || info?.defaultPortion || "—"}
                      {it.notes && <span className="block text-[var(--slate-gray)]" style={{ fontSize: "14px" }}>{it.notes}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {info?.specialBowl && <Labeled label="Bowl" value={info.specialBowl} />}
            {info?.feedingLocation && <Labeled label="Where" value={info.feedingLocation} />}
            {info?.specialInstructions && <Labeled label="Special instructions" value={info.specialInstructions} />}
            {pet.foodInstructions && <Labeled label="Instructions" value={pet.foodInstructions} />}
          </div>
        </Card>
      )}

      {shownVets.length > 0 && (
        <Card title="Vets">
          <ul className="space-y-4">
            {shownVets.map(([label, v]) => {
              const address = fullAddress(v!);
              return (
                <li key={label} className="font-inter">
                  <p className="text-[var(--slate-gray)]" style={{ fontSize: "14px" }}>{label}</p>
                  <p className="font-semibold text-[var(--charcoal)]">{v!.name}{v!.veterinarianName ? `, ${v!.veterinarianName}` : ""}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                    {v!.phoneNumber && <a className="underline text-[var(--bindr-navy)]" href={`tel:${v!.phoneNumber.replace(/[^0-9+]/g, "")}`}>Call {v!.phoneNumber}</a>}
                    {address && <a className="underline text-[var(--bindr-navy)]" target="_blank" rel="noreferrer"
                      href={`https://maps.google.com/?q=${encodeURIComponent(`${v!.name} ${address}`)}`}>Directions</a>}
                  </div>
                  {address && <p className="text-[var(--slate-gray)]" style={{ fontSize: "14px" }}>{address}</p>}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {(routines.length > 0 || pet.quirks) && (
        <Card title="Routines & Behavior">
          <div className="space-y-2">
            {routines.map(([label, value]) => <Labeled key={label} label={label} value={value} />)}
            {pet.quirks && <Labeled label="Quirks" value={pet.quirks} />}
          </div>
        </Card>
      )}

      {(pet.microchipInfo?.chipNumber || pet.insuranceInfo?.provider) && (
        <Card title="ID & Insurance">
          <div className="space-y-2">
            {pet.microchipInfo?.chipNumber && (
              <Labeled label="Microchip" value={[pet.microchipInfo.chipNumber, pet.microchipInfo.provider].filter(Boolean).join(" · ")} />
            )}
            {pet.microchipInfo?.registryPhone && <Labeled label="Chip registry" value={pet.microchipInfo.registryPhone} />}
            {pet.insuranceInfo?.provider && (
              <Labeled label="Insurance" value={[pet.insuranceInfo.provider, pet.insuranceInfo.policyNumber && `policy ${pet.insuranceInfo.policyNumber}`, pet.insuranceInfo.phone].filter(Boolean).join(" · ")} />
            )}
          </div>
        </Card>
      )}

      {pet.notes && <Card title="Notes"><p className="font-inter text-[var(--charcoal)] whitespace-pre-line">{pet.notes}</p></Card>}

      <p className="font-inter text-center text-[var(--slate-gray)]" style={{ fontSize: "14px" }}>
        To change {name}&apos;s info, or see health records, use the PetBindr iPhone app.
      </p>
    </div>
  );
}

// MARK: - Wording

function details(pet: PetData): string {
  const parts: string[] = [];
  if (pet.gender && pet.gender !== "Unknown") parts.push(pet.gender);
  if (typeof pet.isFixed === "boolean") {
    const word = pet.gender === "Female" ? "spayed" : pet.gender === "Male" ? "neutered" : "fixed";
    parts.push(pet.isFixed ? word[0].toUpperCase() + word.slice(1) : `Not ${word}`);
  }
  const born = toDate(pet.birthday);
  if (born) {
    const now = new Date();
    let years = now.getFullYear() - born.getFullYear();
    if (now.getMonth() < born.getMonth() || (now.getMonth() === born.getMonth() && now.getDate() < born.getDate())) years--;
    parts.push(years > 0 ? `${years} year${years === 1 ? "" : "s"} old` : "Under 1 year old");
  }
  return parts.join(" · ");
}

function medLine(m: MedicationSchedule): string {
  const times = (m.scheduledTimes || []).map(toDate).filter((d): d is Date => !!d)
    .sort((a, b) => minutes(a) - minutes(b)).map(fmtTime);
  return [m.dosage, m.frequency, times.length ? `at ${times.join(", ")}` : ""].filter(Boolean).join(" · ");
}

function routineRows(r: Record<string, string> | null | undefined): [string, string][] {
  if (!r) return [];
  const rows: [string, string][] = [
    ["Morning", r.morningRoutine], ["Evening", r.eveningRoutine], ["Daily habits", r.dailyHabits],
    ["Stress signs", r.stressIndicators], ["Calming tips", r.calmingTechniques], ["With others", r.socialBehavior],
  ];
  return rows.filter(([, v]) => (v || "").trim()) as [string, string][];
}

function fullAddress(v: Vet): string {
  const stateZip = [v.state, v.zipCode].map((s) => (s || "").trim()).filter(Boolean).join(" ");
  return [v.address, v.city, stateZip].map((s) => (s || "").trim()).filter(Boolean).join(", ");
}

function minutes(d: Date | null): number { return d ? d.getHours() * 60 + d.getMinutes() : 0; }
function fmtTime(d: Date | null): string { return d ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""; }

// MARK: - Pieces

function BackButton({ onBack }: { onBack: () => void }) {
  return <button className="font-inter underline text-[var(--bindr-navy)]" onClick={onBack}>‹ Back to Today</button>;
}

function Labeled({ label, value }: { label: string; value: string }) {
  return (
    <p className="font-inter text-[var(--charcoal)]">
      <span className="text-[var(--slate-gray)]">{label}: </span>
      <span className="whitespace-pre-line">{value}</span>
    </p>
  );
}

function Card({ title, tone, children }: { title: string; tone?: "alert"; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl p-5 md:p-6"
      style={{ background: tone === "alert" ? "#FDECEA" : "var(--pure-white)", border: "1px solid var(--mist-gray)" }}>
      <h2 className="font-fraunces font-semibold mb-3" style={{ fontSize: "20px", color: tone === "alert" ? "var(--error-red)" : "var(--bindr-navy)" }}>{title}</h2>
      {children}
    </section>
  );
}
