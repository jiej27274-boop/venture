export interface Project {
  id: string;
  name: string;
  summary: string;
  industry: string;
  region: string;
  stage: string;
  financingRange: string;
  identityMode: "named" | "anonymous";
}
export interface OwnedProject extends Project { reviewStatus: "pending" | "approved" | "rejected"; published: boolean; bpFileName: string | null; }
export interface BpRequest { id: string; projectId: string; projectName: string; bpFileId: string; purpose: string; status: "pending" | "approved" | "rejected"; createdAt: string; decidedAt: string | null; }
export interface IncomingBpRequest extends BpRequest { requesterOrganizationId: string; requesterOrganizationName: string; }
export interface MyContactRequest { id: string; targetRegion: string | null; organization: string; need: string; status: "new" | "contacted" | "progressing" | "completed" | "closed"; createdAt: string; }

export interface Organization {
  id: string;
  name: string;
  type: "investor" | "fa" | "government";
  tagline: string;
  description: string;
  region: string;
  focus: string[];
}

export interface GovernmentContact {
  id: string;
  organizationName: string;
  name: string;
  title: string;
  region: string;
  industries: string[];
  verified: boolean;
}

export interface Article {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  status: "published";
  publishedAt: string;
}

export type AuthRole = "project" | "investor" | "fa" | "government" | "user";
export interface AuthActor {
  userId: string;
  organizationId: string;
  organizationType: AuthRole | "platform";
  organizationVerified: boolean;
  roles: string[];
  displayName?: string;
  organizationName?: string;
  email?: string | null;
  emailVerifiedAt?: string | null;
  phone?: string | null;
  createdAt?: string;
}

export type FavoriteResourceType = "project" | "organization" | "article";
export interface Favorite { resourceType: FavoriteResourceType; resourceId: string; createdAt: string; }
export interface RecentView { resourceType: FavoriteResourceType; resourceId: string; viewedAt: string; }
export interface Notification { id: string; type: "system" | "account" | "project" | "bp" | "contact"; title: string; body: string; resourceType: string | null; resourceId: string | null; readAt: string | null; createdAt: string; }

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  const token = typeof window !== "undefined" ? window.localStorage.getItem("venture_session") : null;
  if (token && !headers.has("authorization")) headers.set("authorization", `Bearer ${token}`);
  const response = await fetch(path, { ...options, headers });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(payload.error ?? `请求失败：${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  projects: () => request<{ projects: Project[] }>("/api/projects"),
  organizations: () => request<{ organizations: Organization[] }>("/api/organizations"),
  contacts: () => request<{ contacts: GovernmentContact[] }>("/api/government-contacts"),
  articles: () => request<{ articles: Article[] }>("/api/articles"),
  authConfig: () => request<{ emailRequired: boolean; captchaEnabled: boolean; emailVerificationEnabled: boolean; passwordResetEnabled: boolean }>("/api/auth/config"),
  captcha: () => request<{ captchaId: string; image: string; expiresAt: string }>("/api/auth/captcha"),
  register: (input: { email?: string; phone?: string; password: string; confirmPassword: string; role: AuthRole; organizationName?: string; contactName?: string; userName?: string; captchaId: string; captchaCode: string }) => request<{ account: { userId: string; organizationId: string; role: AuthRole; status: "pending" | "active" } }>("/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  }),
  login: (input: { identifier: string; password: string }) => request<{ session: string; actor: AuthActor }>("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  }),
  changePassword: (input: { currentPassword: string; newPassword: string; confirmPassword: string }) => request<{ status: "updated" }>("/api/auth/password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }),
  updateProfile: (input: { displayName: string; email?: string; phone?: string }) => request<{ profile: { displayName: string; email: string | null; phone: string | null } }>("/api/auth/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }),
  requestEmailVerification: () => request<{ status: string; expiresAt?: string; previewToken?: string }>("/api/auth/email-verification/request", { method: "POST" }),
  confirmEmailVerification: (token: string) => request<{ status: string; emailVerifiedAt: string }>("/api/auth/email-verification/confirm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) }),
  requestPasswordReset: (email: string) => request<{ status: string; expiresAt?: string; previewToken?: string }>("/api/auth/password-reset/request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) }),
  confirmPasswordReset: (token: string, newPassword: string, confirmPassword: string) => request<{ status: string }>("/api/auth/password-reset/confirm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, newPassword, confirmPassword }) }),
  session: () => request<{ actor: AuthActor }>("/api/auth/session"),
  logout: () => request<{ status: "signed_out" }>("/api/auth/logout", { method: "POST" }),
  favorites: () => request<{ favorites: Favorite[] }>("/api/me/favorites"),
  addFavorite: (resourceType: FavoriteResourceType, resourceId: string) => request<{ favorite: Favorite }>("/api/me/favorites", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ resourceType, resourceId }) }),
  removeFavorite: (resourceType: FavoriteResourceType, resourceId: string) => request<{ removed: boolean }>(`/api/me/favorites/${resourceType}/${encodeURIComponent(resourceId)}`, { method: "DELETE" }),
  recentViews: () => request<{ views: RecentView[] }>("/api/me/recent-views"),
  notifications: (unreadOnly = false) => request<{ notifications: Notification[]; unreadCount: number }>(`/api/me/notifications${unreadOnly ? "?unreadOnly=true" : ""}`),
  markNotificationRead: (notificationId: string) => request<{ read: boolean }>(`/api/me/notifications/${encodeURIComponent(notificationId)}/read`, { method: "POST" }),
  markAllNotificationsRead: () => request<{ read: number }>("/api/me/notifications/read-all", { method: "POST" }),
  recordRecentView: (resourceType: FavoriteResourceType, resourceId: string) => request<{ view: RecentView }>("/api/me/recent-views", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ resourceType, resourceId }) }),
  requestBp: (projectId: string, purpose: string) => request<{ request: { id: string; status: string } }>(`/api/projects/${encodeURIComponent(projectId)}/bp-requests`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ purpose }) }),
  myProjects: () => request<{ projects: OwnedProject[] }>("/api/me/projects"),
  myBpRequests: () => request<{ requests: BpRequest[] }>("/api/me/bp-requests"),
  incomingBpRequests: () => request<{ requests: IncomingBpRequest[] }>("/api/me/incoming-bp-requests"),
  decideBpRequest: (requestId: string, decision: "approved" | "rejected") => request<{ request: { id: string; status: string } }>(`/api/bp-requests/${encodeURIComponent(requestId)}/decision`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(decision === "approved" ? { decision, expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(), allowDownload: false } : { decision }) }),
  myContactRequests: () => request<{ requests: MyContactRequest[] }>("/api/me/contact-requests"),
  submitProject: (input: { name: string; summary: string; industry: string; region: string; stage: string; financingRange: string; identityMode: "named" | "anonymous"; anonymousName?: string }) => request<{ project: { id: string; reviewStatus: string } }>("/api/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  }),
  uploadBp: (projectId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<{ bp: { id: string; version: number; fileName: string } }>(`/api/projects/${encodeURIComponent(projectId)}/bp`, { method: "POST", body: form });
  },
  submitContact: (input: {
    contactId?: string;
    targetRegion?: string;
    name: string;
    phone: string;
    organization: string;
    need: string;
  }) => request<{ request: { id: string } }>("/api/contact-requests", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  }),
};
