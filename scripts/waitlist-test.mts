// Emulator test for the waitlist signup (app/api/waitlist/route.ts): the reply
// is the same whether or not an address is already on the list, so the form
// can't be used to check someone's email (2026-11-13). Runs the real route
// against the Firestore emulator; emails are captured, not sent. Run from the
// PetBindr repo:
//   PATH=/opt/homebrew/opt/openjdk@21/bin:$PATH firebase emulators:exec --only firestore \
//     --project demo-petbindr "node ../petbindr-site/scripts/waitlist-test.mts"
import { registerHooks } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";

const site = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// The route imports "@/lib/…" (tsconfig paths) without file extensions
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/")) {
      const base = resolve(site, specifier.slice(2));
      for (const ext of [".ts", ".tsx", "/index.ts"]) {
        if (existsSync(base + ext)) return next(pathToFileURL(base + ext).href, context);
      }
    }
    if (specifier === "next/server") return next("next/server.js", context);
    return next(specifier, context);
  },
});

process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8080";
process.env.RESEND_API_KEY = "re_test_not_real";
const { initializeApp } = await import("firebase-admin/app");
const { getFirestore, Timestamp } = await import("firebase-admin/firestore");
initializeApp({ projectId: "demo-petbindr" }); // the route reuses this app
const db = getFirestore();

// Capture emails instead of sending them
const sent: { to: string; subject: string }[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
  if (String(url).includes("api.resend.com")) {
    const body = JSON.parse(String(init?.body || "{}"));
    sent.push({ to: Array.isArray(body.to) ? body.to[0] : body.to, subject: body.subject });
    return new Response(JSON.stringify({ id: "test" }), { status: 200, headers: { "content-type": "application/json" } });
  }
  return realFetch(url, init);
}) as typeof fetch;

const { POST } = await import(pathToFileURL(resolve(site, "app/api/waitlist/route.ts")).href);
const { NextRequest } = await import("next/server.js");

let ok = 0, bad = 0;
const check = (label: string, cond: boolean) => { cond ? ok++ : bad++; console.log(cond ? "ok   " : "WRONG", label); };
let ipCounter = 0;
async function join(email: string, extra: Record<string, string> = {}) {
  const req = new NextRequest("https://petbindr.com/api/waitlist", {
    method: "POST", body: JSON.stringify({ email, ...extra }),
    headers: { "content-type": "application/json", "x-forwarded-for": `10.0.0.${++ipCounter}` },
  });
  const res = await POST(req);
  return { status: res.status, body: await res.json() };
}
const mailTo = (email: string) => sent.filter((m) => m.to === email);

// A new address
const fresh = await join("new@example.test");
// One already on the list (signed up last week)
await db.doc("waitlist/old@example.test").set({ email: "old@example.test", unsubscribeToken: "t1", foundingMember: true, createdAt: Timestamp.now() });
const again = await join("old@example.test");

check("new address: success", fresh.status === 200 && fresh.body.success === true);
check("already on the list: the very same reply", again.status === 200 && JSON.stringify(again.body) === JSON.stringify(fresh.body));
check("reply doesn't say founding member (only new signups got it)", !("foundingMember" in fresh.body) && !("alreadyExists" in again.body));
check("new address gets the confirmation email", mailTo("new@example.test").some((m) => m.subject === "You're on the list."));
check("address already on the list gets 'already on the list' by email", mailTo("old@example.test").some((m) => m.subject === "You're already on the list."));
check("the list entry wasn't changed (still founding, same token)", await db.doc("waitlist/old@example.test").get().then((d) => d.data()?.foundingMember === true && d.data()?.unsubscribeToken === "t1"));

// Submitting again the same day: same reply, no second email
const before = mailTo("old@example.test").length;
const third = await join("old@example.test");
check("again the same day: same reply", JSON.stringify(third.body) === JSON.stringify(fresh.body));
check("again the same day: no second email", mailTo("old@example.test").length === before);

// After unsubscribing, joining again puts them back on, with the normal email
await db.doc("waitlist/gone@example.test").set({ email: "gone@example.test", unsubscribeToken: "t2", unsubscribed: true, createdAt: Timestamp.now() });
const back = await join("gone@example.test");
check("rejoin after unsubscribing: same reply", JSON.stringify(back.body) === JSON.stringify(fresh.body));
check("rejoin: back on the list", await db.doc("waitlist/gone@example.test").get().then((d) => !d.data()?.unsubscribed));

// The bot field: same reply, nothing saved or sent
const bot = await join("bot@example.test", { website: "http://spam" });
check("bot field filled: same reply", JSON.stringify(bot.body) === JSON.stringify(fresh.body));
check("bot field filled: nothing saved or sent", !(await db.doc("waitlist/bot@example.test").get()).exists && mailTo("bot@example.test").length === 0);

// A bad address still says what's wrong
const badAddr = await join("not-an-email");
check("invalid address: error message", badAddr.status === 400 && typeof badAddr.body.error === "string");

console.log(`\n${ok} passed, ${bad} wrong`);
process.exit(bad ? 1 : 0);
