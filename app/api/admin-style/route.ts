import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readSource(relativePath: string) {
  return readFileSync(resolve(process.cwd(), "components", "admin", relativePath), "utf8");
}

export function GET() {
  let css: string;
  try {
    css = readFileSync(resolve(process.cwd(), "public", "admin.css"), "utf8");
  } catch {
    css = `${readSource("styles.css")}\n${readSource("apple-admin-ui.css")}`;
  }
  return new Response(css, { headers: { "content-type": "text/css; charset=utf-8", "cache-control": "no-store" } });
}
