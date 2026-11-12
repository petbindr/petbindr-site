"use client";

// petbindr.com/app: PetBindr in the browser, for co-owners without an iPhone
// (user panel: Priya has Android). Sign up / sign in with the same account as
// the app, then Today across all your pets with check-offs, and your pets.
// Reads and writes Firestore directly, so the same rules apply as in the app:
// a co-owner here can do exactly what a co-owner can do on iPhone. Check-offs
// are saved the way the app saves them (same IDs and fields), so the app, the
// alerts and the widget see them like any other.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  updateProfile, signOut, sendPasswordResetEmail as firebaseResetEmail, type User,
} from "firebase/auth";
import {
  collection, doc, getDoc, onSnapshot, query, where, setDoc, deleteDoc, updateDoc,
  deleteField, Timestamp, serverTimestamp,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { firebase, webAppConfigured } from "./firebase";
import PetPage from "./PetPage";
import SitterLinkMaker from "./SitterLinkMaker";
import {
  tasksFor, startOfDay, feedingLogDoc, medicationLogDoc,
  type PetDay, type TodayTask, type FeedingAmount, type MedicationSchedule,
  type FeedingLog, type MedicationLog, type FeedingSchedule,
} from "./today";

type Pet = { id: string; name: string; species?: string; breed?: string; isDeceased?: boolean; ownerId?: string };

const AMOUNT_TEXT: Record<FeedingAmount, string> = { all: "Ate it all", some: "Ate some", none: "Didn't eat" };

export default function HomeApp() {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    if (!webAppConfigured) return;
    return onAuthStateChanged(firebase().auth, (u) => setUser(u && !u.isAnonymous ? u : null));
  }, []);

  if (!webAppConfigured) {
    return <Card title="Coming soon"><p className="font-inter">PetBindr in your browser is almost ready.</p></Card>;
  }
  if (user === undefined) return <p className="font-inter text-center text-[var(--slate-gray)]">Loading…</p>;
  return user ? <SignedIn user={user} /> : <SignedOut />;
}

// MARK: - Signed out

function SignedOut() {
  const [mode, setMode] = useState<"in" | "up" | "reset">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const { auth, db, functions } = firebase();
    const cleanEmail = email.trim();
    try {
      if (mode === "in") {
        await signInWithEmailAndPassword(auth, cleanEmail, password);
      } else if (mode === "up") {
        const displayName = name.trim();
        if (!displayName) throw new Error("Add your name, so people know who checked things off.");
        const result = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        await updateProfile(result.user, { displayName });
        // The same profile the app makes at sign-up (UserProfile.swift)
        await setDoc(doc(db, "users", result.user.uid), {
          id: result.user.uid, email: result.user.email || cleanEmail, displayName,
          createdAt: serverTimestamp(), showOverdueReminders: false, overdueReminderPetIds: [],
        });
        try { await httpsCallable(functions, "sendVerificationEmail")(); } catch { /* the app nudges later */ }
      } else {
        try {
          await httpsCallable(functions, "sendPasswordResetEmail")({ email: cleanEmail });
        } catch {
          await firebaseResetEmail(auth, cleanEmail);
        }
        setNotice(`If ${cleanEmail} has a PetBindr account, a link to reset the password is on its way.`);
      }
    } catch (err) {
      setError(authMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const title = mode === "in" ? "Sign in to PetBindr" : mode === "up" ? "Create your PetBindr account" : "Reset your password";
  return (
    <div className="space-y-6">
      <header className="text-center space-y-2">
        <h1 className="font-fraunces font-semibold text-[var(--bindr-navy)]" style={{ fontSize: "clamp(26px, 6vw, 34px)" }}>{title}</h1>
        <p className="font-inter text-[var(--charcoal)]">
          {mode === "up"
            ? "Use the email the pet's owner will add you with. Works on any phone or computer."
            : "The same account as the PetBindr iPhone app."}
        </p>
      </header>
      <Card>
        <form onSubmit={submit} className="space-y-4">
          {mode === "up" && <Field label="Your name" value={name} onChange={setName} autoComplete="name" />}
          <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
          {mode !== "reset" && (
            <Field label="Password" type="password" value={password} onChange={setPassword}
              autoComplete={mode === "up" ? "new-password" : "current-password"} />
          )}
          {error && <p className="font-inter" style={{ color: "var(--error-red)" }} role="alert">{error}</p>}
          {notice && <p className="font-inter" style={{ color: "var(--success-green)" }} role="status">{notice}</p>}
          <button className="btn-coral w-full" type="submit" disabled={busy}>
            {busy ? "One moment…" : mode === "in" ? "Sign In" : mode === "up" ? "Create Account" : "Send Reset Link"}
          </button>
        </form>
      </Card>
      <div className="text-center space-y-2 font-inter">
        {mode !== "in" && <LinkButton onClick={() => { setMode("in"); setError(null); setNotice(null); }}>I have an account: sign in</LinkButton>}
        {mode !== "up" && <LinkButton onClick={() => { setMode("up"); setError(null); setNotice(null); }}>New here? Create an account</LinkButton>}
        {mode === "in" && <LinkButton onClick={() => { setMode("reset"); setError(null); }}>Forgot password?</LinkButton>}
      </div>
    </div>
  );
}

function authMessage(err: unknown): string {
  const code = (err as { code?: string }).code || "";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) return "That email and password don't match.";
  if (code.includes("email-already-in-use")) return "There's already an account with that email. Sign in instead.";
  if (code.includes("weak-password")) return "Use a password with at least 6 characters.";
  if (code.includes("invalid-email")) return "That email doesn't look right.";
  if (code.includes("too-many-requests")) return "Too many tries. Wait a minute and try again.";
  if (code.includes("network")) return "Couldn't reach PetBindr. Check your connection and try again.";
  return (err as Error).message || "Something went wrong. Please try again.";
}

// MARK: - Signed in

function SignedIn({ user }: { user: User }) {
  const { db } = firebase();
  const [ownPets, setOwnPets] = useState<Pet[]>([]);
  const [coPets, setCoPets] = useState<Pet[]>([]);
  const [loaded, setLoaded] = useState({ own: false, co: false });
  const [days, setDays] = useState<Record<string, Partial<PetDay>>>({});
  const [names, setNames] = useState<Record<string, string>>({});
  const [myName, setMyName] = useState(user.displayName || "");
  const [now, setNow] = useState(() => new Date());
  const [verified, setVerified] = useState(user.emailVerified);
  // A pet's page is "#pet/<id>", so the browser's Back button returns to Today
  const [openPetId, setOpenPetId] = useState<string | null>(null);
  useEffect(() => {
    const read = () => setOpenPetId(/^#pet\/(.+)$/.exec(window.location.hash)?.[1] || null);
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  const [verifyNote, setVerifyNote] = useState<string | null>(null);

  // Pets you were invited to co-own (by email) are added once your email is confirmed
  const claim = useCallback(async () => {
    try {
      await user.getIdToken(true);
      await httpsCallable(firebase().functions, "claimCoOwnerInvites")();
    } catch { /* invites wait for the next visit */ }
  }, [user]);
  useEffect(() => { if (verified) claim(); }, [verified, claim]);

  async function checkVerified() {
    await user.reload();
    if (firebase().auth.currentUser?.emailVerified) {
      setVerified(true);
      setVerifyNote(null);
    } else {
      setVerifyNote("Not confirmed yet. Open the link in the email from PetBindr, then try again.");
    }
  }

  async function resendVerification() {
    try {
      await httpsCallable(firebase().functions, "sendVerificationEmail")();
      setVerifyNote(`Sent again to ${user.email}.`);
    } catch {
      setVerifyNote("Couldn't send it right now. Try again in a few minutes.");
    }
  }

  // Refresh "now" each minute so a new day starts on its own
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    getDoc(doc(db, "users", user.uid)).then((d) => {
      const n = d.exists() ? (d.data().displayName as string) : "";
      if (n) setMyName(n);
    }).catch(() => {});
    const own = onSnapshot(query(collection(db, "pets"), where("ownerId", "==", user.uid)), (s) => {
      setOwnPets(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Pet, "id">) })));
      setLoaded((l) => ({ ...l, own: true }));
    }, () => setLoaded((l) => ({ ...l, own: true })));
    const co = onSnapshot(query(collection(db, "pets"), where("coOwnerIds", "array-contains", user.uid)), (s) => {
      setCoPets(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Pet, "id">) })));
      setLoaded((l) => ({ ...l, co: true }));
    }, () => setLoaded((l) => ({ ...l, co: true })));
    return () => { own(); co(); };
  }, [db, user.uid]);

  const pets = useMemo(() => {
    const seen = new Set<string>();
    return [...ownPets, ...coPets]
      .filter((p) => !p.isDeceased && !seen.has(p.id) && seen.add(p.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [ownPets, coPets]);
  const petKey = pets.map((p) => p.id).join(",");

  // Each pet's schedules and the last two days of check-offs, live
  useEffect(() => {
    const since = Timestamp.fromDate(new Date(startOfDay(new Date()).getTime() - 86400000));
    const stops: (() => void)[] = [];
    for (const pet of pets) {
      const set = (patch: Partial<PetDay>) =>
        setDays((d) => ({ ...d, [pet.id]: { ...d[pet.id], petId: pet.id, petName: pet.name, ...patch } }));
      const base = `pets/${pet.id}`;
      stops.push(onSnapshot(doc(db, `${base}/feedingSchedule/schedule`),
        (s) => set({ feeding: s.exists() ? (s.data() as FeedingSchedule) : null }), () => set({ feeding: null })));
      stops.push(onSnapshot(query(collection(db, `${base}/feedingLogs`), where("date", ">=", since)),
        (s) => set({ feedingLogs: s.docs.map((d) => ({ ...(d.data() as FeedingLog), id: d.id })) }), () => set({ feedingLogs: [] })));
      stops.push(onSnapshot(collection(db, `${base}/medicationSchedules`),
        (s) => set({ medications: s.docs.map((d) => ({ ...(d.data() as MedicationSchedule), id: d.id })) }), () => set({ medications: [] })));
      stops.push(onSnapshot(query(collection(db, `${base}/medicationLogs`), where("actualTime", ">=", since)),
        (s) => set({ medicationLogs: s.docs.map((d) => ({ ...(d.data() as MedicationLog), id: d.id })) }), () => set({ medicationLogs: [] })));
    }
    return () => stops.forEach((s) => s());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, petKey]);

  // Names for doses (the log keeps only the user's ID)
  const doseUserIds = Object.values(days).flatMap((d) => (d.medicationLogs || []).map((l) => l.givenBy || l.ownerId || "")).filter(Boolean);
  useEffect(() => {
    for (const uid of new Set(doseUserIds)) {
      if (names[uid]) continue;
      getDoc(doc(db, "users", uid)).then((d) => {
        if (d.exists()) setNames((n) => ({ ...n, [uid]: (d.data().displayName as string) || "Someone" }));
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doseUserIds.join(",")]);

  const tasks: TodayTask[] = pets.flatMap((pet) => {
    const d = days[pet.id];
    if (!d) return [];
    return tasksFor({
      petId: pet.id, petName: pet.name, feeding: d.feeding ?? null, feedingLogs: d.feedingLogs || [],
      medications: d.medications || [], medicationLogs: d.medicationLogs || [],
    }, now, { ...names, [user.uid]: myName || "You" });
  }).sort((a, b) => a.time.getTime() - b.time.getTime());

  if (openPetId) {
    return <PetPage petId={openPetId} onBack={() => (window.history.length > 1 ? window.history.back() : (window.location.hash = ""))} />;
  }

  const doneCount = tasks.filter((t) => t.done).length;
  const ready = loaded.own && loaded.co;
  const first = (myName || "").split(" ")[0];

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-fraunces font-semibold text-[var(--bindr-navy)]" style={{ fontSize: "clamp(24px, 6vw, 32px)" }}>
          {first ? `Hi, ${first}` : "PetBindr"}
        </h1>
        <button className="btn-ghost" style={{ padding: "8px 14px", fontSize: "15px" }} onClick={() => signOut(firebase().auth)}>Sign Out</button>
      </header>

      {!verified && (
        <Card title="Confirm your email">
          <p className="font-inter text-[var(--charcoal)]">
            We sent a link to <strong>{user.email}</strong>. Open it to confirm your email; pets you&apos;ve been invited to co-own show up after that.
          </p>
          {verifyNote && <p className="font-inter mt-2" style={{ fontSize: "15px", color: "var(--slate-gray)" }} role="status">{verifyNote}</p>}
          <div className="flex flex-wrap gap-2 mt-3">
            <button className="btn-coral" style={{ padding: "10px 16px" }} onClick={checkVerified}>I&apos;ve Confirmed It</button>
            <button className="btn-ghost" style={{ padding: "10px 16px" }} onClick={resendVerification}>Send It Again</button>
          </div>
        </Card>
      )}

      {verified && <TransferOffers user={user} />}

      {!ready ? (
        <p className="font-inter text-[var(--slate-gray)]">Loading your pets…</p>
      ) : pets.length === 0 ? (
        <Card title="No pets yet">
          <p className="font-inter text-[var(--charcoal)]">
            Ask the pet&apos;s owner to add you as a co-owner in the PetBindr app (the pet&apos;s page, then Manage Ownership), using <strong>{user.email}</strong>.{verified ? " The pets show up here right away." : " Confirm your email first."}
          </p>
        </Card>
      ) : (
        <>
          <Card title={`Today${tasks.length ? ` · ${doneCount === tasks.length ? "All done" : `${doneCount} of ${tasks.length} done`}` : ""}`}>
            {tasks.length === 0 ? (
              <p className="font-inter text-[var(--charcoal)]">No feedings or doses today.</p>
            ) : (
              <ul className="divide-y divide-[var(--mist-gray)]">
                {tasks.map((t) => (
                  <TaskRow key={t.key} task={t} showPet={pets.length > 1} uid={user.uid} myName={myName || user.email || "Someone"} />
                ))}
              </ul>
            )}
          </Card>
          <Card title={pets.length === 1 ? "Your pet" : "Your pets"}>
            <ul className="space-y-2">
              {pets.map((p) => (
                <li key={p.id} className="font-inter">
                  <a href={`#pet/${p.id}`} className="flex items-center justify-between gap-3 py-1" style={{ textDecoration: "none" }}>
                    <span>
                      <span className="font-semibold text-[var(--bindr-navy)] underline">{p.name}</span>
                      <span className="text-[var(--slate-gray)]"> · {[p.species, p.breed].filter(Boolean).join(" · ")}</span>
                    </span>
                    <span className="text-[var(--slate-gray)]" aria-hidden>›</span>
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
      {ready && pets.filter((p) => !p.isDeceased).length > 0 && (
        <SitterLinkMaker uid={user.uid} pets={pets.filter((p) => !p.isDeceased).map((p) => ({ id: p.id, name: p.name }))} />
      )}

      {ready && pets.length > 0 && <AlertEmails uid={user.uid} email={user.email || ""} />}

      <p className="font-inter text-center text-[var(--slate-gray)]" style={{ fontSize: "14px" }}>
        Signed in as {user.email}. Tap a pet for its vets, allergies, medications and more.
      </p>
    </div>
  );
}

// MARK: - A row on Today

function TaskRow({ task, showPet, uid, myName }: { task: TodayTask; showPet: boolean; uid: string; myName: string }) {
  const { db } = firebase();
  const [busy, setBusy] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isFeeding = task.kind === "feeding";
  const base = `pets/${task.petId}`;

  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(t);
  }, [confirming]);

  const run = useCallback(async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      setChoosing(false);
    } catch (err) {
      const code = (err as { code?: string }).code || "";
      setError(code.includes("permission-denied")
        ? "Someone else just checked this off. It'll update in a moment."
        : "Couldn't save that. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }, []);

  // The same documents the app writes (FeedingStore / MedicationStore)
  function checkOff(amount: FeedingAmount = "all") {
    if (!isFeeding && !confirming) { setConfirming(true); return; }
    setConfirming(false);
    run(async () => {
      // Dates become Firestore timestamps when saved
      if (isFeeding) {
        const log = feedingLogDoc(task.petId, task.itemId, uid, myName, new Date(), amount);
        await setDoc(doc(db, `${base}/feedingLogs/${log.id}`), log.data);
      } else {
        const log = medicationLogDoc(task.petId, task.itemId, task.title, task.detail, task.time, uid, new Date(), crypto.randomUUID().toUpperCase());
        await setDoc(doc(db, `${base}/medicationLogs/${log.id}`), log.data);
      }
    });
  }

  function setAmount(amount: FeedingAmount) {
    if (!task.done) return checkOff(amount);
    run(() => updateDoc(doc(db, `${base}/feedingLogs/${task.done!.logId}`), { amount: amount === "all" ? deleteField() : amount }));
  }

  function undo() {
    if (!task.done) return;
    run(() => deleteDoc(doc(db, `${base}/${isFeeding ? "feedingLogs" : "medicationLogs"}/${task.done!.logId}`)));
  }

  const done = task.done;
  const amount = done?.amount || "all";
  const doneColor = isFeeding && amount !== "all" ? "#9C5F0E" : "var(--success-green)";
  const doneMark = !isFeeding || amount === "all" ? "✓" : amount === "some" ? "◐" : "✕";
  const choices = (done ? (["all", "some", "none"] as const).filter((a) => a !== amount) : (["some", "none"] as const));

  return (
    <li className="py-3">
      <div className="flex items-center gap-3">
        <div className="w-16 shrink-0 font-inter text-[var(--slate-gray)]" style={{ fontSize: "14px" }}>{fmtTime(task.time)}</div>
        <div className="flex-1 min-w-0">
          <p className="font-inter font-semibold text-[var(--charcoal)]">
            {isFeeding ? "🍽️ " : "💊 "}{showPet ? `${task.petName} · ` : ""}{task.title}
          </p>
          {task.detail && <p className="font-inter text-[var(--slate-gray)]" style={{ fontSize: "14px" }}>{task.detail}</p>}
          {done && (
            <p className="font-inter" style={{ fontSize: "14px", color: doneColor }}>
              {doneMark} {isFeeding && amount !== "all" ? `${AMOUNT_TEXT[amount]} · ${done.by}` : `Done by ${done.by}`} at {fmtTime(done.at)}
            </p>
          )}
          <div className="flex flex-wrap gap-x-4">
            {isFeeding && !choosing && !busy && (
              <button className="font-inter underline text-[var(--bindr-navy)]" style={{ fontSize: "14px", padding: "4px 0" }} onClick={() => setChoosing(true)}>
                {done ? "Change how much" : "Ate some or didn't eat?"}
              </button>
            )}
            {done && !busy && (
              <button className="font-inter underline text-[var(--slate-gray)]" style={{ fontSize: "14px", padding: "4px 0" }} onClick={undo}>
                Not done yet
              </button>
            )}
          </div>
          {error && <p className="font-inter" style={{ fontSize: "14px", color: "var(--error-red)" }} role="alert">{error}</p>}
        </div>
        {!done && (
          <button
            className="btn-coral shrink-0"
            style={{ padding: "10px 16px", minWidth: 92, ...(confirming ? { backgroundColor: "var(--bindr-navy)" } : {}) }}
            onClick={() => checkOff()}
            disabled={busy}
          >
            {busy ? "Saving…" : confirming ? "Tap to confirm" : "Done"}
          </button>
        )}
      </div>
      {isFeeding && choosing && (
        <div className="flex flex-wrap items-center gap-2 mt-2 sm:pl-[76px]">
          {choices.map((a) => (
            <button key={a} className="btn-ghost" style={{ padding: "8px 14px", fontSize: "15px" }} onClick={() => setAmount(a)} disabled={busy}>
              {AMOUNT_TEXT[a]}
            </button>
          ))}
          <button className="font-inter underline text-[var(--slate-gray)]" style={{ fontSize: "14px" }} onClick={() => setChoosing(false)}>Cancel</button>
        </div>
      )}
    </li>
  );
}

// MARK: - Pieces

function fmtTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// Missed-dose / missed-feeding alerts by email, for people without the iPhone
// app (the server sends them when it can't send a notification). On unless
// turned off here: users/{uid}.alertEmails.
function AlertEmails({ uid, email }: { uid: string; email: string }) {
  const [on, setOn] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    getDoc(doc(firebase().db, "users", uid))
      .then((d) => setOn(!(d.exists() && d.data().alertEmails === false)))
      .catch(() => setOn(true));
  }, [uid]);
  if (on === null) return null;
  async function toggle(next: boolean) {
    setSaving(true);
    setError(false);
    try {
      await setDoc(doc(firebase().db, "users", uid), { alertEmails: next }, { merge: true });
      setOn(next);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Card title="Alerts">
      <label className="flex items-start gap-3 font-inter text-[var(--charcoal)] cursor-pointer">
        <input type="checkbox" className="mt-1" style={{ width: 20, height: 20 }} checked={on} disabled={saving}
          onChange={(e) => toggle(e.target.checked)} />
        <span>
          Email me at <strong>{email}</strong> when a dose or feeding is missed.
          <span className="block text-[var(--slate-gray)]" style={{ fontSize: "14px" }}>
            Only if you don&apos;t have the PetBindr iPhone app (it sends a notification instead).
          </span>
        </span>
      </label>
      {error && <p className="font-inter mt-2" style={{ fontSize: "14px", color: "var(--error-red)" }} role="alert">Couldn&apos;t save that. Try again.</p>}
    </Card>
  );
}

// Someone handing a pet over to you (adoption, end of a foster): accept it with
// every record, or decline. Same functions as the iPhone app (petTransfers).
type TransferOffer = {
  petId: string; petName: string; species: string | null; breed: string | null;
  fromName: string; note: string | null; keepAsCoOwner: boolean;
};

function TransferOffers({ user }: { user: User }) {
  const [offers, setOffers] = useState<TransferOffer[]>([]);
  const [working, setWorking] = useState<string | null>(null);
  const [confirmDecline, setConfirmDecline] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await user.getIdToken(true); // the confirmed-email flag must be in the token
        const r = await httpsCallable<unknown, { transfers: TransferOffer[] }>(firebase().functions, "myPetTransfers")();
        if (!cancelled) setOffers(r.data.transfers || []);
      } catch { /* offers show on the next visit */ }
    })();
    return () => { cancelled = true; };
  }, [user]);

  async function respond(petId: string, accept: boolean) {
    setWorking(petId);
    setError(null);
    try {
      await httpsCallable(firebase().functions, "respondToPetTransfer")({ petId, accept });
      // An accepted pet appears under "Your pets" by itself
      setOffers((list) => list.filter((o) => o.petId !== petId));
    } catch (e) {
      setError((e as Error).message || "Couldn't do that. Please try again.");
    } finally {
      setWorking(null);
      setConfirmDecline(null);
    }
  }

  if (offers.length === 0) return null;
  return (
    <>
      {offers.map((o) => {
        const kind = [o.species, o.breed].filter(Boolean).join(" · ");
        return (
          <Card key={o.petId} title={`${o.fromName} is giving you ${o.petName}`}>
            <p className="font-inter text-[var(--charcoal)]">
              {kind ? `${kind}, with` : "With"} all their records: vaccines, vet visits, medications, feeding and the vet&apos;s details.
            </p>
            {o.note && <p className="font-inter italic mt-2 text-[var(--charcoal)]">“{o.note}”</p>}
            {o.keepAsCoOwner && (
              <p className="font-inter mt-2" style={{ fontSize: "15px", color: "var(--slate-gray)" }}>
                {o.fromName} will stay on as a co-owner. You can remove them in the iPhone app.
              </p>
            )}
            {error && <p className="font-inter mt-2" style={{ fontSize: "15px", color: "var(--error-red)" }} role="alert">{error}</p>}
            <div className="flex flex-wrap gap-2 mt-3">
              <button className="btn-coral" style={{ padding: "10px 16px" }} disabled={!!working} onClick={() => respond(o.petId, true)}>
                {working === o.petId ? "Accepting…" : `Accept ${o.petName}`}
              </button>
              {confirmDecline === o.petId ? (
                <button className="btn-ghost" style={{ padding: "10px 16px", color: "var(--error-red)" }} disabled={!!working} onClick={() => respond(o.petId, false)}>
                  Tap to decline
                </button>
              ) : (
                <button className="btn-ghost" style={{ padding: "10px 16px" }} disabled={!!working} onClick={() => setConfirmDecline(o.petId)}>
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

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl p-5 md:p-6" style={{ background: "var(--pure-white)", border: "1px solid var(--mist-gray)" }}>
      {title && <h2 className="font-fraunces font-semibold mb-3" style={{ fontSize: "20px", color: "var(--bindr-navy)" }}>{title}</h2>}
      {children}
    </section>
  );
}

function Field({ label, value, onChange, type = "text", autoComplete }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; autoComplete?: string;
}) {
  return (
    <label className="block font-inter">
      <span className="block mb-1 text-[var(--charcoal)] font-semibold" style={{ fontSize: "15px" }}>{label}</span>
      <input
        className="w-full rounded-xl px-4 py-3 text-[var(--charcoal)]"
        style={{ border: "1px solid var(--mist-gray)", background: "var(--warm-cream)", fontSize: "16px" }}
        type={type} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} required
      />
    </label>
  );
}

function LinkButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <button className="block mx-auto underline text-[var(--bindr-navy)]" onClick={onClick}>{children}</button>;
}
