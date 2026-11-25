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
  collection, query, where, serverTimestamp, orderBy, limit, disableNetwork, enableNetwork,
} from "firebase/firestore";
import { feedingLogDoc, medicationLogDoc, doseLogId, tasksFor } from "../app/app/today.ts";
import { undoOwnDose, undoOwnMeal, setOwnMealAmount, DOSE_KEPT, MEAL_KEPT } from "../app/app/undo.ts";
import {
  healthRecordDoc, dayFromInput, vaccineDoc, vaccineChanges, allergyDoc, allergyChanges, reminderDoc, reminderChanges,
  nextOccurrence, nextReminderId,
} from "../app/app/records.ts";
import { dayAt, linkMessage } from "../app/app/links.ts";
import { feedingChanges, medicationChanges, newMedication, timeAt } from "../app/app/care.ts";

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
await setDoc(doc(db, "users", uid), { alertEmails: false }, { merge: true });
check("Alerts setting: can turn alert emails off", (await getDoc(doc(db, "users", uid))).data()?.alertEmails === false);
await denied("Alerts setting: can't change someone else's", setDoc(doc(db, "users", "owner"), { alertEmails: false }, { merge: true }));

// Not a co-owner yet
const coQuery = query(collection(db, "pets"), where("coOwnerIds", "array-contains", uid));
check("no pets before being added", (await getDocs(coQuery)).size === 0);
const now = new Date();
const feed = feedingLogDoc("rex", "am", uid, "Priya", now, "all");
await denied("can't check off before being added", setDoc(doc(db, `pets/rex/feedingLogs/${feed.id}`), feed.data));
await denied("Change care: can't edit feeding times before being added", updateDoc(doc(db, "pets/rex/feedingSchedule/schedule"), { "mealDays.am": { weekdays: [1] } }));
await denied("Change care: can't edit a medication before being added", updateDoc(doc(db, "pets/rex/medicationSchedules/m1"), { dosage: "50 mg" }));

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

// Adding to the record from the website (AddToRecord)
const day = dayFromInput("2026-11-12")!;
check("date input → that day at noon", day.getFullYear() === 2026 && day.getMonth() === 10 && day.getDate() === 12 && day.getHours() === 12);
check("bad date input refused", dayFromInput("12/11/2026") === null);
const w = healthRecordDoc("rex", uid, "Weight", day, { title: "Weight", notes: " after a walk ", weightData: { weight: 12.4, unit: "lbs" } });
await setDoc(doc(db, `pets/rex/healthRecords/${w.id}`), w.data);
const savedW = (await getDoc(doc(db, `pets/rex/healthRecords/${w.id}`))).data();
check("co-owner logs a weight", savedW?.weightData?.weight === 12.4 && savedW?.type === "Weight" && savedW?.source === "owner" && savedW?.createdBy === uid && savedW?.notes === "after a walk");
check("record has every field the app needs", ["id", "petId", "type", "date", "title", "notes", "source", "createdAt", "createdBy", "attachments"].every((k) => k in (savedW || {})) && savedW?.id === w.id);
const v = healthRecordDoc("rex", uid, "Vet Visit", day, { title: "Ear infection", vetVisitData: { clinicName: "Vet Co", reason: "Ear infection", veterinarianName: "", diagnosis: "Otitis" } });
await setDoc(doc(db, `pets/rex/healthRecords/${v.id}`), v.data);
const savedV = (await getDoc(doc(db, `pets/rex/healthRecords/${v.id}`))).data();
check("co-owner adds a vet visit (empty optional fields left out)", savedV?.vetVisitData?.reason === "Ear infection" && savedV?.vetVisitData?.diagnosis === "Otitis" && !("veterinarianName" in (savedV?.vetVisitData || {})));
await updateDoc(doc(db, "pets/rex"), { notes: "Loves the blue ball" });
check("co-owner edits the pet's notes", (await getDoc(doc(db, "pets/rex"))).data()?.notes === "Loves the blue ball");
await denied("co-owner can't make themselves the owner", updateDoc(doc(db, "pets/rex"), { ownerId: uid }));
const x = healthRecordDoc("other", uid, "Weight", day, { title: "Weight", weightData: { weight: 3, unit: "kg" } });
await denied("can't add to a pet she doesn't co-own", setDoc(doc(db, `pets/other/healthRecords/${x.id}`), x.data));

// Vaccines, allergies and reminders (app/app/HealthEditors.tsx; 2026-11-24, review #14)
const vxDue = new Date(2027, 10, 1, 12);
const vx = vaccineDoc("rex", uid, { vaccineName: " Rabies ", given: day, nextDue: vxDue, administeredBy: "", notes: "" });
await setDoc(doc(db, `pets/rex/healthRecords/${vx.id}`), vx.data);
const savedVx = (await getDoc(doc(db, `pets/rex/healthRecords/${vx.id}`))).data();
check("co-owner adds a vaccine in the app's shape", savedVx?.type === "Vaccination" && savedVx?.title === "Rabies" &&
  savedVx?.vaccinationData?.vaccineName === "Rabies" && savedVx?.vaccinationData?.nextDueDate?.toDate().getTime() === vxDue.getTime() &&
  !("administeredBy" in (savedVx?.vaccinationData || {})) && ["id", "petId", "date", "notes", "source", "createdAt", "createdBy", "attachments"].every((k) => k in (savedVx || {})));
// The app added a lot number meanwhile; the web edit keeps it
await admin.doc(`pets/rex/healthRecords/${vx.id}`).update({ "vaccinationData.lotNumber": "L123", title: "Annual Rabies Booster" });
const vxOpened = { vaccineName: "Rabies", given: day, nextDue: vxDue, administeredBy: "", notes: "" };
const vxEdit = vaccineChanges(vxOpened, { ...vxOpened, vaccineName: "Rabies (3 year)", nextDue: null, administeredBy: "Vet Co" }, "Annual Rabies Booster");
await updateDoc(doc(db, `pets/rex/healthRecords/${vx.id}`), vxEdit);
const editedVx = (await getDoc(doc(db, `pets/rex/healthRecords/${vx.id}`))).data();
check("vaccine edit saves only what changed (lot number and a typed title kept, due date cleared)",
  editedVx?.vaccinationData?.vaccineName === "Rabies (3 year)" && editedVx?.vaccinationData?.lotNumber === "L123" &&
  editedVx?.title === "Annual Rabies Booster" && editedVx?.vaccinationData?.nextDueDate === null && editedVx?.vaccinationData?.administeredBy === "Vet Co");
check("vaccine with no changes writes nothing", Object.keys(vaccineChanges(vxOpened, vxOpened)).length === 0);
await deleteDoc(doc(db, `pets/rex/healthRecords/${vx.id}`));
check("co-owner deletes a vaccine", !(await getDoc(doc(db, `pets/rex/healthRecords/${vx.id}`))).exists());
const vxOther = vaccineDoc("other", uid, { vaccineName: "Rabies", given: day, nextDue: null, administeredBy: "", notes: "" });
await denied("can't add a vaccine to a pet she doesn't co-own", setDoc(doc(db, `pets/other/healthRecords/${vxOther.id}`), vxOther.data));

const al = allergyDoc("rex", { allergenName: " Chicken ", category: "Food", severity: "Severe", symptoms: "Itching", notes: "", isActive: true });
await setDoc(doc(db, `pets/rex/allergies/${al.id}`), al.data);
const savedAl = (await getDoc(doc(db, `pets/rex/allergies/${al.id}`))).data();
check("co-owner adds an allergy with every field the app needs",
  ["id", "petId", "allergenName", "category", "severity", "symptoms", "notes", "isActive"].every((k) => k in (savedAl || {})) &&
  savedAl?.allergenName === "Chicken" && savedAl?.severity === "Severe" && savedAl?.category === "Food");
check("unknown allergy category/severity fall back to the app's", allergyDoc("rex", { allergenName: "x", category: "Bogus", severity: "Bad", symptoms: "", notes: "", isActive: true }).data.category === "Other");
const alOpened = { allergenName: "Chicken", category: "Food", severity: "Severe", symptoms: "Itching", notes: "", isActive: true };
const alEdit = allergyChanges(alOpened, { ...alOpened, isActive: false });
check("allergy edit is just the one field", JSON.stringify(alEdit) === JSON.stringify({ isActive: false }));
await updateDoc(doc(db, `pets/rex/allergies/${al.id}`), alEdit);
check("co-owner marks an allergy inactive", (await getDoc(doc(db, `pets/rex/allergies/${al.id}`))).data()?.isActive === false);
await deleteDoc(doc(db, `pets/rex/allergies/${al.id}`));
check("co-owner deletes an allergy", !(await getDoc(doc(db, `pets/rex/allergies/${al.id}`))).exists());
await denied("can't add an allergy to a pet she doesn't co-own", setDoc(doc(db, `pets/other/allergies/${al.id}`), { ...al.data, petId: "other" }));

const rmWhen = new Date(2026, 11, 1, 9, 0);
const rm = reminderDoc(uid, "rex", { title: "Flea dose", date: rmWhen, category: "Medication", notes: "", repeatDays: 30 });
await setDoc(doc(db, `customReminders/${rm.id}`), rm.data);
const savedRm = (await getDoc(doc(db, `customReminders/${rm.id}`))).data();
check("co-owner adds a repeating reminder in the app's shape",
  ["id", "ownerId", "petId", "title", "date", "category", "notes", "isCompleted", "isRecurring"].every((k) => k in (savedRm || {})) &&
  savedRm?.ownerId === uid && savedRm?.isRecurring === true && savedRm?.recurringFrequencyDays === 30 && savedRm?.isCompleted === false);
const rmOpened = { title: "Flea dose", date: rmWhen, category: "Medication", notes: "", repeatDays: 30 };
await updateDoc(doc(db, `customReminders/${rm.id}`), reminderChanges(rmOpened, { ...rmOpened, repeatDays: null }));
const noRepeat = (await getDoc(doc(db, `customReminders/${rm.id}`))).data();
check("turning repeat off clears both fields", noRepeat?.isRecurring === false && noRepeat?.recurringFrequencyDays === null);
check("her reminders list (the app's query) finds it",
  (await getDocs(query(collection(db, "customReminders"), where("ownerId", "==", uid)))).docs.some((d) => d.id === rm.id));
await denied("can't make a reminder for someone else", setDoc(doc(db, "customReminders/someone"), { ...rm.data, id: "someone", ownerId: "owner" }));
await admin.doc("customReminders/owners").set({ id: "owners", ownerId: "owner", petId: "rex", title: "Mine", date: rmWhen, category: "Custom", notes: "", isCompleted: false, isRecurring: false });
await denied("can't read the owner's own reminders", getDoc(doc(db, "customReminders/owners")));
await deleteDoc(doc(db, `customReminders/${rm.id}`));
check("co-owner deletes her reminder", !(await admin.doc(`customReminders/${rm.id}`).get()).exists);
// Same next ID and date as the app (CalendarStore.nextReminderId / nextOccurrence)
check("next reminder ID matches the app's", (await nextReminderId("ABC-123")) === "A0730F69-11FF-9734-55AE-51F7B5813982");
const jan31 = new Date(2026, 0, 31, 9);
check("monthly from Jan 31 goes to Feb 28, then Mar 31", nextOccurrence(jan31, 30, new Date(2026, 0, 31, 10)).getDate() === 28 &&
  nextOccurrence(jan31, 30, new Date(2026, 1, 28, 10)).getMonth() === 2 && nextOccurrence(jan31, 30, new Date(2026, 1, 28, 10)).getDate() === 31);
check("weekly checked off late lands in the future", nextOccurrence(new Date(2026, 0, 1, 9), 7, new Date(2026, 0, 20, 12)).getDate() === 22);

// Sitter links from the website (SitterLinkMaker): her links, and turning one off
check("link dates: first day from midnight, last day to 11:59 PM", dayAt("2026-11-12", 0)!.getHours() === 0 && dayAt("2026-11-14", 23, 59)!.getMinutes() === 59 && dayAt("bad", 0) === null);
const msg = linkMessage("Jess Taylor", ["Rex", "Mittens"], "https://www.petbindr.com/s#abc", "Trash Tuesday");
check("link message names the sitter, pets and note", msg.startsWith("Hi Jess! ") && msg.includes("Rex and Mittens: https://www.petbindr.com/s#abc") && msg.endsWith("This time: Trash Tuesday"));
await admin.doc("petShares/rex_link_mine").set({ petId: "rex", ownerId: uid, sharedWithUserId: "", shareType: "link", linkId: "mine", status: "active", sitterName: "Jess" });
await admin.doc("petShares/rex_link_theirs").set({ petId: "rex", ownerId: "owner", sharedWithUserId: "", shareType: "link", linkId: "theirs", status: "active", sitterName: "Sam" });
const myLinks = await getDocs(query(collection(db, "petShares"), where("ownerId", "==", uid), where("shareType", "==", "link")));
check("lists the links she made (not the other owner's)", myLinks.size === 1 && myLinks.docs[0].id === "rex_link_mine");
await updateDoc(doc(db, "petShares/rex_link_mine"), { status: "revoked", revokedAt: serverTimestamp(), updatedAt: serverTimestamp() });
check("turns her link off", (await getDoc(doc(db, "petShares/rex_link_mine"))).data()?.status === "revoked");
await denied("can't repoint a link to another pet", updateDoc(doc(db, "petShares/rex_link_mine"), { petId: "other" }));

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
check("dose saved with via web", (await getDoc(doc(db, `pets/rex/medicationLogs/${dose.id}`))).data()?.via === "web");
check("meal saved with via web", feed.data.via === "web");
// One ID per dose, the same as the app's: checking the same dose off twice is refused
const slot = medicationLogDoc("rex", "m1", "Apoquel", "5 mg", due, uid, now, doseLogId("m1", due));
check("dose ID is the schedule and its time", slot.id === `m1-${Math.floor(due.getTime() / 1000)}`);
await setDoc(doc(db, `pets/rex/medicationLogs/${slot.id}`), slot.data);
await denied("the same dose again (same ID) is refused", setDoc(doc(db, `pets/rex/medicationLogs/${slot.id}`),
  medicationLogDoc("rex", "m1", "Apoquel", "5 mg", due, uid, new Date(now.getTime() + 5000), slot.id).data));
await deleteDoc(doc(db, `pets/rex/medicationLogs/${slot.id}`));
await deleteDoc(doc(db, `pets/rex/medicationLogs/${dose.id}`));
check("dose undone", !(await getDoc(doc(db, `pets/rex/medicationLogs/${dose.id}`))).exists());

// "Not done yet" on her own dose goes with the Undo marker (app/app/undo.ts)
{
  const own = medicationLogDoc("rex", "m1", "Apoquel", "5 mg", due, uid, now, doseLogId("m1", due));
  await setDoc(doc(db, `pets/rex/medicationLogs/${own.id}`), own.data);
  await undoOwnDose(db, "rex", own.id, uid);
  check("Not done yet on her own dose removes it", !(await getDoc(doc(db, `pets/rex/medicationLogs/${own.id}`))).exists());
  check("Undo marker written", (await admin.doc(`pets/rex/doseUndos/${uid}`).get()).data()?.logId === own.id);

  // The tab goes offline, she checks the dose off and taps Not done yet; meanwhile
  // the owner logs the same dose. Back online her check-off is refused (same ID).
  const race = async (undo: (id: string) => Promise<unknown>) => {
    await disableNetwork(db);
    const mine = setDoc(doc(db, `pets/rex/medicationLogs/${own.id}`), own.data).then(() => "saved", (e) => String(e.code));
    const gone = undo(own.id).then(() => "done", (e) => String(e.code));
    await admin.doc(`pets/rex/medicationLogs/${own.id}`).set({ ...own.data, ownerId: "owner", givenBy: "owner", via: "app" });
    await enableNetwork(db);
    const out = { mine: await mine, undo: await gone, kept: (await admin.doc(`pets/rex/medicationLogs/${own.id}`).get()).data()?.ownerId };
    await admin.doc(`pets/rex/medicationLogs/${own.id}`).delete();
    return out;
  };
  const plain = await race((id) => deleteDoc(doc(db, `pets/rex/medicationLogs/${id}`)));
  check("offline race, plain delete (old web undo): the owner's dose was deleted", plain.mine.includes("permission-denied") && plain.undo === "done" && plain.kept === undefined);
  const guarded = await race((id) => undoOwnDose(db, "rex", id, uid));
  check("offline race, Not done yet: her check-off refused", guarded.mine.includes("permission-denied"));
  check("offline race, Not done yet: the owner's dose kept and she's told", guarded.undo === DOSE_KEPT && guarded.kept === "owner");

  // Removing a dose someone else logged (the row says who) is still a plain delete
  await admin.doc(`pets/rex/medicationLogs/${own.id}`).set({ ...own.data, ownerId: "owner", givenBy: "owner" });
  check("Undo marker can't remove the owner's dose", (await undoOwnDose(db, "rex", own.id, uid).then(() => "done", (e) => e.code)) === DOSE_KEPT);
  await deleteDoc(doc(db, `pets/rex/medicationLogs/${own.id}`));
  check("co-owner can still remove a dose the owner logged", !(await admin.doc(`pets/rex/medicationLogs/${own.id}`).get()).exists);
}

// "Not done yet" on her own meal goes with the meal Undo marker (Fresh list 9 O1):
// one meal has one log ID a day, the same race as the dose
{
  const own = feedingLogDoc("rex", "am", uid, "Priya", now, "all");
  await setDoc(doc(db, `pets/rex/feedingLogs/${own.id}`), own.data);
  await undoOwnMeal(db, "rex", own.id, uid);
  check("Not done yet on her own meal removes it", !(await getDoc(doc(db, `pets/rex/feedingLogs/${own.id}`))).exists());
  check("meal Undo marker written", (await admin.doc(`pets/rex/mealUndos/${uid}`).get()).data()?.logId === own.id);

  const race = async (undo: (id: string) => Promise<unknown>) => {
    await disableNetwork(db);
    const mine = setDoc(doc(db, `pets/rex/feedingLogs/${own.id}`), own.data).then(() => "saved", (e) => String(e.code));
    const gone = undo(own.id).then(() => "done", (e) => String(e.code));
    await admin.doc(`pets/rex/feedingLogs/${own.id}`).set({ ...own.data, completedBy: "owner", completedByName: "Jordan", via: "app" });
    await enableNetwork(db);
    const out = { mine: await mine, undo: await gone, kept: (await admin.doc(`pets/rex/feedingLogs/${own.id}`).get()).data()?.completedBy };
    await admin.doc(`pets/rex/feedingLogs/${own.id}`).delete();
    return out;
  };
  const plain = await race((id) => deleteDoc(doc(db, `pets/rex/feedingLogs/${id}`)));
  check("meal offline race, plain delete (old web undo): the owner's meal was deleted", plain.mine.includes("permission-denied") && plain.undo === "done" && plain.kept === undefined);
  const guarded = await race((id) => undoOwnMeal(db, "rex", id, uid));
  check("meal offline race, Not done yet: her check-off refused", guarded.mine.includes("permission-denied"));
  check("meal offline race, Not done yet: the owner's meal kept and she's told", guarded.undo === MEAL_KEPT && guarded.kept === "owner");

  // "Ate some" on her own meal, offline, after the owner's check-off won (Fresh list 10 O1)
  const amountRace = async (change: (id: string) => Promise<unknown>) => {
    await disableNetwork(db);
    const mine = setDoc(doc(db, `pets/rex/feedingLogs/${own.id}`), own.data).then(() => "saved", (e) => String(e.code));
    const changed = change(own.id).then(() => "done", (e) => String(e.code));
    await admin.doc(`pets/rex/feedingLogs/${own.id}`).set({ ...own.data, completedBy: "owner", completedByName: "Jordan", via: "app" });
    await enableNetwork(db);
    const out = { mine: await mine, change: await changed, amount: (await admin.doc(`pets/rex/feedingLogs/${own.id}`).get()).data()?.amount };
    await admin.doc(`pets/rex/feedingLogs/${own.id}`).delete();
    return out;
  };
  const plainAmount = await amountRace((id) => updateDoc(doc(db, `pets/rex/feedingLogs/${id}`), { amount: "some" }));
  check("amount offline race, plain update (old web): the owner's meal changed to some", plainAmount.change === "done" && plainAmount.amount === "some");
  const guardedAmount = await amountRace((id) => setOwnMealAmount(db, "rex", id, uid, "some"));
  check("amount offline race, with marker: the owner's meal unchanged and she's told", guardedAmount.change === MEAL_KEPT && guardedAmount.amount === undefined);
  await setDoc(doc(db, `pets/rex/feedingLogs/${own.id}`), own.data);
  await setOwnMealAmount(db, "rex", own.id, uid, "none");
  check("Didn't eat on her own meal (with marker) saved", (await admin.doc(`pets/rex/feedingLogs/${own.id}`).get()).data()?.amount === "none");
  await admin.doc(`pets/rex/feedingLogs/${own.id}`).delete();

  await admin.doc(`pets/rex/feedingLogs/${own.id}`).set({ ...own.data, completedBy: "owner", completedByName: "Jordan" });
  check("meal Undo marker can't remove the owner's meal", (await undoOwnMeal(db, "rex", own.id, uid).then(() => "done", (e) => e.code)) === MEAL_KEPT);
  await deleteDoc(doc(db, `pets/rex/feedingLogs/${own.id}`));
  check("co-owner can still remove a meal the owner logged", !(await admin.doc(`pets/rex/feedingLogs/${own.id}`).get()).exists);
}

// Someone else's pet stays private
await denied("can't read a pet she doesn't co-own", getDoc(doc(db, "pets/other")));
const f2 = feedingLogDoc("other", "am", uid, "Priya", now, "all");
await denied("can't check off someone else's pet", setDoc(doc(db, `pets/other/feedingLogs/${f2.id}`), f2.data));

// Removed as co-owner: access ends
// Change care (app/app/CareEditor.tsx): feeding times, days and medications, written like the app
{
  const ref = doc(db, "pets/rex/feedingSchedule/schedule");
  const opened = (await getDoc(ref)).data() as never;
  const mine = { feedingInfo: { foodName: "Kibble" }, mealDays: { am: { weekdays: [1, 3, 5] } },
    scheduleItems: [{ id: "am", time: timeAt("07:30", new Date(2026, 0, 1, 7))!, portion: "1 cup" }, { id: "NEW1", time: timeAt("18:00")!, portion: "1 cup" }] };
  const out = feedingChanges(opened, mine, (await getDoc(ref)).data() as never, deleteField);
  await updateDoc(ref, out.update!);
  const saved = (await getDoc(ref)).data()!;
  check("Change care: co-owner saves feeding times", saved.scheduleItems.length === 2 && saved.scheduleItems[0].time.toDate().getMinutes() === 30);
  check("Change care: co-owner saves a meal's days", JSON.stringify(saved.mealDays.am.weekdays) === "[1,3,5]");
  const out2 = feedingChanges(saved as never, { ...mine, mealDays: {} }, saved as never, deleteField);
  await updateDoc(ref, out2.update!);
  check("Change care: back to every day removes the days", !("am" in ((await getDoc(ref)).data()!.mealDays || {})));

  const medRef = doc(db, "pets/rex/medicationSchedules/m1");
  const med = { id: "m1", ...(await getDoc(medRef)).data() } as never;
  await updateDoc(medRef, medicationChanges(med, { ...(med as object), id: "m1", dosage: "5.4 mg" }, med, deleteField));
  check("Change care: co-owner changes a dose", (await getDoc(medRef)).data()?.dosage === "5.4 mg");
  const nm = newMedication("rex", { medicationName: "Gabapentin", dosage: "100 mg", frequency: "Twice Daily", scheduledTimes: [timeAt("08:00")!, timeAt("20:00")!], startDate: new Date() });
  await setDoc(doc(db, `pets/rex/medicationSchedules/${nm.id}`), nm);
  check("Change care: co-owner adds a medication", (await getDoc(doc(db, `pets/rex/medicationSchedules/${nm.id}`))).data()?.frequency === "Twice Daily");
  await denied("Change care: can't edit another family's feeding times", setDoc(doc(db, "pets/other/feedingSchedule/schedule"), { mealDays: { x: { weekdays: [1] } } }, { merge: true }));
  await denied("Change care: can't add a medication to another family's pet", setDoc(doc(db, "pets/other/medicationSchedules/x"), nm));
}

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

// Visit reports (app/app/VisitReports.tsx): the same query the page makes
await admin.doc("visitReports/r1").set({ sitterId: "link_abc", sitterName: "Jess", ownerIds: ["owner", uid], petIds: ["rex"], petNames: ["Rex"],
  note: "Great walk", items: [], photoPaths: [], createdAt: new Date() });
await admin.doc("visitReports/r2").set({ sitterId: "s", sitterName: "Sam", ownerIds: ["stranger"], petIds: ["other"], petNames: ["Nope"],
  note: "", items: [], photoPaths: [], createdAt: new Date() });
const reports = await getDocs(query(collection(db, "visitReports"), where("ownerIds", "array-contains", uid), orderBy("createdAt", "desc"), limit(5)));
check("Visit reports: a co-owner sees reports sent to them", reports.size === 1 && reports.docs[0].data().sitterName === "Jess");
await denied("Visit reports: can't read someone else's report", getDoc(doc(db, "visitReports/r2")));
await denied("Visit reports: can't list everyone's reports", getDocs(query(collection(db, "visitReports"), limit(5))));

console.log(`\n${ok} ok, ${bad} wrong`);
process.exit(bad ? 1 : 0);
