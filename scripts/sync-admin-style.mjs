import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(scriptDir, "..");
const adminSource = resolve(workspaceRoot, "components", "admin");
const output = resolve(workspaceRoot, "public", "admin.css");

const [base, apple] = await Promise.all([
  readFile(resolve(adminSource, "styles.css"), "utf8"),
  readFile(resolve(adminSource, "apple-admin-ui.css"), "utf8"),
]);
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${base}\n${apple}\n`, "utf8");
console.log(`同步后台样式：${output}`);
