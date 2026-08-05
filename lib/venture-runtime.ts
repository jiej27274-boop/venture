import { createApp } from "../server/app";
import { type VentureDatabase } from "../server/database-mysql";
import { createMySqlDatabase, mysqlRuntimeStatus } from "../server/mysql";

type RuntimeCache = {
  database?: VentureDatabase;
  app?: ReturnType<typeof createApp>;
};

const globalRuntime = globalThis as typeof globalThis & { __ventureRuntime?: RuntimeCache };

export function projectRoot() {
  return process.env.VENTURE_PROJECT_ROOT?.trim() || process.cwd();
}

export function getVentureDatabase() {
  const cache = globalRuntime.__ventureRuntime ?? (globalRuntime.__ventureRuntime = {});
  if (!cache.database) cache.database = createMySqlDatabase();
  return cache.database;
}

export function getVentureApp() {
  const cache = globalRuntime.__ventureRuntime ?? (globalRuntime.__ventureRuntime = {});
  if (!cache.app) cache.app = createApp({ database: getVentureDatabase() });
  return cache.app;
}

export async function handleVentureApi(request: Request) {
  const headers = new Headers(request.headers);
  headers.delete("x-user-id");
  headers.delete("x-organization-id");
  return getVentureApp().fetch(new Request(request, { headers }));
}

export function runtimeStatus() {
  if (process.env.NODE_ENV === "production") return { ok: true, runtime: "next-app-router" };
  const mysql = mysqlRuntimeStatus();
  return {
    ok: true,
    runtime: "next-app-router",
    database: mysql.configured ? "mysql" : "not-configured",
    mysql,
    localDataBoundary: projectRoot(),
  };
}
