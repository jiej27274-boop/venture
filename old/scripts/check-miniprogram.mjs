import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL("..", import.meta.url)), "old", "apps", "miniprogram");
const manifest = JSON.parse(readFileSync(join(root, "app.json"), "utf8"));
const missing = [];
for (const page of manifest.pages) {
  for (const extension of [".js", ".json", ".wxml", ".wxss"]) {
    const file = join(root, `${page}${extension}`);
    if (!existsSync(file)) missing.push(file);
  }
}
const result = { passed: missing.length === 0, pages: manifest.pages.length, missing };
console.log(JSON.stringify(result, null, 2));
if (missing.length) process.exitCode = 1;
