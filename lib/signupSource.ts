// Where a waitlist signup came from (2026-11-17, review: signup sources were
// never recorded; the API looked for utm_source on its own address, which never
// has one). The first page someone lands on is read once per visit: the
// utm_source / utm_medium / utm_campaign in its address, and the site that
// linked here, and a friend's referral code (?ref=). Kept in sessionStorage
// (this tab only), then sent with the signup.

export type SignupSource = { source?: string; medium?: string; campaign?: string; referrer?: string; ref?: string };

const KEY = "pb_signup_source";

const clean = (v: string | null) => (v ? v.trim().slice(0, 100) : undefined) || undefined;

export function rememberSignupSource() {
  try {
    if (sessionStorage.getItem(KEY)) return; // only the landing page counts
    const params = new URLSearchParams(window.location.search);
    let referrer: string | undefined;
    try {
      const host = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, "") : "";
      // Our own pages don't count as a source
      if (host && host !== "petbindr.com") referrer = host.slice(0, 100);
    } catch { /* not a URL */ }
    const found: SignupSource = {
      source: clean(params.get("utm_source")),
      medium: clean(params.get("utm_medium")),
      campaign: clean(params.get("utm_campaign")),
      referrer,
      // A friend's referral link (?ref=<code>); the server checks the code
      ref: (() => { const r = clean(params.get("ref"))?.toUpperCase(); return r && /^[A-Z0-9]{8}$/.test(r) ? r : undefined; })(),
    };
    sessionStorage.setItem(KEY, JSON.stringify(found));
  } catch { /* storage blocked: no source, the signup still works */ }
}

export function signupSource(): SignupSource {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || "{}") as SignupSource;
  } catch {
    return {};
  }
}
