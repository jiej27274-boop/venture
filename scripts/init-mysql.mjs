import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPool } from "mysql2/promise";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(scriptDir, "..", "database", "mysql", "schema.sql");

function mysqlConfig() {
  const url = process.env.MYSQL_URL?.trim();
  if (url) {
    const parsed = new URL(url);
    return { host: parsed.hostname, port: Number(parsed.port || 3306), user: decodeURIComponent(parsed.username), password: decodeURIComponent(parsed.password), database: decodeURIComponent(parsed.pathname.replace(/^\//, "")) };
  }
  return { host: process.env.MYSQL_HOST?.trim() || "127.0.0.1", port: Number(process.env.MYSQL_PORT ?? 3306), user: process.env.MYSQL_USER?.trim() || "venture", password: process.env.MYSQL_PASSWORD ?? "", database: process.env.MYSQL_DATABASE?.trim() || "venture" };
}

const pool = createPool({ ...mysqlConfig(), waitForConnections: true, connectionLimit: 2, queueLimit: 0, multipleStatements: true, charset: "utf8mb4", timezone: "Z" });
try {
  await pool.query(await readFile(schemaPath, "utf8"));
  const [usernameColumns] = await pool.query(
    "SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'venture_auth_accounts' AND column_name = 'username' LIMIT 1",
  );
  if (!usernameColumns.length) {
    await pool.query("ALTER TABLE venture_auth_accounts ADD COLUMN username VARCHAR(191) NULL UNIQUE AFTER legacy_user_id");
  }
  const [sessionTypeColumns] = await pool.query(
    "SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'venture_auth_sessions' AND column_name = 'session_type' LIMIT 1",
  );
  if (!sessionTypeColumns.length) {
    await pool.query("ALTER TABLE venture_auth_sessions ADD COLUMN session_type VARCHAR(16) NOT NULL DEFAULT 'public' AFTER organization_legacy_id");
  }
  const [indexes] = await pool.query(
    "SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'venture_email_otps' AND index_name = 'venture_email_otps_email_purpose_unique' LIMIT 1",
  );
  if (!indexes.length) {
    await pool.query("ALTER TABLE venture_email_otps ADD UNIQUE KEY venture_email_otps_email_purpose_unique (email, purpose)");
  }
  console.log(`MySQL schema initialized from ${schemaPath}`);
} finally {
  await pool.end();
}
