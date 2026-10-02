import { IntegrationError, safeZoomUrl } from "./security";

export const scopes = {
  calendar: ["https://www.googleapis.com/auth/calendar.events.owned"],
  classroom: ["https://www.googleapis.com/auth/classroom.courses.readonly", "https://www.googleapis.com/auth/classroom.rosters"],
  drive: ["https://www.googleapis.com/auth/drive.metadata.readonly"],
} as const;
export type GoogleProvider = keyof typeof scopes;

// Injectable transport: tests replace fetch, never call real accounts.
export async function request<T = any>(url: string, init: RequestInit = {}, transport: typeof fetch = fetch): Promise<T> {
  let response: Response;
  try { response = await transport(url, { ...init, redirect: "error", signal: AbortSignal.timeout(15_000) }); }
  catch { throw new IntegrationError("network_error", 502, true); }
  if (!response.ok) {
    const code = response.status === 401 ? "credentials_revoked" : response.status === 403 ? "permission_denied" : response.status === 404 ? "remote_not_found" : response.status === 409 ? "remote_conflict" : response.status === 429 ? "rate_limited" : "provider_error";
    // Provider response bodies can contain tokens and personal data: never log/return them.
    throw new IntegrationError(code, response.status, response.status >= 500 || response.status === 429);
  }
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!text) return undefined as T;
  try { return JSON.parse(text) as T; } catch { throw new IntegrationError("provider_error", 502); }
}
export const jsonRequest = (method: string, token: string, body?: unknown): RequestInit => ({ method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
export async function zoomToken() {
  const data = await request("https://zoom.us/oauth/token", { method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "account_credentials", account_id: process.env.ZOOM_ACCOUNT_ID! }) });
  if (!data.access_token) throw new IntegrationError("credentials_revoked", 401);
  return data.access_token as string;
}
export const zoom = (path: string, token: string, method = "GET", body?: unknown) => request(`https://api.zoom.us/v2${path}`, jsonRequest(method, token, body));
export const googleBase = { calendar: "https://www.googleapis.com/calendar/v3", classroom: "https://classroom.googleapis.com/v1", drive: "https://www.googleapis.com/drive/v3" };
export const google = (p: GoogleProvider, path: string, token: string, method = "GET", body?: unknown) => request(`${googleBase[p]}${path}`, jsonRequest(method, token, body));
export async function exchangeGoogle(body: Record<string, string>) {
  return request("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, ...body }) });
}
export function meetingBody(title: string, start: Date, end: Date, marker: string) {
  return { topic: title.slice(0, 150), type: 2, start_time: start.toISOString(), duration: Math.ceil((end.getTime() - start.getTime()) / 60_000), timezone: "UTC", agenda: marker,
    settings: { waiting_room: true, join_before_host: false, use_pmi: false, approval_type: 2, auto_recording: "none" } };
}
export function calendarBody(title: string, start: Date, end: Date, timezone: string, joinUrl?: string | null) {
  return { summary: title.slice(0, 150), start: { dateTime: start.toISOString(), timeZone: timezone }, end: { dateTime: end.toISOString(), timeZone: timezone }, description: joinUrl ? `Zoom: ${safeZoomUrl(joinUrl)}` : "Salsabela Academy" };
}
export async function inspectDrive(fileId: string, token: string) {
  const file = await google("drive", `/files/${encodeURIComponent(fileId)}?supportsAllDrives=true&fields=id,name,trashed`, token);
  if (file.trashed) throw new IntegrationError("remote_not_found", 404);
  let pageToken = "";
  const permissions: Array<{ type: string; emailAddress?: string; deleted?: boolean }> = [];
  do {
    const page = await google("drive", `/files/${encodeURIComponent(fileId)}/permissions?supportsAllDrives=true&pageSize=100&fields=nextPageToken,permissions(type,emailAddress,deleted)&pageToken=${encodeURIComponent(pageToken)}`, token);
    permissions.push(...(page.permissions || [])); pageToken = page.nextPageToken || "";
  } while (pageToken);
  return { name: file.name as string, permissions, public: permissions.some(p => !p.deleted && ["anyone", "domain", "group"].includes(p.type)) };
}
