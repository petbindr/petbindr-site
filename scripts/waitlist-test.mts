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
const sent: { to: string; subject: string; text?: string; headers?: Record<string, string> }[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
  if (String(url).includes("api.resend.com")) {
    const body = JSON.parse(String(init?.body || "{}"));
    // The email service turning an address down (it repeats the address)
    if (String(body.to).startsWith("bounce")) {
      return new Response(JSON.stringify({ name: "validation_error", statusCode: 422, message: `Can't send to ${body.to}` }),
        { status: 422, headers: { "content-type": "application/json" } });
    }
    sent.push({ to: Array.isArray(body.to) ? body.to[0] : body.to, subject: body.subject, text: body.text, headers: body.headers });
    return new Response(JSON.stringify({ id: "test" }), { status: 200, headers: { "content-type": "application/json" } });
  }
  return realFetch(url, init);
}) as typeof fetch;

const { POST } = await import(pathToFileURL(resolve(site, "app/api/waitlist/route.ts")).href);
const { NextRequest } = await import("next/server.js");

let ok = 0, bad = 0;
const check = (label: string, cond: boolean) => { cond ? ok++ : bad++; console.log(cond ? "ok   " : "WRONG", label); };
let ipCounter = 0;
async function join(email: string, extra: Record<string, string> = {}, ip = `10.0.0.${++ipCounter}`) {
  const req = new NextRequest("https://petbindr.com/api/waitlist", {
    method: "POST", body: JSON.stringify({ email, ...extra }),
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
  });
  const res = await POST(req);
  return { status: res.status, body: await res.json() };
}
const mailTo = (email: string) => sent.filter((m) => m.to === email);
// Every reply carries a share link with a random-looking code (2026-11-24): compare
// replies with the code masked, and check the link's format on its own
const SHARE_RE = /^https:\/\/petbindr\.com\/\?ref=[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/;
const shape = (body: Record<string, unknown>) =>
  JSON.stringify({ ...body, ...(typeof body.shareUrl === "string" ? { shareUrl: body.shareUrl.replace(/ref=.*/, "ref=CODE") } : {}) });
const sameReply = (a: { body: Record<string, unknown> }, b: { body: Record<string, unknown> }) =>
  shape(a.body) === shape(b.body) && SHARE_RE.test(String(a.body.shareUrl)) && SHARE_RE.test(String(b.body.shareUrl));
const codeOf = (r: { body: Record<string, unknown> }) => String(r.body.shareUrl).split("ref=")[1];

// A new address
const fresh = await join("new@example.test");
// One already on the list (signed up last week)
await db.doc("waitlist/old@example.test").set({ email: "old@example.test", unsubscribeToken: "t1", foundingMember: true, createdAt: Timestamp.now() });
const again = await join("old@example.test");

check("new address: success", fresh.status === 200 && fresh.body.success === true);
check("already on the list: the very same reply", again.status === 200 && sameReply(again, fresh));
check("new address: the reply's code is its saved code", await db.doc("waitlist/new@example.test").get().then((d) => d.data()?.referralCode === codeOf(fresh)));
check("already on the list: the reply doesn't give away its saved code",
  await db.doc("waitlist/old@example.test").get().then((d) => typeof d.data()?.referralCode === "string" && d.data()?.referralCode !== codeOf(again)));
check("already on the list: the email has its real link",
  await db.doc("waitlist/old@example.test").get().then((d) => mailTo("old@example.test").some((m) => JSON.stringify(m).includes(`ref=${d.data()?.referralCode}`))));
check("reply doesn't say founding member (only new signups got it)", !("foundingMember" in fresh.body) && !("alreadyExists" in again.body));
check("new address gets the confirmation email", mailTo("new@example.test").some((m) => m.subject === "You're on the list."));
check("address already on the list gets 'already on the list' by email", mailTo("old@example.test").some((m) => m.subject === "You're already on the list."));
check("the list entry wasn't changed (still founding, same token)", await db.doc("waitlist/old@example.test").get().then((d) => d.data()?.foundingMember === true && d.data()?.unsubscribeToken === "t1"));

// Submitting again the same day: same reply, no second email
const before = mailTo("old@example.test").length;
const third = await join("old@example.test");
check("again the same day: same reply", sameReply(third, fresh));
check("again the same day: no second email", mailTo("old@example.test").length === before);

// Two submits of an address already on the list at the same moment: one email
await db.doc("waitlist/twice@example.test").set({ email: "twice@example.test", unsubscribeToken: "t3", createdAt: Timestamp.now() });
const both = await Promise.all([join("twice@example.test"), join("twice@example.test")]);
check("two at once: same reply both times", both.every((r) => sameReply(r, fresh)));
check("two at once: one 'already on the list' email", mailTo("twice@example.test").length === 1);

// More rounds of the above, so the race shows up: the losing request used to get
// "Service temporarily unavailable" about 1 in 4 times (a transaction error the SDK
// doesn't retry). Same connection for the new address: a real double click.
for (let round = 0; round < 3; round++) {
  const known = `dbl${round}@example.test`, brandNew = `dblnew${round}@example.test`;
  await db.doc(`waitlist/${known}`).set({ email: known, unsubscribeToken: "t4", createdAt: Timestamp.now() });
  const ipNew = `10.1.${round}.2`;
  const k = await Promise.all([join(known), join(known)]);
  check(`two at once, on the list (${round}): same reply both times`, k.every((r) => r.status === 200 && sameReply(r, fresh)));
  check(`two at once, on the list (${round}): one email`, mailTo(known).length === 1);
  const n = await Promise.all([join(brandNew, {}, ipNew), join(brandNew, {}, ipNew)]);
  const saved = (await db.doc(`waitlist/${brandNew}`).get()).data() || {};
  check(`double click, new (${round}): same reply both times`, n.every((r) => r.status === 200 && sameReply(r, fresh)));
  check(`double click, new (${round}): one entry with one of the replies' codes`, n.some((r) => codeOf(r) === saved.referralCode));
  check(`double click, new (${round}): one welcome email`, mailTo(brandNew).filter((m) => m.subject === "You're on the list.").length === 1);
}

// After unsubscribing, joining again puts them back on, with the normal email
await db.doc("waitlist/gone@example.test").set({ email: "gone@example.test", unsubscribeToken: "t2", unsubscribed: true, createdAt: Timestamp.now() });
const back = await join("gone@example.test");
check("rejoin after unsubscribing: same reply", sameReply(back, fresh));
check("rejoin: back on the list", await db.doc("waitlist/gone@example.test").get().then((d) => !d.data()?.unsubscribed));

// The bot field: same reply, nothing saved or sent
const bot = await join("bot@example.test", { website: "http://spam" });
check("bot field filled: same reply", sameReply(bot, fresh));
check("bot field filled: nothing saved or sent", !(await db.doc("waitlist/bot@example.test").get()).exists && mailTo("bot@example.test").length === 0);

// Where the signup came from (sent by the form from the landing page)
await join("tagged@example.test", { source: "instagram", medium: "social", campaign: "launch" });
const tagged = (await db.doc("waitlist/tagged@example.test").get()).data() || {};
check("source: utm tags saved", tagged.source === "instagram" && tagged.medium === "social" && tagged.campaign === "launch");
await join("linked@example.test", { referrer: "reddit.com" });
const linked = (await db.doc("waitlist/linked@example.test").get()).data() || {};
check("source: a referring site is saved as a referral", linked.source === "referral" && linked.referrer === "reddit.com");
await join("direct@example.test");
const direct = (await db.doc("waitlist/direct@example.test").get()).data() || {};
check("source: none when nobody linked here", !("source" in direct) && !("referrer" in direct));
const tooLong = await join("long@example.test", { campaign: "x".repeat(101) });
check("source: an overlong tag is refused", tooLong.status === 400);

// A bad address still says what's wrong
const badAddr = await join("not-an-email");
check("invalid address: error message", badAddr.status === 400 && typeof badAddr.body.error === "string");

// Unsubscribe links carry only the token now (2026-11-18 review, item 22); old ones have the email too
const unsub = await import(pathToFileURL(resolve(site, "app/api/unsubscribe/route.ts")).href);
await db.doc("waitlist/tokenonly@example.test").set({ email: "tokenonly@example.test", unsubscribeToken: "tok-0123456789abcdef-xyz", createdAt: Timestamp.now() });
await db.doc("waitlist/oldlink@example.test").set({ email: "oldlink@example.test", unsubscribeToken: "tok-old-0123456789abcdef", createdAt: Timestamp.now() });
const post = (q: string) => unsub.POST(new NextRequest(`https://www.petbindr.com/api/unsubscribe?${q}`, { method: "POST" }));
await post("t=tok-0123456789abcdef-xyz");
check("unsubscribe by token alone", (await db.doc("waitlist/tokenonly@example.test").get()).data()?.unsubscribed === true);
await post("e=oldlink%40example.test&t=tok-old-0123456789abcdef");
check("an older link with the email still works", (await db.doc("waitlist/oldlink@example.test").get()).data()?.unsubscribed === true);
await db.doc("waitlist/safe@example.test").set({ email: "safe@example.test", unsubscribeToken: "tok-safe-0123456789abcdef", createdAt: Timestamp.now() });
await post("t=wrong-token-0123456789abcdef");
check("a wrong token unsubscribes nobody", !(await db.doc("waitlist/safe@example.test").get()).data()?.unsubscribed);
check("links sent now are token-only, on www", sent.some((m) => /www\.petbindr\.com\/unsubscribe\?t=/.test(m.text || ""))
  && !sent.some((m) => /unsubscribe\?[^\s"]*e=/.test(JSON.stringify(m))));

// A failed email is logged (it used to be dropped without a word), without the address
const logged: string[] = [];
const realError = console.error;
console.error = (...a: unknown[]) => { logged.push(a.map(String).join(" ")); };
const bounced = await join("bounce@example.test");
console.error = realError;
check("email refused: the signup still succeeds", bounced.status === 200);
check("email refused: it's logged", logged.some((l) => l.startsWith("Resend error") && l.includes("422")));
check("email refused: no address in the log", logged.every((l) => !l.includes("bounce@example.test")));
check("email refused: hello@ still hears about the signup", sent.some((m) => m.to === "hello@petbindr.com" && m.subject.includes("bounce@example.test")));

console.log(`\n${ok} passed, ${bad} wrong`);
process.exit(bad ? 1 : 0);
