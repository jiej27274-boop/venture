import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { createDatabase, seedDatabase, type VentureDatabase } from "../src/database.ts";

let database: VentureDatabase;

function headers(userId: string, organizationId: string) {
  return {
    "content-type": "application/json",
    "x-user-id": userId,
    "x-organization-id": organizationId,
  };
}

async function captchaFor(app: ReturnType<typeof createApp>) {
  const response = await app.request("/api/auth/captcha");
  const payload = await response.json() as { captchaId: string; image: string };
  const svg = decodeURIComponent(payload.image.split(",", 2)[1]);
  const code = [...svg.matchAll(/<text[^>]*>([A-Z])<\/text>/g)].map((match) => match[1]).join("");
  return { captchaId: payload.captchaId, captchaCode: code };
}

beforeEach(() => {
  database = createDatabase(":memory:");
  seedDatabase(database);
});

describe("public discovery", () => {
  it("exposes health and published project summaries", async () => {
    const app = createApp({ database });
    expect((await app.request("/health")).status).toBe(200);
    const ready = await app.request("/readyz");
    expect(ready.status).toBe(200);
    expect(await ready.json()).toMatchObject({ status: "ready", database: "ok" });
    expect(ready.headers.get("x-content-type-options")).toBe("nosniff");

    const response = await app.request("/api/projects");
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.projects).toHaveLength(3);
    expect(payload.projects[0]).not.toHaveProperty("storageKey");
  });

  it("keeps anonymous project identities private and supports discovery filters", async () => {
    const app = createApp({ database });
    const detail = await app.request("/api/projects/project-energy");
    expect(detail.status).toBe(200);
    const detailPayload = await detail.json();
    expect(detailPayload.project).toMatchObject({
      name: "苏州某新能源材料项目",
      identityMode: "anonymous",
    });
    expect(detailPayload.project.name).not.toBe("新能源材料项目");
    expect(detailPayload.project).not.toHaveProperty("realName");

    const filtered = await app.request(
      "/api/projects?industry=" + encodeURIComponent("人工智能") + "&region=" + encodeURIComponent("上海"),
    );
    expect(filtered.status).toBe(200);
    expect((await filtered.json()).projects).toHaveLength(1);
  });

  it("supports server-side pagination, filters, and public detail endpoints", async () => {
    const app = createApp({ database });
    const projects = await app.request("/api/projects?page=2&pageSize=2");
    expect(projects.status).toBe(200);
    expect(await projects.json()).toMatchObject({ pagination: { page: 2, pageSize: 2, total: 3, totalPages: 2 } });

    const organizations = await app.request("/api/organizations?type=investor&pageSize=1");
    expect(organizations.status).toBe(200);
    const organizationPayload = await organizations.json() as { organizations: Array<{ type: string }>; pagination: { total: number } };
    expect(organizationPayload.pagination.total).toBeGreaterThan(0);
    expect(organizationPayload.organizations).toHaveLength(1);
    expect(organizationPayload.organizations[0].type).toBe("investor");

    const article = await app.request("/api/articles/industrial-capital-2026");
    expect(article.status).toBe(200);
    expect(await article.json()).toMatchObject({ article: { id: "article-1", status: "published" } });
  });

  it("publishes only investor, FA and government organization profiles", async () => {
    const app = createApp({ database });
    const response = await app.request("/api/organizations");
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.organizations.map((organization: { type: string }) => organization.type).sort())
      .toEqual(["fa", "government", "investor"]);
  });

  it("validates contact requests and exposes accepted leads to platform administrators", async () => {
    const app = createApp({ database });
    const invalid = await app.request("/api/contact-requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "张三", phone: "123", organization: "测试企业", need: "寻找落地区域" }),
    });
    expect(invalid.status).toBe(400);

    const accepted = await app.request("/api/contact-requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "张三",
        phone: "13800138000",
        organization: "测试科技",
        need: "希望对接上海人工智能产业政策与落地空间",
        targetRegion: "上海",
      }),
    });
    expect(accepted.status).toBe(201);

    const leads = await app.request("/api/admin/contact-requests", {
      headers: headers("user-admin", "org-platform"),
    });
    expect(leads.status).toBe(200);
    expect(await leads.json()).toMatchObject({
      requests: [{ name: "张三", phone: "13800138000", status: "new" }],
    });
  });

  it("keeps draft articles private until an administrator publishes them", async () => {
    const app = createApp({ database });
    const created = await app.request("/api/admin/articles", {
      method: "POST",
      headers: headers("user-admin", "org-platform"),
      body: JSON.stringify({
        title: "创投市场周报",
        summary: "本周创投市场重点融资事件与产业趋势观察。",
        content: "这是供平台运营发布的周报正文，发布前不应出现在用户端。",
        category: "市场观察",
      }),
    });
    expect(created.status).toBe(201);
    const article = (await created.json()).article;

    const beforePublish = await app.request(`/api/articles/${article.slug}`);
    expect(beforePublish.status).toBe(404);

    const published = await app.request(`/api/admin/articles/${article.id}`, {
      method: "PATCH",
      headers: headers("user-admin", "org-platform"),
      body: JSON.stringify({ status: "published" }),
    });
    expect(published.status).toBe(200);

    const visible = await app.request(`/api/articles/${article.slug}`);
    expect(visible.status).toBe(200);
    expect(await visible.json()).toMatchObject({ article: { title: "创投市场周报", status: "published" } });
  });
});

describe("BP authorization flow", () => {
  it("rejects an unverified organization request", async () => {
    const app = createApp({ database });
    const response = await app.request("/api/projects/project-robotics/bp-requests", {
      method: "POST",
      headers: headers("user-unverified", "org-unverified"),
      body: JSON.stringify({ purpose: "Evaluate the project" }),
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: "organization_not_verified" });
  });

  it("requires a grant before access and allows access after project approval", async () => {
    const app = createApp({ database });

    const denied = await app.request("/api/bp-files/bp-robotics/access", {
      headers: headers("user-investor", "org-investor"),
    });
    expect(denied.status).toBe(403);
    expect(await denied.json()).toMatchObject({ error: "grant_required" });

    const request = await app.request("/api/projects/project-robotics/bp-requests", {
      method: "POST",
      headers: headers("user-investor", "org-investor"),
      body: JSON.stringify({ purpose: "Series A investment review" }),
    });
    expect(request.status).toBe(201);
    const requestPayload = await request.json();

    const decision = await app.request(`/api/bp-requests/${requestPayload.request.id}/decision`, {
      method: "POST",
      headers: headers("user-owner", "org-project"),
      body: JSON.stringify({
        decision: "approved",
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        allowDownload: true,
      }),
    });
    expect(decision.status).toBe(200);
    expect(await decision.json()).toMatchObject({ grant: { allowDownload: true } });

    const allowed = await app.request("/api/bp-files/bp-robotics/access", {
      headers: headers("user-investor", "org-investor"),
    });
    expect(allowed.status).toBe(200);
    expect(await allowed.json()).toMatchObject({
      access: {
        allowDownload: true,
        watermark: {
          userId: "user-investor",
          organizationId: "org-investor",
        },
      },
    });
  });

  it("does not allow the platform administrator to bypass BP authorization", async () => {
    const app = createApp({ database });
    const response = await app.request("/api/bp-files/bp-robotics/access", {
      headers: headers("user-admin", "org-platform"),
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: "grant_required" });
  });
});

describe("platform administration", () => {
  it("restricts the overview to platform administrators", async () => {
    const app = createApp({ database });
    const forbidden = await app.request("/api/admin/overview", {
      headers: headers("user-investor", "org-investor"),
    });
    expect(forbidden.status).toBe(403);

    const allowed = await app.request("/api/admin/overview", {
      headers: headers("user-admin", "org-platform"),
    });
    expect(allowed.status).toBe(200);
    expect(await allowed.json()).toMatchObject({
      organizations: 6,
      projects: 3,
      pendingReviews: 2,
    });
  });

  it("lists and exports audit logs for platform administrators", async () => {
    const app = createApp({ database });
    const forbidden = await app.request("/api/admin/audit-logs", { headers: headers("user-investor", "org-investor") });
    expect(forbidden.status).toBe(403);
    await app.request("/api/admin/project-submissions/project-energy/decision", { method: "POST", headers: { ...headers("user-admin", "org-platform"), "content-type": "application/json" }, body: JSON.stringify({ status: "approved" }) });
    const listed = await app.request("/api/admin/audit-logs?resourceType=project&limit=10", { headers: headers("user-admin", "org-platform") });
    expect(listed.status).toBe(200);
    const payload = await listed.json();
    expect(payload.total).toBeGreaterThan(0);
    expect(payload.logs[0]).toHaveProperty("metadata");
    const exported = await app.request("/api/admin/audit-logs/export?resourceType=project", { headers: headers("user-admin", "org-platform") });
    expect(exported.status).toBe(200);
    expect(exported.headers.get("content-type")).toContain("text/csv");
    expect(await exported.text()).toContain("操作");
  });
});

describe("authentication flow", () => {
  it("registers a pending account, approves it, and creates a bearer session", async () => {
    const app = createApp({ database });
    const captcha = await captchaFor(app);
    const registration = await app.request("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "founder@example.com",
        phone: "13800138000",
        password: "secret123",
        confirmPassword: "secret123",
        role: "project",
        captchaId: captcha.captchaId,
        captchaCode: captcha.captchaCode,
        organizationName: "新项目公司",
        contactName: "项目负责人",
      }),
    });
    expect(registration.status).toBe(201);
    const account = (await registration.json()).account;
    expect(account).toMatchObject({ role: "project", status: "pending" });

    const pendingLogin = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier: "founder@example.com", password: "secret123" }),
    });
    expect(pendingLogin.status).toBe(403);
    expect(await pendingLogin.json()).toMatchObject({ error: "account_pending" });

    const forbiddenList = await app.request("/api/admin/auth-accounts", {
      headers: headers("user-investor", "org-investor"),
    });
    expect(forbiddenList.status).toBe(403);

    const accountList = await app.request("/api/admin/auth-accounts?status=pending", {
      headers: headers("user-admin", "org-platform"),
    });
    expect(accountList.status).toBe(200);
    expect(await accountList.json()).toMatchObject({ accounts: [{ userId: account.userId, status: "pending", role: "project" }] });

    const approved = await app.request(`/api/admin/auth-accounts/${account.userId}/approve`, { method: "POST", headers: headers("user-admin", "org-platform") });
    expect(approved.status).toBe(200);

    const login = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier: "founder@example.com", password: "secret123" }),
    });
    expect(login.status).toBe(200);
    const loginPayload = await login.json();
    expect(loginPayload.actor).toMatchObject({ organizationType: "project" });

    const session = await app.request("/api/auth/session", { headers: { authorization: `Bearer ${loginPayload.session}` } });
    expect(session.status).toBe(200);
    expect(await session.json()).toMatchObject({ actor: { userId: account.userId } });
    const secondApp = createApp({ database });
    const persistedSession = await secondApp.request("/api/auth/session", { headers: { authorization: `Bearer ${loginPayload.session}` } });
    expect(persistedSession.status).toBe(200);

    const suspended = await app.request(`/api/admin/auth-accounts/${account.userId}/status`, {
      method: "POST",
      headers: { ...headers("user-admin", "org-platform"), "content-type": "application/json" },
      body: JSON.stringify({ status: "suspended" }),
    });
    expect(suspended.status).toBe(200);
    const suspendedLogin = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier: "founder@example.com", password: "secret123" }),
    });
    expect(suspendedLogin.status).toBe(403);
    expect(await suspendedLogin.json()).toMatchObject({ error: "account_suspended" });

    const restored = await app.request(`/api/admin/auth-accounts/${account.userId}/status`, {
      method: "POST",
      headers: { ...headers("user-admin", "org-platform"), "content-type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    });
    expect(restored.status).toBe(200);

    const passwordChanged = await app.request("/api/auth/password", { method: "POST", headers: { ...headers(account.userId, account.organizationId), authorization: `Bearer ${loginPayload.session}` }, body: JSON.stringify({ currentPassword: "secret123", newPassword: "newsecret456", confirmPassword: "newsecret456" }) });
    expect(passwordChanged.status).toBe(200);
    const oldPasswordLogin = await app.request("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: "founder@example.com", password: "secret123" }) });
    expect(oldPasswordLogin.status).toBe(401);
    const newPasswordLogin = await app.request("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: "founder@example.com", password: "newsecret456" }) });
    expect(newPasswordLogin.status).toBe(200);
    const sessionBeforeLogout = (await newPasswordLogin.json()).session as string;
    const logout = await app.request("/api/auth/logout", { method: "POST", headers: { authorization: `Bearer ${sessionBeforeLogout}` } });
    expect(logout.status).toBe(200);
    const revokedSession = await app.request("/api/auth/session", { headers: { authorization: `Bearer ${sessionBeforeLogout}` } });
    expect(revokedSession.status).toBe(401);
  });

  it("registers an ordinary user as active and rejects invalid captcha", async () => {
    const app = createApp({ database });
    const invalidCaptcha = await captchaFor(app);
    const rejected = await app.request("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        role: "user",
        userName: "普通用户",
        phone: "13900139000",
        password: "secret123",
        confirmPassword: "secret123",
        ...invalidCaptcha,
        captchaCode: "AAAAA",
      }),
    });
    expect(rejected.status).toBe(400);
    expect(await rejected.json()).toMatchObject({ error: "invalid_captcha" });

    const captcha = await captchaFor(app);
    const registration = await app.request("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        role: "user",
        userName: "普通用户",
        phone: "13900139000",
        password: "secret123",
        confirmPassword: "secret123",
        ...captcha,
      }),
    });
    expect(registration.status).toBe(201);
    expect((await registration.json()).account).toMatchObject({ role: "user", status: "active" });
  });

  it("updates profile details and rejects duplicate identifiers", async () => {
    const app = createApp({ database });
    const firstCaptcha = await captchaFor(app);
    const firstRegistration = await app.request("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        role: "user",
        userName: "资料用户",
        email: "profile@example.com",
        phone: "13900139001",
        password: "secret123",
        confirmPassword: "secret123",
        ...firstCaptcha,
      }),
    });
    expect(firstRegistration.status).toBe(201);
    const firstAccount = (await firstRegistration.json()).account as { userId: string; organizationId: string };

    const secondCaptcha = await captchaFor(app);
    const secondRegistration = await app.request("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        role: "user",
        userName: "另一位用户",
        email: "other@example.com",
        phone: "13900139002",
        password: "secret123",
        confirmPassword: "secret123",
        ...secondCaptcha,
      }),
    });
    expect(secondRegistration.status).toBe(201);

    const login = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier: "profile@example.com", password: "secret123" }),
    });
    expect(login.status).toBe(200);
    const session = (await login.json()).session as string;
    const authHeaders = { "content-type": "application/json", authorization: `Bearer ${session}` };

    const updated = await app.request("/api/auth/profile", {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ displayName: "资料用户（已更新）", email: "profile-updated@example.com", phone: "13900139003" }),
    });
    expect(updated.status).toBe(200);
    expect(await updated.json()).toMatchObject({ profile: { displayName: "资料用户（已更新）", email: "profile-updated@example.com", phone: "13900139003" } });

    const duplicate = await app.request("/api/auth/profile", {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ displayName: "资料用户", email: "other@example.com", phone: "13900139003" }),
    });
    expect(duplicate.status).toBe(409);
    expect(await duplicate.json()).toMatchObject({ error: "identifier_taken" });

    const sessionCheck = await app.request("/api/auth/session", { headers: { authorization: `Bearer ${session}` } });
    expect(sessionCheck.status).toBe(200);
    expect(await sessionCheck.json()).toMatchObject({ actor: { userId: firstAccount.userId, displayName: "资料用户（已更新）", email: "profile-updated@example.com", phone: "13900139003" } });
    expect(firstAccount.organizationId).toBeTruthy();
  });

  it("creates notifications and supports read state management", async () => {
    const app = createApp({ database });
    const captcha = await captchaFor(app);
    const registration = await app.request("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        role: "user",
        userName: "通知用户",
        email: "notifications@example.com",
        password: "secret123",
        confirmPassword: "secret123",
        ...captcha,
      }),
    });
    expect(registration.status).toBe(201);
    const login = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier: "notifications@example.com", password: "secret123" }),
    });
    const session = (await login.json()).session as string;
    const authHeaders = { authorization: `Bearer ${session}` };

    const listed = await app.request("/api/me/notifications", { headers: authHeaders });
    expect(listed.status).toBe(200);
    const listedPayload = await listed.json();
    expect(listedPayload.unreadCount).toBe(1);
    expect(listedPayload.notifications[0]).toMatchObject({ type: "account", title: "欢迎加入创投智联", readAt: null });

    const notificationId = listedPayload.notifications[0].id as string;
    const marked = await app.request(`/api/me/notifications/${notificationId}/read`, { method: "POST", headers: authHeaders });
    expect(marked.status).toBe(200);
    const afterRead = await app.request("/api/me/notifications", { headers: authHeaders });
    expect(await afterRead.json()).toMatchObject({ unreadCount: 0, notifications: [{ id: notificationId, readAt: expect.any(String) }] });

    const unauthorized = await app.request("/api/me/notifications");
    expect(unauthorized.status).toBe(401);
  });

  it("verifies email and resets password with one-time tokens", async () => {
    const app = createApp({ database });
    const captcha = await captchaFor(app);
    const registration = await app.request("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "user", userName: "安全用户", email: "security@example.com", password: "secret123", confirmPassword: "secret123", ...captcha }),
    });
    expect(registration.status).toBe(201);
    const login = await app.request("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: "security@example.com", password: "secret123" }) });
    const session = (await login.json()).session as string;
    const authHeaders = { authorization: `Bearer ${session}` };

    const verification = await app.request("/api/auth/email-verification/request", { method: "POST", headers: authHeaders });
    expect(verification.status).toBe(200);
    const verificationToken = (await verification.json()).previewToken as string;
    expect(verificationToken).toBeTruthy();
    const confirmed = await app.request("/api/auth/email-verification/confirm", { method: "POST", headers: { ...authHeaders, "content-type": "application/json" }, body: JSON.stringify({ token: verificationToken }) });
    expect(confirmed.status).toBe(200);
    expect((await confirmed.json()).status).toBe("verified");
    const reusedVerification = await app.request("/api/auth/email-verification/confirm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: verificationToken }) });
    expect(reusedVerification.status).toBe(400);

    const resetRequest = await app.request("/api/auth/password-reset/request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "security@example.com" }) });
    expect(resetRequest.status).toBe(200);
    const resetToken = (await resetRequest.json()).previewToken as string;
    const reset = await app.request("/api/auth/password-reset/confirm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: resetToken, newPassword: "newsecret456", confirmPassword: "newsecret456" }) });
    expect(reset.status).toBe(200);
    const oldLogin = await app.request("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: "security@example.com", password: "secret123" }) });
    expect(oldLogin.status).toBe(401);
    const newLogin = await app.request("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: "security@example.com", password: "newsecret456" }) });
    expect(newLogin.status).toBe(200);
  });

  it("delivers email flows through the configured webhook provider", async () => {
    const previousProvider = process.env.EMAIL_PROVIDER;
    const previousUrl = process.env.EMAIL_WEBHOOK_URL;
    const previousToken = process.env.EMAIL_WEBHOOK_TOKEN;
    const previousFetch = globalThis.fetch;
    process.env.EMAIL_PROVIDER = "webhook";
    process.env.EMAIL_WEBHOOK_URL = "https://mail.test/send";
    process.env.EMAIL_WEBHOOK_TOKEN = "test-token";
    globalThis.fetch = (async (_input, init) => {
      expect(init?.method).toBe("POST");
      expect((init?.headers as Record<string, string>).authorization).toBe("Bearer test-token");
      return new Response(null, { status: 202 });
    }) as typeof fetch;
    try {
      const app = createApp({ database });
      const captcha = await captchaFor(app);
      const registration = await app.request("/api/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "user", userName: "邮件用户", email: "webhook@example.com", password: "secret123", confirmPassword: "secret123", ...captcha }) });
      expect(registration.status).toBe(201);
      const login = await app.request("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: "webhook@example.com", password: "secret123" }) });
      const session = (await login.json()).session as string;
      const verification = await app.request("/api/auth/email-verification/request", { method: "POST", headers: { authorization: `Bearer ${session}` } });
      expect(verification.status).toBe(200);
      expect((await verification.json()).previewToken).toBeUndefined();
    } finally {
      if (previousProvider === undefined) delete process.env.EMAIL_PROVIDER; else process.env.EMAIL_PROVIDER = previousProvider;
      if (previousUrl === undefined) delete process.env.EMAIL_WEBHOOK_URL; else process.env.EMAIL_WEBHOOK_URL = previousUrl;
      if (previousToken === undefined) delete process.env.EMAIL_WEBHOOK_TOKEN; else process.env.EMAIL_WEBHOOK_TOKEN = previousToken;
      globalThis.fetch = previousFetch;
    }
  });
});

describe("project submission flow", () => {
  it("submits a project, uploads BP, and publishes after admin review", async () => {
    const app = createApp({ database });
    const submission = await app.request("/api/projects", {
      method: "POST",
      headers: headers("user-owner", "org-project"),
      body: JSON.stringify({
        name: "测试产业项目",
        summary: "这是一个用于验证项目登记与审核流程的公开项目摘要，内容超过最小长度。",
        industry: "先进制造",
        region: "上海",
        stage: "A 轮",
        financingRange: "1000 万",
        identityMode: "named",
      }),
    });
    expect(submission.status).toBe(201);
    const project = (await submission.json()).project;
    expect(project).toMatchObject({ reviewStatus: "pending" });

    const form = new FormData();
    form.append("file", new Blob(["%PDF-test"], { type: "application/pdf" }), "测试项目BP.pdf");
    const upload = await app.request(`/api/projects/${project.id}/bp`, { method: "POST", headers: { "x-user-id": "user-owner", "x-organization-id": "org-project" }, body: form });
    expect(upload.status).toBe(201);

    const pending = await app.request("/api/admin/project-submissions", { headers: headers("user-admin", "org-platform") });
    expect(pending.status).toBe(200);
    expect((await pending.json()).projects).toEqual(expect.arrayContaining([expect.objectContaining({ id: project.id, reviewStatus: "pending", bpFileName: "测试项目BP.pdf" })]));

    const approved = await app.request(`/api/admin/project-submissions/${project.id}/decision`, { method: "POST", headers: headers("user-admin", "org-platform"), body: JSON.stringify({ status: "approved" }) });
    expect(approved.status).toBe(200);
    const publicProjects = await app.request("/api/projects");
    expect((await publicProjects.json()).projects).toEqual(expect.arrayContaining([expect.objectContaining({ id: project.id, name: "测试产业项目" })]));
  });
});

describe("identity publishing flow", () => {
  it("routes identity content through review and supports a rejected resubmission", async () => {
    const app = createApp({ database });
    const created = await app.request("/api/identity-submissions", {
      method: "POST",
      headers: headers("user-investor", "org-investor"),
      body: JSON.stringify({
        type: "investor_thesis",
        title: "关注先进制造和工业软件的早期方向",
        summary: "面向已有客户验证的先进制造与工业软件团队，提供早期资金和产业资源支持。",
        industry: "先进制造",
        region: "上海",
        stage: "天使至 A 轮",
        financingRange: "500 万至 3000 万",
        details: { primary: "关注真实交付和产业客户复购。" },
      }),
    });
    expect(created.status).toBe(201);
    const submission = (await created.json()).submission;
    expect(submission).toMatchObject({ type: "investor_thesis", status: "pending", version: 1 });

    const pending = await app.request("/api/admin/identity-submissions?status=pending", { headers: headers("user-admin", "org-platform") });
    expect(pending.status).toBe(200);
    expect((await pending.json()).submissions).toEqual(expect.arrayContaining([expect.objectContaining({ id: submission.id, ownerOrganizationName: "远景创投" })]));

    const rejected = await app.request(`/api/admin/identity-submissions/${submission.id}/decision`, {
      method: "POST",
      headers: headers("user-admin", "org-platform"),
      body: JSON.stringify({ status: "rejected", reason: "请补充可公开验证的客户交付信息。" }),
    });
    expect(rejected.status).toBe(200);
    expect((await rejected.json()).submission).toMatchObject({ status: "rejected", rejectionReason: "请补充可公开验证的客户交付信息。", version: 1 });

    const resubmitted = await app.request(`/api/identity-submissions/${submission.id}`, {
      method: "PATCH",
      headers: headers("user-investor", "org-investor"),
      body: JSON.stringify({
        title: "关注先进制造和工业软件的早期方向",
        summary: "面向已有客户验证的先进制造与工业软件团队，提供早期资金和产业资源支持，并关注交付复购。",
        industry: "先进制造",
        region: "上海",
        stage: "天使至 A 轮",
        financingRange: "500 万至 3000 万",
        details: { primary: "已补充客户交付与复购验证。" },
        status: "pending",
      }),
    });
    expect(resubmitted.status).toBe(200);
    expect((await resubmitted.json()).submission).toMatchObject({ status: "pending", version: 2 });

    const approved = await app.request(`/api/admin/identity-submissions/${submission.id}/decision`, {
      method: "POST",
      headers: headers("user-admin", "org-platform"),
      body: JSON.stringify({ status: "approved" }),
    });
    expect(approved.status).toBe(200);
    expect((await approved.json()).submission).toMatchObject({ status: "approved", version: 2 });
  });
});

describe("matching and favorites", () => {
  it("tracks contact follow-ups and keeps favorites private per user", async () => {
    const app = createApp({ database });
    const created = await app.request("/api/contact-requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "对接测试", phone: "13800138000", organization: "测试机构", targetRegion: "上海", need: "希望对接先进制造园区和产业基金资源。" }),
    });
    expect(created.status).toBe(201);
    const requestId = (await created.json()).request.id;
    const updated = await app.request(`/api/admin/contact-requests/${requestId}`, { method: "PATCH", headers: headers("user-admin", "org-platform"), body: JSON.stringify({ status: "progressing", note: "已分配上海联系人，等待首次会议。" }) });
    expect(updated.status).toBe(200);
    const updates = await app.request(`/api/admin/contact-requests/${requestId}/updates`, { headers: headers("user-admin", "org-platform") });
    expect((await updates.json()).updates).toMatchObject([{ status: "progressing", note: "已分配上海联系人，等待首次会议。" }]);

    const addProject = await app.request("/api/me/favorites", { method: "POST", headers: headers("user-owner", "org-project"), body: JSON.stringify({ resourceType: "project", resourceId: "project-robotics" }) });
    expect(addProject.status).toBe(201);
    const addArticle = await app.request("/api/me/favorites", { method: "POST", headers: headers("user-owner", "org-project"), body: JSON.stringify({ resourceType: "article", resourceId: "article-1" }) });
    expect(addArticle.status).toBe(201);
    const favorites = await app.request("/api/me/favorites", { headers: headers("user-owner", "org-project") });
    expect((await favorites.json()).favorites).toEqual(expect.arrayContaining([expect.objectContaining({ resourceType: "project", resourceId: "project-robotics" }), expect.objectContaining({ resourceType: "article", resourceId: "article-1" })]));
    const removed = await app.request("/api/me/favorites/project/project-robotics", { method: "DELETE", headers: headers("user-owner", "org-project") });
    expect(removed.status).toBe(200);
    const viewed = await app.request("/api/me/recent-views", { method: "POST", headers: headers("user-owner", "org-project"), body: JSON.stringify({ resourceType: "project", resourceId: "project-robotics" }) });
    expect(viewed.status).toBe(201);
    const recent = await app.request("/api/me/recent-views", { headers: headers("user-owner", "org-project") });
    expect((await recent.json()).views).toMatchObject([{ resourceType: "project", resourceId: "project-robotics" }]);

    const bpRequest = await app.request("/api/projects/project-robotics/bp-requests", { method: "POST", headers: headers("user-investor", "org-investor"), body: JSON.stringify({ purpose: "评估项目产业协同和投资可行性。" }) });
    expect(bpRequest.status).toBe(201);
    const myBpRequests = await app.request("/api/me/bp-requests", { headers: headers("user-investor", "org-investor") });
    expect((await myBpRequests.json()).requests).toMatchObject([{ projectId: "project-robotics", status: "pending" }]);
    const incoming = await app.request("/api/me/incoming-bp-requests", { headers: headers("user-owner", "org-project") });
    const incomingPayload = await incoming.json();
    expect(incomingPayload.requests).toMatchObject([{ projectId: "project-robotics", requesterOrganizationName: "远景创投" }]);
    const decision = await app.request(`/api/bp-requests/${incomingPayload.requests[0].id}/decision`, { method: "POST", headers: headers("user-owner", "org-project"), body: JSON.stringify({ decision: "approved", expiresAt: new Date(Date.now() + 86400000).toISOString(), allowDownload: false }) });
    expect(decision.status).toBe(200);

    const ownContact = await app.request("/api/contact-requests", { method: "POST", headers: headers("user-owner", "org-project"), body: JSON.stringify({ name: "项目负责人", phone: "13800138000", organization: "云拓机器人", targetRegion: "上海", need: "希望对接产业园区和政府招商联系人。" }) });
    expect(ownContact.status).toBe(201);
    const ownContacts = await app.request("/api/me/contact-requests", { headers: headers("user-owner", "org-project") });
    expect((await ownContacts.json()).requests).toEqual(expect.arrayContaining([expect.objectContaining({ organization: "云拓机器人", status: "new" })]));
  });
});
