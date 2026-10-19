export function lessonDashboard(id: number | string, role: string, language: string) {
  const prefix = language === "ar" ? "/ar" : "";
  return `${prefix}/dashboard/${role === "admin" ? "admin" : "student"}?tab=lessons&focus=lesson:${encodeURIComponent(String(id))}`;
}
export function lessonJoinPath(id: number | string, startsAt: string | Date, language: string) {
  return `/api/lessons/${id}/join?lang=${language === "ar" ? "ar" : "en"}&at=${encodeURIComponent(new Date(startsAt).toISOString())}`;
}
/** Allow only lesson entry or a focused lesson in the academy dashboard after sign-in. */
export function safeLessonReturn(value: string | null): string | undefined {
  if (!value || value.length > 300 || !value.startsWith("/")) return;
  try {
    const url = new URL(value, "https://academy.invalid");
    if (url.origin !== "https://academy.invalid" || url.hash) return;
    if (/^\/(ar\/)?dashboard\/(admin|student)$/.test(url.pathname)) {
      const keys = Array.from(url.searchParams.keys());
      if (keys.length === 2 && keys.every(k => ["tab","focus"].includes(k)) &&
          url.searchParams.get("tab") === "lessons" && /^lesson:[1-9]\d{0,9}$/.test(url.searchParams.get("focus") || ""))
        return url.pathname + url.search;
      return;
    }
    if (!/^\/api\/lessons\/[1-9]\d{0,9}\/join$/.test(url.pathname)) return;
    if (Array.from(url.searchParams.keys()).some(k => !["lang", "at"].includes(k))) return;
    if (!["en", "ar"].includes(url.searchParams.get("lang") || "") || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(url.searchParams.get("at") || "")) return;
    if (!Number.isFinite(Date.parse(url.searchParams.get("at")!))) return;
    return url.pathname + url.search;
  } catch { return; }
}
