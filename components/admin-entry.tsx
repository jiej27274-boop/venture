"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

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

async function ensureLocalAdminSession() {
  const current = window.localStorage.getItem("venture_session");
  if (current) return;
  const response = await fetch("/api/dev/admin-session", { method: "POST" });
  if (!response.ok) throw new Error("admin_session_required");
  const payload = await response.json() as { session: string };
  window.localStorage.setItem("venture_session", payload.session);
}

export default function AdminEntry() {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    void Promise.all([loadAdminStyles(), ensureLocalAdminSession()])
      .then(() => setState("ready"))
      .catch(() => setState("error"));
    return () => document.querySelector('link[data-venture-admin-style="true"]')?.remove();
  }, []);

  if (state === "error") return <div className="loading error">管理后台需要有效的管理员会话，请先从公开端登录或在本地开发模式下重新打开。</div>;
  if (state === "loading") return <div className="loading">正在打开平台管理后台…</div>;
  return <AdminApp />;
}
