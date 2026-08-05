"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type FormEvent } from "react";
import { getPublicSession, clearPublicSession } from "./web/api";
import { ADMIN_SESSION_KEY, api, clearAdminSession, getAdminSession, notifyAdminAuthChanged } from "./admin/api";

const AdminApp = dynamic(() => import("./admin/App"), { ssr: false });

function loadAdminStyles() {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLLinkElement>('link[data-venture-admin-style="true"]');
    if (existing) {
      if (existing.dataset.loaded === "true") resolve();
      else { existing.addEventListener("load", () => resolve(), { once: true }); existing.addEventListener("error", () => reject(new Error("admin_style_failed")), { once: true }); }
      return;
    }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/api/admin-style";
    link.dataset.ventureAdminStyle = "true";
    link.addEventListener("load", () => { link.dataset.loaded = "true"; resolve(); }, { once: true });
    link.addEventListener("error", () => reject(new Error("admin_style_failed")), { once: true });
    document.head.appendChild(link);
  });
}

async function sessionStatus(path: string, token: string): Promise<"valid" | "invalid" | "unavailable"> {
  let response: Response;
  try {
    response = await fetch(path, { headers: { authorization: `Bearer ${token}` } });
  } catch {
    return "unavailable";
  }
  if (response.ok) return "valid";
  if (response.status === 401 || response.status === 403) return "invalid";
  return "unavailable";
}

function AdminLoginView({ onSuccess }: { onSuccess: () => void }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true); setError("");
    try {
      const result = await api.adminLogin({ username, password });
      window.localStorage.setItem(ADMIN_SESSION_KEY, result.session);
      notifyAdminAuthChanged();
      onSuccess();
    } catch (reason) {
      const code = reason instanceof Error ? reason.message : "admin_login_failed";
      setError(code === "invalid_credentials" ? "管理员账号或密码不正确。" : code === "account_suspended" ? "管理员账号已停用，请联系系统维护人员。" : "管理员登录失败，请检查后台服务和数据库配置。");
    } finally { setSaving(false); }
  };
  return <main className="admin-entry-page"><section className="admin-entry-card" aria-labelledby="admin-entry-title"><div className="admin-entry-mark">管</div><span className="eyebrow">PLATFORM ADMIN</span><h1 id="admin-entry-title">进入管理后台</h1><p>使用独立的管理员账号登录。前台账号和后台账号可以在同一浏览器同时保持登录。</p><form onSubmit={submit}><label>管理员账号<input autoComplete="username" required value={username} onChange={(event) => setUsername(event.target.value)} placeholder="请输入管理员账号" /></label><label>管理员密码<input autoComplete="current-password" required type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="请输入管理员密码" /></label>{error && <p className="admin-entry-error">{error}</p>}<button className="admin-entry-submit" disabled={saving}>{saving ? "登录中…" : "登录管理后台"}</button></form><button className="admin-entry-back" onClick={() => window.location.assign("/")}>返回平台前台</button></section></main>;
}

function AdminForbiddenView({ onSwitch }: { onSwitch: () => void }) {
  return <main className="admin-entry-page"><section className="admin-entry-card admin-entry-forbidden" aria-labelledby="admin-forbidden-title"><div className="admin-entry-mark muted">!</div><span className="eyebrow">ACCESS CONTROL</span><h1 id="admin-forbidden-title">当前账号没有后台权限</h1><p>你当前登录的是前台账号。前台身份和管理员身份相互独立，不需要退出当前账号即可切换管理员。</p><div className="admin-entry-actions"><button className="admin-entry-submit" onClick={onSwitch}>使用管理员账号登录</button><button className="admin-entry-back" onClick={() => window.location.assign("/")}>返回平台前台</button></div></section></main>;
}

export default function AdminEntry() {
  const [state, setState] = useState<"loading" | "login" | "forbidden" | "ready" | "error">("loading");

  useEffect(() => {
    let mounted = true;
    const openEntry = async () => {
      await loadAdminStyles();
      const adminSession = getAdminSession();
      if (adminSession) {
        const status = await sessionStatus("/api/admin/session", adminSession);
        if (status === "valid") { if (mounted) setState("ready"); return; }
        if (status === "unavailable") throw new Error("admin_session_unavailable");
        clearAdminSession();
      }
      const publicSession = getPublicSession();
      if (publicSession) {
        const status = await sessionStatus("/api/auth/session", publicSession);
        if (status === "valid") { if (mounted) setState("forbidden"); return; }
        if (status === "unavailable") throw new Error("public_session_unavailable");
        clearPublicSession();
      }
      if (mounted) setState("login");
    };
    void openEntry().catch(() => { if (mounted) setState("error"); });
    return () => document.querySelector('link[data-venture-admin-style="true"]')?.remove();
  }, []);

  if (state === "error") return <div className="loading error">管理后台暂时无法连接，请检查服务和数据库配置。</div>;
  if (state === "loading") return <div className="loading">正在打开平台管理后台…</div>;
  if (state === "login") return <AdminLoginView onSuccess={() => setState("ready")} />;
  if (state === "forbidden") return <AdminForbiddenView onSwitch={() => setState("login")} />;
  return <AdminApp />;
}
