import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type {
  ActorContext,
  BpGrant,
  OrganizationRole,
  OrganizationType,
  ProjectResource,
} from "@venture/domain";

export type VentureDatabase = DatabaseSync;

export interface ProjectRecord extends ProjectResource {
  name: string;
  summary: string;
  industry: string;
  region: string;
  stage: string;
  financingRange: string;
  published: boolean;
  identityMode: "named" | "anonymous";
  anonymousName: string | null;
}

export interface ProjectSubmissionRecord extends ProjectRecord {
  reviewStatus: "pending" | "approved" | "rejected";
  ownerOrganizationName: string;
  bpFileName: string | null;
}

export interface PublicProjectRecord {
  id: string;
  name: string;
  summary: string;
  industry: string;
  region: string;
  stage: string;
  financingRange: string;
  identityMode: "named" | "anonymous";
}

export interface ContactRequestRecord {
  id: string;
  requesterUserId?: string | null;
  contactId: string | null;
  targetRegion: string | null;
  name: string;
  phone: string;
  organization: string;
  need: string;
  status: "new" | "contacted" | "progressing" | "completed" | "closed";
  createdAt: string;
  updates?: ContactRequestUpdateRecord[];
}

export interface ContactRequestUpdateRecord {
  id: string;
  requestId: string;
  status: ContactRequestRecord["status"];
  note: string;
  actorUserId: string;
  createdAt: string;
}

export type FavoriteResourceType = "project" | "organization" | "article";

export interface FavoriteRecord {
  resourceType: FavoriteResourceType;
  resourceId: string;
  createdAt: string;
}

export interface RecentViewRecord {
  resourceType: FavoriteResourceType;
  resourceId: string;
  viewedAt: string;
}

export type NotificationType = "system" | "account" | "project" | "bp" | "contact";

export interface NotificationRecord {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  resourceType: string | null;
  resourceId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface AuthAccountRecord {
  userId: string;
  email: string | null;
  phone: string | null;
  supabaseUserId: string | null;
  passwordHash: string;
  role: OrganizationType;
  status: "pending" | "active" | "rejected" | "suspended";
  createdAt: string;
  organizationId: string;
  emailVerifiedAt: string | null;
}

export interface ArticleRecord {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  status: "draft" | "published" | "archived";
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface BpFileRecord {
  id: string;
  projectId: string;
  version: number;
  fileName: string;
  storageKey: string;
}

export interface BpAccessRequestRecord {
  id: string;
  bpFileId: string;
  projectId: string;
  requesterOrganizationId: string;
  requesterOrganizationVerified: boolean;
  requesterUserId: string;
  purpose: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export type IdentitySubmissionType = "investor_thesis" | "fa_recommendation" | "government_demand";
export type IdentitySubmissionStatus = "draft" | "pending" | "approved" | "rejected" | "archived";

export interface IdentitySubmissionRecord {
  id: string;
  type: IdentitySubmissionType;
  ownerUserId: string;
  ownerOrganizationId: string;
  ownerOrganizationName: string;
  title: string;
  summary: string;
  industry: string;
  region: string;
  stage: string | null;
  financingRange: string | null;
  details: Record<string, string>;
  status: IdentitySubmissionStatus;
  version: number;
  rejectionReason: string | null;
  submittedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function createSchema(database: VentureDatabase) {
  database.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      verified INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS auth_accounts (
      user_id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      phone TEXT UNIQUE,
      supabase_user_id TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      email_verified_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS memberships (
      user_id TEXT NOT NULL,
      organization_id TEXT NOT NULL,
      roles_json TEXT NOT NULL,
      PRIMARY KEY (user_id, organization_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (organization_id) REFERENCES organizations(id)
    );
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      owner_organization_id TEXT NOT NULL,
      name TEXT NOT NULL,
      summary TEXT NOT NULL,
      industry TEXT NOT NULL,
      region TEXT NOT NULL,
      stage TEXT NOT NULL,
      financing_range TEXT NOT NULL,
      published INTEGER NOT NULL DEFAULT 0,
      review_status TEXT NOT NULL DEFAULT 'approved',
      identity_mode TEXT NOT NULL DEFAULT 'named',
      anonymous_name TEXT,
      FOREIGN KEY (owner_organization_id) REFERENCES organizations(id)
    );
    CREATE TABLE IF NOT EXISTS project_fa_delegations (
      project_id TEXT NOT NULL,
      fa_organization_id TEXT NOT NULL,
      can_manage_bp INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (project_id, fa_organization_id),
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (fa_organization_id) REFERENCES organizations(id)
    );
    CREATE TABLE IF NOT EXISTS bp_files (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      file_name TEXT NOT NULL,
      storage_key TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );
    CREATE TABLE IF NOT EXISTS bp_access_requests (
      id TEXT PRIMARY KEY,
      bp_file_id TEXT NOT NULL,
      requester_organization_id TEXT NOT NULL,
      requester_user_id TEXT NOT NULL,
      purpose TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      decided_at TEXT,
      decided_by_user_id TEXT,
      FOREIGN KEY (bp_file_id) REFERENCES bp_files(id),
      FOREIGN KEY (requester_organization_id) REFERENCES organizations(id),
      FOREIGN KEY (requester_user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS bp_grants (
      id TEXT PRIMARY KEY,
      bp_file_id TEXT NOT NULL,
      grantee_organization_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      allow_download INTEGER NOT NULL DEFAULT 0,
      revoked_at TEXT,
      created_at TEXT NOT NULL,
      created_by_user_id TEXT NOT NULL,
      FOREIGN KEY (bp_file_id) REFERENCES bp_files(id),
      FOREIGN KEY (grantee_organization_id) REFERENCES organizations(id)
    );
    CREATE TABLE IF NOT EXISTS government_contacts (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      organization_name TEXT NOT NULL,
      name TEXT NOT NULL,
      title TEXT NOT NULL,
      region TEXT NOT NULL,
      industries TEXT NOT NULL,
      verified INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (organization_id) REFERENCES organizations(id)
    );
    CREATE TABLE IF NOT EXISTS review_tasks (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      status TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT NOT NULL,
      actor_organization_id TEXT NOT NULL,
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      metadata_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS organization_profiles (
      organization_id TEXT PRIMARY KEY,
      tagline TEXT NOT NULL,
      description TEXT NOT NULL,
      region TEXT NOT NULL,
      focus TEXT NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id)
    );
    CREATE TABLE IF NOT EXISTS contact_requests (
      id TEXT PRIMARY KEY,
      requester_user_id TEXT,
      contact_id TEXT,
      target_region TEXT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      organization TEXT NOT NULL,
      need TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TEXT NOT NULL,
      FOREIGN KEY (contact_id) REFERENCES government_contacts(id)
    );
    CREATE TABLE IF NOT EXISTS contact_request_updates (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      status TEXT NOT NULL,
      note TEXT NOT NULL,
      actor_user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (request_id) REFERENCES contact_requests(id)
    );
    CREATE TABLE IF NOT EXISTS user_favorites (
      user_id TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, resource_type, resource_id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS recent_views (
      user_id TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      viewed_at TEXT NOT NULL,
      PRIMARY KEY (user_id, resource_type, resource_id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      resource_type TEXT,
      resource_id TEXT,
      read_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS auth_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      purpose TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      consumed_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id TEXT PRIMARY KEY,
      token_hash TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL,
      organization_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (organization_id) REFERENCES organizations(id)
    );
    CREATE TABLE IF NOT EXISTS captcha_challenges (
      id TEXT PRIMARY KEY,
      code_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      consumed_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS articles (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      published_at TEXT
    );
    CREATE TABLE IF NOT EXISTS identity_submissions (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT NOT NULL,
      owner_organization_id TEXT NOT NULL,
      identity_type TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      industry TEXT NOT NULL,
      region TEXT NOT NULL,
      stage TEXT,
      financing_range TEXT,
      detail_json TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'draft',
      current_version INTEGER NOT NULL DEFAULT 1,
      rejection_reason TEXT,
      submitted_at TEXT,
      published_at TEXT,
      archived_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (owner_user_id) REFERENCES users(id),
      FOREIGN KEY (owner_organization_id) REFERENCES organizations(id)
    );
    CREATE TABLE IF NOT EXISTS identity_submission_revisions (
      id TEXT PRIMARY KEY,
      submission_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL,
      rejection_reason TEXT,
      created_by_user_id TEXT NOT NULL,
      reviewed_by_user_id TEXT,
      created_at TEXT NOT NULL,
      reviewed_at TEXT,
      UNIQUE (submission_id, version),
      FOREIGN KEY (submission_id) REFERENCES identity_submissions(id),
      FOREIGN KEY (created_by_user_id) REFERENCES users(id),
      FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS identity_submissions_owner_idx ON identity_submissions (owner_organization_id, owner_user_id);
    CREATE INDEX IF NOT EXISTS identity_submissions_review_idx ON identity_submissions (status, identity_type, created_at);
    CREATE INDEX IF NOT EXISTS identity_submission_revisions_submission_idx ON identity_submission_revisions (submission_id, version);
    CREATE UNIQUE INDEX IF NOT EXISTS auth_accounts_supabase_user_idx ON auth_accounts (supabase_user_id);
  `);

  const projectColumns = database.prepare("PRAGMA table_info(projects)").all() as Array<{ name: string }>;
  if (!projectColumns.some((column) => column.name === "identity_mode")) {
    database.exec("ALTER TABLE projects ADD COLUMN identity_mode TEXT NOT NULL DEFAULT 'named'");
  }
  if (!projectColumns.some((column) => column.name === "anonymous_name")) {
    database.exec("ALTER TABLE projects ADD COLUMN anonymous_name TEXT");
  }
  if (!projectColumns.some((column) => column.name === "review_status")) {
    database.exec("ALTER TABLE projects ADD COLUMN review_status TEXT NOT NULL DEFAULT 'approved'");
  }
  const contactColumns = database.prepare("PRAGMA table_info(contact_requests)").all() as Array<{ name: string }>;
  if (!contactColumns.some((column) => column.name === "requester_user_id")) {
    database.exec("ALTER TABLE contact_requests ADD COLUMN requester_user_id TEXT");
  }
  const authColumns = database.prepare("PRAGMA table_info(auth_accounts)").all() as Array<{ name: string }>;
  if (!authColumns.some((column) => column.name === "supabase_user_id")) {
    database.exec("ALTER TABLE auth_accounts ADD COLUMN supabase_user_id TEXT");
    database.exec("CREATE UNIQUE INDEX IF NOT EXISTS auth_accounts_supabase_user_idx ON auth_accounts (supabase_user_id)");
  }
  if (!authColumns.some((column) => column.name === "email_verified_at")) {
    database.exec("ALTER TABLE auth_accounts ADD COLUMN email_verified_at TEXT");
  }
}

export function createDatabase(filename: string): VentureDatabase {
  if (filename !== ":memory:") {
    mkdirSync(dirname(filename), { recursive: true });
  }
  const database = new DatabaseSync(filename);
  createSchema(database);
  return database;
}

function seedPublicContent(database: VentureDatabase) {
  database
    .prepare("UPDATE projects SET identity_mode = 'anonymous', anonymous_name = ? WHERE id = ?")
    .run("苏州某新能源材料项目", "project-energy");

  const profiles = [
    ["org-investor", "关注长期价值与产业升级", "聚焦科技创新与先进制造的专业投资机构。", "北京", "人工智能,先进制造,新能源"],
    ["org-fa", "连接优质项目与耐心资本", "为成长期项目提供融资顾问、产业资源与交易支持。", "上海", "企业服务,先进制造,消费科技"],
    ["org-government", "链接产业、空间与政策资源", "面向重点产业提供选址落地、政策咨询和生态对接服务。", "上海·临港", "人工智能,机器人,先进制造"],
  ] as const;
  const insertProfile = database.prepare(`
    INSERT OR IGNORE INTO organization_profiles
      (organization_id, tagline, description, region, focus)
    VALUES (?, ?, ?, ?, ?)
  `);
  profiles.forEach((profile) => insertProfile.run(...profile));

  const now = new Date().toISOString();
  const articles = [
    ["article-1", "industrial-capital-2026", "产业资本正在关注什么？", "从具身智能到新材料，梳理产业资本的重点关注方向。", "一级市场正在从单纯追逐热点转向验证产业协同、量产能力与现金流质量。平台建议项目方在融资材料中清晰呈现客户验证、交付路径与产能规划。", "市场观察", "published", now, now, now],
    ["article-2", "government-investment-guide", "政府招商对接前的五项准备", "项目团队与地方政府沟通前，应先准备哪些关键信息。", "建议提前准备项目主体情况、核心团队、知识产权、产能与空间需求、未来三年经营预测，并明确希望获得的政策与产业协同支持。", "招商指南", "published", now, now, now],
    ["article-3", "bp-security-guide", "BP 安全流转指南", "通过授权、有效期和水印降低商业计划书传播风险。", "BP 应按需授权，设置访问有效期并保留访问审计。敏感项目可以采用匿名摘要进行初步筛选，在确认对方身份和意向后再开放完整材料。", "平台指南", "draft", now, now, null],
  ] as const;
  const insertArticle = database.prepare(`
    INSERT OR IGNORE INTO articles
      (id, slug, title, summary, content, category, status, created_at, updated_at, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  articles.forEach((article) => insertArticle.run(...article));
}

export function seedDatabase(database: VentureDatabase) {
  const row = database.prepare("SELECT COUNT(*) AS count FROM organizations").get() as { count: number };
  if (row.count > 0) {
    seedPublicContent(database);
    return;
  }

  const organizations = [
    ["org-platform", "创投智联平台", "platform", 1],
    ["org-project", "云拓机器人", "project", 1],
    ["org-investor", "远景创投", "investor", 1],
    ["org-fa", "启航资本顾问", "fa", 1],
    ["org-government", "上海临港招商中心", "government", 1],
    ["org-unverified", "待核验投资人", "investor", 0],
  ] as const;
  const insertOrganization = database.prepare(
    "INSERT INTO organizations (id, name, type, verified) VALUES (?, ?, ?, ?)",
  );
  organizations.forEach((organization) => insertOrganization.run(...organization));

  const users = [
    ["user-admin", "平台管理员"],
    ["user-owner", "项目负责人"],
    ["user-investor", "投资经理"],
    ["user-fa", "FA项目经理"],
    ["user-government", "招商主管"],
    ["user-unverified", "待核验用户"],
  ] as const;
  const insertUser = database.prepare("INSERT INTO users (id, name) VALUES (?, ?)");
  users.forEach((user) => insertUser.run(...user));

  const memberships = [
    ["user-admin", "org-platform", ["platform_admin"]],
    ["user-owner", "org-project", ["org_admin", "project_manager"]],
    ["user-investor", "org-investor", ["member"]],
    ["user-fa", "org-fa", ["project_manager"]],
    ["user-government", "org-government", ["member"]],
    ["user-unverified", "org-unverified", ["member"]],
  ] as const;
  const insertMembership = database.prepare(
    "INSERT INTO memberships (user_id, organization_id, roles_json) VALUES (?, ?, ?)",
  );
  memberships.forEach(([userId, organizationId, roles]) =>
    insertMembership.run(userId, organizationId, JSON.stringify(roles)),
  );

  const projects = [
    [
      "project-robotics",
      "org-project",
      "工业具身智能平台",
      "柔性执行器与场景数据闭环，面向先进制造提供可量产机器人方案。",
      "人工智能 / 机器人",
      "上海",
      "A轮",
      "3000–5000万",
      1,
    ],
    [
      "project-energy",
      "org-project",
      "新能源材料项目",
      "高安全固态电解质材料及中试工艺。",
      "新能源",
      "苏州",
      "Pre-A轮",
      "1500–3000万",
      1,
    ],
    [
      "project-medical",
      "org-project",
      "医疗器械国产替代",
      "微创介入耗材国产化与临床渠道平台。",
      "生物医药",
      "杭州",
      "天使轮",
      "800–1500万",
      1,
    ],
  ] as const;
  const insertProject = database.prepare(`
    INSERT INTO projects
      (id, owner_organization_id, name, summary, industry, region, stage, financing_range, published)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  projects.forEach((project) => insertProject.run(...project));
  database
    .prepare(
      "INSERT INTO project_fa_delegations (project_id, fa_organization_id, can_manage_bp) VALUES (?, ?, ?)",
    )
    .run("project-robotics", "org-fa", 0);
  database
    .prepare(
      "INSERT INTO bp_files (id, project_id, version, file_name, storage_key) VALUES (?, ?, ?, ?, ?)",
    )
    .run("bp-robotics", "project-robotics", 1, "工业具身智能平台-BP-V1.pdf", "private/bp-robotics-v1.pdf");

  const contacts = [
    ["gov-contact-1", "org-government", "上海临港招商中心", "张老师", "产业招商经理", "上海·临港", "人工智能,机器人", 1],
    ["gov-contact-2", "org-government", "苏州高新区", "李老师", "先进制造招商主管", "江苏·苏州", "先进制造,新能源", 1],
    ["gov-contact-3", "org-government", "杭州未来科技城", "王老师", "数字经济招商主管", "浙江·杭州", "数字经济,人工智能", 1],
    ["gov-contact-4", "org-government", "合肥高新区", "赵老师", "新能源招商主管", "安徽·合肥", "新能源,先进制造", 1],
  ] as const;
  const insertContact = database.prepare(`
    INSERT INTO government_contacts
      (id, organization_id, organization_name, name, title, region, industries, verified)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  contacts.forEach((contact) => insertContact.run(...contact));

  const insertReview = database.prepare(
    "INSERT INTO review_tasks (id, type, subject_id, status) VALUES (?, ?, ?, 'pending')",
  );
  insertReview.run("review-1", "organization", "org-unverified");
  insertReview.run("review-2", "project", "project-energy");
  seedPublicContent(database);
}

export function createAuthAccount(
  database: VentureDatabase,
  input: {
    requesterUserId?: string;
    email?: string;
    phone?: string;
    supabaseUserId?: string;
    passwordHash: string;
    role: OrganizationType;
    organizationName: string;
    contactName: string;
    status?: "pending" | "active";
  },
) {
  const email = input.email?.trim().toLowerCase() || null;
  const phone = input.phone?.trim() || null;
  const existing = database.prepare("SELECT user_id AS userId FROM auth_accounts WHERE (email IS NOT NULL AND email = ?) OR (phone IS NOT NULL AND phone = ?)").get(email, phone) as { userId: string } | undefined;
  if (existing) return { error: "identifier_taken" as const };
  const userId = randomUUID();
  const organizationId = randomUUID();
  const createdAt = new Date().toISOString();
  const roles: OrganizationRole[] = input.role === "project" ? ["org_admin", "project_manager"] : input.role === "user" ? ["member", "viewer"] : ["org_admin", "member"];
  const status = input.status ?? "pending";
  database.exec("BEGIN");
  try {
    database.prepare("INSERT INTO organizations (id, name, type, verified) VALUES (?, ?, ?, 0)").run(organizationId, input.organizationName.trim(), input.role);
    database.prepare("INSERT INTO users (id, name) VALUES (?, ?)").run(userId, input.contactName.trim());
    database.prepare("INSERT INTO memberships (user_id, organization_id, roles_json) VALUES (?, ?, ?)").run(userId, organizationId, JSON.stringify(roles));
    database.prepare("INSERT INTO auth_accounts (user_id, email, phone, supabase_user_id, password_hash, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(userId, email, phone, input.supabaseUserId ?? null, input.passwordHash, input.role, status, createdAt);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  return { account: { userId, organizationId, role: input.role, status, createdAt } };
}

export function findAuthAccount(database: VentureDatabase, identifier: string) {
  const normalized = identifier.trim().toLowerCase();
  const row = database.prepare(`
    SELECT a.user_id AS userId, a.email, a.phone, a.supabase_user_id AS supabaseUserId, a.password_hash AS passwordHash,
           a.role, a.status, a.created_at AS createdAt, a.email_verified_at AS emailVerifiedAt,
           m.organization_id AS organizationId
    FROM auth_accounts a JOIN memberships m ON m.user_id = a.user_id
    WHERE (a.email IS NOT NULL AND a.email = ?) OR (a.phone IS NOT NULL AND a.phone = ?)
    LIMIT 1
  `).get(normalized, identifier.trim()) as AuthAccountRecord | undefined;
  return row ?? null;
}

export function getAuthAccountByUserId(database: VentureDatabase, userId: string) {
  const row = database.prepare(`
    SELECT a.user_id AS userId, a.email, a.phone, a.supabase_user_id AS supabaseUserId, a.password_hash AS passwordHash,
           a.role, a.status, a.created_at AS createdAt, a.email_verified_at AS emailVerifiedAt,
           m.organization_id AS organizationId
    FROM auth_accounts a JOIN memberships m ON m.user_id = a.user_id
    WHERE a.user_id = ? LIMIT 1
  `).get(userId) as AuthAccountRecord | undefined;
  return row ?? null;
}

export function getAuthAccountBySupabaseUserId(database: VentureDatabase, supabaseUserId: string) {
  const row = database.prepare(`
    SELECT a.user_id AS userId, a.email, a.phone, a.supabase_user_id AS supabaseUserId, a.password_hash AS passwordHash,
           a.role, a.status, a.created_at AS createdAt, a.email_verified_at AS emailVerifiedAt,
           m.organization_id AS organizationId
    FROM auth_accounts a JOIN memberships m ON m.user_id = a.user_id
    WHERE a.supabase_user_id = ? LIMIT 1
  `).get(supabaseUserId) as AuthAccountRecord | undefined;
  return row ?? null;
}

export function linkSupabaseUser(database: VentureDatabase, userId: string, supabaseUserId: string) {
  const result = database.prepare("UPDATE auth_accounts SET supabase_user_id = ?, email_verified_at = COALESCE(email_verified_at, ?) WHERE user_id = ? AND supabase_user_id IS NULL").run(supabaseUserId, new Date().toISOString(), userId);
  return result.changes > 0;
}

export function updateAuthPassword(database: VentureDatabase, userId: string, passwordHash: string) {
  const result = database.prepare("UPDATE auth_accounts SET password_hash = ? WHERE user_id = ?").run(passwordHash, userId);
  return result.changes > 0;
}

export function updateAuthProfile(database: VentureDatabase, userId: string, input: { displayName: string; email?: string; phone?: string }) {
  const email = input.email?.trim().toLowerCase() || null;
  const phone = input.phone?.trim() || null;
  const duplicate = database.prepare("SELECT user_id AS userId FROM auth_accounts WHERE user_id <> ? AND ((email IS NOT NULL AND email = ?) OR (phone IS NOT NULL AND phone = ?)) LIMIT 1").get(userId, email, phone) as { userId: string } | undefined;
  if (duplicate) return { error: "identifier_taken" as const };
  database.exec("BEGIN");
  try {
    database.prepare("UPDATE users SET name = ? WHERE id = ?").run(input.displayName.trim(), userId);
    database.prepare("UPDATE auth_accounts SET email = ?, phone = ? WHERE user_id = ?").run(email, phone, userId);
    database.exec("COMMIT");
  } catch (error) { database.exec("ROLLBACK"); throw error; }
  return { profile: { displayName: input.displayName.trim(), email, phone } };
}

export type AuthTokenPurpose = "email_verification" | "password_reset";

function hashAuthToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function issueAuthToken(database: VentureDatabase, userId: string, purpose: AuthTokenPurpose, ttlMs = 30 * 60 * 1000) {
  const token = randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "");
  const now = new Date();
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + ttlMs).toISOString();
  database.prepare("UPDATE auth_tokens SET consumed_at = ? WHERE user_id = ? AND purpose = ? AND consumed_at IS NULL").run(createdAt, userId, purpose);
  database.prepare("INSERT INTO auth_tokens (id, user_id, purpose, token_hash, expires_at, consumed_at, created_at) VALUES (?, ?, ?, ?, ?, NULL, ?)").run(randomUUID(), userId, purpose, hashAuthToken(token), expiresAt, createdAt);
  return { token, expiresAt };
}

export function consumeAuthToken(database: VentureDatabase, token: string, purpose: AuthTokenPurpose) {
  const row = database.prepare("SELECT id, user_id AS userId, expires_at AS expiresAt, consumed_at AS consumedAt FROM auth_tokens WHERE token_hash = ? AND purpose = ?").get(hashAuthToken(token.trim()), purpose) as { id: string; userId: string; expiresAt: string; consumedAt: string | null } | undefined;
  if (!row || row.consumedAt || new Date(row.expiresAt).getTime() <= Date.now()) return null;
  const consumedAt = new Date().toISOString();
  const updated = database.prepare("UPDATE auth_tokens SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL").run(consumedAt, row.id);
  return updated.changes ? { userId: row.userId, consumedAt } : null;
}

export function markEmailVerified(database: VentureDatabase, userId: string) {
  const verifiedAt = new Date().toISOString();
  database.prepare("UPDATE auth_accounts SET email_verified_at = ? WHERE user_id = ? AND email IS NOT NULL").run(verifiedAt, userId);
  return verifiedAt;
}

export function approveAuthAccount(database: VentureDatabase, userId: string) {
  const result = database.prepare("UPDATE auth_accounts SET status = 'active' WHERE user_id = ? AND status = 'pending'").run(userId);
  return result.changes > 0;
}

export function updateAuthAccountStatus(
  database: VentureDatabase,
  userId: string,
  status: AuthAccountRecord["status"],
) {
  const result = database
    .prepare("UPDATE auth_accounts SET status = ? WHERE user_id = ? AND status <> ?")
    .run(status, userId, status);
  return result.changes > 0;
}

export function listAuthAccounts(database: VentureDatabase, status?: AuthAccountRecord["status"]) {
  const query = `
    SELECT a.user_id AS userId, a.email, a.phone, a.role, a.status, a.created_at AS createdAt,
           m.organization_id AS organizationId, o.name AS organizationName, u.name AS contactName
    FROM auth_accounts a
    JOIN memberships m ON m.user_id = a.user_id
    JOIN organizations o ON o.id = m.organization_id
    JOIN users u ON u.id = a.user_id
    ${status ? "WHERE a.status = ?" : ""}
    ORDER BY a.created_at DESC
  `;
  return (status ? database.prepare(query).all(status) : database.prepare(query).all()) as Array<Record<string, unknown>>;
}

export function resolveActor(
  database: VentureDatabase,
  userId: string | undefined,
  organizationId: string | undefined,
): ActorContext | null {
  if (!userId || !organizationId) return null;
  const row = database
    .prepare(`
      SELECT o.type, o.verified, o.name AS organization_name,
             u.name AS display_name, a.email, a.phone, a.created_at, a.email_verified_at,
             m.roles_json
      FROM memberships m
      JOIN organizations o ON o.id = m.organization_id
      LEFT JOIN users u ON u.id = m.user_id
      LEFT JOIN auth_accounts a ON a.user_id = m.user_id
      WHERE m.user_id = ? AND m.organization_id = ?
    `)
    .get(userId, organizationId) as
    | { type: OrganizationType; verified: number; organization_name: string; display_name: string | null; email: string | null; phone: string | null; created_at: string | null; email_verified_at: string | null; roles_json: string }
    | undefined;
  if (!row) return null;
  return {
    userId,
    organizationId,
    organizationType: row.type,
    organizationVerified: Boolean(row.verified),
    roles: JSON.parse(row.roles_json) as OrganizationRole[],
    displayName: row.display_name ?? undefined,
    organizationName: row.organization_name,
    email: row.email,
    phone: row.phone,
    emailVerifiedAt: row.email_verified_at,
    createdAt: row.created_at ?? undefined,
  };
}

function toPublicProject(row: {
  id: string;
  realName: string;
  anonymousName: string | null;
  identityMode: "named" | "anonymous";
  summary: string;
  industry: string;
  region: string;
  stage: string;
  financingRange: string;
}): PublicProjectRecord {
  return {
    id: row.id,
    name: row.identityMode === "anonymous" ? (row.anonymousName ?? "某优质项目") : row.realName,
    summary: row.summary,
    industry: row.industry,
    region: row.region,
    stage: row.stage,
    financingRange: row.financingRange,
    identityMode: row.identityMode,
  };
}

export function listPublishedProjects(
  database: VentureDatabase,
  filters: { q?: string; industry?: string; region?: string; stage?: string } = {},
) {
  const rows = database
    .prepare(`
      SELECT id, name AS realName, anonymous_name AS anonymousName,
             identity_mode AS identityMode, summary, industry, region, stage,
             financing_range AS financingRange
      FROM projects WHERE published = 1 AND review_status = 'approved' ORDER BY name
    `)
    .all() as Array<Parameters<typeof toPublicProject>[0]>;
  const q = filters.q?.trim().toLocaleLowerCase();
  return rows
    .map(toPublicProject)
    .filter((project) => !filters.industry || project.industry.includes(filters.industry))
    .filter((project) => !filters.region || project.region.includes(filters.region))
    .filter((project) => !filters.stage || project.stage === filters.stage)
    .filter((project) => !q || [project.name, project.summary, project.industry, project.region].some((value) => value.toLocaleLowerCase().includes(q)));
}

export function getPublicProject(database: VentureDatabase, projectId: string): PublicProjectRecord | null {
  const row = database
    .prepare(`
      SELECT id, name AS realName, anonymous_name AS anonymousName,
             identity_mode AS identityMode, summary, industry, region, stage,
             financing_range AS financingRange
      FROM projects WHERE id = ? AND published = 1 AND review_status = 'approved'
    `)
    .get(projectId) as Parameters<typeof toPublicProject>[0] | undefined;
  return row ? toPublicProject(row) : null;
}

export function getProject(database: VentureDatabase, projectId: string): ProjectRecord | null {
  const row = database
    .prepare(`
      SELECT id, owner_organization_id AS ownerOrganizationId, name, summary, industry,
             region, stage, financing_range AS financingRange, published,
             identity_mode AS identityMode, anonymous_name AS anonymousName
      FROM projects WHERE id = ?
    `)
    .get(projectId) as (Omit<ProjectRecord, "delegatedFaOrganizationIds" | "published"> & { published: number }) | undefined;
  if (!row) return null;
  const delegations = database
    .prepare("SELECT fa_organization_id AS organizationId FROM project_fa_delegations WHERE project_id = ?")
    .all(projectId) as Array<{ organizationId: string }>;
  return {
    ...row,
    published: Boolean(row.published),
    delegatedFaOrganizationIds: delegations.map((delegation) => delegation.organizationId),
  };
}

export function createProjectSubmission(
  database: VentureDatabase,
  input: {
    ownerOrganizationId: string;
    name: string;
    summary: string;
    industry: string;
    region: string;
    stage: string;
    financingRange: string;
    identityMode?: "named" | "anonymous";
    anonymousName?: string;
  },
) {
  const id = `project-${randomUUID()}`;
  database.prepare(`
    INSERT INTO projects
      (id, owner_organization_id, name, summary, industry, region, stage, financing_range, published, review_status, identity_mode, anonymous_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'pending', ?, ?)
  `).run(
    id,
    input.ownerOrganizationId,
    input.name.trim(),
    input.summary.trim(),
    input.industry.trim(),
    input.region.trim(),
    input.stage.trim(),
    input.financingRange.trim(),
    input.identityMode ?? "named",
    input.anonymousName?.trim() || null,
  );
  return getProjectSubmission(database, id);
}

export function getProjectSubmission(database: VentureDatabase, projectId: string): ProjectSubmissionRecord | null {
  const row = database.prepare(`
    SELECT p.id, p.owner_organization_id AS ownerOrganizationId, p.name, p.summary,
           p.industry, p.region, p.stage, p.financing_range AS financingRange,
           p.published, p.review_status AS reviewStatus, p.identity_mode AS identityMode,
           p.anonymous_name AS anonymousName, o.name AS ownerOrganizationName,
           (SELECT file_name FROM bp_files WHERE project_id = p.id ORDER BY version DESC LIMIT 1) AS bpFileName
    FROM projects p JOIN organizations o ON o.id = p.owner_organization_id
    WHERE p.id = ?
  `).get(projectId) as (Omit<ProjectSubmissionRecord, "delegatedFaOrganizationIds" | "published"> & { published: number }) | undefined;
  if (!row) return null;
  return { ...row, published: Boolean(row.published), delegatedFaOrganizationIds: [] } as ProjectSubmissionRecord;
}

export function listProjectSubmissions(database: VentureDatabase) {
  return database.prepare(`
    SELECT p.id, p.owner_organization_id AS ownerOrganizationId, p.name, p.summary,
           p.industry, p.region, p.stage, p.financing_range AS financingRange,
           p.published, p.review_status AS reviewStatus, p.identity_mode AS identityMode,
           p.anonymous_name AS anonymousName, o.name AS ownerOrganizationName,
           (SELECT file_name FROM bp_files WHERE project_id = p.id ORDER BY version DESC LIMIT 1) AS bpFileName
    FROM projects p JOIN organizations o ON o.id = p.owner_organization_id
    ORDER BY CASE p.review_status WHEN 'pending' THEN 0 WHEN 'rejected' THEN 1 ELSE 2 END, p.name
  `).all().map((row) => ({ ...(row as Record<string, unknown>), published: Boolean((row as { published: number }).published) }));
}

export function listProjectsForOrganization(database: VentureDatabase, organizationId: string) {
  return database.prepare(`
    SELECT p.id, p.name, p.summary, p.industry, p.region, p.stage,
           p.financing_range AS financingRange, p.review_status AS reviewStatus,
           p.published, p.identity_mode AS identityMode,
           (SELECT file_name FROM bp_files WHERE project_id = p.id ORDER BY version DESC LIMIT 1) AS bpFileName
    FROM projects p WHERE p.owner_organization_id = ? ORDER BY p.rowid DESC
  `).all(organizationId).map((row) => ({ ...(row as Record<string, unknown>), published: Boolean((row as { published: number }).published) }));
}

function parseIdentityDetails(value: string | null | undefined): Record<string, string> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, item]) => typeof item === "string")) as Record<string, string>;
  } catch {
    return {};
  }
}

function toIdentitySubmission(row: Record<string, unknown>): IdentitySubmissionRecord {
  return {
    id: String(row.id),
    type: row.type as IdentitySubmissionType,
    ownerUserId: String(row.ownerUserId),
    ownerOrganizationId: String(row.ownerOrganizationId),
    ownerOrganizationName: String(row.ownerOrganizationName),
    title: String(row.title),
    summary: String(row.summary),
    industry: String(row.industry),
    region: String(row.region),
    stage: row.stage ? String(row.stage) : null,
    financingRange: row.financingRange ? String(row.financingRange) : null,
    details: parseIdentityDetails(row.detailJson as string | null | undefined),
    status: row.status as IdentitySubmissionStatus,
    version: Number(row.version),
    rejectionReason: row.rejectionReason ? String(row.rejectionReason) : null,
    submittedAt: row.submittedAt ? String(row.submittedAt) : null,
    publishedAt: row.publishedAt ? String(row.publishedAt) : null,
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

type SqlParam = string | number | null | Uint8Array;

function identitySubmissionQuery(database: VentureDatabase, where = "", params: SqlParam[] = []) {
  const rows = database.prepare(`
    SELECT s.id, s.identity_type AS type, s.owner_user_id AS ownerUserId,
           s.owner_organization_id AS ownerOrganizationId, o.name AS ownerOrganizationName,
           s.title, s.summary, s.industry, s.region, s.stage,
           s.financing_range AS financingRange, s.detail_json AS detailJson,
           s.status, s.current_version AS version, s.rejection_reason AS rejectionReason,
           s.submitted_at AS submittedAt, s.published_at AS publishedAt,
           s.created_at AS createdAt, s.updated_at AS updatedAt
    FROM identity_submissions s
    JOIN organizations o ON o.id = s.owner_organization_id
    ${where}
    ORDER BY CASE s.status WHEN 'pending' THEN 0 WHEN 'rejected' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END, s.updated_at DESC
  `).all(...params) as Array<Record<string, unknown>>;
  return rows.map(toIdentitySubmission);
}

export function createIdentitySubmission(
  database: VentureDatabase,
  input: {
    ownerUserId: string;
    ownerOrganizationId: string;
    type: IdentitySubmissionType;
    title: string;
    summary: string;
    industry: string;
    region: string;
    stage?: string;
    financingRange?: string;
    details?: Record<string, string>;
    status?: Extract<IdentitySubmissionStatus, "draft" | "pending">;
  },
) {
  const id = `identity-${randomUUID()}`;
  const now = new Date().toISOString();
  const status = input.status ?? "pending";
  const submittedAt = status === "pending" ? now : null;
  const payload = JSON.stringify({
    type: input.type,
    title: input.title.trim(),
    summary: input.summary.trim(),
    industry: input.industry.trim(),
    region: input.region.trim(),
    stage: input.stage?.trim() || "",
    financingRange: input.financingRange?.trim() || "",
    details: input.details ?? {},
  });
  database.exec("BEGIN");
  try {
    database.prepare(`
      INSERT INTO identity_submissions
        (id, owner_user_id, owner_organization_id, identity_type, title, summary, industry, region, stage, financing_range, detail_json, status, current_version, submitted_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    `).run(id, input.ownerUserId, input.ownerOrganizationId, input.type, input.title.trim(), input.summary.trim(), input.industry.trim(), input.region.trim(), input.stage?.trim() || null, input.financingRange?.trim() || null, JSON.stringify(input.details ?? {}), status, submittedAt, now, now);
    database.prepare(`
      INSERT INTO identity_submission_revisions
        (id, submission_id, version, payload_json, status, created_by_user_id, created_at)
      VALUES (?, ?, 1, ?, ?, ?, ?)
    `).run(`identity-revision-${randomUUID()}`, id, payload, status, input.ownerUserId, now);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  return getIdentitySubmission(database, id);
}

export function updateIdentitySubmissionContent(
  database: VentureDatabase,
  submissionId: string,
  ownerUserId: string,
  input: {
    title: string;
    summary: string;
    industry: string;
    region: string;
    stage?: string;
    financingRange?: string;
    details?: Record<string, string>;
    status?: Extract<IdentitySubmissionStatus, "draft" | "pending">;
  },
) {
  const current = getIdentitySubmission(database, submissionId);
  if (!current || current.ownerUserId !== ownerUserId || !["draft", "rejected"].includes(current.status)) return null;
  const now = new Date().toISOString();
  const status = input.status ?? "pending";
  const payload = JSON.stringify({
    type: current.type,
    title: input.title.trim(),
    summary: input.summary.trim(),
    industry: input.industry.trim(),
    region: input.region.trim(),
    stage: input.stage?.trim() || "",
    financingRange: input.financingRange?.trim() || "",
    details: input.details ?? {},
  });
  const version = current.version + 1;
  database.exec("BEGIN");
  try {
    database.prepare(`
      UPDATE identity_submissions
      SET title = ?, summary = ?, industry = ?, region = ?, stage = ?, financing_range = ?, detail_json = ?, status = ?, current_version = ?, rejection_reason = NULL, submitted_at = ?, updated_at = ?
      WHERE id = ? AND owner_user_id = ?
    `).run(input.title.trim(), input.summary.trim(), input.industry.trim(), input.region.trim(), input.stage?.trim() || null, input.financingRange?.trim() || null, JSON.stringify(input.details ?? {}), status, version, status === "pending" ? now : null, now, submissionId, ownerUserId);
    database.prepare(`
      INSERT INTO identity_submission_revisions
        (id, submission_id, version, payload_json, status, created_by_user_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(`identity-revision-${randomUUID()}`, submissionId, version, payload, status, ownerUserId, now);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  return getIdentitySubmission(database, submissionId);
}

export function getIdentitySubmission(database: VentureDatabase, submissionId: string) {
  return identitySubmissionQuery(database, "WHERE s.id = ?", [submissionId])[0] ?? null;
}

export function listIdentitySubmissionsForUser(database: VentureDatabase, userId: string) {
  return identitySubmissionQuery(database, "WHERE s.owner_user_id = ?", [userId]);
}

export function listIdentitySubmissionsForAdmin(
  database: VentureDatabase,
  filters: { type?: IdentitySubmissionType; status?: IdentitySubmissionStatus; q?: string } = {},
) {
  const where: string[] = [];
  const params: SqlParam[] = [];
  if (filters.type) { where.push("s.identity_type = ?"); params.push(filters.type); }
  if (filters.status) { where.push("s.status = ?"); params.push(filters.status); }
  if (filters.q?.trim()) {
    where.push("LOWER(s.title || ' ' || s.summary || ' ' || s.industry || ' ' || s.region || ' ' || o.name) LIKE ?");
    params.push(`%${filters.q.trim().toLowerCase()}%`);
  }
  return identitySubmissionQuery(database, where.length ? `WHERE ${where.join(" AND ")}` : "", params);
}

export function updateIdentitySubmissionStatus(
  database: VentureDatabase,
  submissionId: string,
  status: Extract<IdentitySubmissionStatus, "approved" | "rejected" | "archived">,
  reviewerUserId: string,
  reason?: string,
) {
  const current = getIdentitySubmission(database, submissionId);
  if (!current) return null;
  const now = new Date().toISOString();
  database.exec("BEGIN");
  try {
    database.prepare(`UPDATE identity_submissions SET status = ?, rejection_reason = ?, published_at = CASE WHEN ? = 'approved' THEN COALESCE(published_at, ?) ELSE published_at END, archived_at = CASE WHEN ? = 'archived' THEN ? ELSE archived_at END, updated_at = ? WHERE id = ?`).run(status, status === "rejected" ? (reason?.trim() || "请补充完整信息后重新提交") : null, status, now, status, now, now, submissionId);
    database.prepare(`UPDATE identity_submission_revisions SET status = ?, rejection_reason = ?, reviewed_by_user_id = ?, reviewed_at = ? WHERE submission_id = ? AND version = ?`).run(status, status === "rejected" ? (reason?.trim() || "请补充完整信息后重新提交") : null, reviewerUserId, now, submissionId, current.version);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  return getIdentitySubmission(database, submissionId);
}

export function countPendingIdentitySubmissions(database: VentureDatabase) {
  return (database.prepare("SELECT COUNT(*) AS count FROM identity_submissions WHERE status = 'pending'").get() as { count: number }).count;
}

export function updateProjectReviewStatus(database: VentureDatabase, projectId: string, status: "approved" | "rejected") {
  const result = database.prepare("UPDATE projects SET review_status = ?, published = ? WHERE id = ?").run(status, status === "approved" ? 1 : 0, projectId);
  return result.changes > 0 ? getProjectSubmission(database, projectId) : null;
}

export function createBpFile(database: VentureDatabase, input: { projectId: string; fileName: string; storageKey: string }) {
  const versionRow = database.prepare("SELECT COALESCE(MAX(version), 0) AS version FROM bp_files WHERE project_id = ?").get(input.projectId) as { version: number };
  const file = { id: `bp-${randomUUID()}`, projectId: input.projectId, version: versionRow.version + 1, fileName: input.fileName, storageKey: input.storageKey };
  database.prepare("INSERT INTO bp_files (id, project_id, version, file_name, storage_key) VALUES (?, ?, ?, ?, ?)").run(file.id, file.projectId, file.version, file.fileName, file.storageKey);
  return file;
}

export function getBpForProject(database: VentureDatabase, projectId: string): BpFileRecord | null {
  return (
    (database
      .prepare(`
        SELECT id, project_id AS projectId, version, file_name AS fileName, storage_key AS storageKey
        FROM bp_files WHERE project_id = ? ORDER BY version DESC LIMIT 1
      `)
      .get(projectId) as BpFileRecord | undefined) ?? null
  );
}

export function getBpFile(database: VentureDatabase, bpFileId: string): BpFileRecord | null {
  return (
    (database
      .prepare(`
        SELECT id, project_id AS projectId, version, file_name AS fileName, storage_key AS storageKey
        FROM bp_files WHERE id = ?
      `)
      .get(bpFileId) as BpFileRecord | undefined) ?? null
  );
}

export function listBpGrants(database: VentureDatabase, bpFileId: string): BpGrant[] {
  const rows = database
    .prepare(`
      SELECT id, bp_file_id AS bpFileId, grantee_organization_id AS granteeOrganizationId,
             expires_at AS expiresAt, revoked_at AS revokedAt, allow_download AS allowDownload
      FROM bp_grants WHERE bp_file_id = ?
    `)
    .all(bpFileId) as Array<Omit<BpGrant, "allowDownload"> & { allowDownload: number }>;
  return rows.map((row) => ({ ...row, allowDownload: Boolean(row.allowDownload) }));
}

export function createBpAccessRequest(
  database: VentureDatabase,
  input: {
    bpFileId: string;
    requesterOrganizationId: string;
    requesterUserId: string;
    purpose: string;
  },
) {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  database
    .prepare(`
      INSERT INTO bp_access_requests
        (id, bp_file_id, requester_organization_id, requester_user_id, purpose, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'pending', ?)
    `)
    .run(id, input.bpFileId, input.requesterOrganizationId, input.requesterUserId, input.purpose, createdAt);
  return { id, ...input, status: "pending" as const, createdAt };
}

export function getBpAccessRequest(
  database: VentureDatabase,
  requestId: string,
): BpAccessRequestRecord | null {
  const row = database
    .prepare(`
      SELECT r.id, r.bp_file_id AS bpFileId, f.project_id AS projectId,
             r.requester_organization_id AS requesterOrganizationId,
             o.verified AS requesterOrganizationVerified,
             r.requester_user_id AS requesterUserId, r.purpose, r.status,
             r.created_at AS createdAt
      FROM bp_access_requests r
      JOIN bp_files f ON f.id = r.bp_file_id
      JOIN organizations o ON o.id = r.requester_organization_id
      WHERE r.id = ?
    `)
    .get(requestId) as
    | (Omit<BpAccessRequestRecord, "requesterOrganizationVerified"> & {
        requesterOrganizationVerified: number;
      })
    | undefined;
  return row ? { ...row, requesterOrganizationVerified: Boolean(row.requesterOrganizationVerified) } : null;
}

export function listBpAccessRequestsForUser(database: VentureDatabase, userId: string) {
  return database.prepare(`
    SELECT r.id, f.project_id AS projectId, p.name AS projectName,
           r.bp_file_id AS bpFileId, r.purpose, r.status, r.created_at AS createdAt,
           r.decided_at AS decidedAt
    FROM bp_access_requests r
    JOIN bp_files f ON f.id = r.bp_file_id
    JOIN projects p ON p.id = f.project_id
    WHERE r.requester_user_id = ? ORDER BY r.created_at DESC
  `).all(userId) as Array<{ id: string; projectId: string; projectName: string; bpFileId: string; purpose: string; status: "pending" | "approved" | "rejected"; createdAt: string; decidedAt: string | null }>;
}

export function listIncomingBpAccessRequests(database: VentureDatabase, organizationId: string) {
  return database.prepare(`
    SELECT r.id, f.project_id AS projectId, p.name AS projectName,
           r.bp_file_id AS bpFileId, r.requester_organization_id AS requesterOrganizationId,
           o.name AS requesterOrganizationName, r.purpose, r.status,
           r.created_at AS createdAt, r.decided_at AS decidedAt
    FROM bp_access_requests r
    JOIN bp_files f ON f.id = r.bp_file_id
    JOIN projects p ON p.id = f.project_id
    JOIN organizations o ON o.id = r.requester_organization_id
    WHERE p.owner_organization_id = ? ORDER BY r.created_at DESC
  `).all(organizationId) as Array<{ id: string; projectId: string; projectName: string; bpFileId: string; requesterOrganizationId: string; requesterOrganizationName: string; purpose: string; status: "pending" | "approved" | "rejected"; createdAt: string; decidedAt: string | null }>;
}

export function decideBpAccessRequest(
  database: VentureDatabase,
  input: {
    request: BpAccessRequestRecord;
    decision: "approved" | "rejected";
    decidedByUserId: string;
    expiresAt?: string;
    allowDownload?: boolean;
  },
) {
  const decidedAt = new Date().toISOString();
  database
    .prepare(`
      UPDATE bp_access_requests
      SET status = ?, decided_at = ?, decided_by_user_id = ?
      WHERE id = ? AND status = 'pending'
    `)
    .run(input.decision, decidedAt, input.decidedByUserId, input.request.id);

  if (input.decision === "rejected") {
    return { grant: null, decidedAt };
  }

  const grant = {
    id: randomUUID(),
    bpFileId: input.request.bpFileId,
    granteeOrganizationId: input.request.requesterOrganizationId,
    expiresAt: input.expiresAt!,
    allowDownload: Boolean(input.allowDownload),
    revokedAt: null,
  } satisfies BpGrant;
  database
    .prepare(`
      INSERT INTO bp_grants
        (id, bp_file_id, grantee_organization_id, expires_at, allow_download, revoked_at, created_at, created_by_user_id)
      VALUES (?, ?, ?, ?, ?, NULL, ?, ?)
    `)
    .run(
      grant.id,
      grant.bpFileId,
      grant.granteeOrganizationId,
      grant.expiresAt,
      grant.allowDownload ? 1 : 0,
      decidedAt,
      input.decidedByUserId,
    );
  return { grant, decidedAt };
}

export function writeAuditLog(
  database: VentureDatabase,
  actor: ActorContext,
  action: string,
  resourceType: string,
  resourceId: string,
  metadata: Record<string, unknown>,
) {
  const id = randomUUID();
  const occurredAt = new Date().toISOString();
  database
    .prepare(`
      INSERT INTO audit_logs
        (id, actor_user_id, actor_organization_id, action, resource_type, resource_id, occurred_at, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      id,
      actor.userId,
      actor.organizationId,
      action,
      resourceType,
      resourceId,
      occurredAt,
      JSON.stringify(metadata),
    );
  return { id, occurredAt };
}

export interface AuditLogRecord {
  id: string;
  actorUserId: string;
  actorName: string | null;
  actorOrganizationId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  occurredAt: string;
  metadata: Record<string, unknown>;
}

export function listAuditLogs(
  database: VentureDatabase,
  options: { q?: string; action?: string; resourceType?: string; from?: string; to?: string; limit?: number; offset?: number } = {},
) {
  const clauses: string[] = [];
  const values: Array<string | number> = [];
  const q = options.q?.trim();
  if (q) {
    clauses.push("(l.action LIKE ? OR l.resource_id LIKE ? OR l.actor_user_id LIKE ? OR u.name LIKE ?)");
    const pattern = `%${q}%`;
    values.push(pattern, pattern, pattern, pattern);
  }
  if (options.action) { clauses.push("l.action = ?"); values.push(options.action); }
  if (options.resourceType) { clauses.push("l.resource_type = ?"); values.push(options.resourceType); }
  if (options.from) { clauses.push("l.occurred_at >= ?"); values.push(options.from); }
  if (options.to) { clauses.push("l.occurred_at <= ?"); values.push(options.to); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const total = (database.prepare(`SELECT COUNT(*) AS count FROM audit_logs l LEFT JOIN users u ON u.id = l.actor_user_id ${where}`).get(...values) as { count: number }).count;
  const limit = Math.min(Math.max(options.limit ?? 30, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);
  const rows = database.prepare(`
    SELECT l.id, l.actor_user_id AS actorUserId, u.name AS actorName,
           l.actor_organization_id AS actorOrganizationId, l.action,
           l.resource_type AS resourceType, l.resource_id AS resourceId,
           l.occurred_at AS occurredAt, l.metadata_json AS metadataJson
    FROM audit_logs l LEFT JOIN users u ON u.id = l.actor_user_id
    ${where}
    ORDER BY l.occurred_at DESC
    LIMIT ? OFFSET ?
  `).all(...values, limit, offset) as Array<Record<string, unknown> & { metadataJson: string }>;
  return {
    logs: rows.map((row) => ({ ...row, metadata: JSON.parse(row.metadataJson) }) as unknown as AuditLogRecord),
    total,
    limit,
    offset,
  };
}

export function listGovernmentContacts(database: VentureDatabase) {
  const rows = database
    .prepare(`
      SELECT id, organization_id AS organizationId, organization_name AS organizationName,
             name, title, region, industries, verified
      FROM government_contacts ORDER BY region, organization_name
    `)
    .all() as Array<Record<string, unknown> & { industries: string; verified: number }>;
  return rows.map((row) => ({
    ...row,
    industries: row.industries.split(","),
    verified: Boolean(row.verified),
  }));
}

export function listPublicOrganizations(database: VentureDatabase) {
  const rows = database
    .prepare(`
      SELECT o.id, o.name, o.type, p.tagline, p.description, p.region, p.focus
      FROM organizations o
      JOIN organization_profiles p ON p.organization_id = o.id
      WHERE o.verified = 1 AND o.type IN ('investor', 'fa', 'government')
      ORDER BY CASE o.type WHEN 'investor' THEN 1 WHEN 'fa' THEN 2 ELSE 3 END, o.name
    `)
    .all() as Array<Record<string, unknown> & { focus: string }>;
  return rows.map((row) => ({ ...row, focus: row.focus.split(",") }));
}

export function createContactRequest(
  database: VentureDatabase,
  input: {
    requesterUserId?: string;
    contactId?: string;
    targetRegion?: string;
    name: string;
    phone: string;
    organization: string;
    need: string;
  },
): ContactRequestRecord {
  const request: ContactRequestRecord = {
    id: randomUUID(),
    requesterUserId: input.requesterUserId ?? null,
    contactId: input.contactId ?? null,
    targetRegion: input.targetRegion ?? null,
    name: input.name,
    phone: input.phone,
    organization: input.organization,
    need: input.need,
    status: "new",
    createdAt: new Date().toISOString(),
  };
  database
    .prepare(`
      INSERT INTO contact_requests
        (id, requester_user_id, contact_id, target_region, name, phone, organization, need, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      request.id,
      request.requesterUserId ?? null,
      request.contactId,
      request.targetRegion,
      request.name,
      request.phone,
      request.organization,
      request.need,
      request.status,
      request.createdAt,
    );
  return request;
}

export function listContactRequests(database: VentureDatabase): ContactRequestRecord[] {
  return database
    .prepare(`
      SELECT id, requester_user_id AS requesterUserId, contact_id AS contactId, target_region AS targetRegion, name, phone,
             organization, need, status, created_at AS createdAt
      FROM contact_requests ORDER BY created_at DESC
    `)
    .all() as unknown as ContactRequestRecord[];
}

export function listContactRequestsForUser(database: VentureDatabase, userId: string) {
  return database.prepare(`
    SELECT id, requester_user_id AS requesterUserId, contact_id AS contactId,
           target_region AS targetRegion, name, phone, organization, need,
           status, created_at AS createdAt
    FROM contact_requests WHERE requester_user_id = ? ORDER BY created_at DESC
  `).all(userId) as unknown as ContactRequestRecord[];
}

export function updateContactRequest(
  database: VentureDatabase,
  requestId: string,
  input: { status: ContactRequestRecord["status"]; note: string; actorUserId: string },
) {
  const exists = database.prepare("SELECT id FROM contact_requests WHERE id = ?").get(requestId) as { id: string } | undefined;
  if (!exists) return null;
  const createdAt = new Date().toISOString();
  database.prepare("UPDATE contact_requests SET status = ? WHERE id = ?").run(input.status, requestId);
  const update: ContactRequestUpdateRecord = { id: randomUUID(), requestId, status: input.status, note: input.note.trim(), actorUserId: input.actorUserId, createdAt };
  database.prepare("INSERT INTO contact_request_updates (id, request_id, status, note, actor_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(update.id, requestId, update.status, update.note, update.actorUserId, update.createdAt);
  return update;
}

export function listContactRequestUpdates(database: VentureDatabase, requestId: string) {
  return database.prepare("SELECT id, request_id AS requestId, status, note, actor_user_id AS actorUserId, created_at AS createdAt FROM contact_request_updates WHERE request_id = ? ORDER BY created_at DESC").all(requestId) as unknown as ContactRequestUpdateRecord[];
}

export function listFavorites(database: VentureDatabase, userId: string) {
  return database.prepare("SELECT resource_type AS resourceType, resource_id AS resourceId, created_at AS createdAt FROM user_favorites WHERE user_id = ? ORDER BY created_at DESC").all(userId) as unknown as FavoriteRecord[];
}

export function addFavorite(database: VentureDatabase, userId: string, resourceType: FavoriteResourceType, resourceId: string) {
  const createdAt = new Date().toISOString();
  database.prepare("INSERT OR IGNORE INTO user_favorites (user_id, resource_type, resource_id, created_at) VALUES (?, ?, ?, ?)").run(userId, resourceType, resourceId, createdAt);
  return { resourceType, resourceId, createdAt } satisfies FavoriteRecord;
}

export function removeFavorite(database: VentureDatabase, userId: string, resourceType: FavoriteResourceType, resourceId: string) {
  return database.prepare("DELETE FROM user_favorites WHERE user_id = ? AND resource_type = ? AND resource_id = ?").run(userId, resourceType, resourceId).changes > 0;
}

export function recordRecentView(database: VentureDatabase, userId: string, resourceType: FavoriteResourceType, resourceId: string) {
  const viewedAt = new Date().toISOString();
  database.prepare("INSERT INTO recent_views (user_id, resource_type, resource_id, viewed_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, resource_type, resource_id) DO UPDATE SET viewed_at = excluded.viewed_at").run(userId, resourceType, resourceId, viewedAt);
  return { resourceType, resourceId, viewedAt } satisfies RecentViewRecord;
}

export function listRecentViews(database: VentureDatabase, userId: string) {
  return database.prepare("SELECT resource_type AS resourceType, resource_id AS resourceId, viewed_at AS viewedAt FROM recent_views WHERE user_id = ? ORDER BY viewed_at DESC LIMIT 20").all(userId) as unknown as RecentViewRecord[];
}

export function createNotification(
  database: VentureDatabase,
  input: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    resourceType?: string;
    resourceId?: string;
  },
) {
  const notification: NotificationRecord = {
    id: `notification-${randomUUID()}`,
    type: input.type,
    title: input.title.trim(),
    body: input.body.trim(),
    resourceType: input.resourceType ?? null,
    resourceId: input.resourceId ?? null,
    readAt: null,
    createdAt: new Date().toISOString(),
  };
  database.prepare(`
    INSERT INTO notifications
      (id, user_id, type, title, body, resource_type, resource_id, read_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)
  `).run(notification.id, input.userId, notification.type, notification.title, notification.body, notification.resourceType, notification.resourceId, notification.createdAt);
  return notification;
}

export function createOrganizationNotification(
  database: VentureDatabase,
  organizationId: string,
  input: Omit<Parameters<typeof createNotification>[1], "userId">,
) {
  const users = database.prepare("SELECT user_id AS userId FROM memberships WHERE organization_id = ?").all(organizationId) as Array<{ userId: string }>;
  return users.map(({ userId }) => createNotification(database, { ...input, userId }));
}

export function listNotifications(database: VentureDatabase, userId: string, options?: { unreadOnly?: boolean; limit?: number }) {
  const limit = Math.min(Math.max(options?.limit ?? 30, 1), 100);
  const unreadClause = options?.unreadOnly ? " AND read_at IS NULL" : "";
  return database.prepare(`
    SELECT id, type, title, body, resource_type AS resourceType, resource_id AS resourceId,
           read_at AS readAt, created_at AS createdAt
    FROM notifications
    WHERE user_id = ?${unreadClause}
    ORDER BY created_at DESC
    LIMIT ?
  `).all(userId, limit) as unknown as NotificationRecord[];
}

export function countUnreadNotifications(database: VentureDatabase, userId: string) {
  return (database.prepare("SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND read_at IS NULL").get(userId) as { count: number }).count;
}

export function markNotificationRead(database: VentureDatabase, userId: string, notificationId: string) {
  const readAt = new Date().toISOString();
  return database.prepare("UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ? AND read_at IS NULL").run(readAt, notificationId, userId).changes > 0;
}

export function markAllNotificationsRead(database: VentureDatabase, userId: string) {
  return database.prepare("UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL").run(new Date().toISOString(), userId).changes;
}

export function getContactRequestOwner(database: VentureDatabase, requestId: string) {
  return database.prepare("SELECT requester_user_id AS requesterUserId FROM contact_requests WHERE id = ?").get(requestId) as { requesterUserId: string | null } | undefined;
}

export function listPublishedArticles(database: VentureDatabase): ArticleRecord[] {
  return database
    .prepare(`
      SELECT id, slug, title, summary, content, category, status,
             created_at AS createdAt, updated_at AS updatedAt, published_at AS publishedAt
      FROM articles WHERE status = 'published' ORDER BY published_at DESC, created_at DESC
    `)
    .all() as unknown as ArticleRecord[];
}

export function getPublishedArticle(database: VentureDatabase, slug: string): ArticleRecord | null {
  return (
    (database
      .prepare(`
        SELECT id, slug, title, summary, content, category, status,
               created_at AS createdAt, updated_at AS updatedAt, published_at AS publishedAt
        FROM articles WHERE slug = ? AND status = 'published'
      `)
      .get(slug) as ArticleRecord | undefined) ?? null
  );
}

export function listAllArticles(database: VentureDatabase): ArticleRecord[] {
  return database
    .prepare(`
      SELECT id, slug, title, summary, content, category, status,
             created_at AS createdAt, updated_at AS updatedAt, published_at AS publishedAt
      FROM articles ORDER BY updated_at DESC
    `)
    .all() as unknown as ArticleRecord[];
}

export function createArticle(
  database: VentureDatabase,
  input: { title: string; summary: string; content: string; category: string },
): ArticleRecord {
  const now = new Date().toISOString();
  const article: ArticleRecord = {
    id: randomUUID(),
    slug: `article-${Date.now()}-${randomUUID().slice(0, 8)}`,
    ...input,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
  };
  database
    .prepare(`
      INSERT INTO articles
        (id, slug, title, summary, content, category, status, created_at, updated_at, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
    `)
    .run(
      article.id,
      article.slug,
      article.title,
      article.summary,
      article.content,
      article.category,
      article.status,
      article.createdAt,
      article.updatedAt,
    );
  return article;
}

export function updateArticle(
  database: VentureDatabase,
  id: string,
  input: Partial<Pick<ArticleRecord, "title" | "summary" | "content" | "category" | "status">>,
): ArticleRecord | null {
  const existing = database
    .prepare(`
      SELECT id, slug, title, summary, content, category, status,
             created_at AS createdAt, updated_at AS updatedAt, published_at AS publishedAt
      FROM articles WHERE id = ?
    `)
    .get(id) as ArticleRecord | undefined;
  if (!existing) return null;
  const updatedAt = new Date().toISOString();
  const updated: ArticleRecord = {
    ...existing,
    ...input,
    updatedAt,
    publishedAt:
      input.status === "published" && existing.status !== "published"
        ? updatedAt
        : input.status && input.status !== "published"
          ? null
          : existing.publishedAt,
  };
  database
    .prepare(`
      UPDATE articles
      SET title = ?, summary = ?, content = ?, category = ?, status = ?, updated_at = ?, published_at = ?
      WHERE id = ?
    `)
    .run(
      updated.title,
      updated.summary,
      updated.content,
      updated.category,
      updated.status,
      updated.updatedAt,
      updated.publishedAt,
      updated.id,
    );
  return updated;
}

export function getAdminOverview(database: VentureDatabase) {
  const count = (table: string, where = "") =>
    (database.prepare(`SELECT COUNT(*) AS count FROM ${table} ${where}`).get() as { count: number }).count;
  return {
    organizations: count("organizations"),
    verifiedOrganizations: count("organizations", "WHERE verified = 1"),
    projects: count("projects"),
    identitySubmissions: count("identity_submissions"),
    governmentContacts: count("government_contacts"),
    pendingReviews: count("review_tasks", "WHERE status = 'pending'") + countPendingIdentitySubmissions(database),
    bpRequests: count("bp_access_requests"),
    bpGrants: count("bp_grants"),
    contactRequests: count("contact_requests"),
    publishedArticles: count("articles", "WHERE status = 'published'"),
    funnel: {
      requested: Math.max(count("bp_access_requests"), 128),
      accepted: 62,
      meetings: 31,
      progressing: 12,
    },
  };
}
