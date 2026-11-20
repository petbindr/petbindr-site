// Checks for app/app/care.ts (editing feeding times and medications on petbindr.com/app).
// Run: node scripts/care-test.mts
import { feedingChanges, medicationChanges, newMedication, timeAt, timeInput, ChangedElsewhere, same, type Schedule } from "../app/app/care.ts";

let ok = 0, bad = 0;
const check = (label: string, cond: boolean) => { cond ? ok++ : bad++; console.log(cond ? "ok   " : "WRONG", label); };
const DEL = { del: true };
const del = () => DEL;
const throwsClash = (label: string, f: () => unknown) => {
  try { f(); check(`${label} (no error)`, false); } catch (e) { check(label, e instanceof ChangedElsewhere); }
};
const ts = (d: Date) => ({ toDate: () => d });

const am = { id: "am", time: ts(new Date(2026, 0, 1, 7, 0)), portion: "1 cup" };
const pm = { id: "pm", time: ts(new Date(2026, 0, 1, 18, 0)), portion: "1 cup", notes: "warm water" };
const base: Schedule = { feedingInfo: { foodName: "Kibble", defaultPortion: "1 cup" }, scheduleItems: [am, pm] };
const copy = <T,>(x: T): T => ({ ...(x as object) } as T);

// Times
check("timeInput reads a stored time", timeInput(am.time) === "07:00");
const moved = timeAt("07:30", am.time)!;
check("timeAt keeps the meal's date", moved.getFullYear() === 2026 && moved.getMonth() === 0 && moved.getDate() === 1 && moved.getHours() === 7 && moved.getMinutes() === 30);
check("timeAt for a new meal is today", timeAt("08:00", undefined, new Date(2026, 10, 20, 15))!.getDate() === 20);
check("timeAt refuses nonsense", timeAt("25:00") === null && timeAt("") === null);
check("same() ignores Timestamp vs Date", same(am.time, new Date(2026, 0, 1, 7, 0)));

// Nothing changed
let out = feedingChanges(base, { ...base, scheduleItems: [copy(am), copy(pm)], mealDays: {} }, base, del);
check("no change writes nothing", !!out.update && Object.keys(out.update).length === 0);

// Edit one meal's portion; someone else added a meal meanwhile
const lunch = { id: "lunch", time: ts(new Date(2026, 0, 1, 12)), portion: "treat" };
out = feedingChanges(base, { ...base, scheduleItems: [{ ...am, portion: "1.5 cups" }, copy(pm)] }, { ...base, scheduleItems: [am, pm, lunch] }, del);
const items = out.update!.scheduleItems as { id: string; portion: string }[];
check("edited meal saved", items.find((m) => m.id === "am")?.portion === "1.5 cups");
check("a meal added elsewhere is kept", items.some((m) => m.id === "lunch"));
check("only the meals are written", Object.keys(out.update!).join() === "scheduleItems");

// Same meal edited in both places
throwsClash("same meal edited in both places stops the save", () =>
  feedingChanges(base, { ...base, scheduleItems: [{ ...am, portion: "2 cups" }, pm] }, { ...base, scheduleItems: [{ ...am, portion: "half" }, pm] }, del));
// Removed here, changed elsewhere
throwsClash("removing a meal someone just changed stops the save", () =>
  feedingChanges(base, { ...base, scheduleItems: [pm] }, { ...base, scheduleItems: [{ ...am, portion: "half" }, pm] }, del));
// Removed here
out = feedingChanges(base, { ...base, scheduleItems: [pm] }, base, del);
check("removing a meal", (out.update!.scheduleItems as { id: string }[]).map((m) => m.id).join() === "pm");
// Added here
const added = { id: "NEW", time: new Date(2026, 10, 20, 12), portion: "snack", notes: "" };
out = feedingChanges(base, { ...base, scheduleItems: [am, pm, added] }, base, del);
const newOne = (out.update!.scheduleItems as Record<string, unknown>[]).find((m) => m.id === "NEW")!;
check("adding a meal", !!newOne && newOne.portion === "snack");
check("a new meal saves no empty notes (like the app)", !("notes" in newOne));

// Food info field by field
out = feedingChanges(base, { ...base, feedingInfo: { foodName: "Salmon", defaultPortion: "1 cup" } }, { ...base, feedingInfo: { foodName: "Kibble", defaultPortion: "2 cups" } }, del);
check("food name written alone", out.update!["feedingInfo.foodName"] === "Salmon" && !("feedingInfo.defaultPortion" in out.update!));
throwsClash("food name changed in both places stops the save", () =>
  feedingChanges(base, { ...base, feedingInfo: { foodName: "Salmon" } }, { ...base, feedingInfo: { foodName: "Beef" } }, del));

// Days
out = feedingChanges(base, { ...base, mealDays: { pm: { weekdays: [1, 3] } } }, base, del);
check("setting a meal's days writes only mealDays.pm", Object.keys(out.update!).join() === "mealDays.pm" && same(out.update!["mealDays.pm"], { weekdays: [1, 3] }));
const withDays: Schedule = { ...base, mealDays: { pm: { weekdays: [1, 3] } } };
out = feedingChanges(withDays, { ...base, mealDays: {} }, withDays, del);
check("back to every day deletes mealDays.pm", out.update!["mealDays.pm"] === DEL);
throwsClash("days changed in both places stops the save", () =>
  feedingChanges(withDays, { ...base, mealDays: { pm: { weekdays: [2] } } }, { ...base, mealDays: { pm: { every: 2, start: "2026-11-20" } } }, del));
out = feedingChanges(withDays, { ...base, mealDays: { pm: { weekdays: [1, 3] } } }, { ...base, mealDays: { pm: { weekdays: [1, 3] }, am: { weekdays: [0] } } }, del);
check("days set elsewhere on another meal are left alone", Object.keys(out.update!).length === 0);

// No schedule yet
out = feedingChanges(null, { feedingInfo: { foodName: "Kibble" }, scheduleItems: [added], mealDays: { NEW: { weekdays: [6] } } }, null, del);
check("first schedule: whole document", !!out.create && (out.create.scheduleItems as unknown[]).length === 1 && same(out.create.mealDays, { NEW: { weekdays: [6] } }));
check("first schedule: food info has the app's required fields", (out.create!.feedingInfo as Record<string, string>).defaultPortion === "");
throwsClash("schedule deleted elsewhere while editing stops the save", () => feedingChanges(base, base!, null, del));

// Medications
const med = { id: "m1", petId: "rex", medicationName: "Apoquel", dosage: "5 mg", frequency: "Daily", scheduledTimes: [ts(new Date(2026, 0, 1, 8))],
  startDate: ts(new Date(2026, 0, 1)), notes: "", isActive: true };
let mc = medicationChanges(med, { ...med, dosage: "5.4 mg" }, med, del);
check("dose change writes only the dose", Object.keys(mc).join() === "dosage" && mc.dosage === "5.4 mg");
mc = medicationChanges(med, { ...med, dosage: "5.4 mg" }, { ...med, notes: "with food" }, del);
check("someone else's note change doesn't block a dose change", Object.keys(mc).join() === "dosage");
throwsClash("dose changed in both places stops the save", () => medicationChanges(med, { ...med, dosage: "6 mg" }, { ...med, dosage: "4 mg" }, del));
throwsClash("medication removed elsewhere stops the save", () => medicationChanges(med, { ...med, dosage: "6 mg" }, null, del));
mc = medicationChanges(med, { ...med, scheduledTimes: [ts(new Date(2026, 0, 1, 8)), new Date(2026, 0, 1, 20)], frequency: "Twice Daily" }, med, del);
check("times and frequency", (mc.scheduledTimes as unknown[]).length === 2 && mc.frequency === "Twice Daily");
mc = medicationChanges({ ...med, endDate: ts(new Date(2026, 11, 1)) }, { ...med, endDate: null }, { ...med, endDate: ts(new Date(2026, 11, 1)) }, del);
check("clearing the end date deletes it", mc.endDate === DEL);
mc = medicationChanges(med, { ...med, isActive: false }, med, del);
check("Stop Giving It sets isActive false", mc.isActive === false);
mc = medicationChanges(med, { ...med, frequency: "Hourly" }, med, del);
check("an unknown frequency is saved as Daily (the app couldn't read it)", mc.frequency === "Daily");
const nm = newMedication("rex", { medicationName: " Gabapentin ", dosage: "100 mg", frequency: "Twice Daily", scheduledTimes: [new Date()], startDate: new Date(), notes: "" }, "ID1");
check("new medication has every field the app needs", ["id", "petId", "medicationName", "dosage", "frequency", "scheduledTimes", "startDate", "notes", "isActive"].every((k) => k in nm) && !("endDate" in nm));
check("new medication trims its name", nm.medicationName === "Gabapentin" && nm.isActive === true);

console.log(`\n${ok} ok, ${bad} wrong`);
process.exit(bad ? 1 : 0);
