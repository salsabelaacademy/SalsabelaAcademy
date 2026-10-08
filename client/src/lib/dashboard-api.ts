export async function conversationApi(
  path: string,
  method = "GET",
  body?: unknown,
) {
  const r = await fetch("/api" + path, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const value = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(value.code || "failed");
  return value;
}
