function requestHeaders(input?: HeadersInit) {
  const headers = new Headers(input);
  if (!headers.has("content-type")) headers.set("content-type", "application/json");
  const session = typeof window !== "undefined" ? window.localStorage.getItem("venture_session") : null;
  if (session && !headers.has("authorization")) headers.set("authorization", `Bearer ${session}`);
  return headers;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: requestHeaders(options.headers),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? `请求失败：${response.status}`);
  }
  return response.json() as Promise<T>;
}

export interface Overview {
  organizations: number;
  verifiedOrganizations: number;
  projects: number;
  identitySubmissions: number;
  governmentContacts: number;
  pendingReviews: number;
  bpRequests: number;
  bpGrants: number;
  contactRequests: number;
  publishedArticles: number;
  funnel: {
    requested: number;
    accepted: number;
    meetings: number;
    progressing: number;
  };
}

export type IdentitySubmissionType = "investor_thesis" | "fa_recommendation" | "government_demand";
export type IdentitySubmissionStatus = "draft" | "pending" | "approved" | "rejected" | "archived";
export interface IdentitySubmission {
  id: string;
  type: IdentitySubmissionType;
  ownerOrganizationName: string;
  title: string;
  summary: string;
  industry: string;
  region: string;
  stage: string | null;
  financingRange: string | null;
  details: Record<string, string>;
  status: IdentitySubmissionStatus;
  version: number;
  rejectionReason: string | null;
  submittedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSummary {
  id: string;
  ownerOrganizationId?: string;
  name: string;
  summary: string;
  industry: string;
  region: string;
  stage: string;
  financingRange: string;
  reviewStatus?: "pending" | "approved" | "rejected";
  ownerOrganizationName?: string;
  bpFileName?: string | null;
}

export interface GovernmentContact {
  id: string;
  organizationId?: string;
  organizationName: string;
  name: string;
  title: string;
  region: string;
  industries: string[];
  verified: boolean;
}

export interface GovernmentContactInput {
  organizationId: string;
  organizationName: string;
  name: string;
  title: string;
  region: string;
  industries: string[];
  verified?: boolean;
}

export interface AdminProjectInput {
  ownerOrganizationId: string;
  name: string;
  summary: string;
  industry: string;
  region: string;
  stage: string;
  financingRange: string;
  identityMode?: "named" | "anonymous";
  anonymousName?: string;
}

export interface ContactRequest {
  id: string;
  contactId: string | null;
  targetRegion: string | null;
  name: string;
  phone: string;
  organization: string;
  need: string;
  status: "new" | "contacted" | "progressing" | "completed" | "closed";
  createdAt: string;
}

export interface ContactRequestUpdate {
  id: string;
  requestId: string;
  status: ContactRequest["status"];
  note: string;
  actorUserId: string;
  createdAt: string;
}

export interface AdminArticle {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  status: "draft" | "published" | "archived";
  updatedAt: string;
  publishedAt: string | null;
}

export type AuthAccountStatus = "pending" | "active" | "rejected" | "suspended";

export interface AuthAccount {
  userId: string;
  organizationId: string;
  organizationName: string;
  contactName: string;
  email: string | null;
  phone: string | null;
  role: "project" | "investor" | "fa" | "government" | "user";
  status: AuthAccountStatus;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorUserId: string;
  actorName: string | null;
  actorOrganizationId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  occurredAt: string;
  metadata: Record<string, unknown>;
}

export interface AdminNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  resourceType: string | null;
  resourceId: string | null;
  createdAt: string;
  readAt: string | null;
}

export const api = {
  overview: () => request<Overview>("/api/admin/overview"),
  projects: () => request<{ projects: ProjectSummary[] }>("/api/admin/project-submissions"),
  createAdminProject: (input: AdminProjectInput) => request<{ project: ProjectSummary }>("/api/admin/project-submissions", { method: "POST", body: JSON.stringify(input) }),
  updateProjectStatus: (id: string, status: "approved" | "rejected") => request<{ project: ProjectSummary }>(`/api/admin/project-submissions/${encodeURIComponent(id)}/decision`, { method: "POST", body: JSON.stringify({ status }) }),
  identitySubmissions: (params: { type?: IdentitySubmissionType; status?: IdentitySubmissionStatus; q?: string } = {}) => { const query = new URLSearchParams(); Object.entries(params).forEach(([key, value]) => { if (value) query.set(key, String(value)); }); return request<{ submissions: IdentitySubmission[] }>(`/api/admin/identity-submissions${query.toString() ? `?${query}` : ""}`); },
  updateIdentitySubmissionStatus: (id: string, status: "approved" | "rejected" | "archived", reason?: string) => request<{ submission: IdentitySubmission }>(`/api/admin/identity-submissions/${encodeURIComponent(id)}/decision`, { method: "POST", body: JSON.stringify({ status, reason }) }),
  governmentContacts: () => request<{ contacts: GovernmentContact[] }>("/api/government-contacts"),
  createGovernmentContact: (input: GovernmentContactInput) => request<{ contact: GovernmentContact }>("/api/admin/government-contacts", { method: "POST", body: JSON.stringify(input) }),
  contactRequests: () => request<{ requests: ContactRequest[] }>("/api/admin/contact-requests"),
  updateContactRequest: (id: string, input: { status: ContactRequest["status"]; note: string }) => request<{ update: ContactRequestUpdate }>(`/api/admin/contact-requests/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) }),
  contactRequestUpdates: (id: string) => request<{ updates: ContactRequestUpdate[] }>(`/api/admin/contact-requests/${encodeURIComponent(id)}/updates`),
  articles: () => request<{ articles: AdminArticle[] }>("/api/admin/articles"),
  authAccounts: (status?: AuthAccountStatus) => request<{ accounts: AuthAccount[] }>(`/api/admin/auth-accounts${status ? `?status=${status}` : ""}`),
  approveAuthAccount: (userId: string) => request<{ status: "active" }>(`/api/admin/auth-accounts/${encodeURIComponent(userId)}/approve`, { method: "POST" }),
  updateAuthAccountStatus: (userId: string, status: AuthAccountStatus) => request<{ status: AuthAccountStatus }>(`/api/admin/auth-accounts/${encodeURIComponent(userId)}/status`, { method: "POST", body: JSON.stringify({ status }) }),
  auditLogs: (params: { q?: string; action?: string; resourceType?: string; limit?: number; offset?: number } = {}) => { const query = new URLSearchParams(); Object.entries(params).forEach(([key, value]) => { if (value) query.set(key, String(value)); }); return request<{ logs: AuditLog[]; total: number; limit: number; offset: number }>(`/api/admin/audit-logs${query.toString() ? `?${query}` : ""}`); },
  exportAuditLogs: (params: { q?: string; action?: string; resourceType?: string } = {}) => { const query = new URLSearchParams(); Object.entries(params).forEach(([key, value]) => { if (value) query.set(key, String(value)); }); return `/api/admin/audit-logs/export${query.toString() ? `?${query}` : ""}`; },
  downloadAuditLogs: async (params: { q?: string; action?: string; resourceType?: string } = {}) => { const response = await fetch(api.exportAuditLogs(params), { headers: requestHeaders() }); if (!response.ok) throw new Error("audit_export_failed"); const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "venture-audit-logs.csv"; link.click(); URL.revokeObjectURL(url); },
  createArticle: (input: { title: string; summary: string; content: string; category: string }) =>
    request<{ article: AdminArticle }>("/api/admin/articles", { method: "POST", body: JSON.stringify(input) }),
  updateArticle: (id: string, input: Partial<Pick<AdminArticle, "title" | "summary" | "content" | "category" | "status">>) =>
    request<{ article: AdminArticle }>(`/api/admin/articles/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  notifications: (unreadOnly = false) => request<{ notifications: AdminNotification[]; unreadCount: number }>(`/api/me/notifications${unreadOnly ? "?unreadOnly=true" : ""}`),
  markNotificationRead: (id: string) => request<{ read: boolean }>(`/api/me/notifications/${encodeURIComponent(id)}/read`, { method: "POST" }),
  markAllNotificationsRead: () => request<{ read: number }>("/api/me/notifications/read-all", { method: "POST" }),
};
