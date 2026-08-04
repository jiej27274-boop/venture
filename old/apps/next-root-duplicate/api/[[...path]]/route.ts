import { handleVentureApi } from "../../../lib/venture-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handler(request: Request) {
  return handleVentureApi(request);
}

export { handler as DELETE, handler as GET, handler as PATCH, handler as POST, handler as PUT };
