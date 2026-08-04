import { createSession } from "../../../../server/auth";
import { getAuthAccountByUserId, resolveActor } from "../../../../server/database-mysql";
import { getVentureDatabase } from "../../../../lib/venture-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  if (process.env.NODE_ENV === "production") return Response.json({ error: "not_found" }, { status: 404 });
  const database = getVentureDatabase();
  const account = await getAuthAccountByUserId(database, "user-admin");
  if (!account) return Response.json({ error: "local_admin_not_seeded" }, { status: 503 });
  const actor = await resolveActor(database, "user-admin", account.organizationId);
  if (!actor?.roles.includes("platform_admin")) return Response.json({ error: "platform_admin_required" }, { status: 403 });
  return Response.json({ session: await createSession({ userId: "user-admin", organizationId: account.organizationId }, database), actor, localOnly: true });
}
