import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdmin } from "@/lib/firebase-admin";
import { logError } from "@/lib/logSafe";

// POST only: from the button on /unsubscribe (form post) or from a mail app's
// one-click unsubscribe (RFC 8058, email + token in the query string).
// GET is deliberately not supported, so link scanners can't unsubscribe people.

async function unsubscribe(email: string, token: string): Promise<boolean> {
  if (!token || token.length < 20) return false;
  const { db } = getFirebaseAdmin();
  let ref;
  if (email) {
    // Links sent before 2026-11-18 carry the email too
    ref = db.collection("waitlist").doc(email.toLowerCase().trim());
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.unsubscribeToken !== token) return false;
  } else {
    const found = await db.collection("waitlist").where("unsubscribeToken", "==", token).limit(1).get();
    if (found.empty) return false;
    ref = found.docs[0].ref;
  }
  await ref.update({ unsubscribed: true, unsubscribedAt: FieldValue.serverTimestamp() });
  return true;
}

export async function POST(req: NextRequest) {
  let email = req.nextUrl.searchParams.get("e") ?? "";
  let token = req.nextUrl.searchParams.get("t") ?? "";
  let fromOurPage = false;

  if ((req.headers.get("content-type") ?? "").includes("application/x-www-form-urlencoded")) {
    const form = await req.formData();
    fromOurPage = form.get("source") === "page";
    email = String(form.get("e") ?? email);
    token = String(form.get("t") ?? token);
  }

  let ok = false;
  try {
    ok = await unsubscribe(email, token);
  } catch (err) {
    logError("Unsubscribe error", err);
  }

  // Button on /unsubscribe → show the result page. Mail-app one-click → plain status.
  if (fromOurPage) {
    return NextResponse.redirect(new URL(`/unsubscribe?status=${ok ? "done" : "invalid"}`, req.url), 303);
  }
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}
