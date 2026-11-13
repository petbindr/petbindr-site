// Today's feedings and doses for the web app (petbindr.com/app), worked out
// the same way as the iPhone app (PetBindr/TodayTasks.swift) and the server
// (functions/index.js shouldGiveOn / doseTimesToday). Times are the browser's
// own time zone, which is the co-owner's.

export type FeedingAmount = "all" | "some" | "none";

// pending: saved on this device, not sent yet (no signal). skipped: a dose marked "Not given"
export type Done = { by: string; at: Date; amount: FeedingAmount; logId: string; byUserId: string; pending?: boolean; skipped?: boolean };

export type TodayTask = {
  key: string;
  kind: "feeding" | "medication";
  petId: string;
  petName: string;
  itemId: string; // feeding schedule item id, or medication schedule id
  title: string;  // "Breakfast" / medication name
  detail: string; // portion / dosage
  time: Date;
  done: Done | null;
};

// Firestore values arrive as Timestamps; tests pass Dates
type Stamp = { toDate(): Date } | Date | null | undefined;
export function toDate(v: Stamp): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  return typeof v.toDate === "function" ? v.toDate() : null;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** The app's feeding log ID: one per meal per day ("<item>_2026-11-12") */
/** Local noon of that calendar day (see feedingLogDoc) */
export function feedingDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
}

export function feedingLogId(itemId: string, day: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${itemId}_${day.getFullYear()}-${p(day.getMonth() + 1)}-${p(day.getDate())}`;
}

/** "Breakfast" / "Lunch" / "Dinner", from the time of day */
export function mealName(time: Date): string {
  const h = time.getHours();
  if (h < 11) return "Breakfast";
  if (h < 16) return "Lunch";
  return "Dinner";
}

/** A schedule's time of day, on today's date */
export function todayAt(time: Date, now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), time.getHours(), time.getMinutes());
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86400000);
}

export type MedicationSchedule = {
  id: string; medicationName?: string; dosage?: string; frequency?: string;
  scheduledTimes?: Stamp[]; startDate?: Stamp; endDate?: Stamp; isActive?: boolean;
};

/** Whether a medication is due on `now`'s day (same rules as the app and server) */
export function shouldGiveOn(s: MedicationSchedule, now: Date): boolean {
  if (s.isActive === false) return false;
  const start = toDate(s.startDate);
  const end = toDate(s.endDate);
  if (start && daysBetween(start, now) < 0) return false;
  if (end && daysBetween(end, now) > 0) return false;
  const days = start ? daysBetween(start, now) : 0;
  switch (s.frequency) {
    case "Every Other Day": return days % 2 === 0;
    case "Every 3 Days": return days % 3 === 0;
    case "Weekly": return days % 7 === 0;
    case "Every 2 Weeks": return days % 14 === 0;
    case "Monthly": {
      if (!start) return true;
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      return now.getDate() === Math.min(start.getDate(), daysInMonth);
    }
    default: return true; // Daily, Twice Daily, Three Times Daily
  }
}

export type FeedingSchedule = { scheduleItems?: { id: string; time?: Stamp; portion?: string }[] } | null;
export type FeedingLog = { id: string; scheduleItemId?: string; date?: Stamp; completedAt?: Stamp; completedBy?: string; completedByName?: string; amount?: string; pending?: boolean };
export type MedicationLog = { id: string; scheduleId?: string; scheduledTime?: Stamp; actualTime?: Stamp; ownerId?: string; givenBy?: string; notes?: string; wasGiven?: boolean; pending?: boolean };

export type PetDay = {
  petId: string; petName: string;
  feeding: FeedingSchedule; feedingLogs: FeedingLog[];
  medications: MedicationSchedule[]; medicationLogs: MedicationLog[];
};

/** Who logged a dose: the app keeps the user in ownerId; link check-offs say "Given by Name (sitter link)" */
function doseBy(log: MedicationLog, names: Record<string, string>): string {
  const m = /^Given by (.+?) \(sitter link\)$/.exec(log.notes || "");
  if (m) return m[1];
  const uid = log.givenBy || log.ownerId || "";
  return names[uid] || "Someone";
}

export function tasksFor(day: PetDay, now: Date, names: Record<string, string>): TodayTask[] {
  const tasks: TodayTask[] = [];
  for (const item of day.feeding?.scheduleItems || []) {
    const t = toDate(item.time);
    if (!t) continue;
    const time = todayAt(t, now);
    const log = day.feedingLogs.find((l) => l.scheduleItemId === item.id && toDate(l.date) && sameDay(toDate(l.date)!, now));
    tasks.push({
      key: `${day.petId}-feed-${item.id}`, kind: "feeding", petId: day.petId, petName: day.petName,
      itemId: item.id, title: mealName(time), detail: (item.portion || "").trim(), time,
      done: log ? {
        by: log.completedByName || "Someone", at: toDate(log.completedAt) || time,
        amount: log.amount === "some" || log.amount === "none" ? log.amount : "all",
        logId: log.id, byUserId: log.completedBy || "", pending: log.pending === true,
      } : null,
    });
  }
  for (const med of day.medications) {
    if (!shouldGiveOn(med, now)) continue;
    for (const st of med.scheduledTimes || []) {
      const t = toDate(st);
      if (!t) continue;
      const time = todayAt(t, now);
      // Like the app: a dose logged today for this schedule within the same hour
      const log = day.medicationLogs.find((l) => {
        const at = toDate(l.actualTime), sched = toDate(l.scheduledTime);
        return l.scheduleId === med.id && at && sameDay(at, now) && sched &&
          sameDay(sched, time) && sched.getHours() === time.getHours();
      });
      tasks.push({
        key: `${day.petId}-med-${med.id}-${time.getTime()}`, kind: "medication", petId: day.petId, petName: day.petName,
        itemId: med.id, title: med.medicationName || "Medication", detail: (med.dosage || "").trim(), time,
        done: log ? {
          by: doseBy(log, names), at: toDate(log.actualTime) || time, amount: "all", logId: log.id,
          byUserId: log.givenBy || log.ownerId || "", pending: log.pending === true, skipped: log.wasGiven === false,
        } : null,
      });
    }
  }
  return tasks;
}

// MARK: - What a check-off saves (the same fields as the app; see firestore.rules)

/** pets/{petId}/feedingLogs/{id}: one per meal per day */
export function feedingLogDoc(petId: string, itemId: string, uid: string, name: string, now: Date, amount: FeedingAmount, rowTime: Date = now) {
  // The day of the row tapped, not of the tap (a page left open past midnight).
  // Stored at local noon, like the app (FeedingStore.feedingDay): at midnight, a
  // co-owner in another time zone read it as the day before.
  const day = feedingDay(rowTime);
  const id = feedingLogId(itemId, day);
  return {
    id,
    data: {
      id, petId, scheduleItemId: itemId, completedAt: now, completedBy: uid, completedByName: name, date: day,
      ...(amount !== "all" ? { amount } : {}),
    },
  };
}

/** pets/{petId}/medicationLogs/{id}: the app keeps who gave it in "ownerId" */
export function medicationLogDoc(petId: string, scheduleId: string, name: string, dosage: string, due: Date, uid: string, now: Date, id: string) {
  return {
    id,
    data: {
      id, ownerId: uid, petId, scheduleId, medicationName: name, dosage,
      scheduledTime: due, actualTime: now, wasGiven: true, notes: "",
    },
  };
}
