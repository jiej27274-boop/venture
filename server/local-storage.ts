import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";

function projectRoot() {
  return process.env.VENTURE_PROJECT_ROOT?.trim() || process.cwd();
}

export function localBpStorageRoot() {
  return resolve(projectRoot(), "data", "uploads");
}

function storagePath(storageKey: string) {
  const normalized = storageKey.replaceAll("\\", "/").replace(/^\/+/, "");
  if (!normalized.startsWith("private/")) throw new Error("invalid_bp_storage_key");
  const root = localBpStorageRoot();
  const target = resolve(root, normalized.slice("private/".length));
  const relativePath = relative(root, target);
  if (!relativePath || relativePath.startsWith("..") || relativePath.includes(":") || resolve(root, relativePath) !== target) {
    throw new Error("invalid_bp_storage_key");
  }
  return target;
}

export async function saveLocalBpFile(storageKey: string, data: Uint8Array) {
  const target = storagePath(storageKey);
  await mkdir(resolve(target, ".."), { recursive: true });
  await writeFile(target, data);
  return target;
}

export async function readLocalBpFile(storageKey: string) {
  const target = storagePath(storageKey);
  try {
    return await readFile(target);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return null;
    throw error;
  }
}

export function contentTypeForStorageKey(storageKey: string) {
  const extension = extname(storageKey).toLowerCase();
  if (extension === ".pdf") return "application/pdf";
  if (extension === ".ppt") return "application/vnd.ms-powerpoint";
  if (extension === ".pptx") return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  return "application/octet-stream";
}

export function localBpFileUrl(bpFileId: string) {
  return `/api/bp-files/${encodeURIComponent(bpFileId)}/file`;
}
