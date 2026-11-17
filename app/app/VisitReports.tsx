"use client";

// Visit reports on petbindr.com/app (2026-11-16): what a sitter (in the app, or
// on a sitter or helper link with "Send an update") reported, for the owner and
// co-owners. Same documents and rules as the iPhone app's Home: visitReports
// where ownerIds contains you, newest first, from the last 7 days. Photos load
// through Storage only when a report is opened, so storage.rules decide.

import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query, where, type Timestamp } from "firebase/firestore";
import { getBlob, ref } from "firebase/storage";
import { firebase } from "./firebase";
import { storagePath } from "./PetPage";

type Item = { pet: string; title: string; kind: string; time: Date | null; detail: string };
type Report = {
  id: string; sitterName: string; petNames: string[]; note: string; items: Item[]; photoPaths: string[]; createdAt: Date;
};

const WEEK_MS = 7 * 86400000;

function toDate(v: unknown): Date | null {
  return v && typeof (v as Timestamp).toDate === "function" ? (v as Timestamp).toDate() : null;
}

function names(list: string[]) {
  return list.length <= 2 ? list.join(" and ") : `${list.slice(0, -1).join(", ")} and ${list.at(-1)}`;
}

function when(d: Date) {
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const yesterday = new Date(today.getTime() - 86400000).toDateString() === d.toDateString();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (sameDay) return `Today, ${time}`;
  if (yesterday) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}, ${time}`;
}

export default function VisitReports({ uid }: { uid: string }) {
  const [reports, setReports] = useState<Report[]>([]);

  useEffect(() => {
    const { db } = firebase();
    return onSnapshot(
      query(collection(db, "visitReports"), where("ownerIds", "array-contains", uid), orderBy("createdAt", "desc"), limit(5)),
      (snap) => {
        const since = Date.now() - WEEK_MS;
        setReports(snap.docs.map((d) => {
          const x = d.data();
          return {
            id: d.id,
            sitterName: typeof x.sitterName === "string" && x.sitterName ? x.sitterName : "Your sitter",
            petNames: Array.isArray(x.petNames) ? x.petNames.filter((n: unknown) => typeof n === "string") : [],
            note: typeof x.note === "string" ? x.note : "",
            items: (Array.isArray(x.items) ? x.items : []).map((i: Record<string, unknown>) => ({
              pet: String(i.pet || ""), title: String(i.title || ""), kind: String(i.kind || ""),
              time: toDate(i.time), detail: String(i.detail || ""),
            })),
            photoPaths: Array.isArray(x.photoPaths) ? x.photoPaths.filter((p: unknown) => typeof p === "string") : [],
            // Just written: the server time isn't back yet
            createdAt: toDate(x.createdAt) || new Date(),
          };
        }).filter((r) => r.createdAt.getTime() >= since));
      },
      () => setReports([]),
    );
  }, [uid]);

  if (reports.length === 0) return null;

  return (
    <section className="rounded-2xl p-5 md:p-6" style={{ background: "var(--pure-white)", border: "1px solid var(--mist-gray)" }}>
      <h2 className="font-fraunces font-semibold mb-3" style={{ fontSize: "20px", color: "var(--bindr-navy)" }}>Visit reports</h2>
      <ul className="divide-y divide-[var(--mist-gray)]">
        {reports.map((r) => <ReportRow key={r.id} report={r} />)}
      </ul>
    </section>
  );
}

function ReportRow({ report }: { report: Report }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="py-2">
      <button
        className="w-full flex items-center justify-between gap-3 text-left font-inter"
        style={{ minHeight: 44 }}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span>
          <span className="block font-semibold text-[var(--charcoal)]">From {report.sitterName}</span>
          <span className="block text-[var(--slate-gray)]" style={{ fontSize: "14px" }}>
            {[names(report.petNames), when(report.createdAt), report.photoPaths.length ? `${report.photoPaths.length} photo${report.photoPaths.length === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ")}
          </span>
        </span>
        <span className="text-[var(--slate-gray)]" aria-hidden>{open ? "▾" : "›"}</span>
      </button>
      {open && <ReportDetail report={report} />}
    </li>
  );
}

function ReportDetail({ report }: { report: Report }) {
  return (
    <div className="space-y-3 pt-2 pb-1">
      {report.note && (
        <p className="font-inter text-[var(--charcoal)] whitespace-pre-line" style={{ fontSize: "16px" }}>{report.note}</p>
      )}
      {report.photoPaths.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {report.photoPaths.map((p, i) => <ReportPhoto key={p} saved={p} label={`Photo ${i + 1} from ${report.sitterName}`} />)}
        </div>
      )}
      {report.items.length > 0 && (
        <div>
          <p className="font-inter font-semibold text-[var(--bindr-navy)] mb-1" style={{ fontSize: "15px" }}>Done</p>
          <ul className="space-y-1">
            {report.items.map((i, n) => (
              <li key={n} className="font-inter flex justify-between gap-3" style={{ fontSize: "15px" }}>
                <span>
                  <span style={{ color: "var(--success-green)" }} aria-hidden>✓ </span>
                  {i.pet} · {i.title}
                  {i.detail && <span className="text-[var(--slate-gray)]"> · {i.detail}</span>}
                </span>
                {i.time && (
                  <span className="text-[var(--slate-gray)] shrink-0">
                    {i.time.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ReportPhoto({ saved, label }: { saved: string; label: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const path = storagePath(saved);
    if (!path) { setFailed(true); return; }
    let url: string | null = null;
    let cancelled = false;
    getBlob(ref(firebase().storage, path))
      .then((b) => { if (cancelled) return; url = URL.createObjectURL(b); setSrc(url); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [saved]);

  if (failed) {
    return (
      <div className="rounded-xl flex items-center justify-center font-inter text-[var(--slate-gray)]"
        style={{ aspectRatio: "1", background: "var(--warm-cream)", fontSize: "14px" }}>
        Photo unavailable
      </div>
    );
  }
  if (!src) {
    return <div className="rounded-xl" style={{ aspectRatio: "1", background: "var(--warm-cream)" }} aria-label="Loading photo" />;
  }
  return (
    <a href={src} target="_blank" rel="noopener noreferrer">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={label} className="rounded-xl w-full object-cover" style={{ aspectRatio: "1" }} />
    </a>
  );
}
