// Emulator test for petbindr.com/app: a co-owner using the website, with the
// real Firestore rules from the app repo. Signs up like the site, then makes
// the same check-off writes the site makes (app/app/today.ts). Run from the
// PetBindr repo:
//   PATH=/opt/homebrew/opt/openjdk@21/bin:$PATH firebase emulators:exec --only auth,firestore \
//     --project demo-petbindr "node ../petbindr-site/scripts/web-app-rules-test.mts '$PWD/functions'"
import { createRequire } from "node:module";
import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from "firebase/auth";
import {
  getFirestore, connectFirestoreEmulator, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, deleteField,
  collection, query, where, serverTimestamp,
} from "firebase/firestore";
import { feedingLogDoc, medicationLogDoc, tasksFor } from "../app/app/today.ts";

const fns = process.argv[2];
const require = createRequire(fns + "/index.js");
const { initializeApp: adminInit } = require("firebase-admin/app");
const { getFirestore: adminDb } = require("firebase-admin/firestore");

process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8080";
const PROJECT = "demo-petbindr";
const admin = adminDb(adminInit({ projectId: PROJECT }, "admin"));

let ok = 0, bad = 0;
const check = (label: string, cond: boolean) => { cond ? ok++ : bad++; console.log(cond ? "ok   " : "WRONG", label); };
const denied = async (label: string, p: Promise<unknown>) => {
  try { await p; check(`${label} (was allowed)`, false); } catch (e) { check(label, String((e as { code?: string }).code).includes("permission-denied")); }
};

// The owner's pet, set up as the app would
await admin.doc("users/owner").set({ id: "owner", email: "owner@example.test", displayName: "Marcus" });
await admin.doc("pets/rex").set({ id: "rex", ownerId: "owner", coOwnerIds: [], name: "Rex", species: "Dog", isDeceased: false });
await admin.doc("pets/rex/feedingSchedule/schedule").set({ scheduleItems: [{ id: "am", time: new Date(2026, 0, 1, 7), portion: "1 cup" }] });
await admin.doc("pets/rex/medicationSchedules/m1").set({ medicationName: "Apoquel", dosage: "5 mg", frequency: "Daily", isActive: true, scheduledTimes: [new Date(2026, 0, 1, 8)], startDate: new Date(2026, 0, 1) });
await admin.doc("pets/other").set({ id: "other", ownerId: "stranger", coOwnerIds: [], name: "Nope", isDeceased: false });

// Priya signs up on the website
const app = initializeApp({ apiKey: "demo-key", projectId: PROJECT });
const auth = getAuth(app);
connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
const db = getFirestore(app);
connectFirestoreEmulator(db, "127.0.0.1", 8080);
const email = `priya${Date.now()}@example.test`;
const { user } = await createUserWithEmailAndPassword(auth, email, "secret-123");
const uid = user.uid;
await setDoc(doc(db, "users", uid), { id: uid, email, displayName: "Priya", createdAt: serverTimestamp(), showOverdueReminders: false, overdueReminderPetIds: [] });
check("sign-up profile saved", (await getDoc(doc(db, "users", uid))).data()?.displayName === "Priya");

// Not a co-owner yet
const coQuery = query(collection(db, "pets"), where("coOwnerIds", "array-contains", uid));
check("no pets before being added", (await getDocs(coQuery)).size === 0);
const now = new Date();
const feed = feedingLogDoc("rex", "am", uid, "Priya", now, "all");
await denied("can't check off before being added", setDoc(doc(db, `pets/rex/feedingLogs/${feed.id}`), feed.data));

// The owner adds her in the app (Manage Ownership)
await admin.doc("pets/rex").update({ coOwnerIds: [uid] });
const pets = await getDocs(coQuery);
check("Rex shows up once added", pets.size === 1 && pets.docs[0].data().name === "Rex");
check("can read the feeding schedule", (await getDoc(doc(db, "pets/rex/feedingSchedule/schedule"))).exists());
check("can read medication schedules", (await getDocs(collection(db, "pets/rex/medicationSchedules"))).size === 1);
await admin.doc("pets/rex/allergies/a1").set({ allergenName: "Chicken", severity: "Severe", isActive: true });
check("pet page: can read allergies", (await getDocs(collection(db, "pets/rex/allergies"))).size === 1);
check("pet page: can read the pet's details", (await getDoc(doc(db, "pets/rex"))).data()?.name === "Rex");
await denied("pet page: can't read the owner's household (home codes, contacts)", getDoc(doc(db, "households/owner")));
await admin.doc("pets/rex/healthRecords/h1").set({ type: "Vaccination", title: "Rabies", date: new Date(), vaccinationData: { vaccineName: "Rabies" } });
await admin.doc("pets/other/healthRecords/h2").set({ type: "Vet Visit", title: "Private", date: new Date() });
check("pet page: can read health records", (await getDocs(collection(db, "pets/rex/healthRecords"))).size === 1);
await denied("pet page: can't read another pet's health records", getDocs(collection(db, "pets/other/healthRecords")));

// Feeding: check off, change amount, back to all, undo
await setDoc(doc(db, `pets/rex/feedingLogs/${feed.id}`), feed.data);
check("breakfast check-off saved", (await getDoc(doc(db, `pets/rex/feedingLogs/${feed.id}`))).data()?.completedByName === "Priya");
// (a second tap is a moment later, so it's an overwrite, not just an amount change)
await denied("a second check-off of the same meal is refused", setDoc(doc(db, `pets/rex/feedingLogs/${feed.id}`), feedingLogDoc("rex", "am", uid, "Priya", new Date(now.getTime() + 2000), "none").data));
await updateDoc(doc(db, `pets/rex/feedingLogs/${feed.id}`), { amount: "some" });
check("changed to Ate some", (await getDoc(doc(db, `pets/rex/feedingLogs/${feed.id}`))).data()?.amount === "some");
await updateDoc(doc(db, `pets/rex/feedingLogs/${feed.id}`), { amount: deleteField() });
check("back to ate it all", !("amount" in ((await getDoc(doc(db, `pets/rex/feedingLogs/${feed.id}`))).data() || {})));
await denied("can't change other fields", updateDoc(doc(db, `pets/rex/feedingLogs/${feed.id}`), { completedByName: "Someone" }));

// What Today shows from what she can read
const logs = (await getDocs(collection(db, "pets/rex/feedingLogs"))).docs.map((d) => ({ ...d.data(), id: d.id }));
const today = tasksFor({ petId: "rex", petName: "Rex", feeding: (await getDoc(doc(db, "pets/rex/feedingSchedule/schedule"))).data() as never, feedingLogs: logs as never, medications: [{ id: "m1", ...(await getDoc(doc(db, "pets/rex/medicationSchedules/m1"))).data() }] as never, medicationLogs: [] }, now, {});
check("Today: breakfast done by Priya", today.find((t) => t.kind === "feeding")?.done?.by === "Priya");
await deleteDoc(doc(db, `pets/rex/feedingLogs/${feed.id}`));
check("Not done yet removes it", !(await getDoc(doc(db, `pets/rex/feedingLogs/${feed.id}`))).exists());

// Dose: log and undo
const due = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8);
const dose = medicationLogDoc("rex", "m1", "Apoquel", "5 mg", due, uid, now, "WEBTEST-DOSE");
await setDoc(doc(db, `pets/rex/medicationLogs/${dose.id}`), dose.data);
check("dose logged", (await getDoc(doc(db, `pets/rex/medicationLogs/${dose.id}`))).data()?.ownerId === uid);
await denied("can't log a dose as someone else", setDoc(doc(db, "pets/rex/medicationLogs/FAKE"), medicationLogDoc("rex", "m1", "Apoquel", "5 mg", due, "owner", now, "FAKE").data));
await deleteDoc(doc(db, `pets/rex/medicationLogs/${dose.id}`));
check("dose undone", !(await getDoc(doc(db, `pets/rex/medicationLogs/${dose.id}`))).exists());

// Someone else's pet stays private
await denied("can't read a pet she doesn't co-own", getDoc(doc(db, "pets/other")));
const f2 = feedingLogDoc("other", "am", uid, "Priya", now, "all");
await denied("can't check off someone else's pet", setDoc(doc(db, `pets/other/feedingLogs/${f2.id}`), f2.data));

// Removed as co-owner: access ends
await admin.doc("pets/rex").update({ coOwnerIds: [] });
await denied("after removal, can't read Rex", getDoc(doc(db, "pets/rex")));

// Co-owner invites (coOwnerInvites rules), made by an owner signed in
const ownerApp = initializeApp({ apiKey: "demo-key", projectId: PROJECT }, "owner");
const ownerAuth = getAuth(ownerApp);
connectAuthEmulator(ownerAuth, "http://127.0.0.1:9099", { disableWarnings: true });
const odb = getFirestore(ownerApp);
connectFirestoreEmulator(odb, "127.0.0.1", 8080);
const marcus = (await createUserWithEmailAndPassword(ownerAuth, `marcus${Date.now()}@example.test`, "secret-123")).user.uid;
await admin.doc("pets/max").set({ id: "max", ownerId: marcus, coOwnerIds: [], name: "Max", isDeceased: false });
const inv = (petId: string, mail: string, extra: Record<string, unknown> = {}) =>
  ({ petId, email: mail, invitedBy: marcus, status: "pending", createdAt: serverTimestamp(), ...extra });
await setDoc(doc(odb, "coOwnerInvites/max_coowner_new@example.test"), inv("max", "new@example.test"));
check("owner can invite a co-owner by email", (await getDoc(doc(odb, "coOwnerInvites/max_coowner_new@example.test"))).exists());
await denied("invite ID must match pet and email", setDoc(doc(odb, "coOwnerInvites/max_coowner_other@example.test"), inv("max", "new2@example.test")));
await denied("email must be lowercase", setDoc(doc(odb, "coOwnerInvites/max_coowner_Up@example.test"), inv("max", "Up@example.test")));
await denied("can't invite to a pet you don't own", setDoc(doc(odb, "coOwnerInvites/rex_coowner_new@example.test"), inv("rex", "new@example.test")));
await denied("can't create it already accepted", setDoc(doc(odb, "coOwnerInvites/max_coowner_acc@example.test"), inv("max", "acc@example.test", { status: "accepted" })));
await denied("can't add other fields", setDoc(doc(odb, "coOwnerInvites/max_coowner_x@example.test"), inv("max", "x@example.test", { acceptedBy: "me" })));
await denied("owner can't mark it accepted", updateDoc(doc(odb, "coOwnerInvites/max_coowner_new@example.test"), { status: "accepted" }));
await denied("someone else can't read it", getDoc(doc(db, "coOwnerInvites/max_coowner_new@example.test")));
const mine = await getDocs(query(collection(odb, "coOwnerInvites"), where("invitedBy", "==", marcus), where("petId", "==", "max")));
check("owner can list their invites for a pet", mine.size === 1);
await deleteDoc(doc(odb, "coOwnerInvites/max_coowner_new@example.test"));
// (checked from the server: reading a deleted invite is refused, since the rule looks at who made it)
check("owner can cancel it", !(await admin.doc("coOwnerInvites/max_coowner_new@example.test").get()).exists);

console.log(`\n${ok} ok, ${bad} wrong`);
process.exit(bad ? 1 : 0);
