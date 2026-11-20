// Checks for app/app/sitter.ts (sitter mode on petbindr.com/app). Run: node scripts/sitter-test.mts
import { toSit, isLive, isUpcoming, isPending, clientsFrom, sitsByPet, may, datesText, doneToday, reportDoc, reportPhotoPath, fitInside, telHref } from "../app/app/sitter.ts";

let ok = 0, bad = 0;
const check = (label: string, cond: boolean) => { cond ? ok++ : bad++; console.log(cond ? "ok   " : "WRONG", label); };
const ts = (date: Date) => ({ toDate: () => date });
const now = new Date(2026, 10, 20, 9, 0);
const share = (o: object) => ({ id: "x", petId: "rex", ownerId: "dana", status: "active", ...o });

// Which shares count
check("link shares aren't sits", toSit(share({ shareType: "link" })) === null);
check("no pet: ignored", toSit({ id: "y", ownerId: "dana" }) === null);
const live = toSit(share({ startDate: ts(new Date(2026, 10, 19)), endDate: ts(new Date(2026, 10, 23)), ownerName: "Dana", petName: "Rex" }))!;
check("live: active and within dates", isLive(live, now) && !isUpcoming(live, now));
check("no dates: live while active", isLive(toSit(share({}))!, now));
const later = toSit(share({ petId: "mia", ownerId: "sam", startDate: ts(new Date(2026, 10, 24)), endDate: ts(new Date(2026, 10, 26)) }))!;
check("starts in 4 days: upcoming, not live", !isLive(later, now) && isUpcoming(later, now));
const far = toSit(share({ startDate: ts(new Date(2026, 11, 20)) }))!;
check("starts in a month: neither", !isLive(far, now) && !isUpcoming(far, now));
const ended = toSit(share({ startDate: ts(new Date(2026, 10, 10)), endDate: ts(new Date(2026, 10, 19)) }))!;
check("ended: neither", !isLive(ended, now) && !isUpcoming(ended, now));
check("revoked: not live", !isLive(toSit(share({ status: "revoked" }))!, now));
check("pending: an invite", isPending(toSit(share({ status: "pending" }))!, now) && !isLive(toSit(share({ status: "pending" }))!, now));
check("pending past its end: no invite", !isPending(toSit(share({ status: "pending", endDate: ts(new Date(2026, 10, 1)) }))!, now));

// Switches: the app's defaults when missing
check("feeding on by default", may(live, "canViewFoodInstructions"));
check("home access off by default", !may(live, "canViewHouseholdAccess"));
const noMeds = toSit(share({ permissions: { canViewMedications: false, canViewHouseholdAccess: true } }))!;
check("medications switched off", !may(noMeds, "canViewMedications"));
check("home access switched on", may(noMeds, "canViewHouseholdAccess"));
check("junk value: default used", may(toSit(share({ permissions: { canViewFoodInstructions: "yes" } }))!, "canViewFoodInstructions"));

// Clients
const second = toSit(share({ id: "z", petId: "bo", ownerName: "", ownerNotes: "Trash goes out Wed", ownerPhone: "555-0100", startDate: ts(new Date(2026, 10, 18)), endDate: ts(new Date(2026, 10, 25)) }))!;
const clients = clientsFrom([later, live, second, far, ended], now);
check("two clients (far and ended left out)", clients.length === 2);
check("the live client first", clients[0].ownerId === "dana" && clients[1].ownerId === "sam");
check("name from the share that has one", clients[0].name === "Dana");
check("phone from the share that has one", clients[0].phone === "555-0100");
check("dates: earliest start to latest end", clients[0].start!.getDate() === 18 && clients[0].end!.getDate() === 25);
check("this-time notes kept", clients[0].notes.join() === "Trash goes out Wed");
check("both pets live", clients[0].live.length === 2 && clients[0].upcoming.length === 0);
check("no name: Client", clients[1].name === "Client" && clients[1].upcoming.length === 1);
const twice = sitsByPet([toSit(share({ id: "a", startDate: ts(new Date(2026, 10, 22)) }))!, toSit(share({ id: "b", ownerId: "co" }))!], now);
check("a pet shared twice: the live share wins", twice.get("rex")!.shareId === "b");

// Dates
check("end is the moment after the last day", datesText(new Date(2026, 10, 19), new Date(2026, 10, 23)) === "Thu, Nov 19 – Sun, Nov 22");
check("one day", datesText(new Date(2026, 10, 20, 8), new Date(2026, 10, 20, 18)) === "Fri, Nov 20");
check("no dates", datesText(null, null) === "");

// Visit report: only my check-offs, for the chosen pets
const at = (h: number) => new Date(2026, 10, 20, h, 5);
const task = (o: object) => ({ key: "k", kind: "feeding", petId: "rex", petName: "Rex", itemId: "am", title: "Breakfast", detail: "1 cup", time: at(8), done: null, ...o });
const tasks = [
  task({ done: { by: "Jess", at: at(8), amount: "some", logId: "f1", byUserId: "jess" } }),
  task({ key: "k2", itemId: "pm", title: "Dinner", done: { by: "Dana", at: at(7), amount: "all", logId: "f2", byUserId: "dana" } }),
  task({ key: "k3", kind: "medication", title: "Apoquel", detail: "16 mg", time: at(9), done: { by: "Jess", at: at(9), amount: "all", logId: "m1", byUserId: "jess", skipped: false } }),
  task({ key: "k4", petId: "bo", petName: "Bo", done: { by: "Jess", at: at(6), amount: "all", logId: "f3", byUserId: "jess" } }),
  task({ key: "k5", title: "Lunch", done: null }),
] as never;
const items = doneToday(tasks, ["rex"], "jess", { rex: { medicationLogs: [{ id: "m1", notes: "with food" }] } });
check("my two check-offs for Rex only", items.length === 2);
check("feeding detail: how much", items[0].detail === "Ate some");
check("dose detail: dose and note", items[1].detail === "16 mg · with food");
check("oldest first", items[0].time < items[1].time);
const skippedItems = doneToday([task({ kind: "medication", title: "Apoquel", detail: "16 mg", done: { by: "Jess", at: at(9), amount: "all", logId: "m9", byUserId: "jess", skipped: true } })] as never, ["rex"], "jess", {});
check("skipped dose says so", skippedItems[0].detail === "Skipped · 16 mg");

const rd = reportDoc({ uid: "jess", sitterName: "  Jess Park  ", ownerId: "dana", coOwnerIds: ["sam"], pets: [{ id: "rex", name: "Rex" }], note: " Good walk ", items, photoPaths: ["a", "b", "c", "d", "e"] }, "TS");
check("report has exactly the keys the rules allow", Object.keys(rd).sort().join() === "createdAt,items,note,ownerIds,petIds,petNames,photoPaths,sitterId,sitterName");
check("owners: owner then co-owners", rd.ownerIds.join() === "dana,sam");
check("trimmed name and note", rd.sitterName === "Jess Park" && rd.note === "Good walk");
check("at most 4 photos", rd.photoPaths.length === 4);
check("photo path under the first pet", reportPhotoPath("rex", "r1", 0) === "visit-reports/rex/r1/0.jpg");
check("photo fits 1600", fitInside(4032, 3024).width === 1600 && fitInside(4032, 3024).height === 1200);
check("small photo kept", fitInside(800, 600).width === 800);
check("tel link", telHref("(555) 010-0100") === "tel:5550100100");

console.log(`\n${ok} ok, ${bad} wrong`);
process.exit(bad ? 1 : 0);
