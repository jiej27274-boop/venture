import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(scriptDir, "..", "..", "..");
const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const dryRun = !apply || args.has("--dry-run");
const sourceArg = process.argv.find((value) => value.startsWith("--source="))?.slice("--source=".length);
const sourcePath = resolve(sourceArg ?? resolve(workspaceRoot, "data", "venture.db"));
const batchSize = Number(process.argv.find((value) => value.startsWith("--batch-size="))?.slice("--batch-size=".length) ?? 100);

if (!existsSync(sourcePath)) {
  console.error(`找不到 SQLite 来源：${sourcePath}`);
  process.exit(1);
}

const database = new DatabaseSync(sourcePath, { readOnly: true });
const rows = (table) => database.prepare(`SELECT * FROM ${table}`).all();
const parseJson = (value, fallback = {}) => {
  if (!value) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
};
const parseList = (value) => String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
const bool = (value) => Boolean(Number(value));
const mapByUser = new Map(rows("memberships").map((row) => [row.user_id, row.organization_id]));

const plans = [
  ["organizations", "venture_organizations", rows("organizations").map((row) => ({ legacy_id: row.id, name: row.name, organization_type: row.type, verified: bool(row.verified) }))],
  ["users", "venture_users", rows("users").map((row) => ({ legacy_id: row.id, name: row.name }))],
  ["auth_accounts", "venture_auth_accounts", rows("auth_accounts").map((row) => ({ legacy_user_id: row.user_id, email: row.email, phone: row.phone, supabase_user_id: row.supabase_user_id, organization_legacy_id: mapByUser.get(row.user_id) ?? null, role: row.role, status: row.status, email_verified_at: row.email_verified_at, created_at: row.created_at }))],
  ["memberships", "venture_memberships", rows("memberships").map((row) => ({ legacy_user_id: row.user_id, organization_legacy_id: row.organization_id, roles: parseJson(row.roles_json, []) }))],
  ["organization_profiles", "venture_organization_profiles", rows("organization_profiles").map((row) => ({ organization_legacy_id: row.organization_id, tagline: row.tagline, description: row.description, region: row.region, focus: parseList(row.focus) }))],
  ["projects", "venture_projects", rows("projects").map((row) => ({ legacy_id: row.id, owner_organization_legacy_id: row.owner_organization_id, name: row.name, summary: row.summary, industry: row.industry, region: row.region, stage: row.stage, financing_range: row.financing_range, published: bool(row.published), review_status: row.review_status, identity_mode: row.identity_mode, anonymous_name: row.anonymous_name }))],
  ["project_fa_delegations", "venture_project_fa_delegations", rows("project_fa_delegations").map((row) => ({ project_legacy_id: row.project_id, fa_organization_legacy_id: row.fa_organization_id, can_manage_bp: bool(row.can_manage_bp) }))],
  ["bp_files", "venture_bp_files", rows("bp_files").map((row) => ({ legacy_id: row.id, project_legacy_id: row.project_id, version: row.version, file_name: row.file_name, storage_key: row.storage_key }))],
  ["bp_access_requests", "venture_bp_access_requests", rows("bp_access_requests").map((row) => ({ legacy_id: row.id, bp_file_legacy_id: row.bp_file_id, requester_organization_legacy_id: row.requester_organization_id, requester_user_legacy_id: row.requester_user_id, purpose: row.purpose, status: row.status, created_at: row.created_at, decided_at: row.decided_at, decided_by_user_legacy_id: row.decided_by_user_id }))],
  ["bp_grants", "venture_bp_grants", rows("bp_grants").map((row) => ({ legacy_id: row.id, bp_file_legacy_id: row.bp_file_id, grantee_organization_legacy_id: row.grantee_organization_id, expires_at: row.expires_at, allow_download: bool(row.allow_download), revoked_at: row.revoked_at, created_at: row.created_at, created_by_user_legacy_id: row.created_by_user_id }))],
  ["government_contacts", "venture_government_contacts", rows("government_contacts").map((row) => ({ legacy_id: row.id, organization_legacy_id: row.organization_id, organization_name: row.organization_name, name: row.name, title: row.title, region: row.region, industries: parseList(row.industries), verified: bool(row.verified) }))],
  ["review_tasks", "venture_review_tasks", rows("review_tasks").map((row) => ({ legacy_id: row.id, task_type: row.type, subject_legacy_id: row.subject_id, status: row.status }))],
  ["articles", "venture_articles", rows("articles").map((row) => ({ legacy_id: row.id, slug: row.slug, title: row.title, summary: row.summary, content: row.content, category: row.category, status: row.status, created_at: row.created_at, updated_at: row.updated_at, published_at: row.published_at }))],
  ["contact_requests", "venture_contact_requests", rows("contact_requests").map((row) => ({ legacy_id: row.id, requester_user_legacy_id: row.requester_user_id, contact_legacy_id: row.contact_id, target_region: row.target_region, name: row.name, phone: row.phone, organization: row.organization, need: row.need, status: row.status, created_at: row.created_at }))],
  ["contact_request_updates", "venture_contact_request_updates", rows("contact_request_updates").map((row) => ({ legacy_id: row.id, request_legacy_id: row.request_id, status: row.status, note: row.note, actor_user_legacy_id: row.actor_user_id, created_at: row.created_at }))],
  ["identity_submissions", "venture_identity_submissions", rows("identity_submissions").map((row) => ({ legacy_id: row.id, owner_user_legacy_id: row.owner_user_id, owner_organization_legacy_id: row.owner_organization_id, identity_type: row.identity_type, title: row.title, summary: row.summary, industry: row.industry, region: row.region, stage: row.stage, financing_range: row.financing_range, detail: parseJson(row.detail_json), status: row.status, current_version: row.current_version, rejection_reason: row.rejection_reason, submitted_at: row.submitted_at, published_at: row.published_at, archived_at: row.archived_at, created_at: row.created_at, updated_at: row.updated_at }))],
  ["identity_submission_revisions", "venture_identity_submission_revisions", rows("identity_submission_revisions").map((row) => ({ legacy_id: row.id, submission_legacy_id: row.submission_id, version: row.version, payload: parseJson(row.payload_json), status: row.status, rejection_reason: row.rejection_reason, created_by_user_legacy_id: row.created_by_user_id, reviewed_by_user_legacy_id: row.reviewed_by_user_id, created_at: row.created_at, reviewed_at: row.reviewed_at }))],
  ["user_favorites", "venture_favorites", rows("user_favorites").map((row) => ({ user_legacy_id: row.user_id, resource_type: row.resource_type, resource_id: row.resource_id, created_at: row.created_at }))],
  ["recent_views", "venture_recent_views", rows("recent_views").map((row) => ({ user_legacy_id: row.user_id, resource_type: row.resource_type, resource_id: row.resource_id, viewed_at: row.viewed_at }))],
  ["notifications", "venture_notifications", rows("notifications").map((row) => ({ legacy_id: row.id, user_legacy_id: row.user_id, notification_type: row.type, title: row.title, body: row.body, resource_type: row.resource_type, resource_id: row.resource_id, read_at: row.read_at, created_at: row.created_at }))],
  ["audit_logs", "venture_audit_logs", rows("audit_logs").map((row) => ({ legacy_id: row.id, actor_user_legacy_id: row.actor_user_id, actor_organization_legacy_id: row.actor_organization_id, action: row.action, resource_type: row.resource_type, resource_id: row.resource_id, occurred_at: row.occurred_at, metadata: parseJson(row.metadata_json) }))],
];

const rowCounts = Object.fromEntries(plans.map(([source, destination, items]) => [destination, { source, count: items.length }]));
console.log(JSON.stringify({ mode: dryRun ? "dry-run" : "apply", sourcePath, batchSize, tables: rowCounts }, null, 2));
if (dryRun) process.exit(0);

const url = process.env.SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !serviceRoleKey) {
  console.error("--apply 需要 SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY；服务角色密钥只从环境变量读取。");
  process.exit(1);
}
if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1000) {
  console.error("--batch-size 必须是 1 到 1000 的整数。");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const runId = randomUUID();
await supabase.from("venture_migration_runs").insert({ id: runId, source_name: sourcePath, mode: "apply", row_counts: rowCounts });
try {
  for (const [, destination, items] of plans) {
    for (let index = 0; index < items.length; index += batchSize) {
      const batch = items.slice(index, index + batchSize);
      const conflict = destination === "venture_auth_accounts" ? "legacy_user_id"
        : destination === "venture_organization_profiles" ? "organization_legacy_id"
        : destination === "venture_memberships" ? "legacy_user_id,organization_legacy_id"
        : destination === "venture_project_fa_delegations" ? "project_legacy_id,fa_organization_legacy_id"
        : destination === "venture_favorites" ? "user_legacy_id,resource_type,resource_id"
        : destination === "venture_recent_views" ? "user_legacy_id,resource_type,resource_id"
        : destination === "venture_bp_files" ? "project_legacy_id,version"
        : destination === "venture_identity_submission_revisions" ? "submission_legacy_id,version"
        : "legacy_id";
      const { error } = await supabase.from(destination).upsert(batch, { onConflict: conflict, ignoreDuplicates: false });
      if (error) throw new Error(`${destination}: ${error.message}`);
    }
    console.log(`已写入 ${destination}: ${items.length}`);
  }
  await supabase.from("venture_migration_runs").update({ finished_at: new Date().toISOString() }).eq("id", runId);
} catch (error) {
  await supabase.from("venture_migration_runs").update({ finished_at: new Date().toISOString(), error: String(error) }).eq("id", runId);
  throw error;
}
