"use client";

// petbindr.com/app: PetBindr in the browser, for co-owners without an iPhone
// (user panel: Priya has Android). Sign up / sign in with the same account as
// the app, then Today across all your pets with check-offs, and your pets.
// Reads and writes Firestore directly, so the same rules apply as in the app:
// a co-owner here can do exactly what a co-owner can do on iPhone. Check-offs
// are saved the way the app saves them (same IDs and fields), so the app, the
// alerts and the widget see them like any other.

import { useCallback, useEffect, useMemo, useState } from "react";
import { track } from "@vercel/analytics";
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
import { signupSource } from "@/lib/signupSource";
import { feedingChanges, newId, timeAt } from "./care";
import PetPage from "./PetPage";
import SitterLinkMaker from "./SitterLinkMaker";
import VisitReports from "./VisitReports";
import AccountCard from "./AccountCard";
import { SitInvites, MyClients, type PetView } from "./SitterMode";
import { toSit, isLive, isUpcoming, clientsFrom, sitsByPet, may, doneToday, type Sit, type ShareDoc } from "./sitter";
import {
  tasksFor, startOfDay, feedingLogDoc, medicationLogDoc, doseLogId,
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
  if (user === undefined) return <p className="font-inter text-center text-(--slate-gray)">Loading…</p>;
  return user ? <SignedIn user={user} /> : <SignedOut />;
}

// MARK: - Signed out

// Where this visit came from, for the new account's profile. A link into /app
// (the sitter page's "Make a free binder") carries utm_source; otherwise the
// visit's landing page (lib/signupSource), which for a sitter was the sitter page.
function arrivalSource(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const q = new URLSearchParams(window.location.search);
    const here = { source: q.get("utm_source"), medium: q.get("utm_medium"), campaign: q.get("utm_campaign") };
    const found = here.source ? here : signupSource();
    for (const [k, v] of Object.entries(found)) if (v) out[k] = String(v).trim().slice(0, 100);
  } catch { /* no source */ }
  return out;
}

/** Arrived from a sitter page's "Make a free binder": someone starting their own */
function fromSitterLink(): boolean {
  try { return new URLSearchParams(window.location.search).get("utm_source") === "sitterlink"; } catch { return false; }
}

function SignedOut() {
  const [newOwner] = useState(fromSitterLink);
  const [mode, setMode] = useState<"in" | "up" | "reset">(newOwner ? "up" : "in");
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
        track("app_signup");
        // The same profile the app makes at sign-up (UserProfile.swift), plus
        // where the sign-up came from (the app ignores fields it doesn't know)
        const source = arrivalSource();
        await setDoc(doc(db, "users", result.user.uid), {
          id: result.user.uid, email: result.user.email || cleanEmail, displayName,
          createdAt: serverTimestamp(), showOverdueReminders: false, overdueReminderPetIds: [],
          ...(Object.keys(source).length ? { signupSource: { ...source, via: "web" } } : {}),
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

  const title = mode === "in" ? "Sign in to PetBindr" : mode === "up" ? (newOwner ? "Start a free binder for your pet" : "Create your PetBindr account") : "Reset your password";
  return (
    <div className="space-y-6">
      <header className="text-center space-y-2">
        <h1 className="font-fraunces font-semibold text-(--bindr-navy)" style={{ fontSize: "clamp(26px, 6vw, 34px)" }}>{title}</h1>
        <p className="font-inter text-(--charcoal)">
          {mode === "up"
            ? (newOwner
              ? "Create your free account, then add your pet: feedings, meds and vet info in one place. Works on any phone or computer."
              : "Add your own pet, or use the email a pet's owner will invite you with. Works on any phone or computer.")
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
      <p className="font-inter text-center text-(--slate-gray)" style={{ fontSize: "14px" }}>
        Your pets&apos; info is only shown to the people you share it with.{" "}
        <a href="/security" className="underline text-(--bindr-navy)">How we protect it</a>
      </p>
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
  // Sitter mode: shares made out to this account, and the server's copy of each shared pet
  const [sits, setSits] = useState<Sit[]>([]);
  const [sitsLoaded, setSitsLoaded] = useState(false);
  const [views, setViews] = useState<Record<string, PetView>>({});
  // A pet's page is "#pet/<id>", so the browser's Back button returns to Today
  const [openPetId, setOpenPetId] = useState<string | null>(null);
  useEffect(() => {
    const read = () => setOpenPetId(/^#pet\/(.+)$/.exec(window.location.hash)?.[1] || null);
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  const [verifyNote, setVerifyNote] = useState<string | null>(null);

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

  // Retention counts (weekly metrics email): today's UTC date on users/{uid}.lastActiveDay,
  // at most once a day per browser (same field and format as the iOS app; the rules check it)
  const activeDay = now.toISOString().slice(0, 10);
  useEffect(() => {
    const key = `lastActiveDayWritten.${user.uid}`;
    try { if (localStorage.getItem(key) === activeDay) return; } catch {}
    setDoc(doc(db, "users", user.uid), { lastActiveDay: activeDay }, { merge: true })
      .then(() => { try { localStorage.setItem(key, activeDay); } catch {} })
      .catch(() => {});
  }, [db, user.uid, activeDay]);

  useEffect(() => {
    // Live: right after signing up here the profile isn't saved yet, and a one-time
    // read missed it, so check-offs went out with the email address as the name
    const me = onSnapshot(doc(db, "users", user.uid), (d) => {
      const n = d.exists() ? (d.data().displayName as string) : "";
      if (n) setMyName(n);
    }, () => {});
    const own = onSnapshot(query(collection(db, "pets"), where("ownerId", "==", user.uid)), (s) => {
      setOwnPets(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Pet, "id">) })));
      setLoaded((l) => ({ ...l, own: true }));
    }, () => setLoaded((l) => ({ ...l, own: true })));
    const co = onSnapshot(query(collection(db, "pets"), where("coOwnerIds", "array-contains", user.uid)), (s) => {
      setCoPets(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Pet, "id">) })));
      setLoaded((l) => ({ ...l, co: true }));
    }, () => setLoaded((l) => ({ ...l, co: true })));
    // Shares made out to me (any status: invites to accept, sits now and coming up)
    // An invite just accepted here counts once the server has it: listening to the
    // pet's schedule before then was refused, and the listener stopped for good
    const shared = onSnapshot(query(collection(db, "petShares"), where("sharedWithUserId", "==", user.uid)), { includeMetadataChanges: true }, (s) => {
      setSits(s.docs.map((d) => toSit({ ...(d.data() as Omit<ShareDoc, "id">), id: d.id, ...(d.metadata.hasPendingWrites ? { status: "accepting" } : {}) })).filter((x): x is Sit => !!x));
      setSitsLoaded(true);
    }, () => setSitsLoaded(true));
    return () => { me(); own(); co(); shared(); };
  }, [db, user.uid]);

  // Email invites to sit wait until the email is confirmed; the app claims them
  // on Home, so do the same here (they then show as invites to accept)
  useEffect(() => {
    if (!verified) return;
    (async () => {
      try {
        await user.getIdToken(true);
        await httpsCallable(firebase().functions, "claimMyPendingShares")();
      } catch { /* they show on the next visit */ }
    })();
  }, [user, verified]);

  // Sits now or within a week, one per pet; the pet's details come from the
  // copy the server keeps with only what the share allows (sitterPetViews)
  const ownIds = new Set([...ownPets, ...coPets].map((p) => p.id));
  const sitPets = [...sitsByPet(sits, now).values()].filter((s) => !ownIds.has(s.petId));
  const sitKey = sitPets.map((s) => `${s.petId}:${isLive(s, now) ? 1 : 0}`).join(",");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let refreshed = false;
      for (const s of sitPets) {
        const read = () => getDoc(doc(db, "sitterPetViews", user.uid, "sharedPets", s.petId));
        try {
          let snap = await read();
          // Shared before the copies existed: ask the server to make them, once
          if (!snap.exists() && !refreshed) {
            refreshed = true;
            try { await httpsCallable(firebase().functions, "refreshMySharedPets")(); snap = await read(); } catch { /* shown from the share */ }
          }
          if (!snap.exists() || cancelled) continue;
          const d = snap.data();
          setViews((v) => ({ ...v, [s.petId]: {
            name: (d.name as string) || s.petName, ownerId: d.ownerId as string, coOwnerIds: (d.coOwnerIds as string[]) || [],
            species: d.species as string | undefined, breed: d.breed as string | undefined, isDeceased: d.isDeceased === true,
          } }));
        } catch { /* not open to me (yet): left out */ }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, user.uid, sitKey]);

  const pets = useMemo(() => {
    const seen = new Set<string>();
    return [...ownPets, ...coPets]
      .filter((p) => !p.isDeceased && !seen.has(p.id) && seen.add(p.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [ownPets, coPets]);
  const petKey = pets.map((p) => p.id).join(",");
  // Same array until the pets change: a new one each minute reset the link maker's pet choice
  const linkPets = useMemo(() => pets.filter((p) => !p.isDeceased).map((p) => ({ id: p.id, name: p.name })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [petKey, pets.map((p) => p.name).join("|")]);

  // Pets on Today: my own, and pets I'm sitting for right now, with only what
  // the share allows (feeding and medications have their own switches)
  const livePets = sitPets.filter((s) => isLive(s, now) && !views[s.petId]?.isDeceased);
  const taskPets: { id: string; name: string; feeding: boolean; meds: boolean }[] = [
    ...pets.map((p) => ({ id: p.id, name: p.name, feeding: true, meds: true })),
    ...livePets.map((s) => ({ id: s.petId, name: views[s.petId]?.name || s.petName, feeding: may(s, "canViewFoodInstructions"), meds: may(s, "canViewMedications") })),
  ];
  const taskKey = taskPets.map((p) => `${p.id}:${p.feeding ? 1 : 0}${p.meds ? 1 : 0}`).join(",");

  // Each pet's schedules and the last two days of check-offs, live
  useEffect(() => {
    const since = Timestamp.fromDate(new Date(startOfDay(new Date()).getTime() - 86400000));
    const stops: (() => void)[] = [];
    setDays({});
    for (const pet of taskPets) {
      const set = (patch: Partial<PetDay>) =>
        setDays((d) => ({ ...d, [pet.id]: { ...d[pet.id], petId: pet.id, petName: pet.name, ...patch } }));
      const base = `pets/${pet.id}`;
      if (!pet.feeding) set({ feeding: null, feedingLogs: [] });
      if (!pet.meds) set({ medications: [], medicationLogs: [] });
      if (pet.feeding) stops.push(onSnapshot(doc(db, `${base}/feedingSchedule/schedule`),
        (s) => set({ feeding: s.exists() ? (s.data() as FeedingSchedule) : null }), () => set({ feeding: null })));
      // With metadata changes: a check-off saved here with no signal shows "Not sent yet"
      // (it looked done; closing the tab then lost it and the owner gave the dose again)
      if (pet.feeding) stops.push(onSnapshot(query(collection(db, `${base}/feedingLogs`), where("date", ">=", since)), { includeMetadataChanges: true },
        (s) => set({ feedingLogs: s.docs.map((d) => ({ ...(d.data() as FeedingLog), id: d.id, pending: d.metadata.hasPendingWrites })) }), () => set({ feedingLogs: [] })));
      if (pet.meds) stops.push(onSnapshot(collection(db, `${base}/medicationSchedules`),
        (s) => set({ medications: s.docs.map((d) => ({ ...(d.data() as MedicationSchedule), id: d.id })) }), () => set({ medications: [] })));
      if (pet.meds) stops.push(onSnapshot(query(collection(db, `${base}/medicationLogs`), where("actualTime", ">=", since)), { includeMetadataChanges: true },
        (s) => set({ medicationLogs: s.docs.map((d) => ({ ...(d.data() as MedicationLog), id: d.id, pending: d.metadata.hasPendingWrites })) }), () => set({ medicationLogs: [] })));
    }
    return () => stops.forEach((s) => s());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, taskKey]);

  // Names for doses (the log keeps only the user's ID)
  const doseUserIds = Object.values(days).flatMap((d) => (d.medicationLogs || []).map((l) => l.givenBy || l.ownerId || "")).filter(Boolean);
  useEffect(() => {
    for (const uid of new Set(doseUserIds)) {
      if (names[uid]) continue;
      // Name only: other people's profiles are private (publicProfiles, 2026-11-14)
      getDoc(doc(db, "publicProfiles", uid)).then((d) => {
        if (d.exists()) setNames((n) => ({ ...n, [uid]: (d.data().displayName as string) || "Someone" }));
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doseUserIds.join(",")]);

  const tasks: TodayTask[] = taskPets.flatMap((pet) => {
    const d = days[pet.id];
    if (!d) return [];
    return tasksFor({
      petId: pet.id, petName: pet.name, feeding: d.feeding ?? null, feedingLogs: d.feedingLogs || [],
      medications: d.medications || [], medicationLogs: d.medicationLogs || [],
    }, now, { ...names, [user.uid]: myName || "You" })
      // A sitter's day: only from the sit's start to its end (a sit starting at
      // 5 PM doesn't owe this morning's breakfast)
      .filter((t) => {
        const sit = livePets.find((s) => s.petId === pet.id);
        return !sit || ((!sit.start || t.time >= sit.start) && (!sit.end || t.time < sit.end));
      });
  }).sort((a, b) => a.time.getTime() - b.time.getTime());
  const clients = clientsFrom(sits.filter((s) => !ownIds.has(s.petId)), now);
  const reportItems = (petIds: string[]) => doneToday(tasks, petIds, user.uid, days);

  if (openPetId) {
    // Back to Today, not "history.back()": opened from a link or after a reload, that left petbindr.com
    // A pet I'm sitting for: read-only, from the server's copy and the share's switches
    const sit = !ownIds.has(openPetId) ? sitPets.find((s) => s.petId === openPetId) : undefined;
    if (sit) return <PetPage petId={openPetId} sitter={{ uid: user.uid, live: isLive(sit, now), ownerName: sit.ownerName }} onBack={() => { window.location.hash = ""; }} />;
    if (!loaded.own || !loaded.co || !sitsLoaded) return <p className="font-inter text-(--slate-gray)">Loading…</p>;
    return <PetPage petId={openPetId} onBack={() => { window.location.hash = ""; }} />;
  }

  const doneCount = tasks.filter((t) => t.done).length;
  const ready = loaded.own && loaded.co && sitsLoaded;
  const sitting = clients.length > 0;
  const first = (myName || "").split(" ")[0];

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-fraunces font-semibold text-(--bindr-navy)" style={{ fontSize: "clamp(24px, 6vw, 32px)" }}>
          {first ? `Hi, ${first}` : "PetBindr"}
        </h1>
        <button className="btn-ghost" style={{ padding: "8px 14px", fontSize: "15px" }} onClick={() => { window.location.hash = ""; signOut(firebase().auth); }}>Sign Out</button>
      </header>

      {!verified && (
        <Card title="Confirm your email">
          <p className="font-inter text-(--charcoal)">
            We sent a link to <strong>{user.email}</strong>. Open it to confirm your email; invites to co-own a pet, or pets handed over to you, show up after that. You can add your own pet right away.
          </p>
          {verifyNote && <p className="font-inter mt-2" style={{ fontSize: "15px", color: "var(--slate-gray)" }} role="status">{verifyNote}</p>}
          <div className="flex flex-wrap gap-2 mt-3">
            <button className="btn-coral" style={{ padding: "10px 16px" }} onClick={checkVerified}>I&apos;ve Confirmed It</button>
            <button className="btn-ghost" style={{ padding: "10px 16px" }} onClick={resendVerification}>Send It Again</button>
          </div>
        </Card>
      )}

      {verified && <CoOwnerInviteOffers user={user} />}
      {verified && <TransferOffers user={user} />}
      <SitInvites sits={sits.filter((s) => !ownIds.has(s.petId))} now={now} />

      {!ready ? (
        <p className="font-inter text-(--slate-gray)">Loading your pets…</p>
      ) : pets.length === 0 && !sitting ? (
        <>
        <AddFirstPet uid={user.uid} />
        <Card title="Caring for someone else's pet?">
          <p className="font-inter text-(--charcoal)">
            Their pets show up here when they share them with <strong>{user.email}</strong>:
          </p>
          <ul className="font-inter text-(--charcoal) list-disc pl-5 mt-2 space-y-1">
            <li><strong>Sitting for someone?</strong> Ask them to share their pet with you in the PetBindr app (Invite a Sitter, then PetBindr app). Your clients, their pets and today&apos;s feedings and medications all show here.</li>
            <li><strong>Family or a partner?</strong> Ask the owner to invite you as a co-owner (the pet&apos;s page, then Manage Ownership).</li>
            <li><strong>A pet being given to you?</strong> The owner hands it over in the app.</li>
          </ul>
          <p className="font-inter text-(--slate-gray) mt-2" style={{ fontSize: "15px" }}>
            {verified ? "Invites show up here to accept." : "Confirm your email first, so invites can reach you."}
          </p>
        </Card>
        </>
      ) : (
        <>
          <Card title={`Today${tasks.length ? ` · ${doneCount === tasks.length ? "All done" : `${doneCount} of ${tasks.length} done`}` : ""}`}>
            {tasks.length === 0 ? (
              <p className="font-inter text-(--charcoal)">No feedings or doses today.</p>
            ) : (
              <ul className="divide-y divide-(--mist-gray)">
                {tasks.map((t) => (
                  <TaskRow key={t.key} task={t} showPet={taskPets.length > 1} uid={user.uid} myName={myName || user.email || "Someone"} />
                ))}
              </ul>
            )}
          </Card>
          {pets.length > 0 && <Card title={pets.length === 1 ? "Your pet" : "Your pets"}>
            <ul className="space-y-2">
              {pets.map((p) => (
                <li key={p.id} className="font-inter">
                  <a href={`#pet/${p.id}`} className="flex items-center justify-between gap-3 py-1" style={{ textDecoration: "none" }}>
                    <span>
                      <span className="font-semibold text-(--bindr-navy) underline">{p.name}</span>
                      <span className="text-(--slate-gray)"> · {[p.species, p.breed].filter((x, i, a) => x && !(i === 1 && x.trim().toLowerCase() === (a[0] || "").trim().toLowerCase())).join(" · ")}</span>
                    </span>
                    <span className="text-(--slate-gray)" aria-hidden>›</span>
                  </a>
                </li>
              ))}
            </ul>
          </Card>}
          {pets.length > 0 && <AddAnotherPet uid={user.uid} />}
          <MyClients clients={clients} tasks={tasks.map((t) => ({ petId: t.petId, done: !!t.done, time: t.time, title: t.title, petName: t.petName }))}
            views={views} uid={user.uid} sitterName={myName || "Your sitter"} reportItems={reportItems} />
        </>
      )}
      {ready && pets.length > 0 && <VisitReports uid={user.uid} />}

      <AccountCard user={user} />

      {ready && pets.filter((p) => !p.isDeceased).length > 0 && (
        <SitterLinkMaker uid={user.uid} pets={linkPets} />
      )}

      {ready && pets.length > 0 && <AlertEmails uid={user.uid} email={user.email || ""} />}

      <p className="font-inter text-center text-(--slate-gray)" style={{ fontSize: "14px" }}>
        Signed in as {user.email}. Tap a pet for its vets, allergies, medications and more.
      </p>
      <p className="font-inter text-center" style={{ fontSize: "14px" }}>
        <a href="mailto:hello@petbindr.com?subject=PetBindr%20feedback%20(web)" className="text-(--bindr-navy) underline">Send feedback</a>
      </p>
    </div>
  );
}

// MARK: - Add a first pet

// The iPhone app's species (Species raw values in Pet.swift); anything else won't load there
const SPECIES = ["Dog", "Cat", "Rabbit", "Guinea Pig", "Hamster", "Ferret", "Bird", "Reptile", "Fish", "Small Animal", "Other"] as const;

// A new owner on the web (Android, a computer, or no app yet) adds their first
// pet: name, species, optional birthday and one feeding time (2026-11-23,
// review: the sitter page's "Make a free binder" led to an account that could
// only wait to be shared a pet). Saved the way the app saves a new pet
// (PetStore.addPet: every field Pet.swift requires, no co-owners), then the
// feeding schedule the way the feeding editor does (care.ts). Everything else
// (vets, meds, records, more meals) is on the pet's page or in the app.
function AddFirstPet({ uid, more = false, onDone }: { uid: string; more?: boolean; onDone?: () => void }) {
  const [name, setName] = useState("");
  const [species, setSpecies] = useState<string>("Dog");
  const [birthday, setBirthday] = useState("");
  const [mealTime, setMealTime] = useState("");
  const [portion, setPortion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = new Date();
  const maxDay = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const petName = name.trim();
    if (!petName) { setError("Add your pet's name."); return; }
    const meal = mealTime ? timeAt(mealTime) : null;
    if (mealTime && !meal) { setError("That feeding time doesn't look right."); return; }
    // Noon on that day, so the date reads the same in any time zone nearby
    const born = birthday ? (() => { const [y, m, d] = birthday.split("-").map(Number); return new Date(y, m - 1, d, 12); })() : null;
    if (born && (isNaN(born.getTime()) || born > today)) { setError("The birthday can't be in the future."); return; }
    setBusy(true);
    setError(null);
    try {
      const { db } = firebase();
      const id = newId();
      await setDoc(doc(db, "pets", id), {
        id, ownerId: uid, coOwnerIds: [], name: petName.slice(0, 100), species, breed: "",
        ...(born ? { birthday: Timestamp.fromDate(born) } : {}),
        allergies: [], medications: [], foodInstructions: "", quirks: "", notes: "",
        additionalVets: [], additionalGroomers: [], isDeceased: false, licenses: [],
      });
      if (meal) {
        const out = feedingChanges(null, {
          feedingInfo: { foodName: "", defaultPortion: portion.trim() },
          scheduleItems: [{ id: newId(), time: meal, portion: portion.trim() }],
        }, null, deleteField);
        if (out.create) await setDoc(doc(db, `pets/${id}/feedingSchedule/schedule`), out.create);
      }
      // The pet shows under "Your pet" by itself (the listener on pets)
      setName(""); setBirthday(""); setMealTime(""); setPortion(""); setBusy(false); onDone?.();
    } catch (err) {
      const code = (err as { code?: string }).code || "";
      setError(code.includes("permission-denied") ? "Couldn't save your pet. Sign out and back in, then try again." : "Couldn't save that. Check your connection and try again.");
      setBusy(false);
    }
  }

  const input = "w-full rounded-xl px-4 py-3 text-(--charcoal)";
  const inputStyle = { border: "1px solid var(--mist-gray)", background: "var(--warm-cream)", fontSize: "16px" };
  const label = "block mb-1 text-(--charcoal) font-semibold";
  return (
    <Card title={more ? "Add another pet" : "Add your pet"}>
      {!more && <p className="font-inter text-(--charcoal) mb-4">
        Start a free binder: feedings, medications, vets and records in one place, ready to share with family or a sitter.
      </p>}
      <form onSubmit={save} className="space-y-4 font-inter">
        <div>
          <label className={label} htmlFor="new-pet-name" style={{ fontSize: "15px" }}>Pet&apos;s name</label>
          <input id="new-pet-name" className={input} style={inputStyle} value={name} maxLength={100} required
            onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="new-pet-species" style={{ fontSize: "15px" }}>Species</label>
            <select id="new-pet-species" className={input} style={inputStyle} value={species} onChange={(e) => setSpecies(e.target.value)}>
              {SPECIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="new-pet-birthday" style={{ fontSize: "15px" }}>Birthday <span className="font-normal text-(--slate-gray)">(optional)</span></label>
            <input id="new-pet-birthday" type="date" className={input} style={inputStyle} value={birthday} max={maxDay}
              onChange={(e) => setBirthday(e.target.value)} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="new-pet-meal" style={{ fontSize: "15px" }}>A feeding time <span className="font-normal text-(--slate-gray)">(optional)</span></label>
            <input id="new-pet-meal" type="time" className={input} style={inputStyle} value={mealTime}
              onChange={(e) => setMealTime(e.target.value)} />
          </div>
          {mealTime && (
            <div>
              <label className={label} htmlFor="new-pet-portion" style={{ fontSize: "15px" }}>Portion <span className="font-normal text-(--slate-gray)">(optional)</span></label>
              <input id="new-pet-portion" className={input} style={inputStyle} value={portion} maxLength={200} placeholder="e.g. 1 cup"
                onChange={(e) => setPortion(e.target.value)} />
            </div>
          )}
        </div>
        <p className="text-(--slate-gray)" style={{ fontSize: "14px" }}>
          You can add more meals, medications and the vet on your pet&apos;s page afterwards.
        </p>
        {error && <p style={{ color: "var(--error-red)" }} role="alert">{error}</p>}
        <button className="btn-coral w-full" type="submit" disabled={busy}>{busy ? "Saving…" : "Add Pet"}</button>
      </form>
    </Card>
  );
}

// A second (and further) pet: a button that opens the same form. The rules
// already let an owner create any number of pets.
function AddAnotherPet({ uid }: { uid: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return <button type="button" className="btn-coral w-full" onClick={() => setOpen(true)}>Add another pet</button>;
  }
  return <AddFirstPet uid={uid} more onDone={() => setOpen(false)} />;
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
      // "Someone else checked it off" only fits a feeding just checked off; otherwise
      // it's lost access (e.g. removed as a co-owner)
      setError(code.includes("permission-denied")
        ? (isFeeding && !task.done ? "Someone else just checked this off. It'll update in a moment." : "You can't change this anymore. The owner may have changed who can see this pet.")
        : "Couldn't save that. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }, [isFeeding, task.done]);

  // The same documents the app writes (FeedingStore / MedicationStore)
  function checkOff(amount: FeedingAmount = "all") {
    if (!isFeeding && !confirming) { setConfirming(true); return; }
    setConfirming(false);
    run(async () => {
      // Dates become Firestore timestamps when saved
      if (isFeeding) {
        // The row's day: a tap just after midnight on last night's row logged today's meal
        const log = feedingLogDoc(task.petId, task.itemId, uid, myName, new Date(), amount, task.time);
        await setDoc(doc(db, `${base}/feedingLogs/${log.id}`), log.data);
      } else {
        const log = medicationLogDoc(task.petId, task.itemId, task.title, task.detail, task.time, uid, new Date(), doseLogId(task.itemId, task.time));
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
  const doneColor = isFeeding && amount !== "all" ? "var(--amber-text, #9C5F0E)" : "var(--success-green)";
  const doneMark = !isFeeding || amount === "all" ? "✓" : amount === "some" ? "◐" : "✕";
  const choices = (done ? (["all", "some", "none"] as const).filter((a) => a !== amount) : (["some", "none"] as const));

  return (
    <li className="py-3">
      <div className="flex items-center gap-3">
        <div className="w-16 shrink-0 font-inter text-(--slate-gray)" style={{ fontSize: "14px" }}>{fmtTime(task.time)}</div>
        <div className="flex-1 min-w-0">
          <p className="font-inter font-semibold text-(--charcoal)">
            {isFeeding ? "🍽️ " : "💊 "}{showPet ? `${task.petName} · ` : ""}{task.title}
          </p>
          {task.detail && <p className="font-inter text-(--slate-gray)" style={{ fontSize: "14px" }}>{task.detail}</p>}
          {done && done.skipped && (
            <p className="font-inter" style={{ fontSize: "14px", color: "var(--slate-gray)" }}>
              Skipped by {done.by} at {fmtTime(done.at)} (not given)
            </p>
          )}
          {done && !done.skipped && (
            <p className="font-inter" style={{ fontSize: "14px", color: doneColor }}>
              {doneMark} {isFeeding && amount !== "all" ? `${AMOUNT_TEXT[amount]} · ${done.by}` : `Done by ${done.by}`} at {fmtTime(done.at)}
            </p>
          )}
          {done?.pending && (
            <p className="font-inter" style={{ fontSize: "14px", color: "var(--amber-text, #9C5F0E)" }} role="status">
              Not sent yet. It&rsquo;ll send when you&rsquo;re back online; keep this page open until then.
            </p>
          )}
          <div className="flex flex-wrap gap-x-4">
            {isFeeding && !choosing && !busy && (
              <button className="font-inter underline text-(--bindr-navy)" style={{ fontSize: "14px", padding: "4px 0" }} onClick={() => setChoosing(true)}>
                {done ? "Change how much" : "Ate some or didn't eat?"}
              </button>
            )}
            {done && !busy && (
              <button className="font-inter underline text-(--slate-gray)" style={{ fontSize: "14px", padding: "4px 0" }} onClick={undo}>
                Not done yet
              </button>
            )}
          </div>
          {error && <p className="font-inter" style={{ fontSize: "14px", color: "var(--error-red)" }} role="alert">{error}</p>}
        </div>
        {!done && (
          <button
            className="btn-coral shrink-0"
            style={{ padding: "10px 16px", minWidth: 92, ...(confirming ? { backgroundColor: "var(--navy-fill)" } : {}) }}
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
          <button className="font-inter underline text-(--slate-gray)" style={{ fontSize: "14px" }} onClick={() => setChoosing(false)}>Cancel</button>
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
      <label className="flex items-start gap-3 font-inter text-(--charcoal) cursor-pointer">
        <input type="checkbox" className="mt-1" style={{ width: 20, height: 20 }} checked={on} disabled={saving}
          onChange={(e) => toggle(e.target.checked)} />
        <span>
          Email me at <strong>{email}</strong> when a dose or feeding is missed.
          <span className="block text-(--slate-gray)" style={{ fontSize: "14px" }}>
            Only if you don&apos;t have the PetBindr iPhone app (it sends a notification instead).
          </span>
        </span>
      </label>
      {error && <p className="font-inter mt-2" style={{ fontSize: "14px", color: "var(--error-red)" }} role="alert">Couldn&apos;t save that. Try again.</p>}
    </Card>
  );
}

// Someone inviting you to co-own a pet: accept or decline. Co-owners always
// join by accepting now; they used to be added without asking (2026-11-14).
// Same functions as the iPhone app (myCoOwnerInvites, respondToCoOwnerInvite).
type CoOwnerInvite = {
  inviteId: string; petId: string; petName: string; species: string | null; breed: string | null; fromName: string;
};

function CoOwnerInviteOffers({ user }: { user: User }) {
  const [invites, setInvites] = useState<CoOwnerInvite[]>([]);
  const [working, setWorking] = useState<string | null>(null);
  const [confirmDecline, setConfirmDecline] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await user.getIdToken(true); // the confirmed-email flag must be in the token
        const r = await httpsCallable<unknown, { invites: CoOwnerInvite[] }>(firebase().functions, "myCoOwnerInvites")();
        if (!cancelled) setInvites(r.data.invites || []);
      } catch { /* invites show on the next visit */ }
    })();
    return () => { cancelled = true; };
  }, [user]);

  async function respond(inviteId: string, accept: boolean) {
    setWorking(inviteId);
    setError(null);
    try {
      await httpsCallable(firebase().functions, "respondToCoOwnerInvite")({ inviteId, accept });
      // An accepted pet appears under "Your pets" by itself
      setInvites((list) => list.filter((i) => i.inviteId !== inviteId));
    } catch (e) {
      setError((e as Error).message || "Couldn't do that. Please try again.");
    } finally {
      setWorking(null);
      setConfirmDecline(null);
    }
  }

  if (invites.length === 0) return null;
  return (
    <>
      {invites.map((i) => {
        const kind = [i.species, i.breed].filter(Boolean).join(" · ");
        return (
          <Card key={i.inviteId} title={`${i.fromName} invited you to co-own ${i.petName}`}>
            <p className="font-inter text-(--charcoal)">
              {kind ? `${kind}. ` : ""}You&apos;ll both see {i.petName}&apos;s feedings, medications, vet and records, and either of you can check things off and make changes.
            </p>
            {error && <p className="font-inter mt-2" style={{ fontSize: "15px", color: "var(--error-red)" }} role="alert">{error}</p>}
            <div className="flex flex-wrap gap-2 mt-3">
              <button className="btn-coral" style={{ padding: "10px 16px" }} disabled={!!working} onClick={() => respond(i.inviteId, true)}>
                {working === i.inviteId ? "Accepting…" : "Accept"}
              </button>
              {confirmDecline === i.inviteId ? (
                <button className="btn-ghost" style={{ padding: "10px 16px", color: "var(--error-red)" }} disabled={!!working} onClick={() => respond(i.inviteId, false)}>
                  Tap to decline
                </button>
              ) : (
                <button className="btn-ghost" style={{ padding: "10px 16px" }} disabled={!!working} onClick={() => setConfirmDecline(i.inviteId)}>
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
            <p className="font-inter text-(--charcoal)">
              {kind ? `${kind}, with` : "With"} all their records: vaccines, vet visits, medications, feeding and the vet&apos;s details.
            </p>
            {o.note && <p className="font-inter italic mt-2 text-(--charcoal)">“{o.note}”</p>}
            {o.keepAsCoOwner && (
              <p className="font-inter mt-2" style={{ fontSize: "15px", color: "var(--slate-gray)" }}>
                {o.fromName} will stay on as a co-owner. If you'd rather not share, ask them or email hello@petbindr.com.
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
      <span className="block mb-1 text-(--charcoal) font-semibold" style={{ fontSize: "15px" }}>{label}</span>
      <input
        className="w-full rounded-xl px-4 py-3 text-(--charcoal)"
        style={{ border: "1px solid var(--mist-gray)", background: "var(--warm-cream)", fontSize: "16px" }}
        type={type} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} required
      />
    </label>
  );
}

function LinkButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <button className="block mx-auto underline text-(--bindr-navy)" onClick={onClick}>{children}</button>;
}
