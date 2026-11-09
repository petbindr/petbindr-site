"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Cloud Functions base (override for local testing against the emulator)
const FUNCTIONS_URL =
  process.env.NEXT_PUBLIC_PETBINDR_FUNCTIONS_URL || "https://us-central1-petbindr-2d4bd.cloudfunctions.net";
const REFRESH_MS = 5 * 60 * 1000;

type Done = { by: string; at: string } | null;
type TodayItem = { kind: "feeding" | "medication"; id: string; title: string; detail: string | null; due: string; done: Done };
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
};
type LinkData =
  | {
      state: "active"; sitterName: string; ownerName: string; ownerPhone: string | null; timeZone: string;
      endDate: string | null; now: string; pets: Pet[];
      emergencyContacts: { name: string; relationship: string | null; phone: string }[] | null;
    }
  | { state: "notFound" | "turnedOff" | "expired" | "notStarted"; ownerName: string | null; sitterName: string | null; startDate: string | null };

async function callFunction<T>(name: string, data: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${FUNCTIONS_URL}/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data }),
    referrerPolicy: "no-referrer",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    throw new Error(json?.error?.message || "Something went wrong. Please try again.");
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
  const loading = useRef(false);

  const load = useCallback(async (link: string) => {
    if (loading.current) return;
    loading.current = true;
    try {
      setData(await callFunction<LinkData>("getSitterLink", { link }));
      setLoadError(null);
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      loading.current = false;
    }
  }, []);

  useEffect(() => {
    const link = window.location.hash.replace(/^#/, "");
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
      <Message heading="Couldn't load this page" text={`${loadError} Check your connection and try again.`}>
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
      notStarted: ["This link isn't active yet", `It starts ${data.startDate ? fmtDay(data.startDate) : "soon"}. Check back then.`],
    } as const;
    const [heading, text] = texts[data.state];
    return <Message heading={heading} text={text} />;
  }

  return <ActiveLink data={data} token={token!} onChanged={() => token && load(token)} />;
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
          Caring for {namesText}
        </h1>
        <p className="font-inter text-[var(--charcoal)]" style={{ fontSize: "16px" }}>
          Hi {data.sitterName}! {owner} shared everything you need here
          {data.endDate ? <>, through <strong>{fmtDay(data.endDate, tz)}</strong></> : null}.
        </p>
        {data.ownerPhone && (
          <a href={telHref(data.ownerPhone)} className="btn-coral" style={{ textDecoration: "none" }}>
            Call {owner}
          </a>
        )}
      </header>

      {data.pets.some((p) => p.today.length > 0) && (
        <Card title={`Today, ${fmtDay(data.now, tz)}`}>
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

      {data.pets.map((pet) => (
        <PetCard key={pet.id} pet={pet} />
      ))}

      <footer className="text-center space-y-3 pt-2 pb-6">
        <p className="font-inter text-[var(--slate-gray)]" style={{ fontSize: "14px" }}>
          Shared with PetBindr. Only {owner} can change what you see here.
        </p>
        <a href="https://petbindr.com" className="font-inter text-[var(--bindr-navy)] underline" style={{ fontSize: "14px" }}>
          Get the PetBindr app for notifications and photo updates
        </a>
      </footer>
    </div>
  );
}

function TodayRow({ item, pet, tz, token, onChanged }: { item: TodayItem; pet: Pet; tz: string; token: string; onChanged: () => void }) {
  const [done, setDone] = useState<Done>(item.done);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setDone(item.done), [item.done]);
  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(t);
  }, [confirming]);

  async function markDone() {
    // A medication is easy to tap by accident and matters more: ask once more
    if (item.kind === "medication" && !confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    setSaving(true);
    setError(null);
    try {
      const result = await callFunction<{ done: Done }>("sitterLinkCheckOff", {
        link: token, petId: pet.id, kind: item.kind, itemId: item.id, due: Date.parse(item.due),
      });
      setDone(result.done);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="py-3 flex items-center gap-3">
      <div className="w-16 shrink-0 font-inter text-[var(--slate-gray)]" style={{ fontSize: "14px" }}>
        {fmtTime(item.due, tz)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-inter font-semibold text-[var(--charcoal)]">
          {item.kind === "medication" ? "💊 " : "🍽️ "}
          {item.title}
        </p>
        {item.detail && <p className="font-inter text-[var(--slate-gray)]" style={{ fontSize: "14px" }}>{item.detail}</p>}
        {done && (
          <p className="font-inter" style={{ fontSize: "14px", color: "var(--success-green)" }}>
            ✓ Done by {done.by} at {fmtTime(done.at, tz)}
          </p>
        )}
        {error && <p className="font-inter" style={{ fontSize: "14px", color: "var(--error-red)" }} role="alert">{error}</p>}
      </div>
      {!done && (
        <button
          className="btn-coral shrink-0"
          style={{ padding: "10px 16px", minWidth: 92, ...(confirming ? { backgroundColor: "var(--bindr-navy)" } : {}) }}
          onClick={markDone}
          disabled={saving}
        >
          {saving ? "Saving…" : confirming ? "Tap to confirm" : "Done"}
        </button>
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

function Card({ title, tone, children }: { title?: string; tone?: "alert"; children: React.ReactNode }) {
  return (
    <section
      className="rounded-2xl p-5 md:p-6"
      style={{ background: tone === "alert" ? "#FDECEA" : "var(--pure-white)", border: "1px solid var(--mist-gray)" }}
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
