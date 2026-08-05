import { readFile } from "node:fs/promises";
import { randomBytes, randomUUID, scryptSync } from "node:crypto";
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

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const digest = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${digest}`;
}

const username = process.env.ADMIN_USERNAME?.trim().toLowerCase() || "admin";
const password = process.env.ADMIN_PASSWORD ?? "";
if (!/^[a-z0-9][a-z0-9_.-]{2,63}$/.test(username)) throw new Error("ADMIN_USERNAME must be 3-64 characters: a-z, 0-9, dot, underscore, or hyphen");
if (password.length < 8 || password.length > 128) throw new Error("ADMIN_PASSWORD must be between 8 and 128 characters");

const pool = createPool({ ...mysqlConfig(), waitForConnections: true, connectionLimit: 2, queueLimit: 0, multipleStatements: true, charset: "utf8mb4", timezone: "Z" });
try {
  await pool.query(await readFile(schemaPath, "utf8"));
  const [columns] = await pool.query("SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'venture_auth_accounts' AND column_name = 'username' LIMIT 1");
  if (!columns.length) await pool.query("ALTER TABLE venture_auth_accounts ADD COLUMN username VARCHAR(191) NULL UNIQUE AFTER legacy_user_id");
  const [sessionTypeColumns] = await pool.query("SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'venture_auth_sessions' AND column_name = 'session_type' LIMIT 1");
  if (!sessionTypeColumns.length) await pool.query("ALTER TABLE venture_auth_sessions ADD COLUMN session_type VARCHAR(16) NOT NULL DEFAULT 'public' AFTER organization_legacy_id");

  const [namedRows] = await pool.query("SELECT legacy_user_id, organization_legacy_id, role FROM venture_auth_accounts WHERE username = ? LIMIT 1", [username]);
  const named = namedRows[0];
  if (named && named.role !== "platform") throw new Error("ADMIN_USERNAME_TAKEN_BY_NON_ADMIN");
  const userId = named?.legacy_user_id ?? randomUUID();
  const organizationId = named?.organization_legacy_id ?? randomUUID();
  const createdAt = new Date();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await connection.query(
      "INSERT INTO venture_organizations (legacy_id, name, organization_type, verified) VALUES (?, ?, 'platform', 1) ON DUPLICATE KEY UPDATE name = VALUES(name), organization_type = 'platform', verified = 1, updated_at = CURRENT_TIMESTAMP(3)",
      [organizationId, "Venture Platform Admin"],
    );
    await connection.query(
      "INSERT INTO venture_users (legacy_id, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), updated_at = CURRENT_TIMESTAMP(3)",
      [userId, "Platform Administrator"],
    );
    await connection.query(
      "INSERT INTO venture_memberships (legacy_user_id, organization_legacy_id, roles) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE roles = VALUES(roles)",
      [userId, organizationId, JSON.stringify(["platform_admin"])],
    );
    await connection.query(
      "INSERT INTO venture_auth_accounts (legacy_user_id, username, email, phone, password_hash, organization_legacy_id, role, status, created_at) VALUES (?, ?, NULL, NULL, ?, ?, 'platform', 'active', ?) ON DUPLICATE KEY UPDATE username = VALUES(username), password_hash = VALUES(password_hash), organization_legacy_id = VALUES(organization_legacy_id), role = 'platform', status = 'active', updated_at = CURRENT_TIMESTAMP(3)",
      [userId, username, hashPassword(password), organizationId, createdAt],
    );
    await connection.commit();
    console.log(`Admin account initialized: ${username}`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
} finally {
  await pool.end();
}
