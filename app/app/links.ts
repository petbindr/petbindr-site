// Small helpers for sitter links on petbindr.com/app (SitterLinkMaker). Plain
// TypeScript so tests can import them.

/** "2026-11-12" → that day at the given hour, local time */
export function dayAt(value: string, hour: number, minute = 0): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), hour, minute);
  return isNaN(d.getTime()) ? null : d;
}

/** The text to send with the link (same wording as the app) */
export function linkMessage(sitterName: string, petNames: string[], url: string, notes: string): string {
  const names = petNames.length <= 1 ? (petNames[0] || "the pets")
    : `${petNames.slice(0, -1).join(", ")} and ${petNames[petNames.length - 1]}`;
  const first = sitterName.trim().split(/\s+/)[0] || sitterName;
  let text = `Hi ${first}! Here's everything you need to take care of ${names}: ${url}\n\nIt opens in your browser, no app needed. You can check off feedings and meds there too.`;
  if (notes.trim()) text += `\n\nThis time: ${notes.trim()}`;
  return text;
}

