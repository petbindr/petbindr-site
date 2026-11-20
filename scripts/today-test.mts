// Checks for app/app/today.ts (web Today list and check-offs). Run: node scripts/today-test.mts
import { tasksFor, feedingLogDoc, mealServedOn, repeatSummary } from "../app/app/today.ts";

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
check("day stored at local noon (reads the same day in other time zones)", (log.data.date as Date).getHours() === 12);
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

// Meals that aren't every day (2026-11-20). Nov 12, 2026 is a Thursday (4)
const feedDay = { petId: "rex", petName: "Rex", feedingLogs: [], medications: [], medicationLogs: [], feeding: { scheduleItems: [
  { id: "daily", time: ts(new Date(2026, 0, 1, 8, 0)) },
  { id: "tth", time: ts(new Date(2026, 0, 1, 12, 0)) },
  { id: "mwf", time: ts(new Date(2026, 0, 1, 13, 0)) },
  { id: "alt", time: ts(new Date(2026, 0, 1, 18, 0)) },
  { id: "odd", time: ts(new Date(2026, 0, 1, 19, 0)) },
], mealDays: { tth: { weekdays: [2, 4] }, mwf: { weekdays: [1, 3, 5] }, alt: { every: 2, start: "2026-11-11" }, odd: { weekdays: "Thu" } } } };
const ids = tasksFor(feedDay as never, now, {}).map((t) => t.itemId);
check("daily meal listed", ids.includes("daily"));
check("meal on its chosen weekday listed", ids.includes("tth"));
check("meal on its day off left out (weekdays)", !ids.includes("mwf"));
check("meal on its day off left out (every 2 days)", !ids.includes("alt"));
check("unreadable rule = every day", ids.includes("odd"));
check("every 2 days: the next day is on", mealServedOn({ every: 2, start: "2026-11-11" }, new Date(2026, 10, 13, 9)));
check("every 7 days across the clock change", mealServedOn({ every: 7, start: "2026-10-30" }, new Date(2026, 10, 6, 23, 30)));
check("summary: Mon, Wed, Fri", repeatSummary({ weekdays: [5, 3, 1] }) === "Mon, Wed, Fri");
check("summary: every 2 days", repeatSummary({ every: 2, start: "2026-11-11" }) === "Every 2 days");
check("summary: every day", repeatSummary(undefined) === null);

console.log(`\n${ok} ok, ${bad} wrong`);
process.exit(bad ? 1 : 0);
