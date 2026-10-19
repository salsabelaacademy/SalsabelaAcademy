import { entryLanguage } from "@shared/site-language";
import { pageBackground } from "@shared/page-background";

export function preloadPageBackground(path: string) {
  const image = pageBackground(path);
  if (!image || Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="preload"][as="image"]')).some(link => link.getAttribute("href") === image)) return;
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "image";
  link.href = image;
  link.setAttribute("fetchpriority", "high");
  document.head.appendChild(link);
}

if (typeof window !== "undefined") {
  const language = entryLanguage(location.pathname, document.cookie, navigator.languages?.length ? navigator.languages : [navigator.language]);
  if (location.pathname === "/" && language === "ar") history.replaceState(history.state, "", "/ar" + location.search + location.hash);
  document.documentElement.lang = language;
  document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  preloadPageBackground(location.pathname);
}
