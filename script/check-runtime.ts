import { serviceApiRevision } from "../shared/service-contract";

// Read-only anonymous routing check. No cookies, API keys, database access or provider calls.
async function main() {
  const base = new URL(process.argv[2] || "http://127.0.0.1:5000");
  if (!["http:", "https:"].includes(base.protocol) || base.username || base.password || base.pathname !== "/" || base.search || base.hash) {
    throw new Error("Pass the app origin only, without credentials, path or query.");
  }
  const results = [];
  for (const [path, method, expected] of [
    ["/health/live", "GET", 200],
    ["/api/admin/service-diagnostics", "GET", 401],
    ["/api/admin/conversations/check", "POST", 401],
  ] as const) {
    try {
      const response = await fetch(new URL(path, base), {
        method, redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(10000),
        headers: method === "POST" ? { Origin: base.origin } : undefined,
      });
      const json = response.headers.get("content-type")?.includes("application/json") || false;
      const revision = response.headers.get("x-academy-api-revision");
      results.push({ path, method, status: response.status, json, matchingRevision: revision === serviceApiRevision, passed: response.status === expected && json });
      await response.body?.cancel();
    } catch {
      results.push({ path, method, passed: false, error: "network_or_timeout" });
    }
  }
  console.log(JSON.stringify({ origin: base.origin, results, note: "401 is expected for protected routes without signing in. This does not test credentials or database schema." }, null, 2));
  if (results.some(r => !r.passed)) process.exitCode = 1;
}
void main().catch(() => { console.error("Runtime check failed. Use a plain HTTP(S) app origin."); process.exitCode = 1; });
