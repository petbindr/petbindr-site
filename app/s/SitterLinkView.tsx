"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Cloud Functions base (override for local testing against the emulator)
const FUNCTIONS_URL =
  process.env.NEXT_PUBLIC_PETBINDR_FUNCTIONS_URL || "https://us-central1-petbindr-2d4bd.cloudfunctions.net";
const REFRESH_MS = 5 * 60 * 1000;

// Feedings also say how much was eaten ("some" / "none"; null = all of it)
// and whether this link made the check-off, so it can change the amount
type Amount = "some" | "none" | null;
// skipped: the owner marked this dose "Not given" (nothing to give)
// undoUntil: this link's own check-off, which it can undo until then (5 minutes)
type Done = { by: string; at: string; amount?: Amount; canChange?: boolean; skipped?: boolean; undoUntil?: string } | null;
// Medications also carry how to give it and the owner's photo, for the "Give it now" panel
type TodayItem = {
  kind: "feeding" | "medication"; id: string; title: string; detail: string | null; due: string; done: Done;
  howTo?: string | null; photo?: string | null;
};
type Vet = { role: string; name: string; vetName: string | null; phone: string | null; address: string | null };
type Pet = {
  id: string;
  name: string;
  species: string | null;
  breed: string | null;
  birthday: string | null;
  photo: string | null;
  feeding: {
    foodName: string | null; defaultPortion: string | null; specialBowl: string | null; feedingLocation: string | null;
    specialInstructions: string | null; instructions: string | null;
    times: { id: string; time: string; meal: string; portion: string | null; notes: string | null }[];
  } | null;
  medications: { id: string; name: string; dosage: string | null; frequency: string | null; notes: string | null; times: string[] }[] | null;
  allergies: { name: string; severity: string | null; symptoms: string | null; notes: string | null }[] | null;
  quirks: string | null;
  notes: string | null;
  routines: Record<string, string | null> | null;
  vets: Vet[] | null;
  microchip?: { number: string; provider: string | null; registryPhone: string | null } | null;
  today: TodayItem[];
  // Medication photos, once per medication (not copied onto every dose)
  medicationPhotos?: Record<string, string>;
};
type LinkData =
  | {
      state: "active"; sitterName: string; ownerName: string; ownerPhone: string | null; timeZone: string;
      helper?: boolean; // a household helper's chores page ("Emma feeds the hamster"): feedings only, no end date
      notes?: string | null; // "What's different this time", from the owner's trip setup
      // The week before the sit: a read-only look at the routine (no check-offs or updates yet)
      startsAt?: string | null;
      endDate: string | null; now: string; pets: Pet[];
      emergencyContacts: { name: string; relationship: string | null; phone: string }[] | null;
    }
  | {
      state: "notFound" | "turnedOff" | "expired" | "notStarted"; ownerName: string | null; sitterName: string | null;
      startDate: string | null; timeZone?: string | null;
      // Why it was turned off, when it wasn't simply the sender's choice
      reason?: "noLongerOwner" | null;
    };

const OFFLINE_MESSAGE = "Couldn't reach PetBindr. Check your connection and try again.";

async function callFunction<T>(name: string, data: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${FUNCTIONS_URL}/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
      referrerPolicy: "no-referrer",
    });
  } catch {
    // No signal or the request was blocked: the browser's own text ("Load failed",
    // "Failed to fetch") meant nothing to a sitter standing next to the pet
    throw new Error(OFFLINE_MESSAGE);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    // Unexpected server errors come back as the bare word "INTERNAL"
    const status = json?.error?.status;
    const friendly = status && !["INTERNAL", "UNAVAILABLE", "UNKNOWN", "DEADLINE_EXCEEDED"].includes(status);
    const err = new Error(friendly && json.error.message ? json.error.message : "Something went wrong. Please try again.");
    (err as Error & { status?: string }).status = status;
    throw err;
  }
  return json.result as T;
}

const firstName = (name: string | null | undefined) => (name || "").trim().split(/\s+/)[0] || "the owner";
const telHref = (phone: string) => `tel:${phone.replace(/[^0-9+]/g, "")}`;

function fmtTime(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}
function fmtDay(iso: string, timeZone?: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric" }).format(new Date(iso));
}
/** "The sit starts …", and when the early look opens if that's still ahead (in
 * a rare case, such as the pet changing owners, the page stays closed after it) */
function notStartedText(startDate: string | null, timeZone?: string) {
  if (!startDate) return "It starts soon. Check back then.";
  const lookFrom = Date.parse(startDate) - 7 * 86400000;
  const starts = `The sit starts ${fmtDay(startDate, timeZone)}.`;
  return lookFrom > Date.now()
    ? `${starts} You can see the routine here from ${fmtDay(new Date(lookFrom).toISOString(), timeZone)}.`
    : `${starts} Check back then.`;
}
function ageText(birthday: string | null) {
  if (!birthday) return null;
  const b = new Date(birthday);
  const now = new Date();
  let months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
  if (now.getDate() < b.getDate()) months--;
  if (months < 0) return null;
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} old`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"} old`;
}

/** A pet with feeding shared but nothing filled in shouldn't show an empty heading */
function hasFeedingInfo(f: NonNullable<Pet["feeding"]>) {
  return Boolean(f.foodName || f.defaultPortion || f.specialBowl || f.feedingLocation ||
    f.specialInstructions || f.instructions || f.times.length);
}

const ROUTINE_LABELS: Record<string, string> = {
  morningRoutine: "Morning", eveningRoutine: "Evening", dailyHabits: "Daily habits",
  stressIndicators: "Signs of stress", calmingTechniques: "What calms them", socialBehavior: "With people and other pets",
};

export default function SitterLinkView() {
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<LinkData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastLoaded, setLastLoaded] = useState<number | null>(null);
  const loading = useRef(false);
  const again = useRef(false);
  const havePhotos = useRef(false);

  // One load at a time. A load asked for meanwhile (a check-off just saved) runs
  // right after, so a reply read before the save can't put "Done" back to not done
  // (it was dropped, and the red "give it now" came back for a dose just given).
  // Photos come once; refreshes keep them (they were re-sent every 5 minutes).
  const load = useCallback(async (link: string) => {
    if (loading.current) { again.current = true; return; }
    loading.current = true;
    try {
      do {
        again.current = false;
        try {
          const fresh = await callFunction<LinkData>("getSitterLink", { link, v: 2, photos: !havePhotos.current });
          setData((prev) => {
            if (fresh.state !== "active" || !havePhotos.current || !prev || prev.state !== "active") return fresh;
            const before = new Map(prev.pets.map((p) => [p.id, p]));
            return { ...fresh, pets: fresh.pets.map((p) => ({
              ...p, photo: before.get(p.id)?.photo ?? null, medicationPhotos: before.get(p.id)?.medicationPhotos,
            })) };
          });
          if (fresh.state === "active") havePhotos.current = true;
          setLoadError(null);
          setLastLoaded(Date.now());
        } catch (e) {
          setLoadError((e as Error).message);
        }
      } while (again.current);
    } finally {
      loading.current = false;
    }
  }, []);

  useEffect(() => {
    // Just the link's own 43 characters: a "." or ")" picked up when copying broke it
    const raw = window.location.hash.replace(/^#/, "");
    const link = raw.match(/^[A-Za-z0-9_-]{43}/)?.[0] ?? raw;
    setToken(link);
    if (!link) {
      setData({ state: "notFound", ownerName: null, sitterName: null, startDate: null });
      return;
    }
    load(link);
    // Coming back to the page later: show what's been done since
    const onVisible = () => document.visibilityState === "visible" && load(link);
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(() => load(link), REFRESH_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, [load]);

  if (!data) {
    return loadError ? (
      <Message heading="Couldn't load this page" text={loadError}>
        <button className="btn-coral" onClick={() => token && load(token)}>Try Again</button>
      </Message>
    ) : (
      <p className="font-inter text-[var(--slate-gray)] text-center py-20">Loading pet care info…</p>
    );
  }

  if (data.state !== "active") {
    const owner = firstName(data.ownerName);
    const texts = {
      notFound: ["This link isn't working", "It may be incomplete. Try opening it again from the original message, or ask the person who sent it for a new one."],
      turnedOff: ["This link was turned off", `${owner} turned off this link. If you still need the info, ask ${owner} for a new one.`],
      expired: ["This link has ended", `The sit is over, so this link no longer works. Thanks for taking care of things! Ask ${owner} if you need it again.`],
      notStarted: ["This link isn't active yet", notStartedText(data.startDate, data.timeZone || undefined)],
    } as const;
    // Whoever sent it is no longer one of the pet's owners (removed as a
    // co-owner, or the pet was handed over): they didn't turn it off and can't
    // send a new one, so don't say so (2026-11-18)
    const [heading, text] = data.state === "turnedOff" && data.reason === "noLongerOwner"
      ? ["This link no longer works", `${data.ownerName ? owner : "The person who sent it"} is no longer one of the pet's owners, so the link they sent stopped working. If you're still caring for the pet, ask its owner for a new link.`]
      : texts[data.state];
    return <Message heading={heading} text={text} />;
  }

  return (
    <>
      {loadError && (
        // A refresh failed: what's shown may be out of date (it used to say nothing)
        <p className="font-inter text-center rounded-xl p-2 mb-3" role="status"
          style={{ fontSize: "0.875rem", background: "#FFF4E5", color: "#7A4A00" }}>
          Couldn&rsquo;t refresh{lastLoaded ? `, showing what was here at ${new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(lastLoaded)}` : ""}.{" "}
          <button className="underline" onClick={() => token && load(token)}>Try again</button>
        </p>
      )}
      <ActiveLink data={data} token={token!} onChanged={() => token && load(token)} />
    </>
  );
}

function ActiveLink({ data, token, onChanged }: { data: Extract<LinkData, { state: "active" }>; token: string; onChanged: () => void }) {
  const owner = firstName(data.ownerName);
  const tz = data.timeZone;
  const petNames = data.pets.map((p) => p.name);
  const namesText = petNames.length <= 2 ? petNames.join(" and ") : `${petNames.slice(0, -1).join(", ")}, and ${petNames.at(-1)}`;

  // Vets across pets, without repeats: emergency vets first, then the regular
  // vet (often the first call during the day; it was left out, review item 19)
  const emergencyVets: Vet[] = [];
  const byRole = (v: Vet) => (v.role === "Emergency vet" ? 0 : v.role === "Regular vet" ? 2 : 1);
  for (const vet of data.pets.flatMap((p) => p.vets || []).sort((a, b) => byRole(a) - byRole(b))) {
    if (!emergencyVets.some((v) => v.name === vet.name && v.phone === vet.phone)) emergencyVets.push(vet);
  }
  const contacts = data.emergencyContacts || [];
  const startsAt = data.startsAt || null;

  return (
    <div className="space-y-6">
      <header className="text-center space-y-3">
        <div className="flex justify-center -space-x-3">
          {data.pets.map((p) => (
            <PetPhoto key={p.id} pet={p} size={72} />
          ))}
        </div>
        <h1 className="font-fraunces font-semibold text-[var(--bindr-navy)]" style={{ fontSize: "clamp(1.625rem, 6vw, 2.125rem)" }}>
          {data.helper ? (data.sitterName?.trim() ? `Hi ${data.sitterName.trim()}!` : "Hi!") : <>Caring for {namesText}</>}
        </h1>
        {data.helper ? (
          // (Not before the start: there are no chores to tap yet, 2026-11-18 review)
          !startsAt && (
            <p className="font-inter text-[var(--charcoal)]" style={{ fontSize: "1rem" }}>
              Here are today&apos;s chores for {namesText}. Tap each one when it&apos;s done, so {owner} knows.
            </p>
          )
        ) : (
          <p className="font-inter text-[var(--charcoal)]" style={{ fontSize: "1rem" }}>
            {data.sitterName?.trim() ? `Hi ${data.sitterName.trim()}! ` : "Hi! "}{owner} shared everything you need here
            {data.endDate ? <>, through <strong>{fmtDay(data.endDate, tz)}</strong></> : null}.
          </p>
        )}
        {data.ownerPhone && (
          <a href={telHref(data.ownerPhone)} className="btn-coral" style={{ textDecoration: "none" }}>
            Call {owner}
          </a>
        )}
      </header>

      {startsAt && (
        <Card title={`Starts ${fmtDay(startsAt, tz)}`} tone="note">
          <p className="font-inter text-[var(--charcoal)]" style={{ fontSize: "1rem" }}>
            {data.helper
              ? <>Here&rsquo;s an early look at the chores for {namesText}. You can tap them off from {fmtDay(startsAt, tz)}.</>
              : <>Here&rsquo;s an early look at the routine so you can get ready. Checking off meals and doses, and
                sending {owner} updates, start {fmtDay(startsAt, tz)}.</>}
          </p>
        </Card>
      )}

      {data.notes && (
        <Card title="This time" tone="note">
          <p className="font-inter text-[var(--charcoal)] whitespace-pre-line" style={{ fontSize: "1rem" }}>
            {data.notes}
          </p>
          <p className="font-inter text-[var(--slate-gray)] mt-2" style={{ fontSize: "0.875rem" }}>
            From {owner}
          </p>
        </Card>
      )}

      {data.pets.some((p) => p.today.length > 0) && (
        <Card title={data.helper ? `Today's chores, ${fmtDay(data.now, tz)}` : `Today, ${fmtDay(data.now, tz)}`}>
          <div className="space-y-5">
            {data.pets.filter((p) => p.today.length > 0).map((pet) => (
              <div key={pet.id}>
                {data.pets.length > 1 && <p className="font-inter font-semibold text-[var(--bindr-navy)] mb-2">{pet.name}</p>}
                <ul className="divide-y divide-[var(--mist-gray)]">
                  {pet.today.map((item) => (
                    <TodayRow key={`${item.kind}-${item.id}-${item.due}`} item={item} pet={pet} tz={tz} token={token} onChanged={onChanged} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Not on helper links: they're often for kids, and the privacy policy says
          they collect only check-offs (2026-11-18 review, item 18) */}
      {!startsAt && !data.helper && <SendUpdateCard data={data} token={token} owner={owner} />}

      {(emergencyVets.length > 0 || contacts.length > 0) && (
        <Card title="In an emergency" tone="alert">
          <ul className="space-y-3">
            {emergencyVets.map((v) => (
              <ContactRow key={`${v.name}-${v.phone}`} title={v.name} subtitle={[v.role, v.address].filter(Boolean).join(" · ")} phone={v.phone} />
            ))}
            {contacts.map((c) => (
              <ContactRow key={`${c.name}-${c.phone}`} title={c.name} subtitle={c.relationship} phone={c.phone} />
            ))}
          </ul>
        </Card>
      )}

      {data.helper && !startsAt && !data.pets.some((p) => p.today.length > 0) && (
        <Card title={`Today's chores, ${fmtDay(data.now, tz)}`}>
          <p className="font-inter text-[var(--charcoal)]">Nothing to do today.</p>
        </Card>
      )}

      {data.pets.map((pet) => (
        <PetCard key={pet.id} pet={pet} />
      ))}

      <footer className="text-center space-y-3 pt-2 pb-6">
        <p className="font-inter text-[var(--slate-gray)]" style={{ fontSize: "0.875rem" }}>
          Shared with PetBindr. Only {owner} can change what you see here.
        </p>
        {/* "Get the PetBindr app…" went to a waitlist for an app that isn't
            out yet (review panel 2026-11-14): say what it is honestly */}
        {!data.helper && (
          <p className="font-inter text-[var(--slate-gray)]" style={{ fontSize: "0.875rem" }}>
            Have a pet of your own? PetBindr for iPhone is coming soon.{" "}
            <a href="https://www.petbindr.com/#get-notified" className="text-[var(--bindr-navy)] underline">Get notified</a>
          </p>
        )}
      </footer>
    </div>
  );
}

// ---------- Send an update (note + photos) ----------

const MAX_UPDATE_PHOTOS = 4;
const MAX_NOTE = 1000;

/** A photo from the phone, shrunk to a JPEG data URL (at most 1600px on its long side) */
async function shrinkPhoto(file: File): Promise<string> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("That photo couldn't be opened. Try a different one.");
  }
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("That photo couldn't be opened. Try a different one.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  let url = canvas.toDataURL("image/jpeg", 0.8);
  if (url.length > 2_800_000) url = canvas.toDataURL("image/jpeg", 0.6);
  return url;
}

function SendUpdateCard({ data, token, owner }: { data: Extract<LinkData, { state: "active" }>; token: string; owner: string }) {
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [petIds, setPetIds] = useState<string[]>(() => data.pets.map((p) => p.id));
  const [busy, setBusy] = useState<"photos" | "sending" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function addPhotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setSent(false);
    const room = MAX_UPDATE_PHOTOS - photos.length;
    if (files.length > room) setError(`You can send up to ${MAX_UPDATE_PHOTOS} photos at a time.`);
    setBusy("photos");
    try {
      const added: string[] = [];
      for (const file of Array.from(files).slice(0, Math.max(0, room))) added.push(await shrinkPhoto(file));
      setPhotos((p) => [...p, ...added].slice(0, MAX_UPDATE_PHOTOS));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function send() {
    setError(null);
    setBusy("sending");
    try {
      await callFunction("sitterLinkSendUpdate", { link: token, note, photos, petIds });
      setNote("");
      setPhotos([]);
      setSent(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const togglePet = (id: string) =>
    setPetIds((ids) => (ids.includes(id) ? (ids.length > 1 ? ids.filter((x) => x !== id) : ids) : [...ids, id]));
  const canSend = (note.trim().length > 0 || photos.length > 0) && petIds.length > 0 && !busy;

  return (
    <Card title={`Send ${owner} an update`}>
      <div className="space-y-3">
        <p className="font-inter text-[var(--slate-gray)]" style={{ fontSize: "0.875rem" }}>
          A note and photos go straight to {owner} in PetBindr, with what you&rsquo;ve checked off today.
        </p>
        {data.pets.length > 1 && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Which pets is this about?">
            {data.pets.map((p) => {
              const on = petIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => togglePet(p.id)}
                  aria-pressed={on}
                  className="font-inter rounded-full"
                  style={{
                    fontSize: "0.9375rem", padding: "6px 14px", minHeight: 36,
                    border: `1.5px solid ${on ? "var(--bindr-navy)" : "var(--mist-gray)"}`,
                    background: on ? "var(--bindr-navy)" : "white", color: on ? "white" : "var(--charcoal)",
                  }}
                >
                  {on ? "✓ " : ""}{p.name}
                </button>
              );
            })}
          </div>
        )}
        <label className="block">
          <span className="sr-only">Your note</span>
          <textarea
            className="email-input w-full"
            style={{ minHeight: 96, resize: "vertical", fontSize: "1rem" }}
            maxLength={MAX_NOTE}
            placeholder={data.helper ? "How did it go?" : `How are things going? e.g. "Long walk, ate everything, napping now."`}
            value={note}
            onChange={(e) => { setNote(e.target.value); setSent(false); }}
          />
        </label>
        {photos.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {photos.map((src, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`Photo ${i + 1}`} className="rounded-xl object-cover" style={{ width: 84, height: 84 }} />
                <button
                  type="button"
                  onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                  className="absolute -top-2 -right-2 rounded-full bg-white font-inter"
                  style={{ width: 28, height: 28, border: "1.5px solid var(--mist-gray)", fontSize: "0.875rem" }}
                  aria-label={`Remove photo ${i + 1}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => addPhotos(e.target.files)}
          />
          {photos.length < MAX_UPDATE_PHOTOS && (
            <button type="button" className="btn-ghost" style={{ padding: "10px 16px" }} onClick={() => fileInput.current?.click()} disabled={!!busy}>
              {busy === "photos" ? "Adding…" : photos.length ? "Add another photo" : "Add photos"}
            </button>
          )}
          <button type="button" className="btn-coral" style={{ padding: "10px 18px" }} onClick={send} disabled={!canSend}>
            {busy === "sending" ? "Sending…" : "Send update"}
          </button>
        </div>
        {sent && (
          <p className="font-inter" style={{ fontSize: "0.9375rem", color: "var(--success-green)" }} role="status">
            ✓ Sent. {owner} will see it in PetBindr.
          </p>
        )}
        {error && <p className="font-inter" style={{ fontSize: "0.875rem", color: "var(--error-red)" }} role="alert">{error}</p>}
      </div>
    </Card>
  );
}

const AMOUNT_TEXT: Record<"all" | "some" | "none", string> = { all: "Ate it all", some: "Ate some", none: "Didn't eat" };

/** A dose tapped more than this long before it's due asks "Give it now?" first */
const EARLY_DOSE_MS = 2 * 60 * 60_000;

function TodayRow({ item, pet, tz, token, onChanged }: { item: TodayItem; pet: Pet; tz: string; token: string; onChanged: () => void }) {
  const [done, setDone] = useState<Done>(item.done);
  const [confirming, setConfirming] = useState(false);
  // The dose being confirmed is more than EARLY_DOSE_MS away (2026-11-17, review:
  // any of today's doses could be marked given in the morning, and the evening
  // sitter then saw "Done" and skipped tonight's)
  const [early, setEarly] = useState(false);
  // Feeding: showing the Ate some / Didn't eat choices (before or after checking off)
  const [choosing, setChoosing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isFeeding = item.kind === "feeding";
  // "Give it now": a dose from 30 minutes before it's due until it's given
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (isFeeding || done) return;
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, [isFeeding, done]);
  const dueAt = Date.parse(item.due);
  const giveNow = !isFeeding && !done && dueAt - 30 * 60_000 <= now;
  const overdue = giveNow && dueAt < now - 5 * 60_000;

  useEffect(() => setDone(item.done), [item.done]);
  // Undo for this link's own check-off, for 5 minutes (a tap on the wrong pet or meal)
  const undoUntil = done?.undoUntil ? Date.parse(done.undoUntil) : 0;
  const [canUndo, setCanUndo] = useState(false);
  useEffect(() => {
    const left = undoUntil - Date.now();
    setCanUndo(left > 0);
    if (left <= 0) return;
    const t = setTimeout(() => setCanUndo(false), left);
    return () => clearTimeout(t);
  }, [undoUntil]);

  async function undo() {
    setSaving(true);
    setError(null);
    try {
      await callFunction("sitterLinkCheckOff", {
        link: token, petId: pet.id, kind: item.kind, itemId: item.id, due: Date.parse(item.due), undo: true,
      });
      setDone(null);
      setChoosing(false);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
      onChanged();
    } finally {
      setSaving(false);
    }
  }
  useEffect(() => {
    if (!confirming) return;
    // Longer to read the early-dose warning
    const t = setTimeout(() => setConfirming(false), early ? 15000 : 4000);
    return () => clearTimeout(t);
  }, [confirming, early]);

  async function save(amount?: "all" | "some" | "none", change = false) {
    setConfirming(false);
    setSaving(true);
    setError(null);
    try {
      const result = await callFunction<{ done: Done }>("sitterLinkCheckOff", {
        link: token, petId: pet.id, kind: item.kind, itemId: item.id, due: Date.parse(item.due),
        ...(amount ? { amount } : {}), ...(change ? { change: true } : {}),
      });
      setDone(result.done);
      setChoosing(false);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
      // Link ended, or the page is out of date (e.g. after midnight): reload it
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  function markDone() {
    // A medication is easy to tap by accident and matters more: ask once more
    if (item.kind === "medication" && !confirming) {
      setEarly(dueAt - Date.now() > EARLY_DOSE_MS);
      setConfirming(true);
      return;
    }
    save();
  }

  const skipped = !isFeeding && done?.skipped === true;
  const photo = item.photo ?? pet.medicationPhotos?.[item.id] ?? null;
  const doneAmount: "all" | "some" | "none" = done?.amount || "all";
  // ✓ ate it all (and every medication), ◐ ate some, ✕ didn't eat
  // Darker than --alert-amber so the text is readable on white
  const doneColor = isFeeding && doneAmount !== "all" ? "#9C5F0E" : "var(--success-green)";
  const doneMark = !isFeeding || doneAmount === "all" ? "✓" : doneAmount === "some" ? "◐" : "✕";
  // Before checking off: the two that aren't plain Done. After: the other two.
  const choices = (done ? (["all", "some", "none"] as const).filter((a) => a !== doneAmount) : (["some", "none"] as const));

  return (
    <li
      className={giveNow ? "my-2 rounded-2xl p-3" : "py-3"}
      style={giveNow ? { border: `2px solid ${overdue ? "var(--error-red)" : "var(--bindr-teal)"}`, background: "white" } : undefined}
    >
      {giveNow && (
        <p className="font-inter font-semibold mb-1" style={{ fontSize: "0.875rem", color: overdue ? "var(--error-red)" : "var(--bindr-navy)" }}>
          {overdue ? `Overdue since ${fmtTime(item.due, tz)}: give it now` : `Time to give ${pet.name} this`}
        </p>
      )}
      {/* Wraps when the phone's text is big: time, then what, then Done, one per line */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-16 shrink-0 font-inter text-[var(--slate-gray)]" style={{ fontSize: "0.875rem" }}>
          {fmtTime(item.due, tz)}
        </div>
        <div className="flex-1 min-w-[8rem]">
          <p className="font-inter font-semibold text-[var(--charcoal)]">
            {item.kind === "medication" ? "💊 " : "🍽️ "}
            {item.title}
          </p>
          {item.detail && (
            <p className="font-inter" style={giveNow ? { fontSize: "1.125rem", fontWeight: 600, color: "var(--charcoal)" } : { fontSize: "0.875rem", color: "var(--slate-gray)" }}>
              {item.detail}
            </p>
          )}
          {skipped && done && (
            <p className="font-inter" style={{ fontSize: "0.875rem", color: "var(--slate-gray)" }}>
              Skipped: {done.by} marked this dose as not given. Don&rsquo;t give it.
            </p>
          )}
          {done && !skipped && (
            <p className="font-inter" style={{ fontSize: "0.875rem", color: doneColor }}>
              {doneMark} {isFeeding && doneAmount !== "all" ? `${AMOUNT_TEXT[doneAmount]} · ` : "Done "}
              {isFeeding && doneAmount !== "all" ? "" : "by "}
              {done.by} at {fmtTime(done.at, tz)}
            </p>
          )}
          {done && !skipped && canUndo && !saving && (
            <button
              className="block text-left font-inter underline text-[var(--bindr-navy)]"
              style={{ fontSize: "0.875rem", padding: "4px 0" }}
              onClick={undo}
            >
              Undo
            </button>
          )}
          {isFeeding && !choosing && !saving && (!done || done.canChange) && (
            <button
              className="block text-left font-inter underline text-[var(--bindr-navy)]"
              style={{ fontSize: "0.875rem", padding: "4px 0" }}
              onClick={() => setChoosing(true)}
            >
              {done ? "Change how much" : "Ate some or didn't eat?"}
            </button>
          )}
          {confirming && early && !done && (
            <p className="font-inter font-semibold" style={{ fontSize: "0.875rem", color: "var(--error-red)" }} role="alert">
              This dose is for {fmtTime(item.due, tz)}, not now. Only tap Give it now if you&rsquo;re giving it early on purpose.
            </p>
          )}
          {error && <p className="font-inter" style={{ fontSize: "0.875rem", color: "var(--error-red)" }} role="alert">{error}</p>}
        </div>
        {!done && (
          <button
            className="btn-coral shrink-0"
            style={{ padding: "10px 16px", minWidth: "5.75rem", ...(confirming ? { backgroundColor: "var(--bindr-navy)" } : {}) }}
            onClick={markDone}
            disabled={saving}
            aria-label={isFeeding ? `${item.title}: done, ate it all` : undefined}
          >
            {saving ? "Saving…" : confirming ? (early ? "Give it now" : "Tap to confirm") : "Done"}
          </button>
        )}
      </div>
      {giveNow && (item.howTo || photo) && (
        <div className="mt-2 space-y-2">
          {item.howTo && (
            <p className="font-inter text-[var(--charcoal)] whitespace-pre-line" style={{ fontSize: "1rem" }}>{item.howTo}</p>
          )}
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt={`How to give ${item.title}`} className="rounded-xl w-full" style={{ maxHeight: 260, objectFit: "contain" }} />
          )}
        </div>
      )}
      {isFeeding && choosing && (
        <div className="flex flex-wrap items-center gap-2 mt-2 sm:pl-[76px]">
          {choices.map((a) => (
            <button
              key={a}
              className="btn-ghost"
              style={{ padding: "8px 14px", fontSize: "0.9375rem" }}
              onClick={() => save(a, !!done)}
              disabled={saving}
            >
              {AMOUNT_TEXT[a]}
            </button>
          ))}
          <button
            className="font-inter text-[var(--slate-gray)]"
            style={{ fontSize: "0.875rem", padding: "8px 6px" }}
            onClick={() => setChoosing(false)}
            disabled={saving}
          >
            Cancel
          </button>
        </div>
      )}
    </li>
  );
}

/** "Every Other Day" -> "Every other day" */
function frequencyText(frequency: string | null): string | null {
  if (!frequency) return null;
  return frequency.charAt(0).toUpperCase() + frequency.slice(1).toLowerCase();
}

function PetCard({ pet }: { pet: Pet }) {
  const about = [pet.breed || pet.species, ageText(pet.birthday)].filter(Boolean).join(" · ");
  const routineEntries = Object.entries(pet.routines || {}).filter(([, v]) => v);
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-4 mb-5">
        <PetPhoto pet={pet} size={64} />
        <div className="min-w-0">
          <h2 className="font-fraunces font-semibold text-[var(--bindr-navy)]" style={{ fontSize: "1.5rem" }}>{pet.name}</h2>
          {about && <p className="font-inter text-[var(--slate-gray)]">{about}</p>}
        </div>
      </div>

      <div className="space-y-5">
        {pet.allergies && pet.allergies.length > 0 && (
          <Section title="⚠️ Allergies" alert>
            <ul className="space-y-1">
              {pet.allergies.map((a) => (
                <li key={a.name}>
                  <strong>{a.name}</strong>
                  {a.severity ? ` (${a.severity})` : ""}
                  {a.symptoms ? `: ${a.symptoms}` : ""}
                  {a.notes && <p style={{ fontSize: "0.875rem" }}>{a.notes}</p>}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {pet.feeding && hasFeedingInfo(pet.feeding) && (
          <Section title="Feeding">
            {pet.feeding.foodName && <p><strong>{pet.feeding.foodName}</strong>{pet.feeding.defaultPortion ? `, ${pet.feeding.defaultPortion}` : ""}</p>}
            {pet.feeding.times.length > 0 && (
              <ul className="mt-1">
                {pet.feeding.times.map((t) => (
                  <li key={t.id}>{t.time}: {t.portion || pet.feeding?.defaultPortion || t.meal}{t.notes ? ` (${t.notes})` : ""}</li>
                ))}
              </ul>
            )}
            <Detail label="Bowl" value={pet.feeding.specialBowl} />
            <Detail label="Where" value={pet.feeding.feedingLocation} />
            <Detail label="Special instructions" value={pet.feeding.specialInstructions} />
            <Detail label="Notes" value={pet.feeding.instructions} />
          </Section>
        )}

        {pet.medications && pet.medications.length > 0 && (
          <Section title="Medications">
            <ul className="space-y-2">
              {pet.medications.map((m) => (
                <li key={m.id}>
                  <strong>{m.name}</strong>{m.dosage ? `, ${m.dosage}` : ""}
                  {/* How often: an every-other-day med read as daily (review item 19) */}
                  {(m.frequency || m.times.length > 0) && (
                    <span className="text-[var(--slate-gray)]"> · {[frequencyText(m.frequency), m.times.join(", ")].filter(Boolean).join(", ")}</span>
                  )}
                  {m.notes && <p className="text-[var(--slate-gray)]" style={{ fontSize: "0.875rem" }}>{m.notes}</p>}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {pet.quirks && <Section title="Good to know"><p className="whitespace-pre-line">{pet.quirks}</p></Section>}

        {routineEntries.length > 0 && (
          <Section title="Routines">
            {routineEntries.map(([key, value]) => <Detail key={key} label={ROUTINE_LABELS[key] || key} value={value} />)}
          </Section>
        )}

        {pet.notes && <Section title="Notes"><p className="whitespace-pre-line">{pet.notes}</p></Section>}

        {pet.microchip && (
          <Section title="Microchip">
            <p><strong>{pet.microchip.number}</strong>{pet.microchip.provider ? ` (${pet.microchip.provider})` : ""}</p>
            {pet.microchip.registryPhone && (
              <p>Registry: <a href={telHref(pet.microchip.registryPhone)} className="text-[var(--bindr-navy)] underline">{pet.microchip.registryPhone}</a></p>
            )}
          </Section>
        )}

        {pet.vets && pet.vets.length > 0 && (
          <Section title="Vets">
            <ul className="space-y-3">
              {pet.vets.map((v) => (
                <ContactRow key={`${v.role}-${v.name}`} title={v.name} subtitle={[v.role, v.vetName, v.address].filter(Boolean).join(" · ")} phone={v.phone} />
              ))}
            </ul>
          </Section>
        )}
      </div>
    </Card>
  );
}

function Card({ title, tone, children }: { title?: string; tone?: "alert" | "note"; children: React.ReactNode }) {
  return (
    <section
      className="rounded-2xl p-5 md:p-6"
      style={{
        background: tone === "alert" ? "#FDECEA" : tone === "note" ? "#E8F4F3" : "var(--pure-white)",
        border: "1px solid var(--mist-gray)",
      }}
    >
      {title && (
        <h2
          className="font-fraunces font-semibold mb-3"
          style={{ fontSize: "1.25rem", color: tone === "alert" ? "var(--error-red)" : "var(--bindr-navy)" }}
        >
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

function Section({ title, alert, children }: { title: string; alert?: boolean; children: React.ReactNode }) {
  return (
    <div className="font-inter text-[var(--charcoal)] leading-relaxed" style={{ fontSize: "1rem" }}>
      <h3 className="font-semibold mb-1" style={{ color: alert ? "var(--error-red)" : "var(--bindr-navy)" }}>{title}</h3>
      {children}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <p className="mt-1">
      <span className="text-[var(--slate-gray)]">{label}: </span>
      <span className="whitespace-pre-line">{value}</span>
    </p>
  );
}

function ContactRow({ title, subtitle, phone }: { title: string; subtitle?: string | null; phone: string | null }) {
  return (
    <li className="flex flex-wrap items-center gap-3 font-inter">
      <div className="flex-1 min-w-[8rem]">
        <p className="font-semibold text-[var(--charcoal)]">{title}</p>
        {subtitle && <p className="text-[var(--slate-gray)]" style={{ fontSize: "0.875rem" }}>{subtitle}</p>}
      </div>
      {phone && (
        <a
          href={telHref(phone)}
          className="shrink-0 rounded-full px-4 py-2 font-semibold"
          style={{ background: "var(--bindr-navy)", color: "#fff", fontSize: "0.875rem", textDecoration: "none" }}
        >
          Call
        </a>
      )}
    </li>
  );
}

function PetPhoto({ pet, size }: { pet: Pet; size: number }) {
  const style = { width: size, height: size, border: "3px solid var(--pure-white)" } as const;
  if (pet.photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={pet.photo} alt={pet.name} className="rounded-full object-cover shadow-sm" style={style} />;
  }
  return (
    <div
      className="rounded-full flex items-center justify-center font-fraunces font-semibold shadow-sm"
      style={{ ...style, background: "var(--soft-teal)", color: "var(--bindr-navy)", fontSize: size * 0.4 }}
      aria-label={pet.name}
    >
      {pet.name.slice(0, 1)}
    </div>
  );
}

function Message({ heading, text, children }: { heading: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="text-center py-16 space-y-4">
      <h1 className="font-fraunces font-semibold text-[var(--bindr-navy)]" style={{ fontSize: "clamp(1.5rem, 6vw, 2rem)" }}>
        {heading}
      </h1>
      <p className="font-inter text-[var(--charcoal)] leading-relaxed" style={{ fontSize: "1rem" }}>{text}</p>
      {children}
      <p className="pt-6">
        <a href="https://www.petbindr.com" className="font-inter text-[var(--slate-gray)] underline" style={{ fontSize: "0.875rem" }}>
          What is PetBindr?
        </a>
      </p>
    </div>
  );
}
