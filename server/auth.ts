import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { VentureDatabase } from "./database.ts";

const sessionTtlSeconds = 60 * 60 * 24 * 7;
const sessionSecret = process.env.AUTH_SECRET ?? "venture-platform-dev-session-secret";
const captchaTtlMs = 5 * 60 * 1000;
const captchaAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const captchaChallenges = new Map<string, { code: string; expiresAt: number }>();

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

function randomCaptchaCode(length = 5) {
  const bytes = randomBytes(length);
  return Array.from(bytes, (value) => captchaAlphabet[value % captchaAlphabet.length]).join("");
}

export function createCaptchaChallenge(database?: VentureDatabase) {
  const id = randomBytes(18).toString("base64url");
  const code = randomCaptchaCode();
  const expiresAt = Date.now() + captchaTtlMs;
  if (database) {
    const now = new Date().toISOString();
    database.prepare("DELETE FROM captcha_challenges WHERE expires_at <= ? OR consumed_at IS NOT NULL").run(now);
    database.prepare("INSERT INTO captcha_challenges (id, code_hash, expires_at, consumed_at, created_at) VALUES (?, ?, ?, NULL, ?)").run(id, hashOpaqueValue(code), new Date(expiresAt).toISOString(), now);
  } else {
    captchaChallenges.set(id, { code, expiresAt });
    for (const [key, challenge] of captchaChallenges) {
      if (challenge.expiresAt <= Date.now()) captchaChallenges.delete(key);
    }
  }
  const noise = Array.from({ length: 5 }, (_, index) => `<path d="M${8 + index * 24} ${12 + (index * 7) % 28} Q${25 + index * 24} ${4 + (index * 11) % 46} ${42 + index * 24} ${18 + (index * 9) % 30}"/>`).join("");
  const letters = [...code].map((letter, index) => `<text x="${17 + index * 24}" y="38" transform="rotate(${(index % 2 ? 1 : -1) * (4 + index)} ${17 + index * 24} 38)">${letter}</text>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="148" height="54" viewBox="0 0 148 54"><rect width="148" height="54" rx="10" fill="#eef6ff"/><g stroke="#8eb9e8" stroke-width="1.2" opacity=".75">${noise}</g><g fill="#1769aa" font-family="Arial,sans-serif" font-size="25" font-weight="700">${letters}</g></svg>`;
  return { captchaId: id, image: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`, expiresAt: new Date(expiresAt).toISOString() };
}

export function verifyCaptchaChallenge(captchaId: string | undefined, code: string | undefined, database?: VentureDatabase) {
  if (!captchaId || !code) return false;
  if (database) {
    const challenge = database.prepare("SELECT id, code_hash AS codeHash, expires_at AS expiresAt, consumed_at AS consumedAt FROM captcha_challenges WHERE id = ?").get(captchaId) as { id: string; codeHash: string; expiresAt: string; consumedAt: string | null } | undefined;
    if (!challenge || challenge.consumedAt || new Date(challenge.expiresAt).getTime() <= Date.now() || challenge.codeHash !== hashOpaqueValue(code.trim().toUpperCase())) return false;
    database.prepare("UPDATE captcha_challenges SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL").run(new Date().toISOString(), captchaId);
    return true;
  }
  const challenge = captchaChallenges.get(captchaId);
  captchaChallenges.delete(captchaId);
  return Boolean(challenge && challenge.expiresAt > Date.now() && challenge.code === code.trim().toUpperCase());
}

export function createSession(input: { userId: string; organizationId: string }, database?: VentureDatabase) {
  const payload = Buffer.from(JSON.stringify({
    sub: input.userId,
    org: input.organizationId,
    jti: randomBytes(16).toString("hex"),
    exp: Math.floor(Date.now() / 1000) + sessionTtlSeconds,
  })).toString("base64url");
  const signature = createHmac("sha256", sessionSecret).update(payload).digest("base64url");
  const token = `${payload}.${signature}`;
  if (database) {
    const createdAt = new Date().toISOString();
    database.prepare("DELETE FROM auth_sessions WHERE expires_at <= ? OR revoked_at IS NOT NULL").run(createdAt);
    database.prepare("INSERT INTO auth_sessions (id, token_hash, user_id, organization_id, expires_at, revoked_at, created_at) VALUES (?, ?, ?, ?, ?, NULL, ?)").run(randomBytes(16).toString("hex"), hashOpaqueValue(token), input.userId, input.organizationId, new Date(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")).exp * 1000).toISOString(), createdAt);
  }
  return token;
}

export function readSession(token: string | undefined, database?: VentureDatabase) {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", sessionSecret).update(payload).digest("base64url");
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { sub?: string; org?: string; exp?: number };
    if (!parsed.sub || !parsed.org || !parsed.exp || parsed.exp <= Math.floor(Date.now() / 1000)) return null;
    if (database) {
      const stored = database.prepare("SELECT token_hash AS tokenHash, user_id AS userId, organization_id AS organizationId, expires_at AS expiresAt, revoked_at AS revokedAt FROM auth_sessions WHERE token_hash = ? AND user_id = ? AND organization_id = ?").get(hashOpaqueValue(token), parsed.sub, parsed.org) as { tokenHash: string; userId: string; organizationId: string; expiresAt: string; revokedAt: string | null } | undefined;
      if (!stored || stored.revokedAt || new Date(stored.expiresAt).getTime() <= Date.now()) return null;
    }
    return { userId: parsed.sub, organizationId: parsed.org };
  } catch {
    return null;
  }
}

export function revokeSession(token: string | undefined, database?: VentureDatabase) {
  if (!token || !database) return false;
  return database.prepare("UPDATE auth_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL").run(new Date().toISOString(), hashOpaqueValue(token)).changes > 0;
}
