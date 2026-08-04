import { runtimeStatus } from "../../../lib/venture-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(runtimeStatus(), { headers: { "cache-control": "no-store" } });
}
