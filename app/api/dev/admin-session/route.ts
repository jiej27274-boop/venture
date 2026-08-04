import { createSession, hashPassword } from "../../../../server/auth";
import { getAuthAccountByUserId, resolveActor } from "../../../../server/database";
import { getVentureDatabase } from "../../../../lib/venture-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  if (process.env.NODE_ENV === "production") return Response.json({ error: "not_found" }, { status: 404 });
  const database = getVentureDatabase();
  const now = new Date().toISOString();
  if (!getAuthAccountByUserId(database, "user-admin")) {
    database.prepare(`
      INSERT INTO auth_accounts
        (user_id, email, phone, supabase_user_id, password_hash, role, status, email_verified_at, created_at)
      VALUES (?, ?, NULL, NULL, ?, 'platform', 'active', ?, ?)
    `).run("user-admin", "admin@venture.local", hashPassword("local-admin-only"), now, now);
  }
  const actor = resolveActor(database, "user-admin", "org-platform");
  if (!actor?.roles.includes("platform_admin")) return Response.json({ error: "platform_admin_required" }, { status: 403 });
  return Response.json({ session: createSession({ userId: "user-admin", organizationId: "org-platform" }, database), actor, localOnly: true });
}
