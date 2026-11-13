import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getFirebaseAdmin } from "@/lib/firebase-admin";
import { getResend, FROM_EMAIL, FROM_NAME } from "@/lib/resend";
import { newUnsubscribeToken, unsubscribePageUrl, unsubscribeHeaders } from "@/lib/unsubscribe";

// trim before checking: " a@b.com" (a pasted space) was rejected as invalid
const schema = z.object({
  email: z.string().trim().toLowerCase().max(254).email("Please enter a valid email address."),
  source: z.string().max(100).optional(),
  // Hidden from people (WaitlistForm); bots that fill every field fill it
  website: z.string().max(500).optional(),
});

const FOUNDING_MEMBER_LIMIT = 1000;
// Every signup gets the same reply ({ success: true }), whether or not the
// address was already on the list: "You're already on the list" (and the
// founding-member flag, which only new signups got) let anyone check whether
// someone's email is signed up (2026-11-13). The person finds out by email.
const SAME_REPLY = { success: true };
// An address already on the list gets a short "you're already on it" email,
// at most once a day, so repeated submits can't flood someone's inbox
const ALREADY_NOTICE_EVERY_MS = 24 * 3600_000;
// Signups from one connection: each one sends an email from petbindr.com, so a
// script posting thousands of addresses could email-bomb strangers
const PER_IP_PER_HOUR = 5;

async function allowedFromIp(db: FirebaseFirestore.Firestore, req: NextRequest) {
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  const ref = db.collection("waitlistThrottle").doc(createHash("sha256").update(ip).digest("hex").slice(0, 32));
  const now = Date.now();
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const recent = ((snap.exists ? snap.data()?.at : []) as number[] || []).filter((t) => now - t < 3600_000);
    if (recent.length >= PER_IP_PER_HOUR) return false;
    tx.set(ref, { at: [...recent, now] });
    return true;
  });
}

export async function POST(req: NextRequest) {
  // Parse and validate
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid email." },
      { status: 400 }
    );
  }

  const { email, source, website } = parsed.data;
  // Honeypot filled in: look like it worked, save and send nothing
  if (website) return NextResponse.json(SAME_REPLY, { status: 200 });

  // Derive source from UTM params if not explicitly provided
  const utmSource = req.nextUrl.searchParams.get("utm_source") ?? undefined;
  const finalSource = source ?? utmSource;

  let db: ReturnType<typeof getFirebaseAdmin>["db"];
  try {
    ({ db } = getFirebaseAdmin());
  } catch (err) {
    console.error("Firebase Admin init error:", err);
    return NextResponse.json(
      { error: "Service temporarily unavailable. Please try again." },
      { status: 503 }
    );
  }

  const docRef = db.collection("waitlist").doc(email);
  let unsubscribeToken: string;
  let isFoundingMember: boolean;
  try {
    if (!(await allowedFromIp(db, req))) {
      return NextResponse.json({ error: "Too many signups from here. Please try again in an hour." }, { status: 429 });
    }

    // Check for existing signup
    const existing = await docRef.get();
    if (existing.exists) {
      const prev = existing.data() || {};
      if (!prev.unsubscribed) {
        await noticeAlreadyOnList(docRef, email, prev);
        return NextResponse.json(SAME_REPLY, { status: 200 });
      }
      // Signed up again after unsubscribing: back on the list (they said "already on
      // the list" but stayed unsubscribed, so they'd never hear about launch)
      unsubscribeToken = prev.unsubscribeToken || newUnsubscribeToken();
      isFoundingMember = prev.foundingMember === true;
      await docRef.update({
        unsubscribed: FieldValue.delete(), unsubscribedAt: FieldValue.delete(),
        unsubscribeToken, resubscribedAt: FieldValue.serverTimestamp(),
      });
    } else {
      // Count existing signups to determine founding member status
      const countSnap = await db.collection("waitlist").count().get();
      isFoundingMember = countSnap.data().count < FOUNDING_MEMBER_LIMIT;

      // create(), not set(): two submits at once both passed the check above and the
      // second overwrote the first one's unsubscribe token (its email's link stopped working)
      unsubscribeToken = newUnsubscribeToken();
      try {
        await docRef.create({
          email,
          unsubscribeToken,
          createdAt: FieldValue.serverTimestamp(),
          foundingMember: isFoundingMember,
          ...(finalSource ? { source: finalSource } : {}),
        });
      } catch (err) {
        // Another submit of the same address got there first; it sends the email
        if ((err as { code?: number }).code === 6) return NextResponse.json(SAME_REPLY, { status: 200 });
        throw err;
      }
    }
  } catch (err) {
    console.error("Waitlist save error:", err);
    return NextResponse.json({ error: "Service temporarily unavailable. Please try again." }, { status: 503 });
  }

  // Send confirmation email
  const unsubscribeUrl = unsubscribePageUrl(email, unsubscribeToken);
  try {
    const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You're on the list.</title>
</head>
<body style="margin:0;padding:0;background-color:#FBF8F3;font-family:Inter,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FBF8F3;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:560px;background-color:#FFFFFF;border-radius:16px;padding:48px 40px;border:1px solid #E8ECEF;">
          <tr>
            <td>
              <img src="https://petbindr.com/logo.png" alt="PetBindr" width="140" style="display:block;margin:0 0 32px;" />
              <h1 style="margin:0 0 20px;font-size:28px;font-weight:700;color:#1F3C5F;line-height:1.2;font-family:Georgia,serif;">
                You&rsquo;re on the list.
              </h1>
              <p style="margin:0 0 16px;font-size:16px;color:#1A1F2E;line-height:1.6;">
                You&rsquo;re officially on the PetBindr waitlist. We&rsquo;ll email you when
                we launch on iOS, and occasionally before with build updates you&rsquo;ll
                actually want.
              </p>
              ${
                isFoundingMember
                  ? `<p style="margin:0 0 16px;font-size:16px;color:#1A1F2E;line-height:1.6;">
                You&rsquo;re one of the first 1,000 — which means you&rsquo;re a <strong style="color:#1F3C5F;">Founding Member</strong>.
                Early access, in-app badge, and locked-in best pricing forever.
              </p>`
                  : ""
              }
              <p style="margin:0 0 32px;font-size:16px;color:#1A1F2E;line-height:1.6;">
                If you have a friend who&rsquo;s ever had to leave a 13-page binder for a
                pet sitter, send them our way:
                <a href="https://petbindr.com" style="color:#1F3C5F;font-weight:600;">petbindr.com</a>
              </p>
              <hr style="border:none;border-top:1px solid #E8ECEF;margin:0 0 28px;" />
              <p style="margin:0;font-size:14px;color:#6B7785;line-height:1.8;text-align:center;">
                <a href="mailto:hello@petbindr.com" style="color:#6B7785;text-decoration:none;">hello@petbindr.com</a>
                &nbsp;&middot;&nbsp;
                <a href="https://instagram.com/petbindr" style="color:#6B7785;text-decoration:none;">Instagram</a>
                &nbsp;&middot;&nbsp;
                <a href="https://tiktok.com/@petbindr" style="color:#6B7785;text-decoration:none;">TikTok</a>
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:20px 0 0;font-size:12px;color:#6B7785;">
          © PetBindr LLC 2026 &bull;
          <a href="https://petbindr.com/privacy" style="color:#6B7785;">Privacy</a> &bull;
          <a href="${unsubscribeUrl}" style="color:#6B7785;">Unsubscribe</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    const textBody = `Hey,

You're officially on the PetBindr waitlist. We'll email you when we launch on iOS, and occasionally before with build updates you'll actually want.

${
  isFoundingMember
    ? `You're one of the first 1,000 — which means you're a Founding Member. Early access, in-app badge, and locked-in best pricing forever.

`
    : ""
}If you have a friend who's ever had to leave a 13-page binder for a pet sitter, send them our way: https://petbindr.com

— The PetBindr team
hello@petbindr.com

Instagram: https://instagram.com/petbindr
TikTok: https://tiktok.com/@petbindr

Don't want these emails? Unsubscribe: ${unsubscribeUrl}`;

    await getResend().emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: email,
      subject: "You're on the list.",
      text: textBody,
      html: htmlBody,
      headers: unsubscribeHeaders(email, unsubscribeToken),
    });

    await getResend().emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: "hello@petbindr.com",
      subject: `New waitlist signup: ${email}`,
      text: `${email} just joined the waitlist.${isFoundingMember ? " Founding member." : ""}`,
    });
  } catch (emailErr) {
    // Don't fail the request if email sending fails — signup is saved
    console.error("Resend error:", emailErr);
  }

  return NextResponse.json(SAME_REPLY, { status: 200 });
}

/** "You're already on the list", by email only (see SAME_REPLY). */
async function noticeAlreadyOnList(
  docRef: FirebaseFirestore.DocumentReference, email: string, prev: FirebaseFirestore.DocumentData,
) {
  try {
    // In a transaction: two submits at once (from different connections) both
    // passed a plain read-then-write check and each sent a notice
    const now = Date.now();
    const token = await docRef.firestore.runTransaction(async (tx) => {
      const d = (await tx.get(docRef)).data() || {};
      const last = d.alreadyNoticeAt?.toMillis?.() ?? 0;
      if (now - last < ALREADY_NOTICE_EVERY_MS) return null;
      const t: string = d.unsubscribeToken || newUnsubscribeToken();
      tx.update(docRef, { alreadyNoticeAt: Timestamp.fromMillis(now), ...(d.unsubscribeToken ? {} : { unsubscribeToken: t }) });
      return t;
    });
    if (!token) return;
    const unsubscribeUrl = unsubscribePageUrl(email, token);
    const founding = prev.foundingMember === true
      ? " And you're a Founding Member: early access, an in-app badge, and locked-in best pricing." : "";
    await getResend().emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: email,
      subject: "You're already on the list.",
      text: `Hey,

Someone (probably you) just tried to join the PetBindr waitlist with this address. You're already on it, so there's nothing to do. We'll email you when we launch on iOS.${founding}

If that wasn't you, you can ignore this email.

— The PetBindr team
hello@petbindr.com

Don't want these emails? Unsubscribe: ${unsubscribeUrl}`,
      html: `<!DOCTYPE html><html lang="en"><body style="margin:0;padding:40px 20px;background-color:#FBF8F3;font-family:Inter,Helvetica,Arial,sans-serif;">
<table width="100%" style="max-width:560px;margin:0 auto;background-color:#FFFFFF;border-radius:16px;padding:40px;border:1px solid #E8ECEF;"><tr><td>
<img src="https://petbindr.com/logo.png" alt="PetBindr" width="140" style="display:block;margin:0 0 28px;" />
<h1 style="margin:0 0 16px;font-size:26px;color:#1F3C5F;font-family:Georgia,serif;">You&rsquo;re already on the list.</h1>
<p style="margin:0 0 16px;font-size:16px;color:#1A1F2E;line-height:1.6;">Someone (probably you) just tried to join the PetBindr waitlist with this address. You&rsquo;re already on it, so there&rsquo;s nothing to do. We&rsquo;ll email you when we launch on iOS.${founding ? ` You&rsquo;re a <strong style="color:#1F3C5F;">Founding Member</strong>: early access, an in-app badge, and locked-in best pricing.` : ""}</p>
<p style="margin:0;font-size:14px;color:#6B7785;line-height:1.6;">If that wasn&rsquo;t you, you can ignore this email.</p>
</td></tr></table>
<p style="margin:20px 0 0;font-size:12px;color:#6B7785;text-align:center;">&copy; PetBindr LLC 2026 &bull; <a href="${unsubscribeUrl}" style="color:#6B7785;">Unsubscribe</a></p>
</body></html>`,
      headers: unsubscribeHeaders(email, token),
    });
  } catch (err) {
    // The reply is the same either way; a failed notice only loses the email
    console.error("Already-on-list notice error:", err);
  }
}
