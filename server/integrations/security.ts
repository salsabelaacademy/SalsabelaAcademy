import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export class IntegrationError extends Error {
  constructor(public code: string, public status = 400, public retryable = false) { super(code); }
}
export const digest = (s: string) => createHash("sha256").update(s).digest("hex");
function key() {
  const value = process.env.INTEGRATION_ENCRYPTION_KEY || "";
  if (!/^[a-f\d]{64}$/i.test(value)) throw new IntegrationError("encryption_missing", 503);
  return Buffer.from(value, "hex");
}
export function encrypt(value: string, context: string) {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(context));
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}
export function decrypt(value: string, context: string) {
  try {
    const [v, iv, tag, data] = value.split(".");
    if (v !== "v1") throw new Error();
    const cipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    cipher.setAAD(Buffer.from(context)); cipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([cipher.update(Buffer.from(data, "base64url")), cipher.final()]).toString("utf8");
  } catch { throw new IntegrationError("encryption_error", 503); }
}
export function frontendOrigin() {
  let url: URL;
  try { url = new URL(process.env.FRONTEND_URL || ""); } catch { throw new IntegrationError("origin_missing", 503); }
  if (url.username || url.password || (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.hostname === "localhost" && url.protocol === "http:"))) throw new IntegrationError("origin_missing", 503);
  return url.origin;
}
export function configured(provider: string) {
  try { key(); frontendOrigin(); } catch { return false; }
  return provider === "zoom"
    ? Boolean(process.env.ZOOM_ACCOUNT_ID && process.env.ZOOM_CLIENT_ID && process.env.ZOOM_CLIENT_SECRET && process.env.ZOOM_HOST_USER_ID)
    : Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}
export function driveId(input: string) {
  if (/^[\w-]{10,200}$/.test(input)) return input;
  try {
    const u = new URL(input);
    if (u.protocol !== "https:" || !["drive.google.com", "docs.google.com"].includes(u.hostname) || u.username || u.password) throw new Error();
    const id = u.pathname.match(/\/d\/([\w-]+)/)?.[1] || u.searchParams.get("id");
    if (id && /^[\w-]{10,200}$/.test(id)) return id;
  } catch { /* fail closed */ }
  throw new IntegrationError("invalid_drive_url");
}
export function validTimezone(value: string) {
  try { new Intl.DateTimeFormat("en", { timeZone: value }).format(); return true; } catch { return false; }
}
export function safeZoomUrl(value: string) {
  try { const u = new URL(value); if (u.protocol === "https:" && (u.hostname === "zoom.us" || u.hostname.endsWith(".zoom.us")) && !u.username && !u.password) return u.href; } catch { /* reject */ }
  throw new IntegrationError("invalid_zoom_url", 502);
}
export function safeLesson<T extends { privateAdminNotes?: unknown; zoomReference?: unknown; googleCalendarReference?: unknown; homework?: unknown }>(row: T) {
  const { privateAdminNotes, zoomReference, googleCalendarReference, homework, ...safe } = row; return safe;
}
export function safeProfile<T extends { internalAdminNotes?: unknown }>(row: T) {
  const { internalAdminNotes, ...safe } = row; return safe;
}
