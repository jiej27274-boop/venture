import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import {
  createAuthSessionRecord,
  readAuthSessionRecord,
  revokeAuthSessionRecord,
  type AuthSessionType,
  type VentureDatabase,
} from "./database-mysql.ts";

const sessionTtlSeconds = 60 * 60 * 24 * 7;
const developmentSessionSecret = "venture-platform-dev-session-secret";

function sessionSecret() {
  const configured = process.env.AUTH_SECRET?.trim();
  if (process.env.NODE_ENV === "production" && (!configured || configured === "replace-with-a-long-random-server-secret")) throw new Error("AUTH_SECRET_REQUIRED");
  return configured || developmentSessionSecret;
}

function hashOpaqueValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const digest = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${digest}`;
}

export function verifyPassword(password: string, encoded: string) {
  const [algorithm, salt, digest] = encoded.split("$");
  if (algorithm !== "scrypt" || !salt || !digest) return false;
  const expected = Buffer.from(digest, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function createSession(input: { userId: string; organizationId: string; sessionType?: AuthSessionType }, database: VentureDatabase) {
  const sessionType = input.sessionType ?? "public";
  const payload = Buffer.from(JSON.stringify({
    sub: input.userId,
    org: input.organizationId,
    aud: sessionType,
    jti: randomBytes(16).toString("hex"),
    exp: Math.floor(Date.now() / 1000) + sessionTtlSeconds,
  })).toString("base64url");
  const signature = createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  const token = `${payload}.${signature}`;
  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp: number };
  await createAuthSessionRecord(database, {
    id: randomBytes(16).toString("hex"),
    tokenHash: hashOpaqueValue(token),
    userId: input.userId,
    organizationId: input.organizationId,
    sessionType,
    expiresAt: new Date(parsed.exp * 1000).toISOString(),
    createdAt: new Date().toISOString(),
  });
  return token;
}

export async function readSession(token: string | undefined, database: VentureDatabase, expectedSessionType?: AuthSessionType) {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { sub?: string; org?: string; aud?: AuthSessionType; exp?: number };
    const sessionType = parsed.aud === "admin" ? "admin" : "public";
    if (expectedSessionType && sessionType !== expectedSessionType) return null;
    if (!parsed.sub || !parsed.org || !parsed.exp || parsed.exp <= Math.floor(Date.now() / 1000)) return null;
    const stored = await readAuthSessionRecord(database, hashOpaqueValue(token), parsed.sub, parsed.org, sessionType);
    if (!stored || stored.revoked_at || new Date(String(stored.expires_at)).getTime() <= Date.now()) return null;
    return { userId: parsed.sub, organizationId: parsed.org };
  } catch {
    return null;
  }
}

export function revokeSession(token: string | undefined, database: VentureDatabase) {
  if (!token) return Promise.resolve(false);
  return revokeAuthSessionRecord(database, hashOpaqueValue(token));
}
