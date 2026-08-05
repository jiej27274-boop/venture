import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import { contentTypeForStorageKey, localBpFileUrl, readLocalBpFile, saveLocalBpFile } from "./local-storage.ts";
import {
  authorizeBpRead,
  authorizeProjectMutation,
  canRequestBp,
  validateGrantInput,
} from "@venture/domain";
import {
  createArticle,
  addFavorite,
  createBpFile,
  createBpAccessRequest,
  createContactRequest,
  createProjectSubmission,
  createGovernmentContact,
  decideBpAccessRequest,
  getAdminOverview,
  getBpAccessRequest,
  getBpFile,
  getBpForProject,
  getProject,
  getPublicProject,
  getPublishedArticle,
  listAllArticles,
  listAuditLogs,
  listBpGrants,
  listContactRequests,
  listContactRequestsForUser,
  listContactRequestUpdates,
  listFavorites,
  listRecentViews,
  listNotifications,
  countUnreadNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  createNotification,
  createOrganizationNotification,
  getContactRequestOwner,
  listGovernmentContacts,
  listBpAccessRequestsForUser,
  listIncomingBpAccessRequests,
  listPublishedProjects,
  listPublishedArticles,
  listProjectSubmissions,
  listProjectsForOrganization,
  listIdentitySubmissionsForAdmin,
  listIdentitySubmissionsForUser,
  createIdentitySubmission,
  updateIdentitySubmissionContent,
  updateIdentitySubmissionStatus,
  countPendingIdentitySubmissions,
  getIdentitySubmission,
  listPublicOrganizations,
  resolveActor,
  updateProjectReviewStatus,
  updateContactRequest,
  removeFavorite,
  recordRecentView,
  type FavoriteResourceType,
  type IdentitySubmissionStatus,
  type IdentitySubmissionType,
  updateArticle,
  writeAuditLog,
  checkDatabase,
  consumeEmailVerificationProof,
  createEmailOtpRecord,
  verifyEmailOtpRecord,
  type VentureDatabase,
} from "./database-mysql.ts";
import { createSession, hashPassword, readSession, revokeSession, verifyPassword } from "./auth.ts";
import { deliverEmail, emailDeliveryStatus } from "./email.ts";
import { approveAuthAccount, consumeAuthToken, createAuthAccount, findAdminAuthAccount, findAuthAccount, getAuthAccountByUserId, issueAuthToken, listAuthAccounts, markEmailVerified, updateAuthAccountStatus, updateAuthPassword, updateAuthProfile } from "./database-mysql.ts";

const requestSchema = z.object({
  purpose: z.string().trim().min(10).max(500),
});

const decisionSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("rejected") }),
  z.object({
    decision: z.literal("approved"),
    expiresAt: z.string().datetime(),
    allowDownload: z.boolean().default(false),
  }),
]);

const contactRequestSchema = z.object({
  contactId: z.string().trim().min(1).optional(),
  targetRegion: z.string().trim().min(2).max(50).optional(),
  name: z.string().trim().min(2).max(30),
  phone: z.string().regex(/^1[3-9]\d{9}$/),
  organization: z.string().trim().min(2).max(100),
  need: z.string().trim().min(10).max(1000),
});

const contactRequestUpdateSchema = z.object({
  status: z.enum(["new", "contacted", "progressing", "completed", "closed"]),
  note: z.string().trim().min(2).max(1000),
});

const favoriteSchema = z.object({
  resourceType: z.enum(["project", "organization", "article"]),
  resourceId: z.string().trim().min(1).max(120),
});

const articleSchema = z.object({
  title: z.string().trim().min(4).max(120),
  summary: z.string().trim().min(10).max(300),
  content: z.string().trim().min(20).max(30_000),
  category: z.string().trim().min(2).max(30),
});

const articleUpdateSchema = articleSchema.partial().extend({
  status: z.enum(["draft", "published", "archived"]).optional(),
}).refine((value) => Object.keys(value).length > 0);

const projectSubmissionSchema = z.object({
  name: z.string().trim().min(2).max(100),
  summary: z.string().trim().min(20).max(1000),
  industry: z.string().trim().min(2).max(50),
  region: z.string().trim().min(2).max(50),
  stage: z.string().trim().min(2).max(30),
  financingRange: z.string().trim().min(1).max(50),
  identityMode: z.enum(["named", "anonymous"]).default("named"),
  anonymousName: z.string().trim().max(100).optional(),
}).refine((value) => value.identityMode !== "anonymous" || Boolean(value.anonymousName), { message: "anonymous_name_required", path: ["anonymousName"] });

const adminProjectSubmissionSchema = projectSubmissionSchema.and(z.object({
  ownerOrganizationId: z.string().trim().min(1).max(120),
}));

const adminGovernmentContactSchema = z.object({
  organizationId: z.string().trim().min(1).max(120),
  organizationName: z.string().trim().min(2).max(120),
  name: z.string().trim().min(2).max(30),
  title: z.string().trim().min(2).max(80),
  region: z.string().trim().min(2).max(80),
  industries: z.array(z.string().trim().min(1).max(40)).min(1).max(12),
  verified: z.boolean().optional(),
});

const identitySubmissionSchema = z.object({
  type: z.enum(["investor_thesis", "fa_recommendation", "government_demand"]),
  title: z.string().trim().min(4).max(120),
  summary: z.string().trim().min(20).max(1200),
  industry: z.string().trim().min(2).max(80),
  region: z.string().trim().min(2).max(80),
  stage: z.string().trim().max(50).optional(),
  financingRange: z.string().trim().max(80).optional(),
  details: z.record(z.string().trim().max(500)).default({}),
  status: z.enum(["draft", "pending"]).default("pending"),
});
const identityDecisionSchema = z.object({
  status: z.enum(["approved", "rejected", "archived"]),
  reason: z.string().trim().max(1000).optional(),
});
const identitySubmissionUpdateSchema = z.object({
  title: z.string().trim().min(4).max(120),
  summary: z.string().trim().min(20).max(1200),
  industry: z.string().trim().min(2).max(80),
  region: z.string().trim().min(2).max(80),
  stage: z.string().trim().max(50).optional(),
  financingRange: z.string().trim().max(80).optional(),
  details: z.record(z.string().trim().max(500)).default({}),
  status: z.enum(["draft", "pending"]).default("pending"),
});

const authRoleSchema = z.enum(["project", "investor", "fa", "government", "user"]);
const registerSchema = z.object({
  email: z.string().trim().email().optional(),
  phone: z.string().trim().regex(/^1[3-9]\d{9}$/).optional(),
  password: z.string().min(6).max(128),
  confirmPassword: z.string().min(6).max(128),
  role: authRoleSchema,
  organizationName: z.string().trim().min(2).max(100).optional(),
  contactName: z.string().trim().min(2).max(30).optional(),
  userName: z.string().trim().min(2).max(30).optional(),
  emailVerificationToken: z.string().trim().min(20).optional(),
  emailVerificationCode: z.string().trim().regex(/^\d{6}$/).optional(),
}).refine((value) => Boolean(value.email || value.phone), { message: "email_or_phone_required" })
  .refine((value) => value.role === "user" || Boolean(value.organizationName), { message: "organization_name_required", path: ["organizationName"] })
  .refine((value) => Boolean(value.contactName || value.userName), { message: "user_name_required", path: ["userName"] })
  .refine((value) => process.env.AUTH_EMAIL_REQUIRED !== "true" || Boolean(value.email), { message: "email_required", path: ["email"] })
  .refine((value) => value.password === value.confirmPassword, { message: "password_mismatch", path: ["confirmPassword"] });
const loginSchema = z.object({ identifier: z.string().trim().min(3), password: z.string().min(6).max(128) });
const adminLoginSchema = z.object({ username: z.string().trim().min(3).max(64), password: z.string().min(8).max(128) });
const otpRequestSchema = z.object({ email: z.string().trim().email(), purpose: z.enum(["register", "login", "recovery"]) });
const otpVerifySchema = z.object({ email: z.string().trim().email(), token: z.string().trim().regex(/^\d{6}$/), purpose: z.enum(["register", "login", "recovery"]) });
const passwordChangeSchema = z.object({ currentPassword: z.string().min(6).max(128), newPassword: z.string().min(8).max(128), confirmPassword: z.string().min(8).max(128) }).refine((value) => value.newPassword === value.confirmPassword, { message: "password_mismatch", path: ["confirmPassword"] });
const profileUpdateSchema = z.object({ displayName: z.string().trim().min(2).max(30), email: z.string().trim().email().optional().or(z.literal("")), phone: z.string().trim().regex(/^1[3-9]\d{9}$/).optional().or(z.literal("")) }).refine((value) => Boolean(value.email || value.phone), { message: "email_or_phone_required" });
const emailSchema = z.object({ email: z.string().trim().email() });
const tokenSchema = z.object({ token: z.string().trim().min(20) });
const passwordResetSchema = z.object({ token: z.string().trim().min(20), newPassword: z.string().min(8).max(128), confirmPassword: z.string().min(8).max(128) }).refine((value) => value.newPassword === value.confirmPassword, { message: "password_mismatch", path: ["confirmPassword"] });
type Pagination = { page: number; pageSize: number; total: number; totalPages: number };

function readPagination(context: { req: { query: (name: string) => string | undefined } }): { page: number; pageSize: number } {
  const rawPage = Number(context.req.query("page") ?? 1);
  const rawPageSize = Number(context.req.query("pageSize") ?? 12);
  const page = Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1;
  const pageSize = Number.isFinite(rawPageSize) ? Math.min(50, Math.max(1, Math.floor(rawPageSize))) : 12;
  return { page, pageSize };
}

function paginate<T>(items: T[], input: { page: number; pageSize: number }): { items: T[]; pagination: Pagination } {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / input.pageSize));
  const page = Math.min(input.page, totalPages);
  const start = (page - 1) * input.pageSize;
  return {
    items: items.slice(start, start + input.pageSize),
    pagination: { page, pageSize: input.pageSize, total, totalPages },
  };
}

function includesQuery(values: string[], query?: string): boolean {
  const normalized = query?.trim().toLocaleLowerCase();
  return !normalized || values.some((value) => value.toLocaleLowerCase().includes(normalized));
}

const loginFailures = new Map<string, { count: number; blockedUntil: number }>();
const loginLimit = { maxFailures: 5, blockMs: 15 * 60 * 1000 };
const loginKey = (request: Request, identifier: string) => `${request.headers.get("x-forwarded-for") ?? "local"}:${identifier.trim().toLowerCase()}`;
function isLoginBlocked(key: string) { const entry = loginFailures.get(key); if (!entry) return false; if (entry.blockedUntil > Date.now()) return true; loginFailures.delete(key); return false; }
function recordLoginFailure(key: string) { const entry = loginFailures.get(key) ?? { count: 0, blockedUntil: 0 }; entry.count += 1; if (entry.count >= loginLimit.maxFailures) entry.blockedUntil = Date.now() + loginLimit.blockMs; loginFailures.set(key, entry); }

type OtpRateEntry = { count: number; resetAt: number };
const otpRequestFailures = new Map<string, OtpRateEntry>();
const otpVerifyFailures = new Map<string, OtpRateEntry>();
const otpRequestLimit = { maxAttempts: 3, windowMs: 10 * 60 * 1000 };
const otpVerifyLimit = { maxAttempts: 5, windowMs: 10 * 60 * 1000 };
function otpKey(request: Request, email: string, purpose: string) {
  return `${request.headers.get("x-forwarded-for") ?? "local"}:${email.trim().toLowerCase()}:${purpose}`;
}
function checkOtpRate(map: Map<string, OtpRateEntry>, key: string, limit: { maxAttempts: number; windowMs: number }) {
  const currentTime = Date.now();
  const existing = map.get(key);
  if (!existing || existing.resetAt <= currentTime) {
    map.set(key, { count: 1, resetAt: currentTime + limit.windowMs });
    return { allowed: true, retryAfter: 0 };
  }
  if (existing.count >= limit.maxAttempts) return { allowed: false, retryAfter: Math.ceil((existing.resetAt - currentTime) / 1000) };
  existing.count += 1;
  return { allowed: true, retryAfter: 0 };
}
function clearOtpRate(map: Map<string, OtpRateEntry>, key: string) { map.delete(key); }

export function createApp({ database }: { database: VentureDatabase }) {
  const app = new Hono();
  const allowedOrigins = (process.env.APP_ORIGINS ?? "http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:5174,http://localhost:5174")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.use("*", cors({
    origin: allowedOrigins,
  }));
  app.use("*", async (context, next) => {
    await next();
    context.header("X-Content-Type-Options", "nosniff");
    context.header("X-Frame-Options", "DENY");
    context.header("Referrer-Policy", "strict-origin-when-cross-origin");
    context.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    if (context.req.path.startsWith("/api/auth/") || context.req.path.startsWith("/api/admin/login") || context.req.path.startsWith("/api/admin/session") || context.req.path.startsWith("/api/admin/logout") || context.req.path.startsWith("/api/me/")) context.header("Cache-Control", "no-store");
  });

  const bearerActorFor = async (request: Request, sessionType: "public" | "admin" = "public") => {
    const authorization = request.headers.get("authorization");
    const bearer = authorization?.startsWith("Bearer ") ? await readSession(authorization.slice(7), database, sessionType) : null;
    if (bearer) {
      const account = await getAuthAccountByUserId(database, bearer.userId);
      if (!account || account.status !== "active" || account.organizationId !== bearer.organizationId) return null;
      return await resolveActor(database, bearer.userId, bearer.organizationId);
    }
    return null;
  };

  const actorFor = async (request: Request) => {
    const bearerActor = await bearerActorFor(request);
    if (bearerActor) return bearerActor;
    return resolveActor(
      database,
      request.headers.get("x-user-id") ?? undefined,
      request.headers.get("x-organization-id") ?? undefined,
    );
  };

  // Admin APIs only accept the dedicated bearer session. The legacy identity
  // headers remain available to the public demo routes but cannot impersonate
  // a platform administrator.
  const adminActorFor = (request: Request) => bearerActorFor(request, "admin");

  app.get("/health", async (context) =>
    context.json({ status: "ok", service: "venture-platform-api", time: new Date().toISOString() }),
  );

  app.get("/api/readyz", async (context) => {
    try {
      const databaseReady = await checkDatabase(database);
      if (!databaseReady) return context.json({ status: "not_ready" }, 503);
      const email = emailDeliveryStatus();
      if (process.env.NODE_ENV === "production" && !email.configured) return context.json({ status: "not_ready" }, 503);
      return context.json({ status: "ready", time: new Date().toISOString() });
    } catch {
      return context.json({ status: "not_ready" }, 503);
    }
  });

  app.post("/api/auth/otp/request", async (context) => {
    const parsed = otpRequestSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return context.json({ error: "invalid_otp_request", issues: parsed.error.flatten() }, 400);
    const rateKey = otpKey(context.req.raw, parsed.data.email, parsed.data.purpose);
    const rate = checkOtpRate(otpRequestFailures, rateKey, otpRequestLimit);
    if (!rate.allowed) return context.json({ error: "otp_rate_limited", retryAfter: rate.retryAfter }, 429);
    const issued = await createEmailOtpRecord(database, { email: parsed.data.email, purpose: parsed.data.purpose });
    try {
      await deliverEmail({
        to: parsed.data.email,
        subject: "创投智联邮箱验证码",
        text: `你的邮箱验证码是：${issued.token}\n验证码 5 分钟内有效。如非本人操作，请忽略此邮件。`,
      });
    } catch (error) {
      console.error("[auth.otp.request] email delivery failed", error);
      return context.json({ error: "otp_delivery_failed" }, 503);
    }
    return context.json({ status: "sent", expiresIn: 300, resendAfter: 60, ...(emailDeliveryStatus().provider === "preview" ? { previewToken: issued.token } : {}) });
  });

  app.post("/api/auth/otp/verify", async (context) => {
    const parsed = otpVerifySchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return context.json({ error: "invalid_otp", issues: parsed.error.flatten() }, 400);
    const rateKey = otpKey(context.req.raw, parsed.data.email, parsed.data.purpose);
    const rate = checkOtpRate(otpVerifyFailures, rateKey, otpVerifyLimit);
    if (!rate.allowed) return context.json({ error: "otp_rate_limited", retryAfter: rate.retryAfter }, 429);
    const verified = await verifyEmailOtpRecord(database, parsed.data);
    if (!verified) return context.json({ error: "invalid_or_expired_otp" }, 400);
    clearOtpRate(otpVerifyFailures, rateKey);
    if (parsed.data.purpose === "register" || parsed.data.purpose === "recovery") {
      return context.json({
        status: "verified",
        email: verified.email,
        emailVerificationToken: verified.verificationToken,
      });
    }
    const account = await findAuthAccount(database, parsed.data.email);
    if (!account) return context.json({ error: "account_not_registered" }, 404);
    await markEmailVerified(database, account.userId);
    if (account.status === "pending") return context.json({ error: "account_pending" }, 403);
    if (account.status === "rejected") return context.json({ error: "account_rejected" }, 403);
    if (account.status === "suspended") return context.json({ error: "account_suspended" }, 403);
    const session = await createSession({ userId: account.userId, organizationId: account.organizationId, sessionType: "public" }, database);
    return context.json({ status: "authenticated", session, actor: await resolveActor(database, account.userId, account.organizationId) });
  });

  app.post("/api/auth/register", async (context) => {
    const parsed = registerSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return context.json({ error: "invalid_registration", issues: parsed.error.flatten() }, 400);
    const emailVerificationRequired = process.env.AUTH_EMAIL_REQUIRED === "true" || emailDeliveryStatus().configured || Boolean(parsed.data.emailVerificationToken || parsed.data.emailVerificationCode);
    if (parsed.data.email && emailVerificationRequired) {
      const verified = parsed.data.emailVerificationToken
        ? await consumeEmailVerificationProof(database, parsed.data.email, parsed.data.emailVerificationToken)
        : parsed.data.emailVerificationCode
          ? Boolean(await verifyEmailOtpRecord(database, { email: parsed.data.email, purpose: "register", token: parsed.data.emailVerificationCode }))
          : false;
      if (!verified) return context.json({ error: parsed.data.emailVerificationCode ? "email_verification_invalid" : "email_verification_required" }, 400);
    }
    const contactName = parsed.data.contactName ?? parsed.data.userName!;
    const organizationName = parsed.data.organizationName ?? `普通用户 · ${contactName}`;
    const result = await createAuthAccount(database, {
      email: parsed.data.email,
      phone: parsed.data.phone,
      passwordHash: hashPassword(parsed.data.password),
      role: parsed.data.role,
      organizationName,
      contactName,
      status: parsed.data.role === "user" ? "active" : "pending",
    });
    if ("error" in result) return context.json({ error: result.error }, 409);
    await createNotification(database, {
      userId: result.account.userId,
      type: "account",
      title: parsed.data.role === "user" ? "欢迎加入创投智联" : "注册资料已提交",
      body: parsed.data.role === "user" ? "你的普通用户账号已激活，可以开始浏览项目、机构和资讯。" : "你的主体资料已提交，平台审核通过后即可使用完整功能。",
      resourceType: "account",
      resourceId: result.account.userId,
    });
    return context.json(result, 201);
  });

  app.post("/api/auth/login", async (context) => {
    const parsed = loginSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return context.json({ error: "invalid_login", issues: parsed.error.flatten() }, 400);
    const attemptKey = loginKey(context.req.raw, parsed.data.identifier);
    if (isLoginBlocked(attemptKey)) return context.json({ error: "login_rate_limited" }, 429);
    const account = await findAuthAccount(database, parsed.data.identifier);
    if (!account || !verifyPassword(parsed.data.password, account.passwordHash)) {
      recordLoginFailure(attemptKey);
      return context.json({ error: "invalid_credentials" }, 401);
    }
    loginFailures.delete(attemptKey);
    if (account.status === "pending") return context.json({ error: "account_pending" }, 403);
    if (account.status === "rejected") return context.json({ error: "account_rejected" }, 403);
    if (account.status === "suspended") return context.json({ error: "account_suspended" }, 403);
    const session = await createSession({ userId: account.userId, organizationId: account.organizationId, sessionType: "public" }, database);
    return context.json({ session, actor: await resolveActor(database, account.userId, account.organizationId) });
  });

  app.post("/api/admin/login", async (context) => {
    const parsed = adminLoginSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return context.json({ error: "invalid_admin_login", issues: parsed.error.flatten() }, 400);
    const attemptKey = loginKey(context.req.raw, `admin:${parsed.data.username}`);
    if (isLoginBlocked(attemptKey)) return context.json({ error: "login_rate_limited" }, 429);
    const account = await findAdminAuthAccount(database, parsed.data.username);
    if (!account || !verifyPassword(parsed.data.password, account.passwordHash)) {
      recordLoginFailure(attemptKey);
      return context.json({ error: "invalid_credentials" }, 401);
    }
    loginFailures.delete(attemptKey);
    if (account.status === "suspended") return context.json({ error: "account_suspended" }, 403);
    if (account.status !== "active") return context.json({ error: "platform_admin_required" }, 403);
    const actor = await resolveActor(database, account.userId, account.organizationId);
    if (!actor?.roles.includes("platform_admin")) return context.json({ error: "platform_admin_required" }, 403);
    const session = await createSession({ userId: account.userId, organizationId: account.organizationId, sessionType: "admin" }, database);
    return context.json({ session, actor });
  });

  app.get("/api/admin/session", async (context) => {
    const actor = await adminActorFor(context.req.raw);
    if (!actor) return context.json({ error: "authentication_required" }, 401);
    if (!actor.roles.includes("platform_admin")) return context.json({ error: "platform_admin_required" }, 403);
    return context.json({ actor });
  });

  app.post("/api/admin/logout", async (context) => {
    const actor = await adminActorFor(context.req.raw);
    if (!actor) return context.json({ error: "authentication_required" }, 401);
    if (!actor.roles.includes("platform_admin")) return context.json({ error: "platform_admin_required" }, 403);
    const authorization = context.req.header("authorization");
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;
    await revokeSession(token, database);
    return context.json({ status: "signed_out" });
  });

  app.get("/api/admin/notifications", async (context) => {
    const actor = await adminActorFor(context.req.raw);
    if (!actor) return context.json({ error: "authentication_required" }, 401);
    if (!actor.roles.includes("platform_admin")) return context.json({ error: "platform_admin_required" }, 403);
    const unreadOnly = context.req.query("unreadOnly") === "true";
    return context.json({ notifications: await listNotifications(database, actor.userId, { unreadOnly }), unreadCount: await countUnreadNotifications(database, actor.userId) });
  });

  app.post("/api/admin/notifications/:notificationId/read", async (context) => {
    const actor = await adminActorFor(context.req.raw);
    if (!actor) return context.json({ error: "authentication_required" }, 401);
    if (!actor.roles.includes("platform_admin")) return context.json({ error: "platform_admin_required" }, 403);
    const updated = await markNotificationRead(database, actor.userId, context.req.param("notificationId"));
    return updated ? context.json({ read: true }) : context.json({ error: "notification_not_found" }, 404);
  });

  app.post("/api/admin/notifications/read-all", async (context) => {
    const actor = await adminActorFor(context.req.raw);
    if (!actor) return context.json({ error: "authentication_required" }, 401);
    if (!actor.roles.includes("platform_admin")) return context.json({ error: "platform_admin_required" }, 403);
    return context.json({ read: await markAllNotificationsRead(database, actor.userId) });
  });

  app.post("/api/auth/email-verification/request", async (context) => {
    const actor = await actorFor(context.req.raw);
    if (!actor) return context.json({ error: "authentication_required" }, 401);
    const account = await getAuthAccountByUserId(database, actor.userId);
    if (!account?.email) return context.json({ error: "email_required" }, 400);
    if (account.emailVerifiedAt) return context.json({ status: "already_verified", emailVerifiedAt: account.emailVerifiedAt });
    const issued = await issueAuthToken(database, actor.userId, "email_verification");
    try {
      await deliverEmail({ to: account.email, subject: "创投智联邮箱验证", text: `请使用以下一次性令牌完成邮箱验证：${issued.token}\n令牌有效期至：${issued.expiresAt}` });
    } catch {
      return context.json({ error: "email_delivery_failed" }, 503);
    }
    return context.json({ status: "sent", expiresAt: issued.expiresAt, ...(emailDeliveryStatus().provider === "preview" ? { previewToken: issued.token } : {}) });
  });

  app.post("/api/auth/email-verification/confirm", async (context) => {
    const parsed = tokenSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return context.json({ error: "invalid_verification_token" }, 400);
    const consumed = await consumeAuthToken(database, parsed.data.token, "email_verification");
    if (!consumed) return context.json({ error: "invalid_or_expired_token" }, 400);
    const emailVerifiedAt = await markEmailVerified(database, consumed.userId);
    const account = await getAuthAccountByUserId(database, consumed.userId);
    if (account) await createNotification(database, { userId: consumed.userId, type: "account", title: "邮箱验证完成", body: "你的邮箱已验证，可以用于找回密码和接收平台通知。", resourceType: "account", resourceId: consumed.userId });
    return context.json({ status: "verified", emailVerifiedAt });
  });

  app.post("/api/auth/password-reset/request", async (context) => {
    const parsed = emailSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return context.json({ error: "invalid_email" }, 400);
    const account = await findAuthAccount(database, parsed.data.email);
    const response: { status: "sent"; expiresAt?: string; previewToken?: string } = { status: "sent" };
    if (account?.email) {
      const issued = await issueAuthToken(database, account.userId, "password_reset");
      try {
        await deliverEmail({ to: account.email, subject: "创投智联密码重置", text: `请使用以下一次性令牌重置密码：${issued.token}\n令牌有效期至：${issued.expiresAt}` });
      } catch {
        return context.json({ error: "email_delivery_failed" }, 503);
      }
      response.expiresAt = issued.expiresAt;
      if (emailDeliveryStatus().provider === "preview") response.previewToken = issued.token;
    }
    return context.json(response);
  });

  app.post("/api/auth/password-reset/confirm", async (context) => {
    const parsed = passwordResetSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return context.json({ error: "invalid_password_reset", issues: parsed.error.flatten() }, 400);
    const consumed = await consumeAuthToken(database, parsed.data.token, "password_reset");
    if (!consumed) return context.json({ error: "invalid_or_expired_token" }, 400);
    await updateAuthPassword(database, consumed.userId, hashPassword(parsed.data.newPassword));
    await createNotification(database, { userId: consumed.userId, type: "account", title: "密码已重置", body: "你的登录密码已更新，如非本人操作请立即联系平台管理员。", resourceType: "account", resourceId: consumed.userId });
    return context.json({ status: "updated" });
  });

  app.get("/api/auth/session", async (context) => {
    const actor = await actorFor(context.req.raw);
    return actor ? context.json({ actor }) : context.json({ error: "authentication_required" }, 401);
  });

  app.post("/api/auth/logout", async (context) => {
    const authorization = context.req.header("authorization");
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;
    await revokeSession(token, database);
    return context.json({ status: "signed_out" });
  });

  app.post("/api/auth/password", async (context) => {
    const actor = await actorFor(context.req.raw);
    if (!actor) return context.json({ error: "authentication_required" }, 401);
    const parsed = passwordChangeSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return context.json({ error: "invalid_password_change", issues: parsed.error.flatten() }, 400);
    const account = await getAuthAccountByUserId(database, actor.userId);
    if (!account || !verifyPassword(parsed.data.currentPassword, account.passwordHash)) return context.json({ error: "current_password_incorrect" }, 400);
    await updateAuthPassword(database, actor.userId, hashPassword(parsed.data.newPassword));
    await writeAuditLog(database, actor, "auth.password_changed", "auth_account", actor.userId, {});
    return context.json({ status: "updated" });
  });

  app.patch("/api/auth/profile", async (context) => {
    const actor = await actorFor(context.req.raw);
    if (!actor) return context.json({ error: "authentication_required" }, 401);
    const parsed = profileUpdateSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return context.json({ error: "invalid_profile", issues: parsed.error.flatten() }, 400);
    const result = await updateAuthProfile(database, actor.userId, parsed.data);
    if ("error" in result) return context.json({ error: result.error }, 409);
    await writeAuditLog(database, actor, "auth.profile_updated", "auth_account", actor.userId, {});
    return context.json(result);
  });

  app.get("/api/auth/config", async (context) => context.json({ emailRequired: process.env.AUTH_EMAIL_REQUIRED === "true", captchaEnabled: false, emailVerificationEnabled: true, passwordResetEnabled: true, otpEnabled: emailDeliveryStatus().configured }));

  app.get("/api/admin/auth-accounts", async (context) => {
    const actor = await adminActorFor(context.req.raw);
    if (!actor) return context.json({ error: "authentication_required" }, 401);
    if (!actor.roles.includes("platform_admin")) return context.json({ error: "platform_admin_required" }, 403);
    const status = context.req.query("status") as "pending" | "active" | "rejected" | undefined;
    return context.json({ accounts: await listAuthAccounts(database, status) });
  });

  app.post("/api/admin/auth-accounts/:userId/approve", async (context) => {
    const actor = await adminActorFor(context.req.raw);
    if (!actor) return context.json({ error: "authentication_required" }, 401);
    if (!actor.roles.includes("platform_admin")) return context.json({ error: "platform_admin_required" }, 403);
    const targetUserId = context.req.param("userId");
    const approved = await approveAuthAccount(database, targetUserId);
    if (approved) await createNotification(database, {
      userId: targetUserId,
      type: "account",
      title: "账号审核已通过",
      body: "你的入驻资料已通过平台审核，现在可以登录并使用对应角色功能。",
      resourceType: "account",
      resourceId: targetUserId,
    });
    return approved ? context.json({ status: "active" }) : context.json({ error: "account_not_pending" }, 409);
  });

  app.post("/api/admin/auth-accounts/:userId/status", async (context) => {
    const actor = await adminActorFor(context.req.raw);
    if (!actor) return context.json({ error: "authentication_required" }, 401);
    if (!actor.roles.includes("platform_admin")) return context.json({ error: "platform_admin_required" }, 403);
    const body = await context.req.json().catch(() => null) as { status?: string } | null;
    const status = body?.status;
    if (!status || !["pending", "active", "rejected", "suspended"].includes(status)) {
      return context.json({ error: "invalid_account_status" }, 400);
    }
    if (context.req.param("userId") === actor.userId && status !== "active") {
      return context.json({ error: "cannot_disable_self" }, 400);
    }
    const updated = await updateAuthAccountStatus(database, context.req.param("userId"), status as "pending" | "active" | "rejected" | "suspended");
    if (!updated) return context.json({ error: "account_not_found" }, 404);
    const statusCopy = status === "suspended" ? "你的账号已被暂停，请联系平台管理员。" : status === "rejected" ? "你的入驻资料未通过审核，可补充资料后重新提交。" : "你的账号状态已恢复，可以继续使用平台功能。";
    await createNotification(database, {
      userId: context.req.param("userId"),
      type: "account",
      title: status === "suspended" ? "账号已暂停" : status === "rejected" ? "账号审核未通过" : "账号状态已更新",
      body: statusCopy,
      resourceType: "account",
      resourceId: context.req.param("userId"),
    });
    await writeAuditLog(database, actor, `auth_account.${status}`, "auth_account", context.req.param("userId"), { status });
    return context.json({ status });
  });

  app.get("/api/admin/project-submissions", async (context) => {
    const actor = await adminActorFor(context.req.raw);
    if (!actor) return context.json({ error: "authentication_required" }, 401);
    if (!actor.roles.includes("platform_admin")) return context.json({ error: "platform_admin_required" }, 403);
    return context.json({ projects: await listProjectSubmissions(database) });
  });

  app.post("/api/admin/project-submissions", async (context) => {
    const actor = await adminActorFor(context.req.raw);
    if (!actor) return context.json({ error: "authentication_required" }, 401);
    if (!actor.roles.includes("platform_admin")) return context.json({ error: "platform_admin_required" }, 403);
    const parsed = adminProjectSubmissionSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return context.json({ error: "invalid_admin_project_submission", issues: parsed.error.flatten() }, 400);
    const project = await createProjectSubmission(database, parsed.data);
    if (!project) return context.json({ error: "project_owner_not_found" }, 404);
    await createOrganizationNotification(database, parsed.data.ownerOrganizationId, {
      type: "project",
      title: "项目已提交平台审核",
      body: `项目「${project.name}」已进入审核队列。`,
      resourceType: "project",
      resourceId: project.id,
    });
    await writeAuditLog(database, actor, "project.created_by_admin", "project", project.id, { reviewStatus: "pending" });
    return context.json({ project }, 201);
  });

  app.post("/api/admin/project-submissions/:projectId/decision", async (context) => {
    const actor = await adminActorFor(context.req.raw);
    if (!actor) return context.json({ error: "authentication_required" }, 401);
    if (!actor.roles.includes("platform_admin")) return context.json({ error: "platform_admin_required" }, 403);
    const body = await context.req.json().catch(() => null) as { status?: string } | null;
    if (body?.status !== "approved" && body?.status !== "rejected") return context.json({ error: "invalid_project_decision" }, 400);
    const project = await updateProjectReviewStatus(database, context.req.param("projectId"), body.status);
    if (!project) return context.json({ error: "project_not_found" }, 404);
    await createOrganizationNotification(database, project.ownerOrganizationId, {
      type: "project",
      title: body.status === "approved" ? "项目已通过审核" : "项目审核未通过",
      body: body.status === "approved" ? `项目「${project.name}」已发布到项目库。` : `项目「${project.name}」暂未通过审核，请补充资料后重新提交。`,
      resourceType: "project",
      resourceId: project.id,
    });
    await writeAuditLog(database, actor, `project.${body.status}`, "project", project.id, { reviewStatus: body.status });
    return context.json({ project });
  });

  app.get("/api/admin/identity-submissions", async (context) => {
    const actor = await adminActorFor(context.req.raw);
    if (!actor) return context.json({ error: "authentication_required" }, 401);
    if (!actor.roles.includes("platform_admin")) return context.json({ error: "platform_admin_required" }, 403);
    const type = context.req.query("type") as IdentitySubmissionType | undefined;
    const status = context.req.query("status") as IdentitySubmissionStatus | undefined;
    const q = context.req.query("q");
    if (type && !["investor_thesis", "fa_recommendation", "government_demand"].includes(type)) return context.json({ error: "invalid_identity_submission_type" }, 400);
    if (status && !["draft", "pending", "approved", "rejected", "archived"].includes(status)) return context.json({ error: "invalid_identity_submission_status" }, 400);
    return context.json({ submissions: await listIdentitySubmissionsForAdmin(database, { type, status, q }) });
  });

  app.post("/api/admin/identity-submissions/:submissionId/decision", async (context) => {
    const actor = await adminActorFor(context.req.raw);
    if (!actor) return context.json({ error: "authentication_required" }, 401);
    if (!actor.roles.includes("platform_admin")) return context.json({ error: "platform_admin_required" }, 403);
    const parsed = identityDecisionSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return context.json({ error: "invalid_identity_decision", issues: parsed.error.flatten() }, 400);
    if (parsed.data.status === "rejected" && !parsed.data.reason) return context.json({ error: "rejection_reason_required" }, 400);
    const current = await getIdentitySubmission(database, context.req.param("submissionId"));
    if (!current) return context.json({ error: "identity_submission_not_found" }, 404);
    const submission = await updateIdentitySubmissionStatus(database, current.id, parsed.data.status, actor.userId, parsed.data.reason);
    if (!submission) return context.json({ error: "identity_submission_not_found" }, 404);
    const title = parsed.data.status === "approved" ? "身份内容已通过审核" : parsed.data.status === "rejected" ? "身份内容需要补充" : "身份内容已下架";
    const body = parsed.data.status === "approved" ? `「${submission.title}」已公开展示。` : parsed.data.status === "rejected" ? `「${submission.title}」暂未通过审核。${parsed.data.reason}` : `「${submission.title}」已从公开区域下架。`;
    await createNotification(database, { userId: submission.ownerUserId, type: "system", title, body, resourceType: "identity_submission", resourceId: submission.id });
    await writeAuditLog(database, actor, `identity_submission.${parsed.data.status}`, "identity_submission", submission.id, { type: submission.type, reason: parsed.data.reason ?? null, version: submission.version });
    return context.json({ submission });
  });

  app.get("/api/session", async (context) => {
    const actor = await actorFor(context.req.raw);
    return actor
      ? context.json({ actor })
      : context.json({ error: "authentication_required" }, 401);
  });

  app.get("/api/me/notifications", async (context) => {
    const actor = await actorFor(context.req.raw);
    if (!actor) return context.json({ error: "authentication_required" }, 401);
    const unreadOnly = context.req.query("unreadOnly") === "true";
    return context.json({
      notifications: await listNotifications(database, actor.userId, { unreadOnly }),
      unreadCount: await countUnreadNotifications(database, actor.userId),
    });
  });

  app.post("/api/me/notifications/:notificationId/read", async (context) => {
    const actor = await actorFor(context.req.raw);
    if (!actor) return context.json({ error: "authentication_required" }, 401);
    const updated = await markNotificationRead(database, actor.userId, context.req.param("notificationId"));
    return updated ? context.json({ read: true }) : context.json({ error: "notification_not_found" }, 404);
  });

  app.post("/api/me/notifications/read-all", async (context) => {
    const actor = await actorFor(context.req.raw);
    if (!actor) return context.json({ error: "authentication_required" }, 401);
    return context.json({ read: await markAllNotificationsRead(database, actor.userId) });
  });

  app.get("/api/me/favorites", async (context) => {
    const actor = await actorFor(context.req.raw);
    if (!actor) return context.json({ error: "authentication_required" }, 401);
    return context.json({ favorites: await listFavorites(database, actor.userId) });
  });

  app.post("/api/me/favorites", async (context) => {
    const actor = await actorFor(context.req.raw);
    if (!actor) return context.json({ error: "authentication_required" }, 401);
    const parsed = favoriteSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return context.json({ error: "invalid_favorite", issues: parsed.error.flatten() }, 400);
    const { resourceType, resourceId } = parsed.data;
    const exists = resourceType === "project"
      ? Boolean(await getPublicProject(database, resourceId))
      : resourceType === "organization"
        ? Boolean((await listPublicOrganizations(database)).some((organization) => (organization as unknown as { id: string }).id === resourceId))
        : Boolean(await getPublishedArticle(database, resourceId) || (await listPublishedArticles(database)).some((article) => article.id === resourceId));
    if (!exists) return context.json({ error: "resource_not_found" }, 404);
    const favorite = await addFavorite(database, actor.userId, resourceType as FavoriteResourceType, resourceId);
    await writeAuditLog(database, actor, "favorite.added", resourceType, resourceId, {});
    return context.json({ favorite }, 201);
  });

  app.delete("/api/me/favorites/:resourceType/:resourceId", async (context) => {
    const actor = await actorFor(context.req.raw);
    if (!actor) return context.json({ error: "authentication_required" }, 401);
    const resourceType = context.req.param("resourceType");
    if (!["project", "organization", "article"].includes(resourceType)) return context.json({ error: "invalid_favorite" }, 400);
    const removed = await removeFavorite(database, actor.userId, resourceType as FavoriteResourceType, context.req.param("resourceId"));
    return removed ? context.json({ removed: true }) : context.json({ removed: false }, 404);
  });

  app.get("/api/me/recent-views", async (context) => {
    const actor = await actorFor(context.req.raw);
    if (!actor) return context.json({ error: "authentication_required" }, 401);
    return context.json({ views: await listRecentViews(database, actor.userId) });
  });

  app.get("/api/me/projects", async (context) => {
    const actor = await actorFor(context.req.raw);
    if (!actor) return context.json({ error: "authentication_required" }, 401);
    return context.json({ projects: await listProjectsForOrganization(database, actor.organizationId) });
  });

  app.get("/api/me/bp-requests", async (context) => {
    const actor = await actorFor(context.req.raw);
    if (!actor) return context.json({ error: "authentication_required" }, 401);
    return context.json({ requests: await listBpAccessRequestsForUser(database, actor.userId) });
  });

  app.get("/api/me/contact-requests", async (context) => {
    const actor = await actorFor(context.req.raw);
    if (!actor) return context.json({ error: "authentication_required" }, 401);
    return context.json({ requests: await listContactRequestsForUser(database, actor.userId) });
  });

  app.get("/api/me/identity-submissions", async (context) => {
    const actor = await actorFor(context.req.raw);
    if (!actor) return context.json({ error: "authentication_required" }, 401);
    return context.json({ submissions: await listIdentitySubmissionsForUser(database, actor.userId) });
  });

  app.get("/api/me/incoming-bp-requests", async (context) => {
    const actor = await actorFor(context.req.raw);
    if (!actor) return context.json({ error: "authentication_required" }, 401);
    return context.json({ requests: await listIncomingBpAccessRequests(database, actor.organizationId) });
  });

  app.post("/api/me/recent-views", async (context) => {
    const actor = await actorFor(context.req.raw);
    if (!actor) return context.json({ error: "authentication_required" }, 401);
    const parsed = favoriteSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return context.json({ error: "invalid_recent_view", issues: parsed.error.flatten() }, 400);
    const view = await recordRecentView(database, actor.userId, parsed.data.resourceType as FavoriteResourceType, parsed.data.resourceId);
    return context.json({ view }, 201);
  });

  app.get("/api/projects", async (context) => {
    const filtered = await listPublishedProjects(database, {
      q: context.req.query("q"),
      industry: context.req.query("industry"),
      region: context.req.query("region"),
      stage: context.req.query("stage"),
    });
    const result = paginate(filtered, readPagination(context));
    return context.json({ projects: result.items, pagination: result.pagination });
  });

  app.get("/api/projects/:projectId", async (context) => {
    const project = await getPublicProject(database, context.req.param("projectId"));
    if (!project) return context.json({ error: "project_not_found" }, 404);
    const bp = await getBpForProject(database, project.id);
    return context.json({
      project: {
        id: project.id,
        name: project.name,
        summary: project.summary,
        industry: project.industry,
        region: project.region,
        stage: project.stage,
        financingRange: project.financingRange,
        identityMode: project.identityMode,
        bp: bp ? { id: bp.id, version: bp.version, access: "request_required" } : null,
      },
    });
  });

  app.post("/api/projects", async (context) => {
    const actor = await actorFor(context.req.raw);
    if (!actor) return context.json({ error: "authentication_required" }, 401);
    if (actor.organizationType !== "project" || !actor.roles.some((role) => ["org_admin", "project_manager"].includes(role))) {
      return context.json({ error: "project_role_required" }, 403);
    }
    const parsed = projectSubmissionSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return context.json({ error: "invalid_project_submission", issues: parsed.error.flatten() }, 400);
    const project = await createProjectSubmission(database, { ...parsed.data, ownerOrganizationId: actor.organizationId });
    await createOrganizationNotification(database, actor.organizationId, {
      type: "project",
      title: "项目已提交审核",
      body: `项目「${project?.name ?? parsed.data.name}」已提交，平台审核完成后会通知你。`,
      resourceType: "project",
      resourceId: project?.id,
    });
    await writeAuditLog(database, actor, "project.submitted", "project", project!.id, { reviewStatus: "pending" });
    return context.json({ project }, 201);
  });

  app.post("/api/identity-submissions", async (context) => {
    const actor = await actorFor(context.req.raw);
    if (!actor) return context.json({ error: "authentication_required" }, 401);
    const parsed = identitySubmissionSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return context.json({ error: "invalid_identity_submission", issues: parsed.error.flatten() }, 400);
    const expectedType: IdentitySubmissionType | null = actor.organizationType === "investor"
      ? "investor_thesis"
      : actor.organizationType === "fa"
        ? "fa_recommendation"
        : actor.organizationType === "government"
          ? "government_demand"
          : null;
    if (!expectedType || parsed.data.type !== expectedType) return context.json({ error: "identity_submission_not_allowed" }, 403);
    const submission = await createIdentitySubmission(database, { ...parsed.data, ownerUserId: actor.userId, ownerOrganizationId: actor.organizationId });
    if (!submission) return context.json({ error: "identity_submission_failed" }, 500);
    if (submission.status === "pending") {
      await createNotification(database, { userId: actor.userId, type: "system", title: "身份内容已提交审核", body: `「${submission.title}」已进入平台审核队列。`, resourceType: "identity_submission", resourceId: submission.id });
    }
    await writeAuditLog(database, actor, "identity_submission.created", "identity_submission", submission.id, { type: submission.type, status: submission.status });
    return context.json({ submission }, 201);
  });

  app.patch("/api/identity-submissions/:submissionId", async (context) => {
    const actor = await actorFor(context.req.raw);
    if (!actor) return context.json({ error: "authentication_required" }, 401);
    const current = await getIdentitySubmission(database, context.req.param("submissionId"));
    if (!current) return context.json({ error: "identity_submission_not_found" }, 404);
    if (current.ownerUserId !== actor.userId) return context.json({ error: "identity_submission_forbidden" }, 403);
    const parsed = identitySubmissionUpdateSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return context.json({ error: "invalid_identity_submission", issues: parsed.error.flatten() }, 400);
    const submission = await updateIdentitySubmissionContent(database, current.id, actor.userId, parsed.data);
    if (!submission) return context.json({ error: "identity_submission_not_editable" }, 409);
    if (submission.status === "pending") await createNotification(database, { userId: actor.userId, type: "system", title: "身份内容已重新提交", body: `「${submission.title}」已进入平台审核队列。`, resourceType: "identity_submission", resourceId: submission.id });
    await writeAuditLog(database, actor, "identity_submission.updated", "identity_submission", submission.id, { type: submission.type, status: submission.status, version: submission.version });
    return context.json({ submission });
  });

  app.post("/api/projects/:projectId/bp", async (context) => {
    const actor = await actorFor(context.req.raw);
    if (!actor) return context.json({ error: "authentication_required" }, 401);
    const project = await getProject(database, context.req.param("projectId"));
    if (!project) return context.json({ error: "project_not_found" }, 404);
    const authorization = authorizeProjectMutation(actor, project);
    if (!authorization.allowed) return context.json({ error: authorization.reason }, 403);
    const form = await context.req.raw.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return context.json({ error: "bp_file_required" }, 400);
    if (file.size === 0 || file.size > 10 * 1024 * 1024) return context.json({ error: "bp_file_size_invalid" }, 400);
    const extension = file.name.toLowerCase().split(".").pop();
    if (!extension || !["pdf", "ppt", "pptx"].includes(extension)) return context.json({ error: "bp_file_type_invalid" }, 400);
    const storageKey = `private/${project.id}/${randomUUID()}.${extension}`;
    try {
      await saveLocalBpFile(storageKey, new Uint8Array(await file.arrayBuffer()));
    } catch (error) {
      return context.json({ error: "bp_storage_upload_failed", detail: error instanceof Error ? error.message : String(error) }, 503);
    }
    const bp = await createBpFile(database, { projectId: project.id, fileName: file.name, storageKey });
    await writeAuditLog(database, actor, "bp.uploaded", "bp_file", bp.id, { projectId: project.id, fileName: file.name });
    return context.json({ bp }, 201);
  });

  app.get("/api/organizations", async (context) => {
    const query = context.req.query("q");
    const type = context.req.query("type");
    const region = context.req.query("region");
    const all = (await listPublicOrganizations(database)).filter((organization) => {
      const item = organization as unknown as { id: string; name: string; type: string; tagline: string; description: string; region: string; focus: string[] };
      return (!type || item.type === type) && (!region || item.region === region) && includesQuery([item.name, item.tagline, item.description, item.region, ...item.focus], query);
    });
    const result = paginate(all, readPagination(context));
    return context.json({ organizations: result.items, pagination: result.pagination });
  });

  app.get("/api/organizations/:organizationId", async (context) => {
    const organization = (await listPublicOrganizations(database)).find((candidate) => (candidate as unknown as { id: string }).id === context.req.param("organizationId"));
    return organization ? context.json({ organization }) : context.json({ error: "organization_not_found" }, 404);
  });

  app.post("/api/contact-requests", async (context) => {
    const parsed = contactRequestSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) {
      return context.json({ error: "invalid_contact_request", issues: parsed.error.flatten() }, 400);
    }
    const actor = await actorFor(context.req.raw);
    const request = await createContactRequest(database, { ...parsed.data, requesterUserId: actor?.userId });
    if (actor) await createNotification(database, {
      userId: actor.userId,
      type: "contact",
      title: "对接需求已提交",
      body: "平台已收到你的对接需求，后续状态变化会在通知中心更新。",
      resourceType: "contact_request",
      resourceId: request.id,
    });
    return context.json({ request }, 201);
  });

  app.get("/api/articles", async (context) => {
    const query = context.req.query("q");
    const category = context.req.query("category");
    const all = (await listPublishedArticles(database)).filter((article) =>
      (!category || article.category === category) && includesQuery([article.title, article.summary, article.content, article.category], query),
    );
    const result = paginate(all, readPagination(context));
    return context.json({ articles: result.items, pagination: result.pagination });
  });

  app.get("/api/articles/:slug", async (context) => {
    const article = await getPublishedArticle(database, context.req.param("slug"));
    return article
      ? context.json({ article })
      : context.json({ error: "article_not_found" }, 404);
  });

  app.post("/api/projects/:projectId/bp-requests", async (context) => {
    const actor = await actorFor(context.req.raw);
    const project = await getProject(database, context.req.param("projectId"));
    if (!project) return context.json({ error: "project_not_found" }, 404);
    if (!actor) return context.json({ error: "authentication_required" }, 403);
    const authorization = canRequestBp(actor, project);
    if (!authorization.allowed) return context.json({ error: authorization.reason }, 403);

    const parsed = requestSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) {
      return context.json({ error: "invalid_request", issues: parsed.error.flatten() }, 400);
    }
    const bp = await getBpForProject(database, project.id);
    if (!bp) return context.json({ error: "bp_not_found" }, 404);
    const request = await createBpAccessRequest(database, {
      bpFileId: bp.id,
      requesterOrganizationId: actor.organizationId,
      requesterUserId: actor.userId,
      purpose: parsed.data.purpose,
    });
    await createOrganizationNotification(database, project.ownerOrganizationId, {
      type: "bp",
      title: "收到新的 BP 访问申请",
      body: `有机构申请查看「${project.name}」的 BP，请在账号中心处理。`,
      resourceType: "bp_request",
      resourceId: request.id,
    });
    await writeAuditLog(database, actor, "bp.requested", "bp_file", bp.id, {
      requestId: request.id,
      projectId: project.id,
    });
    return context.json({ request }, 201);
  });

  app.post("/api/bp-requests/:requestId/decision", async (context) => {
    const actor = await actorFor(context.req.raw);
    if (!actor) return context.json({ error: "authentication_required" }, 401);
    const request = await getBpAccessRequest(database, context.req.param("requestId"));
    if (!request) return context.json({ error: "request_not_found" }, 404);
    if (request.status !== "pending") return context.json({ error: "request_already_decided" }, 409);
    const project = await getProject(database, request.projectId);
    if (!project) return context.json({ error: "project_not_found" }, 404);
    const authorization = authorizeProjectMutation(actor, project);
    if (!authorization.allowed) return context.json({ error: authorization.reason }, 403);

    const parsed = decisionSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) {
      return context.json({ error: "invalid_decision", issues: parsed.error.flatten() }, 400);
    }
    if (parsed.data.decision === "approved") {
      const validation = validateGrantInput({
        granteeOrganizationVerified: request.requesterOrganizationVerified,
        expiresAt: parsed.data.expiresAt,
        allowDownload: parsed.data.allowDownload,
      });
      if (!validation.valid) return context.json({ error: validation.reason }, 400);
    }

    const result = await decideBpAccessRequest(database, {
      request,
      decision: parsed.data.decision,
      decidedByUserId: actor.userId,
      expiresAt: parsed.data.decision === "approved" ? parsed.data.expiresAt : undefined,
      allowDownload: parsed.data.decision === "approved" ? parsed.data.allowDownload : undefined,
    });
    await createNotification(database, {
      userId: request.requesterUserId,
      type: "bp",
      title: parsed.data.decision === "approved" ? "BP 申请已通过" : "BP 申请未通过",
      body: parsed.data.decision === "approved" ? `项目「${project.name}」的 BP 访问申请已通过。` : `项目「${project.name}」的 BP 访问申请暂未通过。`,
      resourceType: "bp_request",
      resourceId: request.id,
    });
    await writeAuditLog(database, actor, `bp.request.${parsed.data.decision}`, "bp_request", request.id, {
      bpFileId: request.bpFileId,
      requesterOrganizationId: request.requesterOrganizationId,
    });
    return context.json({ request: { id: request.id, status: parsed.data.decision }, ...result });
  });

  app.get("/api/bp-files/:bpFileId/access", async (context) => {
    const actor = await actorFor(context.req.raw);
    const bp = await getBpFile(database, context.req.param("bpFileId"));
    if (!bp) return context.json({ error: "bp_not_found" }, 404);
    const project = await getProject(database, bp.projectId);
    if (!project) return context.json({ error: "project_not_found" }, 404);
    const authorization = authorizeBpRead(actor, project, bp.id, await listBpGrants(database, bp.id));
    if (!authorization.allowed) return context.json({ error: authorization.reason }, 403);
    if (!actor) return context.json({ error: "authentication_required" }, 401);

    const traceId = randomUUID();
    const accessedAt = new Date().toISOString();
    const allowDownload = actor.organizationId === project.ownerOrganizationId
      ? true
      : Boolean(authorization.grant?.allowDownload);
    await writeAuditLog(database, actor, "bp.accessed", "bp_file", bp.id, {
      traceId,
      projectId: project.id,
      allowDownload,
    });
    return context.json({
      access: {
        url: localBpFileUrl(bp.id),
        expiresInSeconds: 300,
        allowDownload,
        watermark: {
          userId: actor.userId,
          organizationId: actor.organizationId,
          accessedAt,
          traceId,
        },
      },
    });
  });

  app.get("/api/bp-files/:bpFileId/file", async (context) => {
    const actor = await actorFor(context.req.raw);
    const bp = await getBpFile(database, context.req.param("bpFileId"));
    if (!bp) return context.json({ error: "bp_not_found" }, 404);
    const project = await getProject(database, bp.projectId);
    if (!project) return context.json({ error: "project_not_found" }, 404);
    const authorization = authorizeBpRead(actor, project, bp.id, await listBpGrants(database, bp.id));
    if (!authorization.allowed) return context.json({ error: authorization.reason }, 403);
    if (!actor) return context.json({ error: "authentication_required" }, 401);
    const data = await readLocalBpFile(bp.storageKey);
    if (!data) return context.json({ error: "bp_file_missing" }, 404);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": contentTypeForStorageKey(bp.storageKey),
        "Content-Disposition": `${authorization.grant?.allowDownload || actor.organizationId === project.ownerOrganizationId ? "attachment" : "inline"}; filename="${encodeURIComponent(bp.fileName)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  });

  app.get("/api/government-contacts", async (context) => {
    const query = context.req.query("q");
    const region = context.req.query("region");
    const all = (await listGovernmentContacts(database)).filter((contact) => {
      const item = contact as unknown as { name: string; organizationName: string; title: string; region: string; industries: string[] };
      return (!region || item.region === region) && includesQuery([item.name, item.organizationName, item.title, item.region, ...item.industries], query);
    });
    const result = paginate(all, readPagination(context));
    return context.json({ contacts: result.items, pagination: result.pagination });
  });

  app.post("/api/admin/government-contacts", async (context) => {
    const actor = await adminActorFor(context.req.raw);
    if (!actor) return context.json({ error: "authentication_required" }, 401);
    if (!actor.roles.includes("platform_admin")) return context.json({ error: "platform_admin_required" }, 403);
    const parsed = adminGovernmentContactSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return context.json({ error: "invalid_government_contact", issues: parsed.error.flatten() }, 400);
    const contact = await createGovernmentContact(database, parsed.data);
    if (!contact) return context.json({ error: "government_contact_not_created" }, 409);
    await writeAuditLog(database, actor, "government_contact.created", "government_contact", contact.id, { region: contact.region });
    return context.json({ contact }, 201);
  });

  app.get("/api/government-contacts/:contactId", async (context) => {
    const contact = (await listGovernmentContacts(database)).find((candidate) => (candidate as unknown as { id: string }).id === context.req.param("contactId"));
    return contact ? context.json({ contact }) : context.json({ error: "government_contact_not_found" }, 404);
  });

  const auditQuery = (context: { req: { query: (name: string) => string | undefined } }) => ({
    q: context.req.query("q"),
    action: context.req.query("action"),
    resourceType: context.req.query("resourceType"),
    from: context.req.query("from"),
    to: context.req.query("to"),
    limit: Number(context.req.query("limit") ?? 30),
    offset: Number(context.req.query("offset") ?? 0),
  });

  app.get("/api/admin/audit-logs", async (context) => {
    const actor = await adminActorFor(context.req.raw);
    if (!actor) return context.json({ error: "authentication_required" }, 401);
    if (!actor.roles.includes("platform_admin")) return context.json({ error: "platform_admin_required" }, 403);
    return context.json(await listAuditLogs(database, auditQuery(context)));
  });

  app.get("/api/admin/audit-logs/export", async (context) => {
    const actor = await adminActorFor(context.req.raw);
    if (!actor) return context.json({ error: "authentication_required" }, 401);
    if (!actor.roles.includes("platform_admin")) return context.json({ error: "platform_admin_required" }, 403);
    const result = await listAuditLogs(database, { ...auditQuery(context), limit: 100 });
    const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = [
      ["时间", "操作人", "操作", "资源类型", "资源 ID", "元数据"],
      ...result.logs.map((log) => [log.occurredAt, log.actorName ?? log.actorUserId, log.action, log.resourceType, log.resourceId, JSON.stringify(log.metadata)]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
    return context.text(csv, 200, { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=venture-audit-logs.csv" });
  });

  app.get("/api/admin/contact-requests", async (context) => {
    const actor = await adminActorFor(context.req.raw);
    if (!actor) return context.json({ error: "authentication_required" }, 401);
    if (!actor.roles.includes("platform_admin")) {
      return context.json({ error: "platform_admin_required" }, 403);
    }
    return context.json({ requests: await listContactRequests(database) });
  });

  app.get("/api/admin/contact-requests/:requestId/updates", async (context) => {
    const actor = await adminActorFor(context.req.raw);
    if (!actor) return context.json({ error: "authentication_required" }, 401);
    if (!actor.roles.includes("platform_admin")) return context.json({ error: "platform_admin_required" }, 403);
    return context.json({ updates: await listContactRequestUpdates(database, context.req.param("requestId")) });
  });

  app.patch("/api/admin/contact-requests/:requestId", async (context) => {
    const actor = await adminActorFor(context.req.raw);
    if (!actor) return context.json({ error: "authentication_required" }, 401);
    if (!actor.roles.includes("platform_admin")) return context.json({ error: "platform_admin_required" }, 403);
    const parsed = contactRequestUpdateSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return context.json({ error: "invalid_contact_update", issues: parsed.error.flatten() }, 400);
    const update = await updateContactRequest(database, context.req.param("requestId"), { ...parsed.data, actorUserId: actor.userId });
    if (!update) return context.json({ error: "contact_request_not_found" }, 404);
    const owner = await getContactRequestOwner(database, context.req.param("requestId"));
    if (owner?.requesterUserId) await createNotification(database, {
      userId: owner.requesterUserId,
      type: "contact",
      title: "对接需求状态已更新",
      body: `你的对接需求已更新为「${parsed.data.status}」。${parsed.data.note}`,
      resourceType: "contact_request",
      resourceId: context.req.param("requestId"),
    });
    await writeAuditLog(database, actor, "contact_request.updated", "contact_request", context.req.param("requestId"), { status: parsed.data.status, note: parsed.data.note });
    return context.json({ update });
  });

  app.get("/api/admin/articles", async (context) => {
    const actor = await adminActorFor(context.req.raw);
    if (!actor) return context.json({ error: "authentication_required" }, 401);
    if (!actor.roles.includes("platform_admin")) {
      return context.json({ error: "platform_admin_required" }, 403);
    }
    return context.json({ articles: await listAllArticles(database) });
  });

  app.post("/api/admin/articles", async (context) => {
    const actor = await adminActorFor(context.req.raw);
    if (!actor) return context.json({ error: "authentication_required" }, 401);
    if (!actor.roles.includes("platform_admin")) {
      return context.json({ error: "platform_admin_required" }, 403);
    }
    const parsed = articleSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) {
      return context.json({ error: "invalid_article", issues: parsed.error.flatten() }, 400);
    }
    const article = await createArticle(database, parsed.data);
    await writeAuditLog(database, actor, "article.created", "article", article.id, { status: article.status });
    return context.json({ article }, 201);
  });

  app.patch("/api/admin/articles/:articleId", async (context) => {
    const actor = await adminActorFor(context.req.raw);
    if (!actor) return context.json({ error: "authentication_required" }, 401);
    if (!actor.roles.includes("platform_admin")) {
      return context.json({ error: "platform_admin_required" }, 403);
    }
    const parsed = articleUpdateSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) {
      return context.json({ error: "invalid_article_update", issues: parsed.error.flatten() }, 400);
    }
    const article = await updateArticle(database, context.req.param("articleId"), parsed.data);
    if (!article) return context.json({ error: "article_not_found" }, 404);
    await writeAuditLog(database, actor, "article.updated", "article", article.id, { status: article.status });
    return context.json({ article });
  });

  app.get("/api/admin/overview", async (context) => {
    const actor = await adminActorFor(context.req.raw);
    if (!actor) return context.json({ error: "authentication_required" }, 401);
    if (!actor.roles.includes("platform_admin")) {
      return context.json({ error: "platform_admin_required" }, 403);
    }
    return context.json(await getAdminOverview(database));
  });

  app.notFound(async (context) => context.json({ error: "not_found" }, 404));
  app.onError((error, context) => {
    console.error(error);
    return context.json({ error: "internal_error" }, 500);
  });
  return app;
}
