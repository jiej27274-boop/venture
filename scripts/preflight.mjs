const targets = {
  web: process.env.VENTURE_WEB_URL ?? "http://127.0.0.1:5174/",
  admin: process.env.VENTURE_ADMIN_URL ?? "http://127.0.0.1:5174/admin/overview",
  health: process.env.VENTURE_API_URL ?? "http://127.0.0.1:5174/api/health",
};

const checks = [];
for (const [name, url] of Object.entries(targets)) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    const result = { name, url, status: response.status, ok: response.ok };
    if (name === "health") {
      result.body = await response.json().catch(() => null);
      result.securityHeaders = {
        contentTypeOptions: response.headers.get("x-content-type-options"),
        frameOptions: response.headers.get("x-frame-options"),
      };
      result.ok = result.ok && result.securityHeaders.contentTypeOptions === "nosniff" && result.securityHeaders.frameOptions === "DENY";
    }
    checks.push(result);
  } catch (error) {
    checks.push({ name, url, status: 0, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}

const passed = checks.every((check) => check.ok);
console.log(JSON.stringify({ passed, checks }, null, 2));
if (!passed) process.exitCode = 1;
