// Emulator test for sitter mode on petbindr.com/app (app/app/SitterMode.tsx,
// HomeApp.tsx, sitter.ts): a pro sitter with an account ("Jess") using the
// website, with the real Firestore and Storage rules from the app repo. Makes
// the same reads and writes the site makes. Run from the PetBindr repo:
//   PATH=/opt/homebrew/opt/openjdk@21/bin:$PATH firebase emulators:exec --config firebase.test.json \
//     --only auth,firestore,storage --project demo-petbindr \
//     "node ../petbindr-site/scripts/web-sitter-rules-test.mts '$PWD/functions'"
import { createRequire } from "node:module";
import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from "firebase/auth";
import {
  getFirestore, connectFirestoreEmulator, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
  collection, query, where, serverTimestamp, Timestamp,
} from "firebase/firestore";
import { getStorage, connectStorageEmulator, ref, uploadBytes, deleteObject } from "firebase/storage";
import { feedingLogDoc, medicationLogDoc } from "../app/app/today.ts";
import { toSit, isLive, isUpcoming, isPending, reportDoc, reportPhotoPath } from "../app/app/sitter.ts";

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
  try { await p; check(`${label} (was allowed)`, false); } catch (e) {
    const code = String((e as { code?: string }).code);
    check(label, code.includes("permission-denied") || code.includes("unauthorized"));
  }
};
const allowed = async (label: string, p: Promise<unknown>) => {
  try { await p; check(label, true); } catch (e) { check(`${label} (${(e as { code?: string }).code})`, false); }
};

// Jess signs up on the website
const app = initializeApp({ apiKey: "demo-key", projectId: PROJECT, storageBucket: `${PROJECT}.appspot.com` }, "jess");
const auth = getAuth(app);
connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
const db = getFirestore(app);
connectFirestoreEmulator(db, "127.0.0.1", 8080);
const storage = getStorage(app);
connectStorageEmulator(storage, "127.0.0.1", 9199);
const { user } = await createUserWithEmailAndPassword(auth, `jess${Date.now()}@example.test`, "secret-123");
const uid = user.uid;
await setDoc(doc(db, "users", uid), { id: uid, email: user.email, displayName: "Jess", createdAt: serverTimestamp(), showOverdueReminders: false, overdueReminderPetIds: [] });

// Three clients' pets, set up as the app would
const now = new Date();
const day = 86400000;
const at = (ms: number) => new Date(now.getTime() + ms); // plain dates: the admin SDK has its own Timestamp
const P = `ws${Date.now()}`; // fresh IDs each run
const rex = `${P}rex`, mia = `${P}mia`, old = `${P}old`, nope = `${P}nope`, bo = `${P}bo`;
for (const [id, owner, co] of [[rex, "dana", ["sam"]], [mia, "lee", []], [old, "kim", []], [nope, "stranger", []], [bo, "dana", ["sam"]]] as const) {
  await admin.doc(`pets/${id}`).set({ id, ownerId: owner, coOwnerIds: co, name: id.slice(P.length), species: "Dog", isDeceased: false, notes: "owner-only note" });
  await admin.doc(`pets/${id}/feedingSchedule/schedule`).set({ scheduleItems: [{ id: "am", time: new Date(2026, 0, 1, 7), portion: "1 cup" }] });
  await admin.doc(`pets/${id}/medicationSchedules/m1`).set({ medicationName: "Apoquel", dosage: "16 mg", frequency: "Daily", isActive: true, scheduledTimes: [new Date(2026, 0, 1, 8)], startDate: new Date(2026, 0, 1) });
  // The server's copy for the sitter (syncSitterPetView*), notes left out by the share
  await admin.doc(`sitterPetViews/${uid}/sharedPets/${id}`).set({ id, ownerId: owner, coOwnerIds: co, name: id.slice(P.length), species: "Dog", isDeceased: false, notes: "" });
}
const shareBase = { ownerName: "Dana", ownerPhone: "555-0100", petName: "Rex", sharedWithUserId: uid, sharedWithEmail: user.email, invitedAt: new Date() };
await admin.doc(`petShares/${rex}_${uid}`).set({ ...shareBase, petId: rex, ownerId: "dana", status: "pending", startDate: at(-day), endDate: at(3 * day), permissions: {} });
await admin.doc(`petShares/${bo}_${uid}`).set({ ...shareBase, petName: "Bo", petId: bo, ownerId: "dana", status: "active", startDate: at(-day), endDate: at(3 * day), permissions: { canViewMedications: false, canViewHouseholdAccess: false } });
await admin.doc(`petShares/${mia}_${uid}`).set({ ...shareBase, ownerName: "Lee", petName: "Mia", petId: mia, ownerId: "lee", status: "active", startDate: at(3 * day), endDate: at(5 * day), permissions: {} });
await admin.doc(`petShares/${old}_${uid}`).set({ ...shareBase, ownerName: "Kim", petName: "Old", petId: old, ownerId: "kim", status: "active", startDate: at(-10 * day), endDate: at(-day), permissions: {} });

// HomeApp's query: every share made out to me
const mine = (await getDocs(query(collection(db, "petShares"), where("sharedWithUserId", "==", uid)))).docs
  .map((d) => toSit({ ...d.data(), id: d.id })!);
check("lists my 4 shares", mine.length === 4);
check("Rex: an invite to accept", isPending(mine.find((s) => s.petId === rex)!, now));
check("Mia: upcoming", isUpcoming(mine.find((s) => s.petId === mia)!, now));
check("Old: neither live nor upcoming", !isLive(mine.find((s) => s.petId === old)!, now) && !isUpcoming(mine.find((s) => s.petId === old)!, now));
await denied("can't list other people's shares", getDocs(query(collection(db, "petShares"), where("ownerId", "==", "dana"))));

// Before accepting: nothing
const feed = feedingLogDoc(rex, "am", uid, "Jess", now, "all");
await denied("before accepting: can't check off", setDoc(doc(db, `pets/${rex}/feedingLogs/${feed.id}`), feed.data));
await denied("before accepting: can't read the copy", getDoc(doc(db, "sitterPetViews", uid, "sharedPets", rex)));

// Accepting (SitInvites): only status and the two dates
await denied("accepting can't switch on more permissions", updateDoc(doc(db, "petShares", `${rex}_${uid}`), { status: "active", "permissions.canViewHouseholdAccess": true }));
await allowed("accepts the invite", updateDoc(doc(db, "petShares", `${rex}_${uid}`), { status: "active", respondedAt: serverTimestamp(), updatedAt: serverTimestamp() }));

// The pet: from the copy only
const copy = await getDoc(doc(db, "sitterPetViews", uid, "sharedPets", rex));
check("reads Rex's copy (owner ids for the report)", copy.exists() && copy.data()!.ownerId === "dana");
await denied("can't read the pet document itself", getDoc(doc(db, `pets/${rex}`)));
await denied("can't read another sitter's copies", getDoc(doc(db, "sitterPetViews", "someoneElse", "sharedPets", rex)));
check("upcoming sit: reads Mia's copy (early look)", (await getDoc(doc(db, "sitterPetViews", uid, "sharedPets", mia))).exists());
await denied("ended sit: no copy", getDoc(doc(db, "sitterPetViews", uid, "sharedPets", old)));
await denied("not shared: no copy", getDoc(doc(db, "sitterPetViews", uid, "sharedPets", nope)));

// Today during the sit (HomeApp's listeners and TaskRow's writes)
const since = Timestamp.fromDate(new Date(now.getTime() - 2 * day));
check("reads Rex's feeding schedule", (await getDoc(doc(db, `pets/${rex}/feedingSchedule/schedule`))).exists());
check("reads Rex's medications", (await getDocs(collection(db, `pets/${rex}/medicationSchedules`))).size === 1);
check("reads Rex's recent check-offs", (await getDocs(query(collection(db, `pets/${rex}/feedingLogs`), where("date", ">=", since)))).size === 0);
await allowed("checks off Rex's breakfast", setDoc(doc(db, `pets/${rex}/feedingLogs/${feed.id}`), feed.data));
await allowed("sets Ate some", updateDoc(doc(db, `pets/${rex}/feedingLogs/${feed.id}`), { amount: "some" }));
await denied("can't change anything else on it", updateDoc(doc(db, `pets/${rex}/feedingLogs/${feed.id}`), { completedByName: "Dana" }));
const due = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8);
const dose = medicationLogDoc(rex, "m1", "Apoquel", "16 mg", due, uid, now, `${P}-DOSE`);
await allowed("gives Rex's dose", setDoc(doc(db, `pets/${rex}/medicationLogs/${dose.id}`), dose.data));
await denied("can't log a dose as the owner", setDoc(doc(db, `pets/${rex}/medicationLogs/${P}-FAKE`), { ...dose.data, id: `${P}-FAKE`, ownerId: "dana" }));

// The share's switches: Bo has medications off
await denied("medications off: can't read Bo's medications", getDocs(collection(db, `pets/${bo}/medicationSchedules`)));
const boDose = medicationLogDoc(bo, "m1", "Apoquel", "16 mg", due, uid, now, `${P}-BODOSE`);
await denied("medications off: can't log Bo's dose", setDoc(doc(db, `pets/${bo}/medicationLogs/${boDose.id}`), boDose.data));
const boFeed = feedingLogDoc(bo, "am", uid, "Jess", now, "all");
await allowed("feeding on: checks off Bo's breakfast", setDoc(doc(db, `pets/${bo}/feedingLogs/${boFeed.id}`), boFeed.data));

// Upcoming and ended sits: read the routine early, do nothing
check("upcoming: reads Mia's feeding schedule", (await getDoc(doc(db, `pets/${mia}/feedingSchedule/schedule`))).exists());
const miaFeed = feedingLogDoc(mia, "am", uid, "Jess", now, "all");
await denied("upcoming: can't check off Mia yet", setDoc(doc(db, `pets/${mia}/feedingLogs/${miaFeed.id}`), miaFeed.data));
await denied("ended: can't read Old's schedule", getDoc(doc(db, `pets/${old}/feedingSchedule/schedule`)));
const oldFeed = feedingLogDoc(old, "am", uid, "Jess", now, "all");
await denied("ended: can't check off Old", setDoc(doc(db, `pets/${old}/feedingLogs/${oldFeed.id}`), oldFeed.data));
await denied("not shared: can't check off", setDoc(doc(db, `pets/${nope}/feedingLogs/${feed.id}`), { ...feed.data, petId: nope }));

// Send Visit Report: photo first, then the report, like the app
const reportId = doc(collection(db, "visitReports")).id;
const photoRef = ref(storage, reportPhotoPath(rex, reportId, 0));
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 0xff, 0xd9]);
await allowed("uploads a report photo", uploadBytes(photoRef, jpeg, { contentType: "image/jpeg", customMetadata: { uploadedBy: uid } }));
await denied("photo must say who uploaded it", uploadBytes(ref(storage, reportPhotoPath(rex, reportId, 1)), jpeg, { contentType: "image/jpeg", customMetadata: { uploadedBy: "dana" } }));
await denied("no photos under a pet that isn't shared", uploadBytes(ref(storage, reportPhotoPath(nope, reportId, 0)), jpeg, { contentType: "image/jpeg", customMetadata: { uploadedBy: uid } }));
await denied("no photos under an upcoming sit's pet", uploadBytes(ref(storage, reportPhotoPath(mia, reportId, 0)), jpeg, { contentType: "image/jpeg", customMetadata: { uploadedBy: uid } }));
const items = [{ pet: "Rex", title: "Breakfast", kind: "feeding" as const, time: now, detail: "Ate some" }];
const report = (pets: { id: string; name: string }[], ownerId: string, coOwnerIds: string[]) => reportDoc({
  uid, sitterName: "Jess", ownerId, coOwnerIds, pets, note: "Good walk", items, photoPaths: [`gs://${photoRef.bucket}/${photoRef.fullPath}`],
}, serverTimestamp());
await allowed("sends the report for Rex and Bo", setDoc(doc(db, "visitReports", reportId), report([{ id: rex, name: "Rex" }, { id: bo, name: "Bo" }], "dana", ["sam"])));
const saved = await getDoc(doc(db, "visitReports", reportId));
check("report saved with the owners", saved.exists() && saved.data()!.ownerIds.join() === "dana,sam" && saved.data()!.petIds.length === 2);
await denied("owners must match the pet", setDoc(doc(collection(db, "visitReports")), report([{ id: rex, name: "Rex" }], "dana", [])));
await denied("no report for an upcoming sit", setDoc(doc(collection(db, "visitReports")), report([{ id: mia, name: "Mia" }], "lee", [])));
await denied("no report for an ended sit", setDoc(doc(collection(db, "visitReports")), report([{ id: old, name: "Old" }], "kim", [])));
await denied("no extra fields", setDoc(doc(collection(db, "visitReports")), { ...report([{ id: rex, name: "Rex" }], "dana", ["sam"]), urgent: true }));
await denied("can't change a sent report", updateDoc(doc(db, "visitReports", reportId), { note: "edited" }));

// Undo (TaskRow "Not done yet"), and the photo clean-up the form does when a report fails
await allowed("undoes the breakfast", deleteDoc(doc(db, `pets/${rex}/feedingLogs/${feed.id}`)));
await allowed("undoes the dose", deleteDoc(doc(db, `pets/${rex}/medicationLogs/${dose.id}`)));
await allowed("removes their own photo", deleteObject(photoRef));

// The owner ends the sit: access stops at once
await admin.doc(`petShares/${rex}_${uid}`).update({ status: "revoked" });
await denied("turned off: can't check off", setDoc(doc(db, `pets/${rex}/feedingLogs/${feed.id}`), feed.data));
await denied("turned off: can't read the copy", getDoc(doc(db, "sitterPetViews", uid, "sharedPets", rex)));
await denied("can't switch it back on", updateDoc(doc(db, "petShares", `${rex}_${uid}`), { status: "active" }));

// Clean up what this run made
for (const id of [rex, mia, old, nope, bo]) {
  await admin.recursiveDelete(admin.doc(`pets/${id}`));
  await admin.doc(`petShares/${id}_${uid}`).delete();
  await admin.doc(`sitterPetViews/${uid}/sharedPets/${id}`).delete();
}
await admin.doc(`visitReports/${reportId}`).delete();

console.log(`\n${ok} ok, ${bad} wrong`);
process.exit(bad ? 1 : 0);
