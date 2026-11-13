// Checks for app/app/today.ts (web Today list and check-offs). Run: node scripts/today-test.mts
import { tasksFor, feedingLogDoc } from "../app/app/today.ts";

let ok = 0, bad = 0;
const check = (label: string, cond: boolean) => { cond ? ok++ : bad++; console.log(cond ? "ok   " : "WRONG", label); };
const ts = (date: Date) => ({ toDate: () => date });

// A tap at 12:01 AM on last night's Dinner row: dated last night, not today
const lastDinner = new Date(2026, 10, 11, 18, 0);
const tap = new Date(2026, 10, 12, 0, 1);
const log = feedingLogDoc("rex", "pm", "u1", "Priya", tap, "all", lastDinner);
check("row's day used for the log date", (log.data.date as Date).getDate() === 11);
check("and for its ID", log.id.includes("2026-11-11"));
check("completedAt is the tap", log.data.completedAt === tap);
check("without a row time: the tap's day", (feedingLogDoc("rex", "pm", "u1", "Priya", tap, "all").data.date as Date).getDate() === 12);

// Skipped and not-yet-sent doses
const now = new Date(2026, 10, 12, 9, 0);
const med = { id: "m1", medicationName: "Insulin", dosage: "2 units", frequency: "Daily", isActive: true,
  scheduledTimes: [ts(new Date(2026, 0, 1, 8, 0))], startDate: ts(new Date(2026, 0, 1)) };
const day = (logs: object[]) => ({ petId: "rex", petName: "Rex", feeding: null, feedingLogs: [], medications: [med], medicationLogs: logs });
const skipped = tasksFor(day([{ id: "l1", scheduleId: "m1", scheduledTime: ts(new Date(2026, 10, 12, 8, 0)), actualTime: ts(new Date(2026, 10, 12, 8, 5)), ownerId: "u1", wasGiven: false }]) as never, now, { u1: "Ruth" });
check("skipped dose: done, marked skipped", !!skipped[0]?.done && skipped[0].done.skipped === true);
const given = tasksFor(day([{ id: "l2", scheduleId: "m1", scheduledTime: ts(new Date(2026, 10, 12, 8, 0)), actualTime: ts(new Date(2026, 10, 12, 8, 5)), ownerId: "u1", wasGiven: true, pending: true }]) as never, now, { u1: "Ruth" });
check("given dose: not skipped", given[0]?.done?.skipped === false);
check("unsent dose: pending", given[0]?.done?.pending === true);

console.log(`\n${ok} ok, ${bad} wrong`);
process.exit(bad ? 1 : 0);
