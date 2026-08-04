import { basename, dirname, join, resolve } from "node:path";
import { createApp } from "../../api/src/app";
import { createDatabase, seedDatabase, type VentureDatabase } from "../../api/src/database";
import { supabaseRuntimeStatus } from "../../api/src/supabase";

type RuntimeCache = {
  database?: VentureDatabase;
  app?: ReturnType<typeof createApp>;
};

const globalRuntime = globalThis as typeof globalThis & { __ventureRuntime?: RuntimeCache };

export function projectRoot() {
  const configured = process.env.VENTURE_PROJECT_ROOT?.trim();
  if (configured) return resolve(configured);
  const cwd = resolve(process.cwd());
  return basename(cwd).toLowerCase() === "next" && basename(dirname(cwd)).toLowerCase() === "apps"
    ? dirname(dirname(cwd))
    : cwd;
}

function databasePath() {
  const configured = process.env.VENTURE_DB_PATH?.trim();
  const filename = configured ? resolve(configured) : join(projectRoot(), "data", "venture.db");
  if (/^C:\\?/i.test(filename) && !filename.toLowerCase().startsWith(projectRoot().toLowerCase())) {
    throw new Error("VENTURE_DB_PATH 必须位于项目根目录，不能写入 C 盘");
  }
  return filename;
}

export function getVentureDatabase() {
  const cache = globalRuntime.__ventureRuntime ?? (globalRuntime.__ventureRuntime = {});
  if (!cache.database) {
    cache.database = createDatabase(databasePath());
    seedDatabase(cache.database);
  }
  return cache.database;
}

export function getVentureApp() {
  const cache = globalRuntime.__ventureRuntime ?? (globalRuntime.__ventureRuntime = {});
  if (!cache.app) cache.app = createApp({ database: getVentureDatabase() });
  return cache.app;
}

export async function handleVentureApi(request: Request) {
  const headers = new Headers(request.headers);
  // The Next.js surface never accepts the old browser-spoofable admin headers.
  headers.delete("x-user-id");
  headers.delete("x-organization-id");
  return getVentureApp().fetch(new Request(request, { headers }));
}

export function runtimeStatus() {
  const supabase = supabaseRuntimeStatus();
  return {
    ok: true,
    runtime: "next-app-router",
    database: "sqlite-compatibility",
    databasePath: databasePath(),
    supabase,
    localDataBoundary: projectRoot(),
  };
}
