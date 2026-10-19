import type { Request, Response, NextFunction } from "express";
import { acceptedLanguages, entryLanguage } from "../shared/site-language";
import { pageBackground, backgroundPreload } from "../shared/page-background";

export function sitePresentation(req: Request, res: Response, next: NextFunction) {
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  if (req.path === "/") {
    res.vary("Accept-Language");
    res.vary("Cookie");
    const language = entryLanguage(req.path, req.get("cookie") || "", acceptedLanguages(req.get("accept-language")));
    // Crawlers receive stable English canonical HTML rather than locale redirects.
    const crawler = /bot|crawler|spider|slurp|facebookexternalhit|twitterbot/i.test(req.get("user-agent") || "");
    if (language === "ar" && !crawler) {
      res.set("Cache-Control", "private, no-store");
      return res.redirect(302, "/ar" + (req.originalUrl.includes("?") ? req.originalUrl.slice(req.originalUrl.indexOf("?")) : ""));
    }
  }
  const image = pageBackground(req.path);
  if (image) res.append("Link", `<${image}>; rel=preload; as=image; fetchpriority=high`);
  next();
}

export function backgroundPreloadHtml(path: string) {
  return backgroundPreload(path);
}
