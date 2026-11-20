// Sitter mode on petbindr.com/app (2026-11-20): for someone with a PetBindr
// account whom owners share pets with (a pro sitter on Android, "Jess" in the
// 2026-11-14 panel review). Plain TypeScript so scripts/sitter-test.mts can
// import it. Same rules as the iPhone app (Models/PetShare.swift, PetStore,
// SitterClients.swift): a share counts while it's active and within its dates,
// can be opened read-only from a week before it starts, and its switches decide
// what shows. firestore.rules enforce all of this; this only decides what to show.

import type { Stamp, TodayTask, FeedingLog, MedicationLog } from "./today"; // types only: runs in node tests on its own

function toDate(v: Stamp): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  return typeof v.toDate === "function" ? v.toDate() : null;
}

/** The app's defaults for switches missing from a share (SharePermissions) */
export const PERMISSION_DEFAULTS: Record<string, boolean> = {
  canViewBasicInfo: true, canViewFoodInstructions: true, canViewQuirks: true, canViewVetInfo: true,
  canViewHealthRecords: false, canViewAllergies: true, canViewMedications: true, canViewNotes: true,
  canEdit: false, canViewEmergencyContacts: true, canViewMicrochipInfo: true, canViewLicenseInfo: false,
  canViewHouseholdAccess: false, canViewRoutines: true, canManageSits: false,
};

/** Read-only early look before the sit starts (rules: shareIsPreviewable) */
export const PREVIEW_MS = 7 * 86400000;

export type ShareDoc = {
  id: string; petId?: string; ownerId?: string; sharedWithUserId?: string; status?: string;
  startDate?: Stamp; endDate?: Stamp; permissions?: Record<string, unknown>;
  petName?: string; ownerName?: string; ownerPhone?: string; ownerNotes?: string; shareType?: string;
};

export type Sit = {
  shareId: string; petId: string; ownerId: string; petName: string; ownerName: string;
  ownerPhone: string; ownerNotes: string; start: Date | null; end: Date | null; status: string;
  permissions: Record<string, boolean>;
};

export function may(sit: Pick<Sit, "permissions">, key: string): boolean {
  return sit.permissions[key] ?? PERMISSION_DEFAULTS[key] ?? false;
}

export function toSit(s: ShareDoc): Sit | null {
  if (!s.petId || !s.ownerId || s.shareType === "link") return null;
  const raw = s.permissions || {};
  const permissions: Record<string, boolean> = {};
  for (const k of Object.keys(PERMISSION_DEFAULTS)) {
    permissions[k] = typeof raw[k] === "boolean" ? (raw[k] as boolean) : PERMISSION_DEFAULTS[k];
  }
  return {
    shareId: s.id, petId: s.petId, ownerId: s.ownerId,
    petName: (s.petName || "").trim() || "Pet",
    ownerName: (s.ownerName || "").trim(),
    ownerPhone: (s.ownerPhone || "").trim(),
    ownerNotes: (s.ownerNotes || "").trim(),
    start: toDate(s.startDate), end: toDate(s.endDate), status: s.status || "",
    permissions,
  };
}

/** Active and within its dates: the sitter can check things off (rules: hasActiveShare) */
export function isLive(sit: Sit, now: Date): boolean {
  return sit.status === "active" && (!sit.start || sit.start <= now) && (!sit.end || now < sit.end);
}

/** Starts within a week: the routine can be read, nothing done yet (rules: canPreview) */
export function isUpcoming(sit: Sit, now: Date): boolean {
  return sit.status === "active" && !!sit.start && now < sit.start &&
    sit.start.getTime() - PREVIEW_MS <= now.getTime() && (!sit.end || now < sit.end);
}

export function isPending(sit: Sit, now: Date): boolean {
  return sit.status === "pending" && (!sit.end || now < sit.end);
}

export type Client = {
  ownerId: string; name: string; phone: string; notes: string[];
  start: Date | null; end: Date | null; live: Sit[]; upcoming: Sit[];
};

/**
 * Sits grouped by the person who shared them, like the app's My Clients:
 * name and phone from the first share that has one, dates from the earliest
 * start to the latest end, "this time" notes without repeats. Clients with
 * something live come first, then by the sooner start, then by name.
 */
export function clientsFrom(sits: Sit[], now: Date): Client[] {
  const by = new Map<string, Client>();
  for (const sit of sits) {
    const live = isLive(sit, now);
    if (!live && !isUpcoming(sit, now)) continue;
    let c = by.get(sit.ownerId);
    if (!c) {
      c = { ownerId: sit.ownerId, name: "", phone: "", notes: [], start: null, end: null, live: [], upcoming: [] };
      by.set(sit.ownerId, c);
    }
    if (!c.name && sit.ownerName) c.name = sit.ownerName;
    if (!c.phone && sit.ownerPhone) c.phone = sit.ownerPhone;
    if (sit.ownerNotes && !c.notes.includes(sit.ownerNotes)) c.notes.push(sit.ownerNotes);
    if (sit.start && (!c.start || sit.start < c.start)) c.start = sit.start;
    if (sit.end && (!c.end || sit.end > c.end)) c.end = sit.end;
    (live ? c.live : c.upcoming).push(sit);
  }
  const list = [...by.values()];
  for (const c of list) {
    if (!c.name) c.name = "Client";
    c.live.sort((a, b) => a.petName.localeCompare(b.petName));
    c.upcoming.sort((a, b) => a.petName.localeCompare(b.petName));
  }
  return list.sort((a, b) =>
    Number(b.live.length > 0) - Number(a.live.length > 0) ||
    (a.start?.getTime() ?? 0) - (b.start?.getTime() ?? 0) ||
    a.name.localeCompare(b.name));
}

/** One sit per pet: the live one if there is one (a pet can be shared twice, by two owners) */
export function sitsByPet(sits: Sit[], now: Date): Map<string, Sit> {
  const out = new Map<string, Sit>();
  for (const s of sits) {
    if (!isLive(s, now) && !isUpcoming(s, now)) continue;
    const had = out.get(s.petId);
    if (!had || (!isLive(had, now) && isLive(s, now))) out.set(s.petId, s);
  }
  return out;
}

/** "Fri, Nov 20" / "Fri, Nov 20 – Sun, Nov 22" */
export function datesText(start: Date | null, end: Date | null): string {
  const f = (d: Date) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  // An end date is stored as the moment after the last day (midnight): show the last day
  const last = end ? new Date(end.getTime() - 1) : null;
  if (start && last) return f(start) === f(last) ? f(start) : `${f(start)} – ${f(last)}`;
  if (last) return `Until ${f(last)}`;
  if (start) return `From ${f(start)}`;
  return "";
}

// MARK: - Visit report (same document as the app: SitterClients.swift VisitReports)

export type ReportItem = { pet: string; title: string; kind: "feeding" | "medication"; time: Date; detail: string };

const AMOUNT_NOTE: Record<string, string> = { some: "Ate some", none: "Didn't eat" };

/**
 * What this sitter checked off today for these pets, oldest first. Only their
 * own check-offs: a breakfast the owner gave before leaving isn't this visit's work.
 */
export function doneToday(tasks: TodayTask[], petIds: string[], uid: string,
  logs: Record<string, { feedingLogs?: FeedingLog[]; medicationLogs?: MedicationLog[] }>): ReportItem[] {
  const items: ReportItem[] = [];
  for (const t of tasks) {
    if (!t.done || !petIds.includes(t.petId) || t.done.byUserId !== uid) continue;
    if (t.kind === "feeding") {
      items.push({ pet: t.petName, title: t.title, kind: "feeding", time: t.done.at, detail: AMOUNT_NOTE[t.done.amount] || "Ate it all" });
    } else {
      const log = (logs[t.petId]?.medicationLogs || []).find((l) => l.id === t.done!.logId);
      const parts = [t.done.skipped ? "Skipped" : "", t.detail, (log?.notes || "").trim()].filter(Boolean);
      items.push({ pet: t.petName, title: t.title, kind: "medication", time: t.done.at, detail: parts.join(" · ") });
    }
  }
  return items.sort((a, b) => a.time.getTime() - b.time.getTime());
}

export const MAX_REPORT_PHOTOS = 4;

/** visitReports/{id}: exactly the keys firestore.rules allow, in the app's limits */
export function reportDoc(args: {
  uid: string; sitterName: string; ownerId: string; coOwnerIds: string[];
  pets: { id: string; name: string }[]; note: string; items: ReportItem[]; photoPaths: string[];
}, createdAt: unknown) {
  return {
    sitterId: args.uid,
    sitterName: args.sitterName.trim().slice(0, 80) || "Your sitter",
    ownerIds: [args.ownerId, ...args.coOwnerIds],
    petIds: args.pets.slice(0, 10).map((p) => p.id),
    petNames: args.pets.slice(0, 10).map((p) => p.name),
    note: args.note.trim().slice(0, 2000),
    items: args.items.slice(0, 60),
    photoPaths: args.photoPaths.slice(0, MAX_REPORT_PHOTOS),
    createdAt,
  };
}

/** Where a report photo goes (storage.rules: visit-reports/{petId}/{reportId}/{file}) */
export function reportPhotoPath(firstPetId: string, reportId: string, index: number): string {
  return `visit-reports/${firstPetId}/${reportId}/${index}.jpg`;
}

/** Fits a photo inside maxSide on its longer side, keeping its shape */
export function fitInside(width: number, height: number, maxSide = 1600): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height, 1));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** "tel:" link from a typed number */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^0-9+]/g, "")}`;
}
