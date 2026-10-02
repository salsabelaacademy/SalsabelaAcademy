import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import argon2 from "argon2";
import type { NextFunction, Request, Response } from "express";
import { storage } from "./storage";

export type AppRole = "student" | "admin";
export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: AppRole;
  status: string;
  avatarUrl: string | null;
  grade: string | null;
};

const JWT_SECRET = process.env.SESSION_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("SESSION_SECRET must be set in production");
}
const SESSION_DAYS = 7;

function base64Url(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derivedKey}`;
}

/** New credentials use Argon2id. The legacy helper remains synchronous for
 * old callers; login uses verifyPasswordAsync and transparently upgrades
 * legacy scrypt hashes. */
export async function hashPasswordAsync(password: string) {
  return argon2.hash(password, { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 });
}

export function verifyPassword(password: string, storedHash: string) {
  if (storedHash.startsWith("$argon2")) return false;
  const [, salt, key] = storedHash.split("$");
  if (!salt || !key) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(key, "hex");
  return expected.length === candidate.length && timingSafeEqual(candidate, expected);
}

export async function verifyPasswordAsync(password: string, storedHash: string) {
  if (storedHash.startsWith("$argon2")) {
    try { return await argon2.verify(storedHash, password); } catch { return false; }
  }
  return verifyPassword(password, storedHash);
}

function signJwt(payload: Record<string, unknown>) {
  if (!JWT_SECRET) throw new Error("SESSION_SECRET is required to create a session");
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64Url(JSON.stringify(payload));
  const signature = createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

function verifyJwt(token: string) {
  if (!JWT_SECRET) return null;
  const [header, body, signature] = token.split(".");
  if (!header || !body || !signature) return null;
  const expected = createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload as { sub: string; sid: string; exp: number };
  } catch {
    return null;
  }
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function getCookie(req: Request, name: string) {
  const cookies = req.headers.cookie?.split(";").map(part => part.trim()) ?? [];
  const entry = cookies.find(part => part.startsWith(`${name}=`));
  try { return entry ? decodeURIComponent(entry.slice(name.length + 1)) : undefined; } catch { return undefined; }
}

function isAppRole(role: unknown): role is AppRole {
  return role === "student" || role === "admin";
}

function toAuthUser(user: any): AuthUser {
  if (!isAppRole(user.role)) {
    throw new Error("Unsupported legacy account role");
  }
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as AppRole,
    status: user.status,
    avatarUrl: user.avatarUrl ?? null,
    grade: user.grade ?? null,
  };
}

export async function issueToken(user: any) {
  const sessionId = randomBytes(18).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const token = signJwt({
    sub: String(user.id),
    sid: sessionId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(expiresAt.getTime() / 1000),
  });
  await storage.createSession({ userId: user.id, tokenHash: tokenHash(token), expiresAt });
  return token;
}

export async function getUserFromRequest(req: Request) {
  const token = getCookie(req, "session_token");
  if (!token) return null;
  const payload = verifyJwt(token);
  if (!payload) return null;
  const session = await storage.getSession(tokenHash(token));
  if (!session || session.expiresAt < new Date()) return null;
  const userId = Number(payload.sub);
  if (!Number.isSafeInteger(userId) || userId <= 0 || session.userId !== userId) return null;
  const user = await storage.getUser(userId);
  if (!user || user.status !== "active" || !isAppRole(user.role)) return null;
  return { user: toAuthUser(user), token };
}

export function requireAuth(roles?: AppRole[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await getUserFromRequest(req);
      if (!result) return res.status(401).json({ message: "Authentication required" });
      if (roles && !roles.includes(result.user.role)) {
        return res.status(403).json({ message: "You do not have permission to access this resource" });
      }
      (req as any).auth = result;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function setSessionCookie(res: Response, token: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `session_token=${encodeURIComponent(token)}; Max-Age=${SESSION_DAYS * 24 * 60 * 60}; Path=/; HttpOnly; SameSite=Lax${secure}`,
  );
}

export function clearSessionCookie(res: Response) {
  res.setHeader("Set-Cookie", `session_token=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
}

export { toAuthUser, tokenHash };
