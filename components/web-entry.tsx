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
    const onPop = () => setProjectId(projectDetailId());
    window.addEventListener('popstate', onPop);
    const detailId = projectDetailId();
    if (detailId) {
      setProjectId(detailId);
      window.history.replaceState({}, '', `/projects/${encodeURIComponent(detailId)}`);
      setReady(true);
      return () => window.removeEventListener('popstate', onPop);
    }
    const initialView = window.location.hash.slice(1) || currentView();
    if (window.location.hash) window.history.replaceState({}, '', `/#${initialView}`);
    setReady(true);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  if (!ready) return <div className="loading">正在打开创投智联…</div>;
  return <WebApp projectId={projectId ?? undefined} onLeaveDetail={() => setProjectId(null)} />;
}
