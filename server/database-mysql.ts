import { createHash, randomInt, randomUUID } from "node:crypto";
import type {
  ActorContext,
  BpGrant,
  OrganizationRole,
  OrganizationType,
  ProjectResource,
} from "@venture/domain";
import type { VentureDatabase } from "./mysql.ts";
export type { VentureDatabase } from "./mysql.ts";

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

type Row = Record<string, unknown>;
type DbError = { message: string; code?: string } | null;
type DbResponse<T> = { data: T | null; error: DbError };

async function unwrap<T>(query: PromiseLike<DbResponse<T>>): Promise<T> {
  const result = await query;
  if (result.error) {
    throw new Error(`MySQL query failed: ${result.error.message}`);
  }
  return result.data as T;
}

async function maybeOne<T>(query: PromiseLike<DbResponse<T[] | T | null>>): Promise<T | null> {
  const result = await query;
  if (result.error) throw new Error(`MySQL query failed: ${result.error.message}`);
  if (Array.isArray(result.data)) return (result.data[0] as T | undefined) ?? null;
  return result.data as T | null;
}

function text(row: Row, key: string, fallback = "") {
  const value = row[key];
  return value === null || value === undefined ? fallback : String(value);
}

function nullableText(row: Row, key: string) {
  const value = row[key];
  return value === null || value === undefined || value === "" ? null : String(value);
}

function bool(row: Row, key: string) {
  return row[key] === true || row[key] === 1 || row[key] === "1";
}

function listValue(value: unknown) {
  if (Array.isArray(value)) return value.map(String);
  return String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}

function objectValue(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, item]) => typeof item === "string")) as Record<string, string>;
}

function now() {
  return new Date().toISOString();
}

function mapAuthAccount(row: Row): AuthAccountRecord {
  return {
    userId: text(row, "legacy_user_id"),
    email: nullableText(row, "email"),
    phone: nullableText(row, "phone"),
    passwordHash: text(row, "password_hash"),
    role: text(row, "role") as OrganizationType,
    status: text(row, "status") as AuthAccountRecord["status"],
    createdAt: text(row, "created_at"),
    organizationId: text(row, "organization_legacy_id"),
    emailVerifiedAt: nullableText(row, "email_verified_at"),
  };
}

function toPublicProject(row: Row): PublicProjectRecord {
  const identityMode = text(row, "identity_mode", "named") as "named" | "anonymous";
  return {
    id: text(row, "legacy_id"),
    name: identityMode === "anonymous" ? (nullableText(row, "anonymous_name") ?? "某优质项目") : text(row, "name"),
    summary: text(row, "summary"),
    industry: text(row, "industry"),
    region: text(row, "region"),
    stage: text(row, "stage"),
    financingRange: text(row, "financing_range"),
    identityMode,
  };
}

function mapProject(row: Row, delegatedFaOrganizationIds: string[] = []): ProjectRecord {
  return {
    id: text(row, "legacy_id"),
    ownerOrganizationId: text(row, "owner_organization_legacy_id"),
    name: text(row, "name"),
    summary: text(row, "summary"),
    industry: text(row, "industry"),
    region: text(row, "region"),
    stage: text(row, "stage"),
    financingRange: text(row, "financing_range"),
    published: bool(row, "published"),
    identityMode: text(row, "identity_mode", "named") as "named" | "anonymous",
    anonymousName: nullableText(row, "anonymous_name"),
    delegatedFaOrganizationIds,
  };
}

function mapBpFile(row: Row): BpFileRecord {
  return {
    id: text(row, "legacy_id"),
    projectId: text(row, "project_legacy_id"),
    version: Number(row.version ?? 0),
    fileName: text(row, "file_name"),
    storageKey: text(row, "storage_key"),
  };
}

function mapArticle(row: Row): ArticleRecord {
  return {
    id: text(row, "legacy_id"),
    slug: text(row, "slug"),
    title: text(row, "title"),
    summary: text(row, "summary"),
    content: text(row, "content"),
    category: text(row, "category"),
    status: text(row, "status") as ArticleRecord["status"],
    createdAt: text(row, "created_at"),
    updatedAt: text(row, "updated_at"),
    publishedAt: nullableText(row, "published_at"),
  };
}

function mapNotification(row: Row): NotificationRecord {
  return {
    id: text(row, "legacy_id"),
    type: text(row, "notification_type") as NotificationType,
    title: text(row, "title"),
    body: text(row, "body"),
    resourceType: nullableText(row, "resource_type"),
    resourceId: nullableText(row, "resource_id"),
    readAt: nullableText(row, "read_at"),
    createdAt: text(row, "created_at"),
  };
}

function mapIdentitySubmission(row: Row, ownerOrganizationName: string): IdentitySubmissionRecord {
  return {
    id: text(row, "legacy_id"),
    type: text(row, "identity_type") as IdentitySubmissionType,
    ownerUserId: text(row, "owner_user_legacy_id"),
    ownerOrganizationId: text(row, "owner_organization_legacy_id"),
    ownerOrganizationName,
    title: text(row, "title"),
    summary: text(row, "summary"),
    industry: text(row, "industry"),
    region: text(row, "region"),
    stage: nullableText(row, "stage"),
    financingRange: nullableText(row, "financing_range"),
    details: objectValue(row.detail),
    status: text(row, "status") as IdentitySubmissionStatus,
    version: Number(row.current_version ?? 1),
    rejectionReason: nullableText(row, "rejection_reason"),
    submittedAt: nullableText(row, "submitted_at"),
    publishedAt: nullableText(row, "published_at"),
    createdAt: text(row, "created_at"),
    updatedAt: text(row, "updated_at"),
  };
}

async function organizationNames(database: VentureDatabase, ids: string[]) {
  if (!ids.length) return new Map<string, string>();
  const rows = await unwrap<Row[]>(database.from("venture_organizations").select("legacy_id,name").in("legacy_id", ids));
  return new Map(rows.map((row) => [text(row, "legacy_id"), text(row, "name")]));
}

async function userNames(database: VentureDatabase, ids: string[]) {
  if (!ids.length) return new Map<string, string>();
  const rows = await unwrap<Row[]>(database.from("venture_users").select("legacy_id,name").in("legacy_id", ids));
  return new Map(rows.map((row) => [text(row, "legacy_id"), text(row, "name")]));
}

export async function checkDatabase(database: VentureDatabase) {
  const result = await database.from("venture_migration_runs").select("id").limit(1);
  return !result.error;
}

export async function createAuthAccount(
  database: VentureDatabase,
  input: {
    email?: string;
    phone?: string;
    passwordHash: string;
    role: OrganizationType;
    organizationName: string;
    contactName: string;
    status?: "pending" | "active";
  },
) {
  const email = input.email?.trim().toLowerCase() || null;
  const phone = input.phone?.trim() || null;
  const duplicateEmail = email
    ? await maybeOne<Row>(database.from("venture_auth_accounts").select("legacy_user_id").eq("email", email).limit(1).maybeSingle())
    : null;
  const duplicatePhone = phone
    ? await maybeOne<Row>(database.from("venture_auth_accounts").select("legacy_user_id").eq("phone", phone).limit(1).maybeSingle())
    : null;
  if (duplicateEmail || duplicatePhone) return { error: "identifier_taken" as const };

  const userId = randomUUID();
  const organizationId = randomUUID();
  const createdAt = now();
  const roles: OrganizationRole[] = input.role === "project"
    ? ["org_admin", "project_manager"]
    : input.role === "user"
      ? ["member", "viewer"]
      : ["org_admin", "member"];
  const status = input.status ?? "pending";

  await unwrap(database.from("venture_organizations").insert({
    legacy_id: organizationId,
    name: input.organizationName.trim(),
    organization_type: input.role,
    verified: false,
  }));
  await unwrap(database.from("venture_users").insert({ legacy_id: userId, name: input.contactName.trim() }));
  await unwrap(database.from("venture_memberships").insert({ legacy_user_id: userId, organization_legacy_id: organizationId, roles }));
  await unwrap(database.from("venture_auth_accounts").insert({
    legacy_user_id: userId,
    email,
    phone,
    password_hash: input.passwordHash,
    organization_legacy_id: organizationId,
    role: input.role,
    status,
    created_at: createdAt,
  }));
  return { account: { userId, organizationId, role: input.role, status, createdAt } };
}

async function authAccountByColumn(database: VentureDatabase, column: string, value: string) {
  const row = await maybeOne<Row>(database.from("venture_auth_accounts").select("*").eq(column, value).limit(1).maybeSingle());
  return row ? mapAuthAccount(row) : null;
}

export async function findAuthAccount(database: VentureDatabase, identifier: string) {
  const normalized = identifier.trim().toLowerCase();
  const byEmail = await authAccountByColumn(database, "email", normalized);
  if (byEmail) return byEmail;
  return authAccountByColumn(database, "phone", identifier.trim());
}

export function getAuthAccountByUserId(database: VentureDatabase, userId: string) {
  return authAccountByColumn(database, "legacy_user_id", userId);
}

export async function updateAuthPassword(database: VentureDatabase, userId: string, passwordHash: string) {
  const result = await database.from("venture_auth_accounts").update({ password_hash: passwordHash }).eq("legacy_user_id", userId).select("legacy_user_id");
  if (result.error) throw new Error(`MySQL query failed: ${result.error.message}`);
  return Boolean(result.data?.length);
}

export async function updateAuthProfile(database: VentureDatabase, userId: string, input: { displayName: string; email?: string; phone?: string }) {
  const email = input.email?.trim().toLowerCase() || null;
  const phone = input.phone?.trim() || null;
  const [duplicateEmail, duplicatePhone] = await Promise.all([
    email ? maybeOne<Row>(database.from("venture_auth_accounts").select("legacy_user_id").eq("email", email).neq("legacy_user_id", userId).limit(1).maybeSingle()) : Promise.resolve(null),
    phone ? maybeOne<Row>(database.from("venture_auth_accounts").select("legacy_user_id").eq("phone", phone).neq("legacy_user_id", userId).limit(1).maybeSingle()) : Promise.resolve(null),
  ]);
  if (duplicateEmail || duplicatePhone) return { error: "identifier_taken" as const };
  await unwrap(database.from("venture_users").update({ name: input.displayName.trim() }).eq("legacy_id", userId));
  await unwrap(database.from("venture_auth_accounts").update({ email, phone }).eq("legacy_user_id", userId));
  return { profile: { displayName: input.displayName.trim(), email, phone } };
}

export type AuthTokenPurpose = "email_verification" | "password_reset";

function hashAuthToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function issueAuthToken(database: VentureDatabase, userId: string, purpose: AuthTokenPurpose, ttlMs = 30 * 60 * 1000) {
  const token = randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "");
  const createdAt = now();
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  await unwrap(database.from("venture_auth_tokens").update({ consumed_at: createdAt }).eq("user_legacy_id", userId).eq("purpose", purpose).is("consumed_at", null));
  await unwrap(database.from("venture_auth_tokens").insert({ legacy_id: randomUUID(), user_legacy_id: userId, purpose, token_hash: hashAuthToken(token), expires_at: expiresAt, created_at: createdAt }));
  return { token, expiresAt };
}

export async function consumeAuthToken(database: VentureDatabase, token: string, purpose: AuthTokenPurpose) {
  const row = await maybeOne<Row>(database.from("venture_auth_tokens").select("*").eq("token_hash", hashAuthToken(token.trim())).eq("purpose", purpose).limit(1).maybeSingle());
  if (!row || nullableText(row, "consumed_at") || new Date(text(row, "expires_at")).getTime() <= Date.now()) return null;
  const consumedAt = now();
  const updated = await unwrap<Row[]>(database.from("venture_auth_tokens").update({ consumed_at: consumedAt }).eq("legacy_id", text(row, "legacy_id")).is("consumed_at", null).gt("expires_at", consumedAt).select("legacy_id"));
  return updated.length ? { userId: text(row, "user_legacy_id"), consumedAt } : null;
}

export async function markEmailVerified(database: VentureDatabase, userId: string) {
  const verifiedAt = now();
  await unwrap(database.from("venture_auth_accounts").update({ email_verified_at: verifiedAt }).eq("legacy_user_id", userId).not("email", "is", null));
  return verifiedAt;
}

export async function approveAuthAccount(database: VentureDatabase, userId: string) {
  const rows = await unwrap<Row[]>(database.from("venture_auth_accounts").update({ status: "active" }).eq("legacy_user_id", userId).eq("status", "pending").select("legacy_user_id"));
  return rows.length > 0;
}

export async function updateAuthAccountStatus(database: VentureDatabase, userId: string, status: AuthAccountRecord["status"]) {
  const rows = await unwrap<Row[]>(database.from("venture_auth_accounts").update({ status }).eq("legacy_user_id", userId).neq("status", status).select("legacy_user_id"));
  return rows.length > 0;
}

export async function listAuthAccounts(database: VentureDatabase, status?: AuthAccountRecord["status"]) {
  let query = database.from("venture_auth_accounts").select("*").order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const accounts = await unwrap<Row[]>(query);
  const organizationMap = await organizationNames(database, accounts.map((row) => text(row, "organization_legacy_id")));
  const users = await userNames(database, accounts.map((row) => text(row, "legacy_user_id")));
  return accounts.map((row) => ({
    userId: text(row, "legacy_user_id"),
    email: nullableText(row, "email"),
    phone: nullableText(row, "phone"),
    role: text(row, "role"),
    status: text(row, "status"),
    createdAt: text(row, "created_at"),
    organizationId: text(row, "organization_legacy_id"),
    organizationName: organizationMap.get(text(row, "organization_legacy_id")) ?? "",
    contactName: users.get(text(row, "legacy_user_id")) ?? "",
  }));
}

export async function resolveActor(database: VentureDatabase, userId: string | undefined, organizationId: string | undefined): Promise<ActorContext | null> {
  if (!userId || !organizationId) return null;
  const membership = await maybeOne<Row>(database.from("venture_memberships").select("*").eq("legacy_user_id", userId).eq("organization_legacy_id", organizationId).limit(1).maybeSingle());
  if (!membership) return null;
  const [organization, user, account] = await Promise.all([
    maybeOne<Row>(database.from("venture_organizations").select("*").eq("legacy_id", organizationId).limit(1).maybeSingle()),
    maybeOne<Row>(database.from("venture_users").select("*").eq("legacy_id", userId).limit(1).maybeSingle()),
    getAuthAccountByUserId(database, userId),
  ]);
  if (!organization || !account) return null;
  return {
    userId,
    organizationId,
    organizationType: text(organization, "organization_type") as OrganizationType,
    organizationVerified: bool(organization, "verified"),
    roles: listValue(membership.roles) as OrganizationRole[],
    displayName: user ? text(user, "name") : undefined,
    organizationName: text(organization, "name"),
    email: account.email,
    phone: account.phone,
    emailVerifiedAt: account.emailVerifiedAt,
    createdAt: account.createdAt,
  };
}

export async function listPublishedProjects(database: VentureDatabase, filters: { q?: string; industry?: string; region?: string; stage?: string } = {}) {
  const rows = await unwrap<Row[]>(database.from("venture_projects").select("*").eq("published", true).eq("review_status", "approved").order("name"));
  const projects = rows.map(toPublicProject);
  const q = filters.q?.trim().toLocaleLowerCase();
  return projects
    .filter((project) => !filters.industry || project.industry.includes(filters.industry))
    .filter((project) => !filters.region || project.region.includes(filters.region))
    .filter((project) => !filters.stage || project.stage === filters.stage)
    .filter((project) => !q || [project.name, project.summary, project.industry, project.region].some((value) => value.toLocaleLowerCase().includes(q)));
}

export async function getPublicProject(database: VentureDatabase, projectId: string) {
  const row = await maybeOne<Row>(database.from("venture_projects").select("*").eq("legacy_id", projectId).eq("published", true).eq("review_status", "approved").limit(1).maybeSingle());
  return row ? toPublicProject(row) : null;
}

export async function getProject(database: VentureDatabase, projectId: string): Promise<ProjectRecord | null> {
  const row = await maybeOne<Row>(database.from("venture_projects").select("*").eq("legacy_id", projectId).limit(1).maybeSingle());
  if (!row) return null;
  const delegations = await unwrap<Row[]>(database.from("venture_project_fa_delegations").select("fa_organization_legacy_id").eq("project_legacy_id", projectId));
  return mapProject(row, delegations.map((item) => text(item, "fa_organization_legacy_id")));
}

function projectSubmission(row: Row, ownerOrganizationName: string, bpFileName: string | null): ProjectSubmissionRecord {
  return {
    ...mapProject(row),
    reviewStatus: text(row, "review_status") as ProjectSubmissionRecord["reviewStatus"],
    ownerOrganizationName,
    bpFileName,
  };
}

async function latestBpNames(database: VentureDatabase, projectIds: string[]) {
  if (!projectIds.length) return new Map<string, string>();
  const rows = await unwrap<Row[]>(database.from("venture_bp_files").select("project_legacy_id,file_name,version").in("project_legacy_id", projectIds).order("version", { ascending: false }));
  const result = new Map<string, string>();
  for (const row of rows) if (!result.has(text(row, "project_legacy_id"))) result.set(text(row, "project_legacy_id"), text(row, "file_name"));
  return result;
}

export async function createProjectSubmission(database: VentureDatabase, input: { ownerOrganizationId: string; name: string; summary: string; industry: string; region: string; stage: string; financingRange: string; identityMode?: "named" | "anonymous"; anonymousName?: string }) {
  const id = `project-${randomUUID()}`;
  await unwrap(database.from("venture_projects").insert({
    legacy_id: id,
    owner_organization_legacy_id: input.ownerOrganizationId,
    name: input.name.trim(),
    summary: input.summary.trim(),
    industry: input.industry.trim(),
    region: input.region.trim(),
    stage: input.stage.trim(),
    financing_range: input.financingRange.trim(),
    published: false,
    review_status: "pending",
    identity_mode: input.identityMode ?? "named",
    anonymous_name: input.anonymousName?.trim() || null,
  }));
  return getProjectSubmission(database, id);
}

export async function getProjectSubmission(database: VentureDatabase, projectId: string) {
  const row = await maybeOne<Row>(database.from("venture_projects").select("*").eq("legacy_id", projectId).limit(1).maybeSingle());
  if (!row) return null;
  const [organization, bp] = await Promise.all([
    maybeOne<Row>(database.from("venture_organizations").select("name").eq("legacy_id", text(row, "owner_organization_legacy_id")).limit(1).maybeSingle()),
    maybeOne<Row>(database.from("venture_bp_files").select("file_name").eq("project_legacy_id", projectId).order("version", { ascending: false }).limit(1).maybeSingle()),
  ]);
  return projectSubmission(row, organization ? text(organization, "name") : "", bp ? text(bp, "file_name") : null);
}

export async function listProjectSubmissions(database: VentureDatabase) {
  const rows = await unwrap<Row[]>(database.from("venture_projects").select("*").order("name"));
  const organizations = await organizationNames(database, rows.map((row) => text(row, "owner_organization_legacy_id")));
  const bpNames = await latestBpNames(database, rows.map((row) => text(row, "legacy_id")));
  const rank: Record<string, number> = { pending: 0, rejected: 1, approved: 2 };
  return rows.sort((a, b) => (rank[text(a, "review_status")] ?? 9) - (rank[text(b, "review_status")] ?? 9) || text(a, "name").localeCompare(text(b, "name"))).map((row) => projectSubmission(row, organizations.get(text(row, "owner_organization_legacy_id")) ?? "", bpNames.get(text(row, "legacy_id")) ?? null));
}

export async function listProjectsForOrganization(database: VentureDatabase, organizationId: string) {
  const rows = await unwrap<Row[]>(database.from("venture_projects").select("*").eq("owner_organization_legacy_id", organizationId).order("created_at", { ascending: false }));
  const bpNames = await latestBpNames(database, rows.map((row) => text(row, "legacy_id")));
  return rows.map((row) => ({
    id: text(row, "legacy_id"), name: text(row, "name"), summary: text(row, "summary"), industry: text(row, "industry"), region: text(row, "region"), stage: text(row, "stage"), financingRange: text(row, "financing_range"), reviewStatus: text(row, "review_status"), published: bool(row, "published"), identityMode: text(row, "identity_mode", "named"), bpFileName: bpNames.get(text(row, "legacy_id")) ?? null,
  }));
}

async function identitySubmissionRows(database: VentureDatabase, filters: { ownerUserId?: string; type?: IdentitySubmissionType; status?: IdentitySubmissionStatus } = {}) {
  let query = database.from("venture_identity_submissions").select("*").order("updated_at", { ascending: false });
  if (filters.ownerUserId) query = query.eq("owner_user_legacy_id", filters.ownerUserId);
  if (filters.type) query = query.eq("identity_type", filters.type);
  if (filters.status) query = query.eq("status", filters.status);
  const rows = await unwrap<Row[]>(query);
  const organizations = await organizationNames(database, rows.map((row) => text(row, "owner_organization_legacy_id")));
  const rank: Record<string, number> = { pending: 0, rejected: 1, draft: 2, approved: 3, archived: 4 };
  rows.sort((a, b) => (rank[text(a, "status")] ?? 9) - (rank[text(b, "status")] ?? 9) || text(b, "updated_at").localeCompare(text(a, "updated_at")));
  return rows.map((row) => mapIdentitySubmission(row, organizations.get(text(row, "owner_organization_legacy_id")) ?? ""));
}

export async function createIdentitySubmission(database: VentureDatabase, input: { ownerUserId: string; ownerOrganizationId: string; type: IdentitySubmissionType; title: string; summary: string; industry: string; region: string; stage?: string; financingRange?: string; details?: Record<string, string>; status?: Extract<IdentitySubmissionStatus, "draft" | "pending"> }) {
  const id = `identity-${randomUUID()}`;
  const createdAt = now();
  const status = input.status ?? "pending";
  const payload = { type: input.type, title: input.title.trim(), summary: input.summary.trim(), industry: input.industry.trim(), region: input.region.trim(), stage: input.stage?.trim() || "", financingRange: input.financingRange?.trim() || "", details: input.details ?? {} };
  await unwrap(database.from("venture_identity_submissions").insert({
    legacy_id: id, owner_user_legacy_id: input.ownerUserId, owner_organization_legacy_id: input.ownerOrganizationId, identity_type: input.type, title: payload.title, summary: payload.summary, industry: payload.industry, region: payload.region, stage: input.stage?.trim() || null, financing_range: input.financingRange?.trim() || null, detail: input.details ?? {}, status, current_version: 1, submitted_at: status === "pending" ? createdAt : null, created_at: createdAt, updated_at: createdAt,
  }));
  await unwrap(database.from("venture_identity_submission_revisions").insert({ legacy_id: `identity-revision-${randomUUID()}`, submission_legacy_id: id, version: 1, payload, status, created_by_user_legacy_id: input.ownerUserId, created_at: createdAt }));
  return getIdentitySubmission(database, id);
}

export async function updateIdentitySubmissionContent(database: VentureDatabase, submissionId: string, ownerUserId: string, input: { title: string; summary: string; industry: string; region: string; stage?: string; financingRange?: string; details?: Record<string, string>; status?: Extract<IdentitySubmissionStatus, "draft" | "pending"> }) {
  const current = await getIdentitySubmission(database, submissionId);
  if (!current || current.ownerUserId !== ownerUserId || !["draft", "rejected"].includes(current.status)) return null;
  const updatedAt = now();
  const status = input.status ?? "pending";
  const payload = { type: current.type, title: input.title.trim(), summary: input.summary.trim(), industry: input.industry.trim(), region: input.region.trim(), stage: input.stage?.trim() || "", financingRange: input.financingRange?.trim() || "", details: input.details ?? {} };
  const version = current.version + 1;
  await unwrap(database.from("venture_identity_submissions").update({ title: payload.title, summary: payload.summary, industry: payload.industry, region: payload.region, stage: input.stage?.trim() || null, financing_range: input.financingRange?.trim() || null, detail: input.details ?? {}, status, current_version: version, rejection_reason: null, submitted_at: status === "pending" ? updatedAt : null, updated_at: updatedAt }).eq("legacy_id", submissionId).eq("owner_user_legacy_id", ownerUserId));
  await unwrap(database.from("venture_identity_submission_revisions").insert({ legacy_id: `identity-revision-${randomUUID()}`, submission_legacy_id: submissionId, version, payload, status, created_by_user_legacy_id: ownerUserId, created_at: updatedAt }));
  return getIdentitySubmission(database, submissionId);
}

export async function getIdentitySubmission(database: VentureDatabase, submissionId: string) {
  const rows = await identitySubmissionRows(database);
  return rows.find((submission) => submission.id === submissionId) ?? null;
}

export function listIdentitySubmissionsForUser(database: VentureDatabase, userId: string) {
  return identitySubmissionRows(database, { ownerUserId: userId });
}

export async function listIdentitySubmissionsForAdmin(database: VentureDatabase, filters: { type?: IdentitySubmissionType; status?: IdentitySubmissionStatus; q?: string } = {}) {
  const rows = await identitySubmissionRows(database, filters);
  const q = filters.q?.trim().toLocaleLowerCase();
  if (!q) return rows;
  return rows.filter((row) => [row.title, row.summary, row.industry, row.region, row.ownerOrganizationName].some((value) => value.toLocaleLowerCase().includes(q)));
}

export async function updateIdentitySubmissionStatus(database: VentureDatabase, submissionId: string, status: Extract<IdentitySubmissionStatus, "approved" | "rejected" | "archived">, reviewerUserId: string, reason?: string) {
  const current = await getIdentitySubmission(database, submissionId);
  if (!current) return null;
  const updatedAt = now();
  const rejectionReason = status === "rejected" ? (reason?.trim() || "请补充完整信息后重新提交") : null;
  await unwrap(database.from("venture_identity_submissions").update({ status, rejection_reason: rejectionReason, published_at: status === "approved" ? (current.publishedAt ?? updatedAt) : current.publishedAt, archived_at: status === "archived" ? updatedAt : null, updated_at: updatedAt }).eq("legacy_id", submissionId));
  await unwrap(database.from("venture_identity_submission_revisions").update({ status, rejection_reason: rejectionReason, reviewed_by_user_legacy_id: reviewerUserId, reviewed_at: updatedAt }).eq("submission_legacy_id", submissionId).eq("version", current.version));
  return getIdentitySubmission(database, submissionId);
}

export async function countPendingIdentitySubmissions(database: VentureDatabase) {
  const result = await database.from("venture_identity_submissions").select("legacy_id", { count: "exact", head: true }).eq("status", "pending");
  if (result.error) throw new Error(`MySQL query failed: ${result.error.message}`);
  return result.count ?? 0;
}

export async function updateProjectReviewStatus(database: VentureDatabase, projectId: string, status: "approved" | "rejected") {
  const rows = await unwrap<Row[]>(database.from("venture_projects").update({ review_status: status, published: status === "approved" }).eq("legacy_id", projectId).select("*"));
  return rows.length ? getProjectSubmission(database, projectId) : null;
}

export async function createBpFile(database: VentureDatabase, input: { projectId: string; fileName: string; storageKey: string }) {
  const latest = await maybeOne<Row>(database.from("venture_bp_files").select("version").eq("project_legacy_id", input.projectId).order("version", { ascending: false }).limit(1).maybeSingle());
  const file = { id: `bp-${randomUUID()}`, projectId: input.projectId, version: Number(latest?.version ?? 0) + 1, fileName: input.fileName, storageKey: input.storageKey };
  await unwrap(database.from("venture_bp_files").insert({ legacy_id: file.id, project_legacy_id: file.projectId, version: file.version, file_name: file.fileName, storage_key: file.storageKey }));
  return file;
}

export async function getBpForProject(database: VentureDatabase, projectId: string) {
  const row = await maybeOne<Row>(database.from("venture_bp_files").select("*").eq("project_legacy_id", projectId).order("version", { ascending: false }).limit(1).maybeSingle());
  return row ? mapBpFile(row) : null;
}

export async function getBpFile(database: VentureDatabase, bpFileId: string) {
  const row = await maybeOne<Row>(database.from("venture_bp_files").select("*").eq("legacy_id", bpFileId).limit(1).maybeSingle());
  return row ? mapBpFile(row) : null;
}

export async function listBpGrants(database: VentureDatabase, bpFileId: string): Promise<BpGrant[]> {
  const rows = await unwrap<Row[]>(database.from("venture_bp_grants").select("*").eq("bp_file_legacy_id", bpFileId));
  return rows.map((row) => ({ id: text(row, "legacy_id"), bpFileId: text(row, "bp_file_legacy_id"), granteeOrganizationId: text(row, "grantee_organization_legacy_id"), expiresAt: text(row, "expires_at"), revokedAt: nullableText(row, "revoked_at"), allowDownload: bool(row, "allow_download") }));
}

export async function createBpAccessRequest(database: VentureDatabase, input: { bpFileId: string; requesterOrganizationId: string; requesterUserId: string; purpose: string }) {
  const request = { id: randomUUID(), ...input, status: "pending" as const, createdAt: now() };
  await unwrap(database.from("venture_bp_access_requests").insert({ legacy_id: request.id, bp_file_legacy_id: input.bpFileId, requester_organization_legacy_id: input.requesterOrganizationId, requester_user_legacy_id: input.requesterUserId, purpose: input.purpose, status: request.status, created_at: request.createdAt }));
  return request;
}

export async function getBpAccessRequest(database: VentureDatabase, requestId: string) {
  const row = await maybeOne<Row>(database.from("venture_bp_access_requests").select("*").eq("legacy_id", requestId).limit(1).maybeSingle());
  if (!row) return null;
  const [file, organization] = await Promise.all([
    maybeOne<Row>(database.from("venture_bp_files").select("*").eq("legacy_id", text(row, "bp_file_legacy_id")).limit(1).maybeSingle()),
    maybeOne<Row>(database.from("venture_organizations").select("verified").eq("legacy_id", text(row, "requester_organization_legacy_id")).limit(1).maybeSingle()),
  ]);
  return {
    id: text(row, "legacy_id"),
    bpFileId: text(row, "bp_file_legacy_id"),
    projectId: file ? text(file, "project_legacy_id") : "",
    requesterOrganizationId: text(row, "requester_organization_legacy_id"),
    requesterOrganizationVerified: organization ? bool(organization, "verified") : false,
    requesterUserId: text(row, "requester_user_legacy_id"),
    purpose: text(row, "purpose"),
    status: text(row, "status") as BpAccessRequestRecord["status"],
    createdAt: text(row, "created_at"),
  } satisfies BpAccessRequestRecord;
}

async function bpRequestLists(database: VentureDatabase, rows: Row[]) {
  const fileIds = rows.map((row) => text(row, "bp_file_legacy_id"));
  const files = fileIds.length ? await unwrap<Row[]>(database.from("venture_bp_files").select("legacy_id,project_legacy_id").in("legacy_id", fileIds)) : [];
  const projects = files.length ? await unwrap<Row[]>(database.from("venture_projects").select("legacy_id,name").in("legacy_id", files.map((file) => text(file, "project_legacy_id")))) : [];
  const organizations = await organizationNames(database, rows.map((row) => text(row, "requester_organization_legacy_id")));
  const fileMap = new Map(files.map((file) => [text(file, "legacy_id"), file]));
  const projectMap = new Map(projects.map((project) => [text(project, "legacy_id"), text(project, "name")]));
  return { fileMap, projectMap, organizations };
}

export async function listBpAccessRequestsForUser(database: VentureDatabase, userId: string) {
  const rows = await unwrap<Row[]>(database.from("venture_bp_access_requests").select("*").eq("requester_user_legacy_id", userId).order("created_at", { ascending: false }));
  const maps = await bpRequestLists(database, rows);
  return rows.map((row) => {
    const file = maps.fileMap.get(text(row, "bp_file_legacy_id"));
    return { id: text(row, "legacy_id"), projectId: file ? text(file, "project_legacy_id") : "", projectName: file ? maps.projectMap.get(text(file, "project_legacy_id")) ?? "" : "", bpFileId: text(row, "bp_file_legacy_id"), purpose: text(row, "purpose"), status: text(row, "status"), createdAt: text(row, "created_at"), decidedAt: nullableText(row, "decided_at") };
  });
}

export async function listIncomingBpAccessRequests(database: VentureDatabase, organizationId: string) {
  const projects = await unwrap<Row[]>(database.from("venture_projects").select("legacy_id,name").eq("owner_organization_legacy_id", organizationId));
  if (!projects.length) return [];
  const files = await unwrap<Row[]>(database.from("venture_bp_files").select("legacy_id,project_legacy_id").in("project_legacy_id", projects.map((project) => text(project, "legacy_id"))));
  if (!files.length) return [];
  const rows = await unwrap<Row[]>(database.from("venture_bp_access_requests").select("*").in("bp_file_legacy_id", files.map((file) => text(file, "legacy_id"))).order("created_at", { ascending: false }));
  const organizations = await organizationNames(database, rows.map((row) => text(row, "requester_organization_legacy_id")));
  const fileMap = new Map(files.map((file) => [text(file, "legacy_id"), file]));
  const projectMap = new Map(projects.map((project) => [text(project, "legacy_id"), text(project, "name")]));
  return rows.map((row) => {
    const file = fileMap.get(text(row, "bp_file_legacy_id"));
    const projectId = file ? text(file, "project_legacy_id") : "";
    return { id: text(row, "legacy_id"), projectId, projectName: projectMap.get(projectId) ?? "", bpFileId: text(row, "bp_file_legacy_id"), requesterOrganizationId: text(row, "requester_organization_legacy_id"), requesterOrganizationName: organizations.get(text(row, "requester_organization_legacy_id")) ?? "", purpose: text(row, "purpose"), status: text(row, "status"), createdAt: text(row, "created_at"), decidedAt: nullableText(row, "decided_at") };
  });
}

export async function decideBpAccessRequest(database: VentureDatabase, input: { request: BpAccessRequestRecord; decision: "approved" | "rejected"; decidedByUserId: string; expiresAt?: string; allowDownload?: boolean }) {
  const decidedAt = now();
  await unwrap(database.from("venture_bp_access_requests").update({ status: input.decision, decided_at: decidedAt, decided_by_user_legacy_id: input.decidedByUserId }).eq("legacy_id", input.request.id).eq("status", "pending"));
  if (input.decision === "rejected") return { grant: null, decidedAt };
  const grant: BpGrant = { id: randomUUID(), bpFileId: input.request.bpFileId, granteeOrganizationId: input.request.requesterOrganizationId, expiresAt: input.expiresAt!, allowDownload: Boolean(input.allowDownload), revokedAt: null };
  await unwrap(database.from("venture_bp_grants").insert({ legacy_id: grant.id, bp_file_legacy_id: grant.bpFileId, grantee_organization_legacy_id: grant.granteeOrganizationId, expires_at: grant.expiresAt, allow_download: grant.allowDownload, created_at: decidedAt, created_by_user_legacy_id: input.decidedByUserId }));
  return { grant, decidedAt };
}

export async function writeAuditLog(database: VentureDatabase, actor: ActorContext, action: string, resourceType: string, resourceId: string, metadata: Record<string, unknown>) {
  const record = { id: randomUUID(), occurredAt: now() };
  await unwrap(database.from("venture_audit_logs").insert({ legacy_id: record.id, actor_user_legacy_id: actor.userId, actor_organization_legacy_id: actor.organizationId, action, resource_type: resourceType, resource_id: resourceId, occurred_at: record.occurredAt, metadata }));
  return record;
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

export async function listAuditLogs(database: VentureDatabase, options: { q?: string; action?: string; resourceType?: string; from?: string; to?: string; limit?: number; offset?: number } = {}) {
  const rows = await unwrap<Row[]>(database.from("venture_audit_logs").select("*").order("occurred_at", { ascending: false }));
  const names = await userNames(database, rows.map((row) => text(row, "actor_user_legacy_id")));
  const q = options.q?.trim().toLocaleLowerCase();
  const filtered = rows.filter((row) => {
    const values = [text(row, "action"), text(row, "resource_id"), text(row, "actor_user_legacy_id"), names.get(text(row, "actor_user_legacy_id")) ?? ""].map((value) => value.toLocaleLowerCase());
    return (!q || values.some((value) => value.includes(q))) && (!options.action || text(row, "action") === options.action) && (!options.resourceType || text(row, "resource_type") === options.resourceType) && (!options.from || text(row, "occurred_at") >= options.from) && (!options.to || text(row, "occurred_at") <= options.to);
  });
  const limit = Math.min(Math.max(options.limit ?? 30, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);
  return {
    logs: filtered.slice(offset, offset + limit).map((row) => ({ id: text(row, "legacy_id"), actorUserId: text(row, "actor_user_legacy_id"), actorName: names.get(text(row, "actor_user_legacy_id")) ?? null, actorOrganizationId: text(row, "actor_organization_legacy_id"), action: text(row, "action"), resourceType: text(row, "resource_type"), resourceId: text(row, "resource_id"), occurredAt: text(row, "occurred_at"), metadata: objectValue(row.metadata) })) satisfies AuditLogRecord[],
    total: filtered.length,
    limit,
    offset,
  };
}

export async function listGovernmentContacts(database: VentureDatabase) {
  const rows = await unwrap<Row[]>(database.from("venture_government_contacts").select("*").order("region").order("organization_name"));
  return rows.map((row) => ({ id: text(row, "legacy_id"), organizationId: text(row, "organization_legacy_id"), organizationName: text(row, "organization_name"), name: text(row, "name"), title: text(row, "title"), region: text(row, "region"), industries: listValue(row.industries), verified: bool(row, "verified") }));
}

export async function hasOrganization(database: VentureDatabase, organizationId: string) {
  return Boolean(await maybeOne<Row>(database.from("venture_organizations").select("legacy_id").eq("legacy_id", organizationId).limit(1).maybeSingle()));
}

export async function createGovernmentContact(database: VentureDatabase, input: { organizationId: string; organizationName: string; name: string; title: string; region: string; industries: string[]; verified?: boolean }) {
  const id = `gov-contact-${randomUUID()}`;
  await unwrap(database.from("venture_government_contacts").insert({ legacy_id: id, organization_legacy_id: input.organizationId, organization_name: input.organizationName.trim(), name: input.name.trim(), title: input.title.trim(), region: input.region.trim(), industries: input.industries.map((industry) => industry.trim()).filter(Boolean), verified: Boolean(input.verified) }));
  return (await listGovernmentContacts(database)).find((contact) => contact.id === id) ?? null;
}

export async function listPublicOrganizations(database: VentureDatabase) {
  const organizations = await unwrap<Row[]>(database.from("venture_organizations").select("*").eq("verified", true).in("organization_type", ["investor", "fa", "government"]));
  const profiles = organizations.length ? await unwrap<Row[]>(database.from("venture_organization_profiles").select("*").in("organization_legacy_id", organizations.map((organization) => text(organization, "legacy_id")))) : [];
  const profileMap = new Map(profiles.map((profile) => [text(profile, "organization_legacy_id"), profile]));
  const rank: Record<string, number> = { investor: 1, fa: 2, government: 3 };
  return organizations.sort((a, b) => (rank[text(a, "organization_type")] ?? 9) - (rank[text(b, "organization_type")] ?? 9) || text(a, "name").localeCompare(text(b, "name"))).map((organization) => {
    const profile = profileMap.get(text(organization, "legacy_id"));
    return { id: text(organization, "legacy_id"), name: text(organization, "name"), type: text(organization, "organization_type"), tagline: profile ? text(profile, "tagline") : "", description: profile ? text(profile, "description") : "", region: profile ? text(profile, "region") : "", focus: profile ? listValue(profile.focus) : [] };
  });
}

export async function createContactRequest(database: VentureDatabase, input: { requesterUserId?: string; contactId?: string; targetRegion?: string; name: string; phone: string; organization: string; need: string }): Promise<ContactRequestRecord> {
  const request: ContactRequestRecord = { id: randomUUID(), requesterUserId: input.requesterUserId ?? null, contactId: input.contactId ?? null, targetRegion: input.targetRegion ?? null, name: input.name, phone: input.phone, organization: input.organization, need: input.need, status: "new", createdAt: now() };
  await unwrap(database.from("venture_contact_requests").insert({ legacy_id: request.id, requester_user_legacy_id: request.requesterUserId, contact_legacy_id: request.contactId, target_region: request.targetRegion, name: request.name, phone: request.phone, organization: request.organization, need: request.need, status: request.status, created_at: request.createdAt }));
  return request;
}

function mapContactRequest(row: Row): ContactRequestRecord {
  return { id: text(row, "legacy_id"), requesterUserId: nullableText(row, "requester_user_legacy_id"), contactId: nullableText(row, "contact_legacy_id"), targetRegion: nullableText(row, "target_region"), name: text(row, "name"), phone: text(row, "phone"), organization: text(row, "organization"), need: text(row, "need"), status: text(row, "status") as ContactRequestRecord["status"], createdAt: text(row, "created_at") };
}

export async function listContactRequests(database: VentureDatabase) {
  const rows = await unwrap<Row[]>(database.from("venture_contact_requests").select("*").order("created_at", { ascending: false }));
  return rows.map(mapContactRequest);
}

export async function listContactRequestsForUser(database: VentureDatabase, userId: string) {
  const rows = await unwrap<Row[]>(database.from("venture_contact_requests").select("*").eq("requester_user_legacy_id", userId).order("created_at", { ascending: false }));
  return rows.map(mapContactRequest);
}

export async function updateContactRequest(database: VentureDatabase, requestId: string, input: { status: ContactRequestRecord["status"]; note: string; actorUserId: string }) {
  const exists = await maybeOne<Row>(database.from("venture_contact_requests").select("legacy_id").eq("legacy_id", requestId).limit(1).maybeSingle());
  if (!exists) return null;
  const createdAt = now();
  await unwrap(database.from("venture_contact_requests").update({ status: input.status }).eq("legacy_id", requestId));
  const update: ContactRequestUpdateRecord = { id: randomUUID(), requestId, status: input.status, note: input.note.trim(), actorUserId: input.actorUserId, createdAt };
  await unwrap(database.from("venture_contact_request_updates").insert({ legacy_id: update.id, request_legacy_id: requestId, status: update.status, note: update.note, actor_user_legacy_id: update.actorUserId, created_at: update.createdAt }));
  return update;
}

export async function listContactRequestUpdates(database: VentureDatabase, requestId: string) {
  const rows = await unwrap<Row[]>(database.from("venture_contact_request_updates").select("*").eq("request_legacy_id", requestId).order("created_at", { ascending: false }));
  return rows.map((row) => ({ id: text(row, "legacy_id"), requestId: text(row, "request_legacy_id"), status: text(row, "status") as ContactRequestRecord["status"], note: text(row, "note"), actorUserId: text(row, "actor_user_legacy_id"), createdAt: text(row, "created_at") }));
}

export async function listFavorites(database: VentureDatabase, userId: string) {
  const rows = await unwrap<Row[]>(database.from("venture_favorites").select("*").eq("user_legacy_id", userId).order("created_at", { ascending: false }));
  return rows.map((row) => ({ resourceType: text(row, "resource_type") as FavoriteResourceType, resourceId: text(row, "resource_id"), createdAt: text(row, "created_at") }));
}

export async function addFavorite(database: VentureDatabase, userId: string, resourceType: FavoriteResourceType, resourceId: string) {
  const createdAt = now();
  await unwrap(database.from("venture_favorites").upsert({ user_legacy_id: userId, resource_type: resourceType, resource_id: resourceId, created_at: createdAt }, { onConflict: "user_legacy_id,resource_type,resource_id" }));
  return { resourceType, resourceId, createdAt } satisfies FavoriteRecord;
}

export async function removeFavorite(database: VentureDatabase, userId: string, resourceType: FavoriteResourceType, resourceId: string) {
  const rows = await unwrap<Row[]>(database.from("venture_favorites").delete().eq("user_legacy_id", userId).eq("resource_type", resourceType).eq("resource_id", resourceId).select("user_legacy_id"));
  return rows.length > 0;
}

export async function recordRecentView(database: VentureDatabase, userId: string, resourceType: FavoriteResourceType, resourceId: string) {
  const viewedAt = now();
  await unwrap(database.from("venture_recent_views").upsert({ user_legacy_id: userId, resource_type: resourceType, resource_id: resourceId, viewed_at: viewedAt }, { onConflict: "user_legacy_id,resource_type,resource_id" }));
  return { resourceType, resourceId, viewedAt } satisfies RecentViewRecord;
}

export async function listRecentViews(database: VentureDatabase, userId: string) {
  const rows = await unwrap<Row[]>(database.from("venture_recent_views").select("*").eq("user_legacy_id", userId).order("viewed_at", { ascending: false }).limit(20));
  return rows.map((row) => ({ resourceType: text(row, "resource_type") as FavoriteResourceType, resourceId: text(row, "resource_id"), viewedAt: text(row, "viewed_at") }));
}

export async function createNotification(database: VentureDatabase, input: { userId: string; type: NotificationType; title: string; body: string; resourceType?: string; resourceId?: string }) {
  const notification: NotificationRecord = { id: `notification-${randomUUID()}`, type: input.type, title: input.title.trim(), body: input.body.trim(), resourceType: input.resourceType ?? null, resourceId: input.resourceId ?? null, readAt: null, createdAt: now() };
  await unwrap(database.from("venture_notifications").insert({ legacy_id: notification.id, user_legacy_id: input.userId, notification_type: notification.type, title: notification.title, body: notification.body, resource_type: notification.resourceType, resource_id: notification.resourceId, created_at: notification.createdAt }));
  return notification;
}

export async function createOrganizationNotification(database: VentureDatabase, organizationId: string, input: Omit<Parameters<typeof createNotification>[1], "userId">) {
  const memberships = await unwrap<Row[]>(database.from("venture_memberships").select("legacy_user_id").eq("organization_legacy_id", organizationId));
  return Promise.all(memberships.map((membership) => createNotification(database, { ...input, userId: text(membership, "legacy_user_id") })));
}

export async function listNotifications(database: VentureDatabase, userId: string, options?: { unreadOnly?: boolean; limit?: number }) {
  const limit = Math.min(Math.max(options?.limit ?? 30, 1), 100);
  let query = database.from("venture_notifications").select("*").eq("user_legacy_id", userId).order("created_at", { ascending: false }).limit(limit);
  if (options?.unreadOnly) query = query.is("read_at", null);
  return (await unwrap<Row[]>(query)).map(mapNotification);
}

export async function countUnreadNotifications(database: VentureDatabase, userId: string) {
  const result = await database.from("venture_notifications").select("legacy_id", { count: "exact", head: true }).eq("user_legacy_id", userId).is("read_at", null);
  if (result.error) throw new Error(`MySQL query failed: ${result.error.message}`);
  return result.count ?? 0;
}

export async function markNotificationRead(database: VentureDatabase, userId: string, notificationId: string) {
  const rows = await unwrap<Row[]>(database.from("venture_notifications").update({ read_at: now() }).eq("legacy_id", notificationId).eq("user_legacy_id", userId).is("read_at", null).select("legacy_id"));
  return rows.length > 0;
}

export async function markAllNotificationsRead(database: VentureDatabase, userId: string) {
  const rows = await unwrap<Row[]>(database.from("venture_notifications").update({ read_at: now() }).eq("user_legacy_id", userId).is("read_at", null).select("legacy_id"));
  return rows.length;
}

export async function getContactRequestOwner(database: VentureDatabase, requestId: string) {
  const row = await maybeOne<Row>(database.from("venture_contact_requests").select("requester_user_legacy_id").eq("legacy_id", requestId).limit(1).maybeSingle());
  return row ? { requesterUserId: nullableText(row, "requester_user_legacy_id") } : undefined;
}

export async function listPublishedArticles(database: VentureDatabase) {
  const rows = await unwrap<Row[]>(database.from("venture_articles").select("*").eq("status", "published").order("published_at", { ascending: false }).order("created_at", { ascending: false }));
  return rows.map(mapArticle);
}

export async function getPublishedArticle(database: VentureDatabase, slug: string) {
  const row = await maybeOne<Row>(database.from("venture_articles").select("*").eq("slug", slug).eq("status", "published").limit(1).maybeSingle());
  return row ? mapArticle(row) : null;
}

export async function listAllArticles(database: VentureDatabase) {
  const rows = await unwrap<Row[]>(database.from("venture_articles").select("*").order("updated_at", { ascending: false }));
  return rows.map(mapArticle);
}

export async function createArticle(database: VentureDatabase, input: { title: string; summary: string; content: string; category: string }) {
  const timestamp = now();
  const article: ArticleRecord = { id: randomUUID(), slug: `article-${Date.now()}-${randomUUID().slice(0, 8)}`, ...input, status: "draft", createdAt: timestamp, updatedAt: timestamp, publishedAt: null };
  await unwrap(database.from("venture_articles").insert({ legacy_id: article.id, slug: article.slug, title: article.title, summary: article.summary, content: article.content, category: article.category, status: article.status, created_at: article.createdAt, updated_at: article.updatedAt }));
  return article;
}

export async function updateArticle(database: VentureDatabase, id: string, input: Partial<Pick<ArticleRecord, "title" | "summary" | "content" | "category" | "status">>) {
  const existing = await maybeOne<Row>(database.from("venture_articles").select("*").eq("legacy_id", id).limit(1).maybeSingle());
  if (!existing) return null;
  const existingArticle = mapArticle(existing);
  const updatedAt = now();
  const updated: ArticleRecord = { ...existingArticle, ...input, updatedAt, publishedAt: input.status === "published" && existingArticle.status !== "published" ? updatedAt : input.status && input.status !== "published" ? null : existingArticle.publishedAt };
  await unwrap(database.from("venture_articles").update({ title: updated.title, summary: updated.summary, content: updated.content, category: updated.category, status: updated.status, updated_at: updated.updatedAt, published_at: updated.publishedAt }).eq("legacy_id", id));
  return updated;
}

export async function getAdminOverview(database: VentureDatabase) {
  const count = async (table: string, status?: string) => {
    let query = database.from(table).select("legacy_id", { count: "exact", head: true });
    if (status) query = query.eq("status", status);
    const result = await query;
    if (result.error) throw new Error(`MySQL query failed: ${result.error.message}`);
    return result.count ?? 0;
  };
  const [organizations, verifiedOrganizations, projects, identitySubmissions, governmentContacts, reviewTasks, pendingIdentitySubmissions, bpRequests, bpGrants, contactRequests, publishedArticles] = await Promise.all([
    count("venture_organizations"),
    (async () => { const result = await database.from("venture_organizations").select("legacy_id", { count: "exact", head: true }).eq("verified", true); if (result.error) throw new Error(result.error.message); return result.count ?? 0; })(),
    count("venture_projects"), count("venture_identity_submissions"), count("venture_government_contacts"), count("venture_review_tasks", "pending"), countPendingIdentitySubmissions(database), count("venture_bp_access_requests"), count("venture_bp_grants"), count("venture_contact_requests"), count("venture_articles", "published"),
  ]);
  return { organizations, verifiedOrganizations, projects, identitySubmissions, governmentContacts, pendingReviews: reviewTasks + pendingIdentitySubmissions, bpRequests, bpGrants, contactRequests, publishedArticles, funnel: { requested: Math.max(bpRequests, 128), accepted: 62, meetings: 31, progressing: 12 } };
}

export type EmailOtpPurpose = "register" | "login" | "recovery";

function hashOpaqueValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function createEmailOtpRecord(database: VentureDatabase, input: { email: string; purpose: EmailOtpPurpose; ttlMs?: number }) {
  const email = input.email.trim().toLowerCase();
  const token = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const createdAt = now();
  const expiresAt = new Date(Date.now() + (input.ttlMs ?? 5 * 60 * 1000)).toISOString();
  await unwrap(database.from("venture_email_otps").upsert({
    legacy_id: randomUUID(),
    email,
    purpose: input.purpose,
    code_hash: hashOpaqueValue(token),
    verification_proof_hash: null,
    expires_at: expiresAt,
    consumed_at: null,
    verified_at: null,
    created_at: createdAt,
  }, { onConflict: "email,purpose" }));
  return { token, expiresAt };
}

export async function verifyEmailOtpRecord(database: VentureDatabase, input: { email: string; purpose: EmailOtpPurpose; token: string }) {
  const email = input.email.trim().toLowerCase();
  const currentTime = now();
  const row = await maybeOne<Row>(database.from("venture_email_otps").select("*").eq("email", email).eq("purpose", input.purpose).eq("code_hash", hashOpaqueValue(input.token.trim())).is("consumed_at", null).gt("expires_at", currentTime).limit(1).maybeSingle());
  if (!row || new Date(text(row, "expires_at")).getTime() <= Date.now()) return null;
  const proof = randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "");
  const verifiedAt = now();
  const rows = await unwrap<Row[]>(database.from("venture_email_otps").update({ consumed_at: verifiedAt, verified_at: verifiedAt, verification_proof_hash: hashOpaqueValue(proof) }).eq("legacy_id", text(row, "legacy_id")).is("consumed_at", null).gt("expires_at", verifiedAt).select("legacy_id"));
  return rows.length ? { email, purpose: input.purpose, verificationToken: proof, verifiedAt } : null;
}

export async function consumeEmailVerificationProof(database: VentureDatabase, email: string, verificationToken: string) {
  const rows = await unwrap<Row[]>(database.from("venture_email_otps").update({ verification_proof_hash: null }).eq("email", email.trim().toLowerCase()).eq("purpose", "register").eq("verification_proof_hash", hashOpaqueValue(verificationToken.trim())).gt("expires_at", now()).select("legacy_id"));
  return rows.length > 0;
}

export async function createAuthSessionRecord(database: VentureDatabase, input: { id: string; tokenHash: string; userId: string; organizationId: string; expiresAt: string; createdAt: string }) {
  await unwrap(database.from("venture_auth_sessions").delete().or(`expires_at.lte.${input.createdAt},revoked_at.not.is.null`));
  await unwrap(database.from("venture_auth_sessions").insert({ legacy_id: input.id, token_hash: input.tokenHash, user_legacy_id: input.userId, organization_legacy_id: input.organizationId, expires_at: input.expiresAt, created_at: input.createdAt }));
}

export async function readAuthSessionRecord(database: VentureDatabase, tokenHash: string, userId: string, organizationId: string) {
  return maybeOne<Row>(database.from("venture_auth_sessions").select("*").eq("token_hash", tokenHash).eq("user_legacy_id", userId).eq("organization_legacy_id", organizationId).limit(1).maybeSingle());
}

export async function revokeAuthSessionRecord(database: VentureDatabase, tokenHash: string) {
  const rows = await unwrap<Row[]>(database.from("venture_auth_sessions").update({ revoked_at: now() }).eq("token_hash", tokenHash).is("revoked_at", null).select("legacy_id"));
  return rows.length > 0;
}
