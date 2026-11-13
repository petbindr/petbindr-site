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
type Done = { by: string; at: string; amount?: Amount; canChange?: boolean; skipped?: boolean } | null;
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
  today: TodayItem[];
  // Medication photos, once per medication (not copied onto every dose)
  medicationPhotos?: Record<string, string>;
};
type LinkData =
  | {
      state: "active"; sitterName: string; ownerName: string; ownerPhone: string | null; timeZone: string;
      helper?: boolean; // a household helper's chores page ("Emma feeds the hamster"): feedings only, no end date
      notes?: string | null; // "What's different this time", from the owner's trip setup
      endDate: string | null; now: string; pets: Pet[];
      emergencyContacts: { name: string; relationship: string | null; phone: string }[] | null;
    }
  | {
      state: "notFound" | "turnedOff" | "expired" | "notStarted"; ownerName: string | null; sitterName: string | null;
      startDate: string | null; timeZone?: string | null;
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
      notStarted: ["This link isn't active yet", `It starts ${data.startDate ? fmtDay(data.startDate, data.timeZone || undefined) : "soon"}. Check back then.`],
    } as const;
    const [heading, text] = texts[data.state];
    return <Message heading={heading} text={text} />;
  }

  return (
    <>
      {loadError && (
        // A refresh failed: what's shown may be out of date (it used to say nothing)
        <p className="font-inter text-center rounded-xl p-2 mb-3" role="status"
          style={{ fontSize: "14px", background: "#FFF4E5", color: "#7A4A00" }}>
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

  // Emergency vets across pets, without repeats
  const emergencyVets: Vet[] = [];
  for (const pet of data.pets) {
    for (const vet of pet.vets || []) {
      if (vet.role === "Regular vet") continue;
      if (!emergencyVets.some((v) => v.name === vet.name && v.phone === vet.phone)) emergencyVets.push(vet);
    }
  }
  const contacts = data.emergencyContacts || [];

  return (
    <div className="space-y-6">
      <header className="text-center space-y-3">
        <div className="flex justify-center -space-x-3">
          {data.pets.map((p) => (
            <PetPhoto key={p.id} pet={p} size={72} />
          ))}
        </div>
        <h1 className="font-fraunces font-semibold text-[var(--bindr-navy)]" style={{ fontSize: "clamp(26px, 6vw, 34px)" }}>
          {data.helper ? (data.sitterName?.trim() ? `Hi ${data.sitterName.trim()}!` : "Hi!") : <>Caring for {namesText}</>}
        </h1>
        {data.helper ? (
          <p className="font-inter text-[var(--charcoal)]" style={{ fontSize: "16px" }}>
            Here are today&apos;s chores for {namesText}. Tap each one when it&apos;s done, so {owner} knows.
          </p>
        ) : (
          <p className="font-inter text-[var(--charcoal)]" style={{ fontSize: "16px" }}>
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

      {data.notes && (
        <Card title="This time" tone="note">
          <p className="font-inter text-[var(--charcoal)] whitespace-pre-line" style={{ fontSize: "16px" }}>
            {data.notes}
          </p>
          <p className="font-inter text-[var(--slate-gray)] mt-2" style={{ fontSize: "14px" }}>
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

      {data.helper && !data.pets.some((p) => p.today.length > 0) && (
        <Card title={`Today's chores, ${fmtDay(data.now, tz)}`}>
          <p className="font-inter text-[var(--charcoal)]">Nothing to do today.</p>
        </Card>
      )}

      {data.pets.map((pet) => (
        <PetCard key={pet.id} pet={pet} />
      ))}

      <footer className="text-center space-y-3 pt-2 pb-6">
        <p className="font-inter text-[var(--slate-gray)]" style={{ fontSize: "14px" }}>
          Shared with PetBindr. Only {owner} can change what you see here.
        </p>
        {!data.helper && (
          <a href="https://petbindr.com" className="font-inter text-[var(--bindr-navy)] underline" style={{ fontSize: "14px" }}>
            Get the PetBindr app for notifications and photo updates
          </a>
        )}
      </footer>
    </div>
  );
}

const AMOUNT_TEXT: Record<"all" | "some" | "none", string> = { all: "Ate it all", some: "Ate some", none: "Didn't eat" };

function TodayRow({ item, pet, tz, token, onChanged }: { item: TodayItem; pet: Pet; tz: string; token: string; onChanged: () => void }) {
  const [done, setDone] = useState<Done>(item.done);
  const [confirming, setConfirming] = useState(false);
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
  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(t);
  }, [confirming]);

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
        <p className="font-inter font-semibold mb-1" style={{ fontSize: "14px", color: overdue ? "var(--error-red)" : "var(--bindr-navy)" }}>
          {overdue ? `Overdue since ${fmtTime(item.due, tz)}: give it now` : `Time to give ${pet.name} this`}
        </p>
      )}
      <div className="flex items-center gap-3">
        <div className="w-16 shrink-0 font-inter text-[var(--slate-gray)]" style={{ fontSize: "14px" }}>
          {fmtTime(item.due, tz)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-inter font-semibold text-[var(--charcoal)]">
            {item.kind === "medication" ? "💊 " : "🍽️ "}
            {item.title}
          </p>
          {item.detail && (
            <p className="font-inter" style={giveNow ? { fontSize: "18px", fontWeight: 600, color: "var(--charcoal)" } : { fontSize: "14px", color: "var(--slate-gray)" }}>
              {item.detail}
            </p>
          )}
          {skipped && done && (
            <p className="font-inter" style={{ fontSize: "14px", color: "var(--slate-gray)" }}>
              Skipped: {done.by} marked this dose as not given. Don&rsquo;t give it.
            </p>
          )}
          {done && !skipped && (
            <p className="font-inter" style={{ fontSize: "14px", color: doneColor }}>
              {doneMark} {isFeeding && doneAmount !== "all" ? `${AMOUNT_TEXT[doneAmount]} · ` : "Done "}
              {isFeeding && doneAmount !== "all" ? "" : "by "}
              {done.by} at {fmtTime(done.at, tz)}
            </p>
          )}
          {isFeeding && !choosing && !saving && (!done || done.canChange) && (
            <button
              className="block text-left font-inter underline text-[var(--bindr-navy)]"
              style={{ fontSize: "14px", padding: "4px 0" }}
              onClick={() => setChoosing(true)}
            >
              {done ? "Change how much" : "Ate some or didn't eat?"}
            </button>
          )}
          {error && <p className="font-inter" style={{ fontSize: "14px", color: "var(--error-red)" }} role="alert">{error}</p>}
        </div>
        {!done && (
          <button
            className="btn-coral shrink-0"
            style={{ padding: "10px 16px", minWidth: 92, ...(confirming ? { backgroundColor: "var(--bindr-navy)" } : {}) }}
            onClick={markDone}
            disabled={saving}
            aria-label={isFeeding ? `${item.title}: done, ate it all` : undefined}
          >
            {saving ? "Saving…" : confirming ? "Tap to confirm" : "Done"}
          </button>
        )}
      </div>
      {giveNow && (item.howTo || photo) && (
        <div className="mt-2 space-y-2">
          {item.howTo && (
            <p className="font-inter text-[var(--charcoal)] whitespace-pre-line" style={{ fontSize: "16px" }}>{item.howTo}</p>
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
              style={{ padding: "8px 14px", fontSize: "15px" }}
              onClick={() => save(a, !!done)}
              disabled={saving}
            >
              {AMOUNT_TEXT[a]}
            </button>
          ))}
          <button
            className="font-inter text-[var(--slate-gray)]"
            style={{ fontSize: "14px", padding: "8px 6px" }}
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

function PetCard({ pet }: { pet: Pet }) {
  const about = [pet.breed || pet.species, ageText(pet.birthday)].filter(Boolean).join(" · ");
  const routineEntries = Object.entries(pet.routines || {}).filter(([, v]) => v);
  return (
    <Card>
      <div className="flex items-center gap-4 mb-5">
        <PetPhoto pet={pet} size={64} />
        <div>
          <h2 className="font-fraunces font-semibold text-[var(--bindr-navy)]" style={{ fontSize: "24px" }}>{pet.name}</h2>
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
                  {m.times.length > 0 && <span className="text-[var(--slate-gray)]"> · {m.times.join(", ")}</span>}
                  {m.notes && <p className="text-[var(--slate-gray)]" style={{ fontSize: "14px" }}>{m.notes}</p>}
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
          style={{ fontSize: "20px", color: tone === "alert" ? "var(--error-red)" : "var(--bindr-navy)" }}
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
    <div className="font-inter text-[var(--charcoal)] leading-relaxed" style={{ fontSize: "16px" }}>
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
    <li className="flex items-center gap-3 font-inter">
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[var(--charcoal)]">{title}</p>
        {subtitle && <p className="text-[var(--slate-gray)]" style={{ fontSize: "14px" }}>{subtitle}</p>}
      </div>
      {phone && (
        <a
          href={telHref(phone)}
          className="shrink-0 rounded-full px-4 py-2 font-semibold"
          style={{ background: "var(--bindr-navy)", color: "#fff", fontSize: "14px", textDecoration: "none" }}
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
      <h1 className="font-fraunces font-semibold text-[var(--bindr-navy)]" style={{ fontSize: "clamp(24px, 6vw, 32px)" }}>
        {heading}
      </h1>
      <p className="font-inter text-[var(--charcoal)] leading-relaxed" style={{ fontSize: "16px" }}>{text}</p>
      {children}
      <p className="pt-6">
        <a href="https://petbindr.com" className="font-inter text-[var(--slate-gray)] underline" style={{ fontSize: "14px" }}>
          What is PetBindr?
        </a>
      </p>
    </div>
  );
}
