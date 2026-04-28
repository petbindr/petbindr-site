import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdmin } from "@/lib/firebase-admin";
import { getResend, FROM_EMAIL, FROM_NAME } from "@/lib/resend";

const schema = z.object({
  email: z.string().email("Please enter a valid email address.").toLowerCase().trim(),
  source: z.string().optional(),
});

const FOUNDING_MEMBER_LIMIT = 1000;

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

  const { email, source } = parsed.data;

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

  // Check for existing signup
  const existing = await docRef.get();
  if (existing.exists) {
    return NextResponse.json({ alreadyExists: true }, { status: 200 });
  }

  // Count existing signups to determine founding member status
  const countSnap = await db.collection("waitlist").count().get();
  const currentCount = countSnap.data().count;
  const isFoundingMember = currentCount < FOUNDING_MEMBER_LIMIT;

  // Write to Firestore
  await docRef.set({
    email,
    createdAt: FieldValue.serverTimestamp(),
    foundingMember: isFoundingMember,
    ...(finalSource ? { source: finalSource } : {}),
  });

  // Send confirmation email
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
          <a href="https://petbindr.com/privacy" style="color:#6B7785;">Privacy</a>
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
TikTok: https://tiktok.com/@petbindr`;

    await getResend().emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: email,
      subject: "You're on the list.",
      text: textBody,
      html: htmlBody,
    });
  } catch (emailErr) {
    // Don't fail the request if email sending fails — signup is saved
    console.error("Resend error:", emailErr);
  }

  return NextResponse.json({ success: true, foundingMember: isFoundingMember }, { status: 200 });
}
