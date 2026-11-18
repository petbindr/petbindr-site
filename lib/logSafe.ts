// Server logs without email addresses (2026-11-18, follow-up to the 2026-11-17
// review, item 29). Waitlist entries are stored under the address
// (waitlist/{email}), so a database error's text can include it, and the
// email service's errors can repeat the recipient. Errors are logged as their
// name, code and message with any address masked, never as the whole object.

export function redactEmails(text: unknown): string {
  return String(text ?? "").replace(/[^\s@/"'<>(),;:]+@[^\s@/"'<>(),;:]+\.[a-z]{2,}/gi, "[email]");
}

export function logError(label: string, err: unknown): void {
  const e = (err ?? {}) as { name?: unknown; code?: unknown; statusCode?: unknown; message?: unknown };
  const parts = [
    typeof e.name === "string" && e.name !== "Error" ? e.name : null,
    e.code != null ? `code ${String(e.code)}` : e.statusCode != null ? `status ${String(e.statusCode)}` : null,
    redactEmails(typeof e.message === "string" ? e.message : typeof err === "string" ? err : JSON.stringify(err) ?? ""),
  ].filter(Boolean);
  console.error(`${label}: ${parts.join(" · ")}`);
}
