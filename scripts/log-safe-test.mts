// Server logs without email addresses (lib/logSafe.ts). Run: node scripts/log-safe-test.mts
import { redactEmails, logError } from "../lib/logSafe.ts";

let ok = 0, bad = 0;
const check = (label: string, cond: boolean) => { cond ? ok++ : bad++; console.log(cond ? "ok   " : "WRONG", label); };

check("a Firestore path", redactEmails("ALREADY_EXISTS: Document already exists: projects/p/databases/(default)/documents/waitlist/jo_ann+pets@mail.example.co.uk") ===
  "ALREADY_EXISTS: Document already exists: projects/p/databases/(default)/documents/waitlist/[email]");
check("an address in angle brackets", redactEmails("PetBindr <hello@petbindr.com>") === "PetBindr <[email]>");
check("text with no address is unchanged", redactEmails("Service unavailable") === "Service unavailable");
check("an apostrophe in the address", redactEmails("failed for o'brien@example.com") === "failed for [email]");
check("an address in single quotes", redactEmails("to 'sam@example.com'") === "to [email]'");

const lines: string[] = [];
const real = console.error;
console.error = (...a: unknown[]) => { lines.push(a.join(" ")); };
logError("Resend error", Object.assign(new Error("Invalid `to` field: bad@@example"), { statusCode: 422 }));
logError("Waitlist save error", Object.assign(new Error("5 NOT_FOUND: waitlist/sam@example.com"), { code: 5 }));
logError("Odd error", { message: "for sam@example.com", extra: { to: "sam@example.com" } });
logError("String error", "failed for sam@example.com");
console.error = real;

check("one line each", lines.length === 4);
check("no address in any line", lines.every((l) => !/sam@example\.com/.test(l)));
check("status code kept", lines[0].includes("status 422"));
check("error code and message kept", lines[1] === "Waitlist save error: code 5 · 5 NOT_FOUND: waitlist/[email]");
check("other fields of the object aren't logged", !lines[2].includes("extra"));
check("a thrown string is masked", lines[3] === "String error: failed for [email]");

console.log(`\n${ok} passed, ${bad} wrong`);
process.exit(bad ? 1 : 0);
