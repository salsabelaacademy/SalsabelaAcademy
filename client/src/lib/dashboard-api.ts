let supportsConversationStream = false;
export const conversationStreamingAvailable = () => supportsConversationStream;
export const serviceErrorCodes = [
  "schema_update_required",
  "session_expired",
  "api_endpoint_missing",
  "api_response_invalid",
  "request_timeout",
  "network_unavailable",
  "database_unavailable",
  "request_forbidden",
  "origin_rejected",
  "service_unavailable",
  "message_storage_error",
] as const;
export function serviceErrorKey(error: unknown) {
  const key = error instanceof Error ? error.message : "";
  return (serviceErrorCodes as readonly string[]).includes(key)
    ? key
    : "failed";
}
export async function conversationApi(
  path: string,
  method = "GET",
  body?: unknown,
) {
  let r: Response;
  try {
    r = await fetch("/api" + path, {
      method,
      credentials: "include",
      signal: AbortSignal.timeout(
        path === "/assistant/chat" || path.startsWith("/admin/integrations")
          ? 30000
          : 15000,
      ),
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    throw new Error(
      error instanceof Error &&
        ["TimeoutError", "AbortError"].includes(error.name)
        ? "request_timeout"
        : "network_unavailable",
      { cause: error },
    );
  }
  let value: any;
  try {
    value = await r.json();
  } catch {
    if (r.status === 401) throw new Error("session_expired");
    if (r.status === 404) throw new Error("api_endpoint_missing");
    throw new Error("api_response_invalid");
  }
  if (!r.ok) {
    const failure = (code:string)=>{const error=new Error(code) as Error & {reference?:string;database?:Record<string,string>};const ref=r.headers.get("X-Request-ID") || value?.reference;if(typeof ref==="string" && /^[a-f0-9-]{36}$/i.test(ref))error.reference=ref;if(value?.database&&typeof value.database==="object")error.database=Object.fromEntries(Object.entries(value.database).filter(([k,v])=>["stage","code","table","column","constraint"].includes(k)&&typeof v==="string"&&/^[a-zA-Z0-9_]{1,80}$/.test(v))) as Record<string,string>;return error;};
    if (r.status === 403 && /origin/i.test(String(value?.message)))
      throw new Error("origin_rejected");
    // Keep provider and resource errors distinct from a missing route or expired session.
    if (
      typeof value?.code === "string" &&
      !["forbidden", "unauthorized"].includes(value.code)
    )
      throw failure(value.code);
    if (r.status === 401) throw new Error("session_expired");
    if (r.status === 404) throw new Error("api_endpoint_missing");
    if (r.status === 403) throw new Error("request_forbidden");
    throw failure("service_unavailable");
  }
  if (path === "/conversations") supportsConversationStream = r.headers.get("X-Conversation-Updates") === "sse-v1";
  return value;
}

export async function conversationPeople() {
  const value = await conversationApi("/conversations");
  if (
    !Array.isArray(value) ||
    value.some(
      (person) =>
        !person ||
        !Number.isInteger(person.id) ||
        person.id <= 0 ||
        typeof person.name !== "string" ||
        !Number.isInteger(person.unread) ||
        person.unread < 0,
    )
  )
    throw Error("api_response_invalid");
  return value;
}
