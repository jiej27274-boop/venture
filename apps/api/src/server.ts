import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { createDatabase, seedDatabase } from "./database.ts";

const defaultDatabasePath = fileURLToPath(new URL("../../../data/venture.db", import.meta.url));
const database = createDatabase(process.env.VENTURE_DB_PATH ?? defaultDatabasePath);
seedDatabase(database);

const port = Number(process.env.PORT ?? 8787);
const app = createApp({ database });

serve({ fetch: app.fetch, port, hostname: "127.0.0.1" }, (info) => {
  console.log(`创投智联 API 已启动：http://127.0.0.1:${info.port}`);
});
