"use client";

// Sitter mode on petbindr.com/app (2026-11-20): sit invites to accept, the
// clients you're sitting for (dates, "this time" notes, call the owner, home
// and emergency info, each pet's page), and Send Visit Report with photos.
// Today's check-offs for these pets are on HomeApp's Today list. Same
// documents and rules as the iPhone app's My Clients (SitterClients.swift):
// nothing here can show or do more than the share allows.

import { useEffect, useState } from "react";
import { collection, doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { ref, uploadBytes, deleteObject } from "firebase/storage";
import { firebase } from "./firebase";
import {
  datesText, telHref, may, isPending, reportDoc, reportPhotoPath, fitInside, MAX_REPORT_PHOTOS,
  type Client, type Sit, type ReportItem,
} from "./sitter";

/** The parts of the server's copy of a shared pet (sitterPetViews) used here */
export type PetView = { name: string; ownerId: string; coOwnerIds: string[]; species?: string; breed?: string; isDeceased?: boolean };

// MARK: - Sit invites

export function SitInvites({ sits, now }: { sits: Sit[]; now: Date }) {
  const pending = sits.filter((s) => isPending(s, now));
  const [working, setWorking] = useState<string | null>(null);
  const [confirmDecline, setConfirmDecline] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function respond(sit: Sit, accept: boolean) {
    setWorking(sit.shareId);
    setError(null);
    try {
      // Only these three fields: the rules let the sitter accept or decline, nothing else
      await updateDoc(doc(firebase().db, "petShares", sit.shareId), {
        status: accept ? "active" : "declined", respondedAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
    } catch {
      setError("Couldn't do that. Check your connection and try again.");
    } finally {
      setWorking(null);
      setConfirmDecline(null);
    }
  }

  if (pending.length === 0) return null;
  return (
    <>
      {pending.map((s) => {
        const from = s.ownerName || "Someone";
        const when = datesText(s.start, s.end);
        return (
          <Card key={s.shareId} title={`${from} wants you to look after ${s.petName}`}>
            <p className="font-inter text-(--charcoal)">
              {when ? `${when}. ` : ""}You&apos;ll see what {from} chose to share, and you can check off {s.petName}&apos;s feedings and medications during the sit.
            </p>
            {s.ownerNotes && <p className="font-inter italic mt-2 text-(--charcoal)">“{s.ownerNotes}”</p>}
            {error && working === null && <p className="font-inter mt-2" style={{ fontSize: "15px", color: "var(--error-red)" }} role="alert">{error}</p>}
            <div className="flex flex-wrap gap-2 mt-3">
              <button className="btn-coral" style={{ padding: "10px 16px" }} disabled={!!working} onClick={() => respond(s, true)}>
                {working === s.shareId ? "One moment…" : "Accept"}
              </button>
              {confirmDecline === s.shareId ? (
                <button className="btn-ghost" style={{ padding: "10px 16px", color: "var(--error-red)" }} disabled={!!working} onClick={() => respond(s, false)}>
                  Tap to decline
                </button>
              ) : (
                <button className="btn-ghost" style={{ padding: "10px 16px" }} disabled={!!working} onClick={() => setConfirmDecline(s.shareId)}>
                  Decline
                </button>
              )}
            </div>
          </Card>
        );
      })}
    </>
  );
}

// MARK: - My clients

export function MyClients({ clients, tasks, views, uid, sitterName, reportItems }: {
  clients: Client[];
  tasks: { petId: string; done: boolean; time: Date; title: string; petName: string }[];
  views: Record<string, PetView>;
  uid: string;
  sitterName: string;
  reportItems: (petIds: string[]) => ReportItem[];
}) {
  if (clients.length === 0) return null;
  return (
    <section className="space-y-4" aria-label="My clients">
      <h2 className="font-fraunces font-semibold text-(--bindr-navy)" style={{ fontSize: "24px" }}>
        {clients.length === 1 ? "Your sit" : "Your clients"}
      </h2>
      {clients.map((c) => (
        <ClientCard key={c.ownerId} client={c} tasks={tasks} views={views} uid={uid} sitterName={sitterName} reportItems={reportItems} />
      ))}
    </section>
  );
}

function ClientCard({ client: c, tasks, views, uid, sitterName, reportItems }: {
  client: Client;
  tasks: { petId: string; done: boolean; time: Date; title: string; petName: string }[];
  views: Record<string, PetView>;
  uid: string;
  sitterName: string;
  reportItems: (petIds: string[]) => ReportItem[];
}) {
  const [reporting, setReporting] = useState(false);
  const livePetIds = c.live.map((s) => s.petId);
  const next = tasks.filter((t) => livePetIds.includes(t.petId) && !t.done).slice(0, 3);
  const allSits = [...c.live, ...c.upcoming];
  const homeShared = allSits.some((s) => may(s, "canViewHouseholdAccess"));
  const contactsShared = allSits.some((s) => may(s, "canViewEmergencyContacts"));
  const first = c.name.split(" ")[0];

  return (
    <Card title={c.name}>
      <p className="font-inter text-(--slate-gray)" style={{ fontSize: "15px" }}>
        {c.live.length === 0 && c.start ? `Starts ${datesText(c.start, null).replace(/^From /, "")}` : datesText(c.start, c.end)}
      </p>
      {c.notes.map((n) => (
        <p key={n} className="font-inter mt-2 text-(--charcoal)"><span className="font-semibold">This time: </span>{n}</p>
      ))}

      <ul className="mt-3 space-y-1">
        {allSits.map((s) => {
          const v = views[s.petId];
          const kind = [v?.species, v?.breed].filter(Boolean).join(" · ");
          return (
            <li key={s.shareId} className="font-inter">
              <a href={`#pet/${s.petId}`} className="flex items-center justify-between gap-3 py-2" style={{ textDecoration: "none", minHeight: 44 }}>
                <span>
                  <span className="font-semibold text-(--bindr-navy) underline">{v?.name || s.petName}</span>
                  {kind && <span className="text-(--slate-gray)"> · {kind}</span>}
                </span>
                <span className="text-(--slate-gray)" aria-hidden>›</span>
              </a>
            </li>
          );
        })}
      </ul>

      {next.length > 0 && (
        <div className="mt-2">
          <p className="font-inter font-semibold text-(--charcoal)" style={{ fontSize: "15px" }}>Next up</p>
          <ul className="font-inter text-(--charcoal)" style={{ fontSize: "15px" }}>
            {next.map((t, i) => (
              <li key={i}>{fmtTime(t.time)} · {t.petName} · {t.title}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mt-4">
        {c.phone && <a className="btn-ghost" style={{ padding: "10px 16px" }} href={telHref(c.phone)}>Call {first}</a>}
        {c.live.length > 0 && !reporting && (
          <button className="btn-coral" style={{ padding: "10px 16px" }} onClick={() => setReporting(true)}>Send Visit Report</button>
        )}
      </div>

      {(homeShared || contactsShared) && <HomeInfo ownerId={c.ownerId} ownerFirst={first} homeShared={homeShared} />}

      {reporting && (
        <VisitReportForm client={c} views={views} uid={uid} sitterName={sitterName} reportItems={reportItems} onClose={() => setReporting(false)} />
      )}
    </Card>
  );
}

// MARK: - Home and emergency info

type Contact = { id?: string; name?: string; relationship?: string; phoneNumber?: string; notes?: string };
type Household = {
  alarmCode?: string; alarmInstructions?: string; gateCode?: string; keyLocation?: string; wifiSSID?: string; wifiPassword?: string;
  lockboxCode?: string; parkingInstructions?: string; lightingAutomation?: string; additionalNotes?: string; emergencyContacts?: Contact[];
};

const HOME_ROWS: [keyof Household, string][] = [
  ["keyLocation", "Key"], ["lockboxCode", "Lockbox"], ["gateCode", "Gate"], ["alarmCode", "Alarm code"],
  ["alarmInstructions", "Alarm"], ["wifiSSID", "Wi-Fi"], ["wifiPassword", "Wi-Fi password"],
  ["parkingInstructions", "Parking"], ["lightingAutomation", "Lights"], ["additionalNotes", "Notes"],
];

/**
 * Through getSharedHousehold, like the app: the server checks this sitter's
 * live shares from that owner, gives contacts only unless home access is on,
 * and writes a home-info view to the owner's access log. Loaded only when
 * tapped, so the owner's log shows real looks.
 */
function HomeInfo({ ownerId, ownerFirst, homeShared }: { ownerId: string; ownerFirst: string; homeShared: boolean }) {
  const [state, setState] = useState<"closed" | "loading" | "open" | "error">("closed");
  const [house, setHouse] = useState<Household | null>(null);
  const [contactsOnly, setContactsOnly] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setState("loading");
    try {
      const r = await httpsCallable<unknown, { household: Household | null; contactsOnly?: boolean }>(firebase().functions, "getSharedHousehold")({ ownerId, source: "petbindr.com" });
      setHouse(r.data.household);
      setContactsOnly(!!r.data.contactsOnly);
      setState("open");
    } catch (e) {
      const code = (e as { code?: string }).code || "";
      setError(code.includes("permission-denied") ? `${ownerFirst} isn't sharing home info with you right now.` : "Couldn't load it. Check your connection and try again.");
      setState("error");
    }
  }

  if (state === "closed" || state === "loading" || state === "error") {
    return (
      <div className="mt-3">
        <button className="font-inter underline text-(--bindr-navy)" style={{ padding: "8px 0", minHeight: 44 }} onClick={load} disabled={state === "loading"}>
          {state === "loading" ? "Loading…" : homeShared ? "Show home info and emergency contacts" : "Show emergency contacts"}
        </button>
        {homeShared && state === "closed" && (
          <p className="font-inter text-(--slate-gray)" style={{ fontSize: "13px" }}>{ownerFirst} can see when home info was looked at.</p>
        )}
        {state === "error" && <p className="font-inter" style={{ fontSize: "14px", color: "var(--error-red)" }} role="alert">{error}</p>}
      </div>
    );
  }

  const contacts = (house?.emergencyContacts || []).filter((x) => (x.name || "").trim() || (x.phoneNumber || "").trim());
  const rows = contactsOnly || !house ? [] : HOME_ROWS.filter(([k]) => typeof house[k] === "string" && (house[k] as string).trim());
  return (
    <div className="mt-4 rounded-xl p-4 space-y-3" style={{ background: "var(--warm-cream)" }}>
      {rows.length > 0 && (
        <div className="space-y-1 font-inter">
          <p className="font-semibold text-(--charcoal)">Home</p>
          {rows.map(([k, label]) => (
            <p key={k} className="text-(--charcoal)" style={{ fontSize: "15px" }}>
              <span className="text-(--slate-gray)">{label}: </span><span className="whitespace-pre-line">{house![k] as string}</span>
            </p>
          ))}
        </div>
      )}
      <div className="font-inter">
        <p className="font-semibold text-(--charcoal)">In an emergency</p>
        {contacts.length === 0 ? (
          <p className="text-(--slate-gray)" style={{ fontSize: "15px" }}>No emergency contacts saved.</p>
        ) : (
          <ul className="space-y-2 mt-1">
            {contacts.map((x, i) => (
              <li key={x.id || i}>
                <p className="text-(--charcoal)">{x.name}{x.relationship ? ` · ${x.relationship}` : ""}</p>
                {x.phoneNumber && <a className="underline text-(--bindr-navy)" href={telHref(x.phoneNumber)}>Call {x.phoneNumber}</a>}
                {x.notes && <p className="text-(--slate-gray)" style={{ fontSize: "14px" }}>{x.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <button className="font-inter underline text-(--slate-gray)" style={{ fontSize: "14px" }} onClick={() => { setState("closed"); setHouse(null); }}>Hide</button>
    </div>
  );
}

// MARK: - Send Visit Report

async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const size = fitInside(bitmap.width, bitmap.height, 1600);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("photo"))), "image/jpeg", 0.8));
}

function VisitReportForm({ client: c, views, uid, sitterName, reportItems, onClose }: {
  client: Client; views: Record<string, PetView>; uid: string; sitterName: string;
  reportItems: (petIds: string[]) => ReportItem[]; onClose: () => void;
}) {
  const pets = c.live.map((s) => ({ id: s.petId, name: views[s.petId]?.name || s.petName }));
  const [chosen, setChosen] = useState<string[]>(pets.map((p) => p.id));
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState<Date | null>(null);

  useEffect(() => {
    const urls = photos.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [photos]);

  const picked = pets.filter((p) => chosen.includes(p.id));
  const items = reportItems(picked.map((p) => p.id));

  async function send() {
    const firstView = picked[0] && views[picked[0].id];
    if (!firstView) { setError("Choose at least one pet."); return; }
    setBusy(true);
    setError(null);
    const { db, storage } = firebase();
    const reportRef = doc(collection(db, "visitReports"));
    const uploaded: string[] = [];
    try {
      for (const [i, file] of photos.slice(0, MAX_REPORT_PHOTOS).entries()) {
        const blob = await shrink(file);
        const fileRef = ref(storage, reportPhotoPath(picked[0].id, reportRef.id, i));
        await uploadBytes(fileRef, blob, { contentType: "image/jpeg", customMetadata: { uploadedBy: uid } });
        uploaded.push(`gs://${fileRef.bucket}/${fileRef.fullPath}`);
      }
      // The owners named on the first pet (the rules check them against the pet)
      await setDoc(reportRef, reportDoc({
        uid, sitterName, ownerId: firstView.ownerId, coOwnerIds: firstView.coOwnerIds,
        pets: picked, note, items, photoPaths: uploaded,
      }, serverTimestamp()));
      setSentAt(new Date());
    } catch {
      // Don't leave the photos behind (storage.rules let the uploader remove them)
      for (const p of uploaded) { try { await deleteObject(ref(storage, p)); } catch { /* best effort */ } }
      setError("Couldn't send the report. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (sentAt) {
    return (
      <div className="mt-4 rounded-xl p-4 font-inter" style={{ background: "var(--warm-cream)" }} role="status">
        <p className="font-semibold" style={{ color: "var(--success-green)" }}>✓ Report sent to {c.name} at {fmtTime(sentAt)}</p>
        <button className="underline text-(--slate-gray) mt-1" style={{ fontSize: "14px" }} onClick={onClose}>Close</button>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl p-4 space-y-4 font-inter" style={{ background: "var(--warm-cream)" }}>
      <p className="font-fraunces font-semibold text-(--bindr-navy)" style={{ fontSize: "18px" }}>Visit report for {c.name}</p>
      {pets.length > 1 && (
        <fieldset>
          <legend className="font-semibold text-(--charcoal)" style={{ fontSize: "15px" }}>Pets</legend>
          {pets.map((p) => (
            <label key={p.id} className="flex items-center gap-3" style={{ minHeight: 44 }}>
              <input type="checkbox" style={{ width: 20, height: 20 }} checked={chosen.includes(p.id)}
                onChange={(e) => setChosen((list) => e.target.checked ? [...list, p.id] : list.filter((x) => x !== p.id))} />
              <span>{p.name}</span>
            </label>
          ))}
        </fieldset>
      )}
      <div>
        <p className="font-semibold text-(--charcoal)" style={{ fontSize: "15px" }}>What you did today</p>
        {items.length === 0 ? (
          <p className="text-(--slate-gray)" style={{ fontSize: "15px" }}>Nothing checked off by you yet today. Check things off on Today and they&apos;re added here.</p>
        ) : (
          <ul style={{ fontSize: "15px" }} className="text-(--charcoal)">
            {items.map((it, i) => (
              <li key={i}>{it.kind === "feeding" ? "🍽️" : "💊"} {fmtTime(it.time)} · {it.pet} · {it.title}{it.detail ? ` · ${it.detail}` : ""}</li>
            ))}
          </ul>
        )}
      </div>
      <label className="block">
        <span className="block font-semibold text-(--charcoal) mb-1" style={{ fontSize: "15px" }}>Note</span>
        <textarea className="w-full rounded-xl px-4 py-3 text-(--charcoal)" rows={4} maxLength={2000}
          style={{ border: "1px solid var(--mist-gray)", background: "var(--pure-white)", fontSize: "16px" }}
          placeholder="How did it go? Walks, mood, anything the owner should know."
          value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <div>
        <span className="block font-semibold text-(--charcoal) mb-1" style={{ fontSize: "15px" }}>Photos (up to {MAX_REPORT_PHOTOS})</span>
        {previews.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {previews.map((u, i) => (
              <div key={u} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt={`Photo ${i + 1}`} width={72} height={72} className="rounded-lg" style={{ objectFit: "cover", width: 72, height: 72 }} />
                <button aria-label={`Remove photo ${i + 1}`} className="absolute -top-2 -right-2 rounded-full bg-white"
                  style={{ width: 28, height: 28, border: "1px solid var(--mist-gray)" }}
                  onClick={() => setPhotos((list) => list.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
          </div>
        )}
        {photos.length < MAX_REPORT_PHOTOS && (
          <label className="btn-ghost inline-block cursor-pointer" style={{ padding: "10px 16px" }}>
            Add Photos
            <input type="file" accept="image/*" multiple className="sr-only"
              onChange={(e) => {
                const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith("image/"));
                setPhotos((list) => [...list, ...files].slice(0, MAX_REPORT_PHOTOS));
                e.target.value = "";
              }} />
          </label>
        )}
      </div>
      {error && <p style={{ fontSize: "15px", color: "var(--error-red)" }} role="alert">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn-coral" style={{ padding: "10px 16px" }} disabled={busy || picked.length === 0} onClick={send}>
          {busy ? "Sending…" : "Send Report"}
        </button>
        <button className="btn-ghost" style={{ padding: "10px 16px" }} disabled={busy} onClick={onClose}>Cancel</button>
      </div>
      <p className="text-(--slate-gray)" style={{ fontSize: "13px" }}>{c.name} and anyone who co-owns {picked.length === 1 ? "this pet" : "these pets"} get it in PetBindr.</p>
    </div>
  );
}

// MARK: - Pieces

function fmtTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl p-5 md:p-6" style={{ background: "var(--pure-white)", border: "1px solid var(--mist-gray)" }}>
      {title && <h2 className="font-fraunces font-semibold mb-2" style={{ fontSize: "20px", color: "var(--bindr-navy)" }}>{title}</h2>}
      {children}
    </section>
  );
}
