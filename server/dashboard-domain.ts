import type { Request, Response, NextFunction } from "express";

/** Until the portal has its own deployment, use the canonical site session. */
export function dashboardDestination(host: string | undefined, path: string, site: string | undefined, dashboardHost: string | undefined) {
  if (!dashboardHost || !site || !host || host.toLowerCase().replace(/:\d+$/, "") !== dashboardHost.toLowerCase()) return null;
  let origin: URL;
  try { origin = new URL(site); } catch { throw new Error("FRONTEND_URL must be an absolute URL"); }
  if (origin.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && origin.hostname === "localhost" && origin.protocol === "http:")) throw new Error("FRONTEND_URL must use HTTPS");
  if (origin.hostname === dashboardHost.toLowerCase()) throw new Error("DASHBOARD_HOST must differ from FRONTEND_URL");
  const allowed = /^\/(?:ar\/)?(dashboard\/(admin|student)|admin(?:\/integrations)?|login)$/.test(path);
  return `${origin.origin}${allowed ? path : "/login"}`;
}

export function dashboardDomain(req: Request, res: Response, next: NextFunction) {
  const target = dashboardDestination(req.get("host"), req.path, process.env.FRONTEND_URL, process.env.DASHBOARD_HOST);
  if (!target) return next();
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET" || req.method === "HEAD") return res.redirect(302, target);
  return res.status(404).end();
}
