import type { Response } from "express";
import { z } from "zod";
/** Drivers may wrap PostgreSQL errors. Never serialize their SQL or bound values. */
export function databaseError(error: unknown): { code?: string; table?: unknown; column?: unknown; constraint?: unknown; message?: unknown; where?: unknown } {
  let current = error;
  const seen = new Set<unknown>();
  for (let depth = 0; depth < 6 && current && typeof current === "object" && !seen.has(current); depth++) {
    seen.add(current);
    const value = current as { code?: unknown; cause?: unknown };
    if (typeof value.code === "string") return current as ReturnType<typeof databaseError>;
    current = value.cause;
  }
  return {};
}
// Public error codes only: never return PostgreSQL queries or provider payloads.
export function serviceError(error: unknown, res: Response): boolean {
  if (error instanceof z.ZodError) {
    res.status(400).json({ code: "validation" });
    return true;
  }
  const code = databaseError(error).code || "";
  if (["42P01", "42703"].includes(code)) {
    res.status(503).json({ code: "schema_update_required" });
    return true;
  }
  if (
    ["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "57P01", "53300"].includes(
      code,
    )
  ) {
    res.status(503).json({ code: "database_unavailable" });
    return true;
  }
  return false;
}

const safeCodes = new Set([
  "42P01", "42703", "42501", "23502", "23503", "23505", "42883", "57014",
  "ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "57P01", "53300",
]);

export function safeDatabaseIssue(error: unknown, stage: string) {
  const e = databaseError(error);
  const identifier = (value: unknown) => typeof value === "string" && /^[a-z_][a-z0-9_]{0,79}$/.test(value) ? value : undefined;
  const code = typeof e?.code === "string" && (/^[0-9A-Z]{5}$/.test(e.code) || safeCodes.has(e.code)) ? e.code : "unclassified";
  return { stage, code, table: identifier(e?.table), column: identifier(e?.column), constraint: identifier(e?.constraint) };
}

/** CLI-only metadata: never serialize raw SQL, error text, arguments or values. */
export function missingRoutineInfo(error: unknown): { missingFunction?: string; triggerFunction?: string } {
  const e = databaseError(error);
  if (e.code !== "42883") return {};
  const missingFunction = typeof e.message === "string"
    ? /^function ([a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)?)\(/i.exec(e.message)?.[1] : undefined;
  const triggerFunction = typeof e.where === "string"
    ? /PL\/pgSQL function ([a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)?)\(/i.exec(e.where)?.[1] : undefined;
  return { ...(missingFunction && missingFunction.length <= 160 ? { missingFunction } : {}),
    ...(triggerFunction && triggerFunction.length <= 160 ? { triggerFunction } : {}) };
}
