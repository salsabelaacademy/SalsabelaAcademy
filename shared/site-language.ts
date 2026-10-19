export type SiteLanguage = "en" | "ar";
export const languageCookie = "academy_language";

export function savedSiteLanguage(cookie = ""): SiteLanguage | undefined {
  const value = cookie.split(";").map(v => v.trim()).find(v => v.startsWith(languageCookie + "="))?.slice(languageCookie.length + 1);
  return value === "ar" || value === "en" ? value : undefined;
}

export function preferredSiteLanguage(languages: readonly string[]): SiteLanguage {
  for (const value of languages) {
    const base = value.trim().toLowerCase().split("-")[0];
    if (base === "ar" || base === "en") return base;
  }
  return "en";
}

export function acceptedLanguages(header = ""): string[] {
  return header.split(",").map((value, index) => {
    const [language, ...parameters] = value.trim().split(";");
    const quality = parameters.find(v => v.trim().startsWith("q="));
    const q = quality ? Number(quality.trim().slice(2)) : 1;
    return { language, q, index };
  }).filter(v => v.language && Number.isFinite(v.q) && v.q > 0 && v.q <= 1)
    .sort((a, b) => b.q - a.q || a.index - b.index).map(v => v.language);
}

/** Negotiate only the entry URL; explicit translated/deep links remain stable. */
export function entryLanguage(path: string, cookie: string, languages: readonly string[]): SiteLanguage {
  if (/^\/ar(?:\/|$)/.test(path)) return "ar";
  if (path !== "/") return "en";
  return savedSiteLanguage(cookie) || preferredSiteLanguage(languages);
}
