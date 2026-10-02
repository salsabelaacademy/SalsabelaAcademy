export async function verifyTurnstile(token: unknown, ip?: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: process.env.NODE_ENV === "development", bypass: process.env.NODE_ENV === "development" };
  if (!process.env.TURNSTILE_SITE_KEY || typeof token !== "string" || !token || token.length > 2048) return { ok: false, bypass: false };
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", signal: AbortSignal.timeout(10000), headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ secret, response: token, ...(ip ? { remoteip: ip } : {}) }) });
    const result = await response.json() as { success?: boolean; hostname?: string };
    const expectedHost = process.env.FRONTEND_URL ? new URL(process.env.FRONTEND_URL).hostname : null;
    return { ok: response.ok && result.success === true && (process.env.NODE_ENV !== "production" || (!!expectedHost && result.hostname === expectedHost)), bypass: false };
  } catch { return { ok: false, bypass: false }; }
}
