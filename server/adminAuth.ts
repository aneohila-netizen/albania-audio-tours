// ─── Admin authentication (server-side only) ──────────────────────────────────
// No secret lives in source code. Everything comes from environment variables:
//
//   ADMIN_PASSWORD   — admin panel password (step 1 of login). REQUIRED.
//   ADMIN_API_TOKEN  — long random token for automations / scripts that call the
//                      admin API directly (x-admin-token header). Optional; if
//                      unset, only interactive login sessions are accepted.
//
// Interactive login = password (step 1) + 6-digit email code (step 2). Only after
// both succeed does the server issue a random, short-lived session token. Session
// tokens are stored hashed (SHA-256) in Postgres, so a database leak does not
// reveal usable tokens. If any required variable is missing the login fails
// closed — it never falls back to a default value.

import { createHash, randomBytes, randomInt, timingSafeEqual } from "crypto";
import { storage } from "./storage";

export const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

// Constant-time string comparison (hashing first equalises lengths).
export function safeEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  const ha = createHash("sha256").update(a, "utf8").digest();
  const hb = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(ha, hb);
}

export function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD || "";
}

export function checkAdminPassword(candidate: unknown): boolean {
  const expected = getAdminPassword();
  if (!expected) {
    console.error("[auth] ADMIN_PASSWORD is not set — admin login is disabled until it is configured.");
    return false;
  }
  return typeof candidate === "string" && safeEqual(candidate, expected);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function generateOtp(): string {
  return String(randomInt(100000, 1000000)); // cryptographically secure, 6 digits
}

// ─── Session store (Postgres, with in-memory fallback) ────────────────────────
const memSessions = new Map<string, number>(); // tokenHash -> expiresAt
let tableReady: Promise<void> | null = null;

function getPool(): any | null {
  return (storage as any).pool || null;
}

async function ensureTable(): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  if (!tableReady) {
    const p: Promise<void> = pool
      .query(`CREATE TABLE IF NOT EXISTS admin_sessions (
        token_hash TEXT PRIMARY KEY,
        expires_at BIGINT NOT NULL,
        created_at BIGINT NOT NULL
      )`)
      .then(() => undefined);
    p.catch(() => { tableReady = null; });
    tableReady = p;
  }
  await tableReady;
}

export async function createSession(): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;
  const pool = getPool();
  if (pool) {
    await ensureTable();
    await pool.query("DELETE FROM admin_sessions WHERE expires_at < $1", [now]);
    await pool.query(
      "INSERT INTO admin_sessions (token_hash, expires_at, created_at) VALUES ($1, $2, $3)",
      [tokenHash, expiresAt, now],
    );
  } else {
    memSessions.set(tokenHash, expiresAt);
  }
  return token;
}

async function isValidSession(token: string): Promise<boolean> {
  if (!token || token.length !== 64) return false;
  const tokenHash = hashToken(token);
  const now = Date.now();
  const pool = getPool();
  if (pool) {
    await ensureTable();
    const { rows } = await pool.query(
      "SELECT expires_at FROM admin_sessions WHERE token_hash = $1",
      [tokenHash],
    );
    return rows.length > 0 && Number(rows[0].expires_at) > now;
  }
  const exp = memSessions.get(tokenHash);
  return !!exp && exp > now;
}

export async function revokeSession(token: string): Promise<void> {
  if (!token) return;
  const tokenHash = hashToken(token);
  const pool = getPool();
  if (pool) {
    await ensureTable();
    await pool.query("DELETE FROM admin_sessions WHERE token_hash = $1", [tokenHash]);
  }
  memSessions.delete(tokenHash);
}

export async function revokeAllSessions(): Promise<void> {
  const pool = getPool();
  if (pool) {
    await ensureTable();
    await pool.query("DELETE FROM admin_sessions");
  }
  memSessions.clear();
}

// ─── Express middleware ───────────────────────────────────────────────────────
// Accepts the x-admin-token header only (never a URL query string, which would
// leak into logs and browser history).
export async function requireAdmin(req: any, res: any, next: any) {
  try {
    const header = req.headers["x-admin-token"];
    const token = typeof header === "string" ? header.trim() : "";
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    const apiToken = process.env.ADMIN_API_TOKEN || "";
    if (apiToken && apiToken.length >= 32 && safeEqual(token, apiToken)) return next();

    if (await isValidSession(token)) return next();

    return res.status(401).json({ error: "Unauthorized" });
  } catch (e: any) {
    console.error("[auth] session check failed:", e.message);
    return res.status(503).json({ error: "Authentication temporarily unavailable" });
  }
}

// ─── Simple in-memory rate limiter (per client IP) ────────────────────────────
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function clientIp(req: any): string {
  const xff = (req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"] || "") as string;
  const first = xff.split(",")[0].trim();
  return first || req.socket?.remoteAddress || "unknown";
}

/** Returns true if this request is allowed; false if the limit is exceeded. */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  b.count += 1;
  return b.count <= max;
}

export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

// Periodic cleanup so the map never grows unbounded.
setInterval(() => {
  const now = Date.now();
  buckets.forEach((b, k) => { if (b.resetAt <= now) buckets.delete(k); });
  memSessions.forEach((exp, k) => { if (exp <= now) memSessions.delete(k); });
}, 10 * 60 * 1000).unref?.();
