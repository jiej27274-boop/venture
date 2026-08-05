"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const WebApp = dynamic(() => import("./web/App"), { ssr: false });

const pathToView: Record<string, string> = {
  "/": "home",
  "/market": "projects",
  "/projects": "projects",
  "/organizations": "organizations",
  "/institutions": "institutions",
  "/government": "government",
  "/reports": "research",
  "/research": "research",
  "/events": "events",
  "/articles": "articles",
  "/industry": "industries",
  "/industries": "industries",
  "/services": "services",
  "/login": "auth",
  "/auth": "auth",
  "/account": "account",
};

const viewToPath: Record<string, string> = Object.fromEntries(Object.entries(pathToView).map(([path, view]) => [view, path]));

function currentView() {
  if (typeof window === "undefined") return "home";
  return pathToView[window.location.pathname] ?? pathToView[window.location.pathname.replace(/\/$/, "")] ?? "home";
}

function projectDetailId() {
  if (typeof window === "undefined") return null;
  const match = window.location.pathname.match(/^\/projects\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : null;
}

export default function WebEntry() {
  const [ready, setReady] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);

  useEffect(() => {
    const detailId = projectDetailId();
    if (detailId) {
      setProjectId(detailId);
      window.history.replaceState({}, "", `/projects/${encodeURIComponent(detailId)}`);
      setReady(true);
      return;
    }
    const initialView = window.location.hash.slice(1) || currentView();
    window.history.replaceState({}, "", `/#${initialView}`);
    setReady(true);

    const syncPath = () => {
      const view = window.location.hash.slice(1) || "home";
      const path = viewToPath[view] ?? "/";
      if (window.location.pathname !== path || window.location.hash) window.history.replaceState({}, "", path);
    };
    const onHashChange = () => syncPath();
    window.addEventListener("hashchange", onHashChange);
    let timer = 0;
    const syncWhenReady = () => {
      if (!document.querySelector(".site-shell")) {
        timer = window.setTimeout(syncWhenReady, 50);
        return;
      }
      syncPath();
    };
    syncWhenReady();
    return () => {
      if (timer) window.clearTimeout(timer);
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);

  if (!ready) return <div className="loading">正在打开创投智联…</div>;
  return <WebApp projectId={projectId ?? undefined} onLeaveDetail={() => setProjectId(null)} />;
}
