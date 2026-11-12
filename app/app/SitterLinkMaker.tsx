"use client";

// Sending a sitter a link from petbindr.com/app (so a co-owner on Android can
// do it too). Same createSitterLink function as the iPhone app: the server
// checks you own or co-own every pet, never includes home codes, and needs an
// end date within 30 days. The link (a secret after "#") is shown once, to
// copy or share; the list below shows the links you've made, to turn off.
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, where, updateDoc, serverTimestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { firebase } from "./firebase";
import { dayAt, linkMessage } from "./links";

type PetLite = { id: string; name?: string };

// What the sitter sees: the iPhone app's defaults (SharePermissions)
const SEES: { key: string; label: string; on: boolean }[] = [
  { key: "canViewFoodInstructions", label: "Feeding", on: true },
  { key: "canViewMedications", label: "Medications", on: true },
  { key: "canViewAllergies", label: "Allergies", on: true },
  { key: "canViewVetInfo", label: "Vets", on: true },
  { key: "canViewEmergencyContacts", label: "Emergency contacts", on: true },
  { key: "canViewRoutines", label: "Routines", on: true },
  { key: "canViewQuirks", label: "Quirks", on: true },
  { key: "canViewNotes", label: "Notes", on: true },
  { key: "canViewMicrochipInfo", label: "Microchip", on: true },
  { key: "canViewHealthRecords", label: "Health records", on: false },
];

const DAY = 86_400_000;

function inputDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type LinkRow = { linkId: string; sitterName: string; petNames: string[]; endDate: Date | null; opens: number; shareIds: string[] };

export default function SitterLinkMaker({ uid, pets }: { uid: string; pets: PetLite[] }) {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<string[]>(pets.map((p) => p.id));
  const [name, setName] = useState("");
  const [start, setStart] = useState(inputDay(new Date()));
  const [end, setEnd] = useState(inputDay(new Date(Date.now() + 3 * DAY)));
  const [sees, setSees] = useState<Record<string, boolean>>(Object.fromEntries(SEES.map((s) => [s.key, s.on])));
  const [notes, setNotes] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<{ url: string; message: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [links, setLinks] = useState<LinkRow[]>([]);

  // Keep the pet choice in step with the list (pets can load after this mounts)
  useEffect(() => { setChosen((c) => c.length ? c.filter((id) => pets.some((p) => p.id === id)) : pets.map((p) => p.id)); }, [pets]);

  // Links you've made that are still on
  useEffect(() => {
    const { db } = firebase();
    return onSnapshot(query(collection(db, "petShares"), where("ownerId", "==", uid), where("shareType", "==", "link")), (s) => {
      const byLink = new Map<string, LinkRow>();
      for (const d of s.docs) {
        const x = d.data();
        if (x.status !== "active") continue;
        const end = x.endDate?.toDate ? x.endDate.toDate() as Date : null;
        if (end && end < new Date()) continue;
        const row: LinkRow = byLink.get(x.linkId) || { linkId: x.linkId, sitterName: x.sitterName || "Sitter", petNames: [], endDate: end, opens: 0, shareIds: [] };
        row.petNames.push(x.petName || "Pet");
        row.shareIds.push(d.id);
        row.opens = Math.max(row.opens, x.openCount || 0);
        byLink.set(x.linkId, row);
      }
      setLinks([...byLink.values()].sort((a, b) => (a.endDate?.getTime() || 0) - (b.endDate?.getTime() || 0)));
    }, () => {});
  }, [uid]);

  const startDate = dayAt(start, 0);
  const endDate = dayAt(end, 23, 59);
  const days = startDate && endDate ? Math.round((endDate.getTime() - startDate.getTime()) / DAY) : 0;
  const problem = useMemo(() => {
    if (!chosen.length) return "Choose at least one pet.";
    if (!name.trim()) return "Add the sitter's name.";
    if (!startDate || !endDate) return "Choose the dates.";
    if (endDate <= startDate) return "The last day has to be after the first.";
    if (endDate.getTime() < Date.now()) return "The last day has to be in the future.";
    if (days > 30) return "Links can last up to 30 days.";
    return null;
  }, [chosen, name, startDate, endDate, days]);

  async function create() {
    if (problem) { setError(problem); return; }
    setSaving(true);
    setError(null);
    try {
      const permissions = { canViewBasicInfo: true, ...sees };
      const result = await httpsCallable<unknown, { url: string }>(firebase().functions, "createSitterLink")({
        petIds: chosen, sitterName: name.trim(), permissions,
        startDate: Math.max(startDate!.getTime(), Date.now() - 60_000), endDate: endDate!.getTime(),
        notes: notes.trim(), ownerPhone: phone.trim(), showOwnerPhone: !!phone.trim(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      const names = pets.filter((p) => chosen.includes(p.id)).map((p) => p.name || "Pet");
      setMade({ url: result.data.url, message: linkMessage(name, names, result.data.url, notes) });
      setOpen(false);
    } catch (e) {
      setError((e as Error).message || "Couldn't make the link. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { /* select manually */ }
  }

  async function share(text: string) {
    if (navigator.share) {
      try { await navigator.share({ text }); } catch { /* cancelled */ }
    } else {
      copy(text);
    }
  }

  async function turnOff(row: LinkRow) {
    if (!confirm(`Turn off ${row.sitterName}'s link? It stops working right away.`)) return;
    const { db } = firebase();
    try {
      await Promise.all(row.shareIds.map((id) => updateDoc(doc(db, "petShares", id), {
        status: "revoked", revokedAt: serverTimestamp(), updatedAt: serverTimestamp(),
      })));
    } catch {
      alert("Couldn't turn it off. Try again.");
    }
  }

  const input = "w-full rounded-lg px-3 py-2 font-inter text-[var(--charcoal)]";
  const inputStyle = { border: "1px solid var(--mist-gray)", background: "white", fontSize: "16px" };
  const label = "block font-inter text-[var(--slate-gray)] mb-1";

  return (
    <section className="rounded-2xl p-5 md:p-6" style={{ background: "var(--pure-white)", border: "1px solid var(--mist-gray)" }}>
      <h2 className="font-fraunces font-semibold mb-1" style={{ fontSize: "20px", color: "var(--bindr-navy)" }}>Sitter Links</h2>
      <p className="font-inter text-[var(--slate-gray)] mb-3" style={{ fontSize: "15px" }}>
        A page for your sitter with everything they need, and the day&apos;s feedings and meds to check off. No app or account for them.
      </p>

      {made && (
        <div className="rounded-xl p-4 mb-3 font-inter" style={{ background: "#EEF8F9", border: "1px solid var(--bindr-teal)" }}>
          <p className="font-semibold text-[var(--charcoal)] mb-1">Link ready. Send it to {name.trim().split(/\s+/)[0]}:</p>
          <p className="text-[var(--charcoal)] whitespace-pre-line break-words" style={{ fontSize: "15px" }}>{made.message}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <button className="btn-coral" style={{ padding: "10px 16px" }} onClick={() => share(made.message)}>Share</button>
            <button className="btn-ghost" style={{ padding: "10px 16px" }} onClick={() => copy(made.message)}>{copied ? "Copied" : "Copy Message"}</button>
            <button className="btn-ghost" style={{ padding: "10px 16px" }} onClick={() => copy(made.url)}>Copy Link Only</button>
          </div>
          <p className="text-[var(--slate-gray)] mt-2" style={{ fontSize: "13px" }}>Send it now: for safety, the link isn&apos;t shown again. You can make a new one anytime.</p>
        </div>
      )}

      {!open && (
        <button className="btn-coral" style={{ padding: "10px 16px" }} onClick={() => { setOpen(true); setMade(null); setError(null); setName(""); setNotes(""); }}>
          Send a Sitter Link
        </button>
      )}

      {open && (
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); create(); }}>
          {pets.length > 1 && (
            <fieldset>
              <legend className={label} style={{ fontSize: "14px" }}>Pets</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-2 font-inter text-[var(--charcoal)]">
                {pets.map((p) => (
                  <label key={p.id} className="flex items-center gap-2">
                    <input type="checkbox" style={{ width: 18, height: 18 }} checked={chosen.includes(p.id)}
                      onChange={(e) => setChosen((c) => e.target.checked ? [...c, p.id] : c.filter((id) => id !== p.id))} />
                    {p.name || "Pet"}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <div>
            <label className={label} htmlFor="sl-name" style={{ fontSize: "14px" }}>Sitter&apos;s name</label>
            <input id="sl-name" className={input} style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className={label} htmlFor="sl-start" style={{ fontSize: "14px" }}>First day</label>
              <input id="sl-start" type="date" className={input} style={inputStyle} value={start} min={inputDay(new Date())} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="flex-1">
              <label className={label} htmlFor="sl-end" style={{ fontSize: "14px" }}>Last day</label>
              <input id="sl-end" type="date" className={input} style={inputStyle} value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <fieldset>
            <legend className={label} style={{ fontSize: "14px" }}>What they can see (home codes are never included in a link)</legend>
            <div className="grid grid-cols-2 gap-y-2 gap-x-4 font-inter text-[var(--charcoal)]">
              {SEES.map((s) => (
                <label key={s.key} className="flex items-center gap-2">
                  <input type="checkbox" style={{ width: 18, height: 18 }} checked={!!sees[s.key]}
                    onChange={(e) => setSees((v) => ({ ...v, [s.key]: e.target.checked }))} />
                  {s.label}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label className={label} htmlFor="sl-notes" style={{ fontSize: "14px" }}>What&apos;s different this time (optional)</label>
            <textarea id="sl-notes" className={input} style={inputStyle} rows={2} value={notes} placeholder="e.g. Trash goes out Tuesday" onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="sl-phone" style={{ fontSize: "14px" }}>Your phone, shown to the sitter (optional)</label>
            <input id="sl-phone" type="tel" className={input} style={inputStyle} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          {error && <p className="font-inter" style={{ fontSize: "14px", color: "var(--error-red)" }} role="alert">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn-coral" style={{ padding: "10px 18px" }} disabled={saving}>{saving ? "Making the link…" : "Make the Link"}</button>
            <button type="button" className="btn-ghost" style={{ padding: "10px 16px" }} onClick={() => setOpen(false)} disabled={saving}>Cancel</button>
          </div>
        </form>
      )}

      {links.length > 0 && (
        <div className="mt-5">
          <h3 className="font-semibold uppercase tracking-wide text-[var(--slate-gray)] mb-2 font-inter" style={{ fontSize: "13px" }}>Your links</h3>
          <ul className="space-y-2 font-inter">
            {links.map((l) => (
              <li key={l.linkId} className="flex items-center justify-between gap-3">
                <span className="text-[var(--charcoal)]">
                  <span className="font-semibold">{l.sitterName}</span>
                  <span className="text-[var(--slate-gray)]" style={{ fontSize: "14px" }}>
                    {" "}· {l.petNames.join(", ")}{l.endDate ? ` · until ${l.endDate.toLocaleDateString([], { month: "short", day: "numeric" })}` : ""} · {l.opens ? `opened ${l.opens}×` : "not opened yet"}
                  </span>
                </span>
                <button className="underline shrink-0" style={{ color: "var(--error-red)", fontSize: "14px" }} onClick={() => turnOff(l)}>Turn off</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
