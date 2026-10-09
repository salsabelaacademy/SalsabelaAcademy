import type { Response } from "express";
import { z } from "zod";
// Public error codes only: never return PostgreSQL queries or provider payloads.
export function serviceError(error: unknown, res: Response): boolean {
  if (error instanceof z.ZodError) {
    res.status(400).json({ code: "validation" });
    return true;
  }
  if (["42P01", "42703"].includes((error as { code?: string })?.code || "")) {
    res.status(503).json({ code: "schema_update_required" });
    return true;
  }
  if (
    ["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "57P01", "53300"].includes(
      (error as { code?: string })?.code || "",
    )
  ) {
    res.status(503).json({ code: "database_unavailable" });
    return true;
  }
  return false;
}
