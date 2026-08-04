import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { api, type AdminArticle, type AdminNotification, type AdminProjectInput, type AuditLog, type AuthAccount, type AuthAccountStatus, type ContactRequest, type GovernmentContact, type GovernmentContactInput, type IdentitySubmission, type IdentitySubmissionStatus, type IdentitySubmissionType, type Overview, type ProjectSummary } from "./api.ts";
import qifengLogoAsset from "./qifeng-capital-logo.png";
import ventureRocketAsset from "./venture-rocket.png";

function imageUrl(asset: unknown) {
  if (typeof asset === "string") return asset;
  if (asset && typeof asset === "object" && "src" in asset) return String((asset as { src: unknown }).src);
  return "";
}

const qifengLogoUrl = imageUrl(qifengLogoAsset);
const ventureRocketUrl = imageUrl(ventureRocketAsset);

type View = "overview" | "reviews" | "identity" | "projects" | "government" | "leads" | "articles" | "audit";

type IconName = "home" | "clock" | "user" | "users" | "briefcase" | "folder" | "grid" | "chart" | "settings" | "bell" | "search" | "plus" | "chevron" | "rocket" | "database" | "report" | "shield" | "close";

const navigation: Array<{ id: View; label: string; icon: IconName; badge?: string }> = [
  { id: "overview", label: "运营总览", icon: "home" },
  { id: "reviews", label: "账号审核", icon: "users" },
  { id: "identity", label: "身份内容审核", icon: "user" },
  { id: "projects", label: "项目与 BP", icon: "briefcase" },
  { id: "government", label: "政府联系人", icon: "users" },
  { id: "leads", label: "对接线索", icon: "folder" },
  { id: "articles", label: "资讯管理", icon: "report" },
  { id: "audit", label: "审计与安全", icon: "shield" },
];

const viewPaths: Record<View, string> = {
  overview: "/admin/overview",
  reviews: "/admin/reviews",
  identity: "/admin/identity",
  projects: "/admin/projects",
  government: "/admin/government",
  leads: "/admin/leads",
  articles: "/admin/articles",
  audit: "/admin/audit",
};

const legacyViewPaths: Record<View, string> = {
  overview: "/overview",
  reviews: "/reviews",
  identity: "/identity",
  projects: "/projects",
  government: "/government",
  leads: "/leads",
  articles: "/articles",
  audit: "/audit",
};

function viewFromPath(pathname: string): View {
  const view = (Object.entries(viewPaths).find(([, path]) => path === pathname)?.[0]
    ?? Object.entries(legacyViewPaths).find(([, path]) => path === pathname)?.[0]
    ?? (pathname === "/admin" ? "overview" : "overview")) as View;
  return view;
}

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  const paths: Record<IconName, ReactNode> = {
    home: <><path d="m3 10 9-7 9 7"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    user: <><circle cx="12" cy="8" r="3.2"/><path d="M5 20c.9-3.4 3.2-5 7-5s6.1 1.6 7 5"/></>,
    users: <><circle cx="9" cy="8" r="3"/><path d="M3.5 20c.7-3.1 2.5-4.7 5.5-4.7s4.8 1.6 5.5 4.7"/><path d="M15 5.5a3 3 0 0 1 0 5.8M16 15.6c2.5.3 4 1.8 4.6 4.4"/></>,
    briefcase: <><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2"/></>,
    folder: <><path d="M3 6.5A2.5 2.5 0 0 1 5.5 4H10l2 2h6.5A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z"/><path d="M3.5 9h17"/></>,
    grid: <><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></>,
    chart: <><path d="M4 19V5M4 19h16"/><path d="m7 15 3-4 3 2 5-6"/></>,
    settings: <><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/><circle cx="12" cy="12" r="4"/></>,
    bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
    search: <><circle cx="10.8" cy="10.8" r="6.3"/><path d="m16 16 4.5 4.5"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    chevron: <path d="m9 6 6 6-6 6"/>,
    rocket: <><path d="M14.2 5.2c2.8-2.3 5.4-2.7 6.6-2.7 0 1.2-.4 3.8-2.7 6.6l-5.9 5.9-4.1-4.1z"/><path d="m8.1 10.9-3.5.8-1.9 3.2 4.3-.5M13.1 15.9l-.8 3.5-3.2 1.9.5-4.3"/><circle cx="16.9" cy="7.1" r="1.4"/><path d="M7.7 16.3 5 19"/></>,
    database: <><ellipse cx="12" cy="5" rx="7" ry="3"/><path d="M5 5v7c0 1.7 3.1 3 7 3s7-1.3 7-3V5M5 12v7c0 1.7 3.1 3 7 3s7-1.3 7-3v-7"/></>,
    report: <><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4"/></>,
    shield: <><path d="M12 3 20 6v5c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></>,
    close: <><path d="m6 6 12 12M18 6 6 18"/></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

function EmptyState({ message }: { message: string }) {
  return <div className="empty-state">{message}</div>;
}

function OverviewView({ overview, projects, onNavigate }: { overview: Overview; projects: ProjectSummary[]; onNavigate: (view: View) => void }) {
  const [rankingPeriod, setRankingPeriod] = useState<"month" | "quarter" | "all">("month");
  const [statsPeriod, setStatsPeriod] = useState<"week" | "month">("week");
  const primaryMetrics = [
    ["新增客户数", overview.organizations, "较上月", "blue"],
    ["在库项目", overview.projects, "持续跟进", "orange"],
    ["认证组织", overview.verifiedOrganizations, "已通过认证", "green"],
    ["政府联系人", overview.governmentContacts, "覆盖区域", "purple"],
  ] as const;
  const secondaryMetrics = [
    ["待处理审核", overview.pendingReviews, "项"],
    ["对接需求", overview.contactRequests, "条"],
    ["BP 授权", overview.bpGrants, "次"],
    ["公开资讯", overview.publishedArticles, "篇"],
  ] as const;
  const quickActions: Array<[string, string, IconName, View]> = [
    ["待办事项", `${overview.pendingReviews} 项待处理`, "clock", "reviews"],
    ["账号审核", `${overview.organizations} 个组织`, "users", "reviews"],
    ["项目管理", `${overview.projects} 个项目`, "briefcase", "projects"],
    ["资讯管理", `${overview.publishedArticles} 篇已发布`, "report", "articles"],
    ["对接线索", `${overview.contactRequests} 条需求`, "folder", "leads"],
    ["审计日志", "查看安全记录", "shield", "audit"],
  ];
  const workspaceModules: Array<[string, string, IconName, View, string]> = [
    ["数据中心", "平台核心数据总览", "database", "overview", "mint"],
    ["财务中心", "项目和机构资源", "chart", "projects", "blue"],
    ["文档中心", "项目与 BP 审核", "folder", "identity", "violet"],
    ["采购中心", "政府和对接线索", "briefcase", "government", "green"],
  ];
  const distribution = [
    ["项目数据", overview.projects, "#2779e8"],
    ["组织数据", overview.organizations, "#14b879"],
    ["联系人数据", overview.governmentContacts, "#f5a623"],
    ["资讯数据", overview.publishedArticles, "#ef4a3c"],
  ] as const;
  const distributionTotal = distribution.reduce((sum, [, value]) => sum + value, 0);
  let currentAngle = 0;
  const donutStops = distributionTotal > 0
    ? distribution.map(([, value, color]) => {
        const start = currentAngle;
        currentAngle += (value / distributionTotal) * 360;
        return `${color} ${start}deg ${currentAngle}deg`;
      }).join(", ")
    : "#e7eff8 0deg 360deg";
  const ranking = [
    ["在库项目", overview.projects],
    ["认证组织", overview.verifiedOrganizations],
    ["政府联系人", overview.governmentContacts],
    ["对接需求", overview.contactRequests],
    ["公开资讯", overview.publishedArticles],
  ] as const;
  const resourceRows = [
    ["待处理审核", overview.pendingReviews, "#2779e8"],
    ["BP 授权记录", overview.bpGrants, "#18aee8"],
    ["完成约谈", overview.funnel.meetings, "#14b879"],
  ] as const;
  const resourceMax = Math.max(...resourceRows.map(([, value]) => value), 1);
  return (
    <div className="overview-grid">
      <section className="welcome-banner dashboard-panel">
        <div className="welcome-copy">
          <span className="welcome-kicker">PLATFORM WORKSPACE</span>
          <h2>平台管理工作台</h2>
          <p>把项目、机构与政府资源放在同一张工作台里，今天也能快速推进重要事项。</p>
          <button className="welcome-button" onClick={() => onNavigate("projects")}>查看项目库 <Icon name="chevron" size={15} /></button>
        </div>
        <div className="welcome-art" aria-hidden="true"><div className="welcome-orbit orbit-one"/><div className="welcome-orbit orbit-two"/><img className="welcome-rocket-image" src={ventureRocketUrl} alt="" /></div>
      </section>

      <section className="dashboard-panel quick-panel">
        <div className="dashboard-heading"><div><span className="section-kicker">SHORTCUTS</span><h2>常用功能</h2></div><Icon name="grid" size={20} /></div>
        <div className="quick-actions">{quickActions.map(([label, hint, icon, view]) => <button className="quick-action" key={label} onClick={() => onNavigate(view)}><span className={`quick-icon quick-icon-${icon}`}><Icon name={icon} size={19} /></span><span><b>{label}</b><small>{hint}</small></span><Icon name="chevron" size={14} /></button>)}</div>
      </section>

      <section className="dashboard-panel workspace-modules">
        <div className="dashboard-heading"><div><span className="section-kicker">WORKSPACE</span><h2>工作台模块</h2></div><button className="panel-link" onClick={() => onNavigate("overview")}>查看全部 <Icon name="chevron" size={13} /></button></div>
        <div className="module-grid">{workspaceModules.map(([label, hint, icon, view, tone]) => <button className={`module-card module-${tone}`} key={label} onClick={() => onNavigate(view)}><span className="module-art"><Icon name={icon} size={26} /></span><span className="module-copy"><b>{label}<Icon name="chevron" size={13} /></b><small>{hint}</small></span></button>)}</div>
      </section>

      <section className="dashboard-panel ranking-panel">
        <div className="dashboard-heading"><div><span className="section-kicker">RANKING</span><h2>业务排行</h2></div><Icon name="chart" size={20} /></div>
        <div className="ranking-tabs"><button className={rankingPeriod === "month" ? "selected" : ""} onClick={() => setRankingPeriod("month")}>本月排行</button><button className={rankingPeriod === "quarter" ? "selected" : ""} onClick={() => setRankingPeriod("quarter")}>本季排行</button><button className={rankingPeriod === "all" ? "selected" : ""} onClick={() => setRankingPeriod("all")}>累计排行</button></div>
        <div className="ranking-list">{ranking.map(([label, value], index) => <button className="ranking-row" key={label} onClick={() => onNavigate(index === 0 ? "projects" : index === 2 ? "government" : "overview")}><span className={`ranking-number ranking-${index + 1}`}>{index + 1}</span><span className="ranking-name">{label}</span><strong>{value}</strong></button>)}</div>
        <button className="ranking-more" onClick={() => onNavigate("audit")}>查看更多 <Icon name="chevron" size={13} /></button>
      </section>

      <section className="dashboard-panel stats-panel">
        <div className="dashboard-heading"><div><span className="section-kicker">DATA STATISTICS</span><h2>数据统计</h2></div><div className="stats-period"><button className={statsPeriod === "week" ? "selected" : ""} onClick={() => setStatsPeriod("week")}>本周</button><button className={statsPeriod === "month" ? "selected" : ""} onClick={() => setStatsPeriod("month")}>本月</button></div></div>
        <div className="primary-stat-grid">{primaryMetrics.map(([label, value, hint, tone]) => <button className="primary-stat" key={label} onClick={() => onNavigate(label === "在库项目" ? "projects" : label === "政府联系人" ? "government" : "overview")}><span>{label}</span><strong>{value.toLocaleString("zh-CN")}</strong><small className={`trend trend-${tone}`}>{hint} <Icon name="chart" size={11} /></small></button>)}</div>
        <div className="secondary-stat-grid">{secondaryMetrics.map(([label, value, unit]) => <div className="secondary-stat" key={label}><span>{label}</span><strong>{value.toLocaleString("zh-CN")}<small>{unit}</small></strong></div>)}</div>
      </section>

      <section className="dashboard-panel chart-panel">
        <div className="dashboard-heading"><div><span className="section-kicker">DATA OVERVIEW</span><h2>数据总览</h2></div><Icon name="database" size={20} /></div>
        <div className="donut-layout"><div className="donut-chart" style={{ background: `conic-gradient(${donutStops})` }}><div><strong>{distributionTotal.toLocaleString("zh-CN")}</strong><span>总数据</span></div></div><div className="donut-legend">{distribution.map(([label, value, color]) => <button key={label} onClick={() => onNavigate(label === "项目数据" ? "projects" : label === "联系人数据" ? "government" : "overview")}><i style={{ background: color }}/><span>{label}</span><strong>{value}</strong></button>)}</div></div>
      </section>

      <section className="dashboard-panel resource-panel">
        <div className="dashboard-heading"><div><span className="section-kicker">RESOURCE OVERVIEW</span><h2>资源总览</h2></div><Icon name="chart" size={20} /></div>
        <div className="resource-list">{resourceRows.map(([label, value, color]) => <button className="resource-row" key={label} onClick={() => onNavigate(label === "待处理审核" ? "reviews" : label === "BP 授权记录" ? "projects" : "overview")}><span>{label}</span><div className="resource-track"><i style={{ width: `${Math.max(value / resourceMax * 100, value ? 8 : 0)}%`, background: color }}/></div><strong>{value}</strong></button>)}</div>
      </section>
    </div>
  );
}

const roleLabels: Record<AuthAccount["role"], string> = {
  user: "普通用户",
  project: "项目方",
  investor: "投资机构",
  fa: "FA 机构",
  government: "政府招商",
};

const accountStatusLabels: Record<AuthAccountStatus, string> = {
  pending: "待审核",
  active: "已通过",
  rejected: "已驳回",
  suspended: "已停用",
};

function ReviewsView({ accounts, filter, onFilterChange, roleFilter, onRoleFilterChange, query, onQueryChange, onStatus, approvingId, onNavigate }: {
  accounts: AuthAccount[];
  filter: AuthAccountStatus | "all";
  onFilterChange: (value: AuthAccountStatus | "all") => void;
  roleFilter: AuthAccount["role"] | "all";
  onRoleFilterChange: (value: AuthAccount["role"] | "all") => void;
  query: string;
  onQueryChange: (value: string) => void;
  onStatus: (userId: string, status: AuthAccountStatus) => Promise<void>;
  approvingId: string | null;
  onNavigate: (view: View) => void;
}) {
  const pendingCount = accounts.filter((account) => account.status === "pending").length;
  const visibleAccounts = accounts.filter((account) => {
    const matchesRole = roleFilter === "all" || account.role === roleFilter;
    const normalizedQuery = query.trim().toLowerCase();
    const matchesQuery = !normalizedQuery || [account.organizationName, account.contactName, account.email ?? "", account.phone ?? ""].some((value) => value.toLowerCase().includes(normalizedQuery));
    return matchesRole && matchesQuery;
  });
  return <>
    <section className="panel">
      <header className="panel-header">
        <div><span className="eyebrow">ACCOUNT REVIEW</span><h2>入驻账号审核</h2><p className="panel-subtitle">注册账号须经管理员批准后才能登录平台。</p></div>
        <div className="review-toolbar">
          <span className="status-chip">{pendingCount} 条待处理</span>
          <input className="review-search" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="搜索主体、联系人" aria-label="搜索账号" />
          <select value={roleFilter} onChange={(event) => onRoleFilterChange(event.target.value as AuthAccount["role"] | "all")} aria-label="角色筛选">
            <option value="all">全部角色</option>
            <option value="user">普通用户</option>
            <option value="project">项目方</option>
            <option value="investor">投资机构</option>
            <option value="fa">FA 机构</option>
            <option value="government">政府招商</option>
          </select>
          <select value={filter} onChange={(event) => onFilterChange(event.target.value as AuthAccountStatus | "all")} aria-label="审核状态筛选">
            <option value="all">全部状态</option>
            <option value="pending">待审核</option>
            <option value="active">已通过</option>
            <option value="rejected">已驳回</option>
            <option value="suspended">已停用</option>
          </select>
        </div>
      </header>
      {visibleAccounts.length === 0 ? <EmptyState message="当前筛选条件下没有账号。" /> : <div className="account-review-table">
        <div className="account-review-head"><span>申请主体</span><span>联系人</span><span>联系方式</span><span>角色</span><span>申请时间</span><span>状态</span><span>操作</span></div>
        {visibleAccounts.map((account) => <article className="account-review-row" key={account.userId}>
          <div><b>{account.organizationName}</b><small>{account.organizationId}</small></div>
          <span>{account.contactName}</span>
          <div><span>{account.phone || "未填写手机号"}</span><small>{account.email || "未填写邮箱"}</small></div>
          <span className="role-pill">{roleLabels[account.role]}</span>
          <time>{new Date(account.createdAt).toLocaleString("zh-CN")}</time>
          <span className={`status-chip ${account.status === "active" ? "ok" : account.status === "rejected" || account.status === "suspended" ? "rejected" : ""}`}>{accountStatusLabels[account.status]}</span>
          <div className="account-actions">
            {account.status === "pending" && <><button className="primary-button" disabled={approvingId === account.userId} onClick={() => void onStatus(account.userId, "active")}>{approvingId === account.userId ? "处理中" : "批准"}</button><button className="secondary-button" disabled={approvingId === account.userId} onClick={() => void onStatus(account.userId, "rejected")}>驳回</button></>}
            {account.status === "active" && <button className="secondary-button" disabled={approvingId === account.userId} onClick={() => void onStatus(account.userId, "suspended")}>停用</button>}
            {account.status === "suspended" && <button className="secondary-button" disabled={approvingId === account.userId} onClick={() => void onStatus(account.userId, "active")}>恢复</button>}
            {account.status === "rejected" && <button className="secondary-button" disabled={approvingId === account.userId} onClick={() => void onStatus(account.userId, "active")}>重新开通</button>}
          </div>
        </article>)}
      </div>}
    </section>
    <section className="panel queue-panel">
      <header className="panel-header"><div><span className="eyebrow">CONTENT REVIEW</span><h2>审核工作台</h2><p className="panel-subtitle">从这里进入其他内容审核队列。</p></div><button className="secondary-button" onClick={() => onNavigate("identity")}>批量分配</button></header>
      <div className="review-list">
        <div className="review-item"><span className="risk medium">内容</span><div><b>身份内容审核</b><span>投资方向、项目推荐与招商需求</span></div><button className="secondary-button" onClick={() => onNavigate("identity")}>开始审核</button></div>
        <div className="review-item"><span className="risk high">项目</span><div><b>项目与 BP</b><span>审核公开项目和 BP 申请</span></div><button className="secondary-button" onClick={() => onNavigate("projects")}>开始审核</button></div>
      </div>
    </section>
  </>;
}

const identityTypeLabels: Record<IdentitySubmissionType, string> = {
  investor_thesis: "投资方向",
  fa_recommendation: "项目推荐",
  government_demand: "招商需求",
};

const identityStatusLabels: Record<IdentitySubmissionStatus, string> = {
  draft: "草稿",
  pending: "待审核",
  approved: "已发布",
  rejected: "需修改",
  archived: "已下架",
};

function IdentityReviewView({ submissions, onDecision, savingId }: {
  submissions: IdentitySubmission[];
  onDecision: (id: string, status: "approved" | "rejected" | "archived", reason?: string) => Promise<void>;
  savingId: string | null;
}) {
  const [status, setStatus] = useState<IdentitySubmissionStatus | "all">("pending");
  const [type, setType] = useState<IdentitySubmissionType | "all">("all");
  const [query, setQuery] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const visible = submissions.filter((submission) => {
    const matchesStatus = status === "all" || submission.status === status;
    const matchesType = type === "all" || submission.type === type;
    const matchesQuery = !normalizedQuery || [submission.title, submission.summary, submission.industry, submission.region, submission.ownerOrganizationName].some((value) => value.toLowerCase().includes(normalizedQuery));
    return matchesStatus && matchesType && matchesQuery;
  });
  const pendingCount = submissions.filter((submission) => submission.status === "pending").length;
  const closeReject = () => { setRejectingId(null); setReason(""); };
  const submitReject = async (id: string) => { if (!reason.trim()) return; await onDecision(id, "rejected", reason.trim()); closeReject(); };
  return <section className="panel identity-review-panel">
    <header className="panel-header">
      <div><span className="eyebrow">IDENTITY CONTENT</span><h2>身份发布审核</h2><p className="panel-subtitle">投资机构、FA 和政府招商内容统一进入平台审核，审核通过后才会公开展示。</p></div>
      <span className="status-chip">{pendingCount} 条待处理</span>
    </header>
    <div className="identity-review-toolbar"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题、主体、行业或地区" aria-label="搜索身份发布"/><select value={type} onChange={(event) => setType(event.target.value as IdentitySubmissionType | "all")} aria-label="身份内容类型"><option value="all">全部内容类型</option>{Object.entries(identityTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select value={status} onChange={(event) => setStatus(event.target.value as IdentitySubmissionStatus | "all")} aria-label="身份内容状态"><option value="all">全部状态</option>{Object.entries(identityStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
    {visible.length ? <div className="identity-review-list">{visible.map((submission) => <article className="identity-review-card" key={submission.id}>
      <div className="identity-review-card-top"><span className="identity-type-mark">{identityTypeLabels[submission.type]}</span><span className={`status-chip identity-status ${submission.status === "approved" ? "ok" : submission.status === "rejected" || submission.status === "archived" ? "rejected" : ""}`}>{identityStatusLabels[submission.status]}</span></div>
      <div className="identity-review-card-main"><div className="identity-review-org"><b>{submission.ownerOrganizationName}</b><span>版本 {submission.version} · {new Date(submission.updatedAt).toLocaleString("zh-CN")}</span></div><h3>{submission.title}</h3><p>{submission.summary}</p><div className="identity-review-meta"><span>{submission.industry}</span><span>{submission.region}</span>{submission.stage && <span>{submission.stage}</span>}{submission.financingRange && <span>{submission.financingRange}</span>}</div>{submission.details.primary && <small className="identity-review-detail">补充说明：{submission.details.primary}</small>}{submission.rejectionReason && <small className="identity-review-reason">上次意见：{submission.rejectionReason}</small>}</div>
      <div className="identity-review-actions">{submission.status === "pending" && <><button className="primary-button" disabled={savingId === submission.id} onClick={() => void onDecision(submission.id, "approved")}>{savingId === submission.id ? "处理中" : "通过并发布"}</button><button className="secondary-button" disabled={savingId === submission.id} onClick={() => { setRejectingId(submission.id); setReason(""); }}>驳回</button></>}{submission.status === "approved" && <button className="secondary-button" disabled={savingId === submission.id} onClick={() => void onDecision(submission.id, "archived")}>下架</button>}{submission.status === "rejected" && <button className="secondary-button" disabled={savingId === submission.id} onClick={() => void onDecision(submission.id, "approved")}>重新发布</button>}</div>
      {rejectingId === submission.id && <div className="identity-reject-form"><label>驳回原因<input autoFocus value={reason} onChange={(event) => setReason(event.target.value)} placeholder="告诉提交方需要补充什么"/></label><button className="primary-button" disabled={!reason.trim() || savingId === submission.id} onClick={() => void submitReject(submission.id)}>确认驳回</button><button className="secondary-button" onClick={closeReject}>取消</button></div>}
    </article>)}</div> : <EmptyState message="当前筛选条件下没有身份发布内容。"/>}
  </section>;
}

function ProjectsView({ projects, onStatus, onCreate, organizationOptions }: { projects: ProjectSummary[]; onStatus: (id: string, status: "approved" | "rejected") => Promise<void>; onCreate: (input: AdminProjectInput) => Promise<void>; organizationOptions: Array<{ id: string; name: string }> }) {
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [draft, setDraft] = useState<AdminProjectInput>({ ownerOrganizationId: organizationOptions[0]?.id ?? "org-platform", name: "", summary: "", industry: "", region: "", stage: "", financingRange: "", identityMode: "named" });
  const visibleProjects = projects.filter((project) => {
    const normalized = query.trim().toLowerCase();
    return !normalized || [project.name, project.summary, project.industry, project.region, project.stage, project.ownerOrganizationName ?? ""].some((value) => value.toLowerCase().includes(normalized));
  });
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      await onCreate(draft);
      setDraft({ ownerOrganizationId: organizationOptions[0]?.id ?? "org-platform", name: "", summary: "", industry: "", region: "", stage: "", financingRange: "", identityMode: "named" });
      setShowForm(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "项目创建失败");
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="panel page-panel">
      <header className="panel-header">
        <div><span className="eyebrow">PROJECT GOVERNANCE</span><h2>项目与 BP</h2><p className="panel-subtitle">统一查看项目状态，完成发布前审核和资料管理。</p></div>
        <div className="toolbar"><label className="control-with-icon"><Icon name="search" size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索项目、行业或地区" aria-label="搜索项目" /></label><button className="primary-button" onClick={() => setShowForm((value) => !value)}><Icon name="plus" size={15} />新增项目</button></div>
      </header>
      {showForm && <form className="inline-form project-create-form" onSubmit={(event) => void submit(event)}>
        <div className="form-heading"><div><b>新增项目</b><span>项目会以待审核状态进入平台</span></div><button type="button" className="icon-button subtle" onClick={() => setShowForm(false)} aria-label="关闭"><Icon name="close" size={16} /></button></div>
        <label>项目归属<select value={draft.ownerOrganizationId} onChange={(event) => setDraft({ ...draft, ownerOrganizationId: event.target.value })}>{organizationOptions.length ? organizationOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>) : <option value="org-platform">平台管理组织</option>}</select></label>
        <label>项目名称<input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="例如：智能制造协同平台" /></label>
        <label>所属行业<input required value={draft.industry} onChange={(event) => setDraft({ ...draft, industry: event.target.value })} placeholder="例如：先进制造" /></label>
        <label>所在地区<input required value={draft.region} onChange={(event) => setDraft({ ...draft, region: event.target.value })} placeholder="例如：上海" /></label>
        <label>项目阶段<input required value={draft.stage} onChange={(event) => setDraft({ ...draft, stage: event.target.value })} placeholder="例如：A 轮" /></label>
        <label>融资区间<input required value={draft.financingRange} onChange={(event) => setDraft({ ...draft, financingRange: event.target.value })} placeholder="例如：1000-3000 万" /></label>
        <label className="wide-field">项目摘要<textarea required minLength={20} value={draft.summary} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} placeholder="填写至少 20 个字的公开项目摘要" /></label>
        {formError && <p className="form-error wide-field">{formError}</p>}
        <div className="form-actions wide-field"><button type="button" className="secondary-button" onClick={() => setShowForm(false)}>取消</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "保存中" : "提交审核"}</button></div>
      </form>}
      {visibleProjects.length ? <div className="project-cards">{visibleProjects.map((project) => (
        <article className="project-card" key={project.id}>
          <div className="project-card-top"><span>{project.industry}</span><span className={`status-chip ${project.reviewStatus === "approved" ? "ok" : project.reviewStatus === "rejected" ? "rejected" : ""}`}>{project.reviewStatus === "approved" ? "已发布" : project.reviewStatus === "rejected" ? "已驳回" : "待审核"}</span></div>
          <h3>{project.name}</h3><p>{project.summary}</p>
          <div className="project-meta"><span>{project.stage}</span><span>{project.region}</span><span>{project.financingRange}</span><span>{project.ownerOrganizationName ?? "未标注主体"}</span>{project.bpFileName && <span>BP：{project.bpFileName}</span>}</div>
          <div className="project-actions">{project.reviewStatus === "pending" && <><button className="primary-button" onClick={() => void onStatus(project.id, "approved")}>通过并发布</button><button className="secondary-button" onClick={() => void onStatus(project.id, "rejected")}>驳回</button></>}{project.reviewStatus === "approved" && <button className="secondary-button" onClick={() => void onStatus(project.id, "rejected")}>下架</button>}{project.reviewStatus === "rejected" && <button className="secondary-button" onClick={() => void onStatus(project.id, "approved")}>重新发布</button>}</div>
        </article>
      ))}</div> : <EmptyState message={query ? "没有符合搜索条件的项目。" : "暂无项目数据。"} />}
    </section>
  );
}

function GovernmentView({ contacts, onCreate, organizationOptions }: { contacts: GovernmentContact[]; onCreate: (input: GovernmentContactInput) => Promise<void>; organizationOptions: Array<{ id: string; name: string }> }) {
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const governmentOptions = organizationOptions.filter((option) => option.id === "org-government" || /政府|招商|园区/.test(option.name));
  const [draft, setDraft] = useState<GovernmentContactInput>({ organizationId: governmentOptions[0]?.id ?? "org-government", organizationName: governmentOptions[0]?.name ?? "政府招商组织", name: "", title: "", region: "", industries: [] });
  const visibleContacts = contacts.filter((contact) => {
    const normalized = query.trim().toLowerCase();
    return !normalized || [contact.organizationName, contact.name, contact.title, contact.region, ...contact.industries].some((value) => value.toLowerCase().includes(normalized));
  });
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      await onCreate({ ...draft, industries: draft.industries.length ? draft.industries : ["综合产业"] });
      setDraft({ ...draft, name: "", title: "", region: "", industries: [] });
      setShowForm(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "联系人创建失败");
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="panel page-panel">
      <header className="panel-header">
        <div><span className="eyebrow">REGIONAL NETWORK</span><h2>政府联系人网络</h2><p className="panel-subtitle">统一维护区域联系人，为项目对接提供真实入口。</p></div>
        <div className="toolbar"><label className="control-with-icon"><Icon name="search" size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索地区、机构或联系人" aria-label="搜索政府联系人" /></label><button className="primary-button" onClick={() => setShowForm((value) => !value)}><Icon name="plus" size={15} />新增联系人</button></div>
      </header>
      {showForm && <form className="inline-form contact-create-form" onSubmit={(event) => void submit(event)}>
        <div className="form-heading"><div><b>新增政府联系人</b><span>联系人会直接保存到后台通讯录</span></div><button type="button" className="icon-button subtle" onClick={() => setShowForm(false)} aria-label="关闭"><Icon name="close" size={16} /></button></div>
        <label>所属组织<select value={draft.organizationId} onChange={(event) => { const option = governmentOptions.find((item) => item.id === event.target.value); setDraft({ ...draft, organizationId: event.target.value, organizationName: option?.name ?? draft.organizationName }); }}>{governmentOptions.length ? governmentOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>) : <option value="org-government">政府招商组织</option>}</select></label>
        <label>联系人姓名<input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="例如：张老师" /></label>
        <label>职位<input required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="例如：产业招商经理" /></label>
        <label>所在地区<input required value={draft.region} onChange={(event) => setDraft({ ...draft, region: event.target.value })} placeholder="例如：上海·临港" /></label>
        <label className="wide-field">关注行业<input value={draft.industries.join(",")} onChange={(event) => setDraft({ ...draft, industries: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} placeholder="用逗号分隔，例如：人工智能,机器人" /></label>
        {formError && <p className="form-error wide-field">{formError}</p>}
        <div className="form-actions wide-field"><button type="button" className="secondary-button" onClick={() => setShowForm(false)}>取消</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "保存中" : "保存联系人"}</button></div>
      </form>}
      {visibleContacts.length ? <div className="contact-grid">{visibleContacts.map((contact) => (
        <article className="contact-card" key={contact.id}>
          <div className="contact-avatar">{contact.name.slice(0, 1)}</div>
          <div className="contact-content"><div><b>{contact.organizationName}</b><span className={`status-chip ${contact.verified ? "ok" : ""}`}>{contact.verified ? "已认证" : "待核验"}</span></div>
            <p>{contact.name} · {contact.title}</p><p>{contact.region}</p>
            <div className="tag-row">{contact.industries.map((industry) => <span key={industry}>{industry}</span>)}</div>
          </div>
        </article>
      ))}</div> : <EmptyState message={query ? "没有符合搜索条件的联系人。" : "暂无政府联系人。"} />}
    </section>
  );
}

const leadStatusLabels: Record<ContactRequest["status"], string> = { new: "待处理", contacted: "已联系", progressing: "对接中", completed: "已完成", closed: "已关闭" };

function LeadsView({ requests, onUpdate }: { requests: ContactRequest[]; onUpdate: (id: string, status: ContactRequest["status"], note: string) => Promise<void> }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState<ContactRequest["status"]>("new");
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<ContactRequest["status"] | "all">("all");
  const startEdit = (request: ContactRequest) => { setEditingId(request.id); setStatus(request.status); setNote(""); };
  const save = async (requestId: string) => { await onUpdate(requestId, status, note || "平台跟进状态更新"); setEditingId(null); setNote(""); };
  const visibleRequests = requests.filter((request) => {
    const normalized = query.trim().toLowerCase();
    const matchesStatus = filterStatus === "all" || request.status === filterStatus;
    const matchesQuery = !normalized || [request.name, request.organization, request.phone, request.targetRegion ?? "", request.need].some((value) => value.toLowerCase().includes(normalized));
    return matchesStatus && matchesQuery;
  });
  return (
    <section className="panel page-panel">
      <header className="panel-header">
        <div><span className="eyebrow">MATCHING LEADS</span><h2>线下对接线索</h2><p className="panel-subtitle">记录用户提交的需求，更新跟进状态并保留备注。</p></div>
        <div className="toolbar"><label className="control-with-icon"><Icon name="search" size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索联系人、机构或地区" aria-label="搜索对接线索" /></label><select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value as ContactRequest["status"] | "all")} aria-label="筛选线索状态"><option value="all">全部状态</option>{Object.entries(leadStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><span className="status-chip ok">{requests.filter((request) => request.status === "new").length} 条待跟进</span></div>
      </header>
      {visibleRequests.length === 0 ? <EmptyState message={requests.length === 0 ? "暂无用户提交的对接需求" : "没有符合筛选条件的线索。"} /> : <div className="lead-table">
        {visibleRequests.map((request) => <article className="lead-row" key={request.id}>
          <div><span className="status-chip">{leadStatusLabels[request.status]}</span><time>{new Date(request.createdAt).toLocaleString("zh-CN")}</time></div>
          <div><b>{request.name} · {request.organization}</b><span>{request.phone}</span></div>
          <div><b>{request.targetRegion || "待匹配地区"}</b><p>{request.need}</p></div>
          {editingId === request.id ? <div className="lead-edit"><select value={status} onChange={(event) => setStatus(event.target.value as ContactRequest["status"])}><option value="new">待处理</option><option value="contacted">已联系</option><option value="progressing">对接中</option><option value="completed">已完成</option><option value="closed">已关闭</option></select><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="填写跟进备注"/><button className="primary-button" onClick={() => void save(request.id)}>保存</button></div> : <button className="secondary-button" onClick={() => startEdit(request)}>登记跟进</button>}
        </article>)}
      </div>}
    </section>
  );
}

function ArticlesView({ articles, onCreate, onStatus }: {
  articles: AdminArticle[];
  onCreate: (input: { title: string; summary: string; content: string; category: string }) => Promise<void>;
  onStatus: (id: string, status: AdminArticle["status"]) => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", summary: "", content: "", category: "市场观察" });
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<AdminArticle["status"] | "all">("all");
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true);
    try { await onCreate(form); setForm({ title: "", summary: "", content: "", category: "市场观察" }); setShowForm(false); }
    finally { setSaving(false); }
  };
  const visibleArticles = articles.filter((article) => {
    const normalized = query.trim().toLowerCase();
    return (statusFilter === "all" || article.status === statusFilter) && (!normalized || [article.title, article.summary, article.category].some((value) => value.toLowerCase().includes(normalized)));
  });
  return <>
    {showForm && <section className="panel article-editor"><header className="panel-header"><div><span className="eyebrow">NEW ARTICLE</span><h2>新建资讯</h2></div><button className="secondary-button" onClick={() => setShowForm(false)}>取消</button></header>
      <form onSubmit={submit}><label>标题<input required minLength={4} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })}/></label><label>分类<input required minLength={2} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}/></label><label className="wide">摘要<textarea required minLength={10} value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })}/></label><label className="wide">正文<textarea className="content-input" required minLength={20} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })}/></label><button className="primary-button" disabled={saving}>{saving ? "保存中…" : "保存为草稿"}</button></form>
    </section>}
    <section className="panel page-panel"><header className="panel-header"><div><span className="eyebrow">CONTENT CENTER</span><h2>资讯管理</h2><p className="panel-subtitle">管理平台研究报告、创投电报和运营资讯。</p></div><div className="toolbar"><label className="control-with-icon"><Icon name="search" size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题或分类" aria-label="搜索资讯" /></label><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as AdminArticle["status"] | "all")} aria-label="筛选资讯状态"><option value="all">全部状态</option><option value="published">已发布</option><option value="draft">草稿</option><option value="archived">已下架</option></select><button className="primary-button" onClick={() => setShowForm(true)}><Icon name="plus" size={15} />新增资讯</button></div></header>
      <div className="article-admin-list">{visibleArticles.length ? visibleArticles.map((article) => <article key={article.id}><div><span className={`status-chip ${article.status === "published" ? "ok" : ""}`}>{article.status === "published" ? "已发布" : article.status === "draft" ? "草稿" : "已下架"}</span><small>{article.category}</small></div><div><b>{article.title}</b><p>{article.summary}</p></div><time>{new Date(article.updatedAt).toLocaleDateString("zh-CN")}</time><div className="project-actions">{article.status !== "published" && <button className="primary-button" onClick={() => void onStatus(article.id, "published")}>发布</button>}{article.status === "published" && <button className="secondary-button" onClick={() => void onStatus(article.id, "archived")}>下架</button>}</div></article>) : <EmptyState message={query ? "没有符合搜索条件的资讯。" : "暂无资讯。"} />}</div>
    </section>
  </>;
}

function AuditLogView() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [action, setAction] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const pageSize = 20;
  useEffect(() => { setLoading(true); api.auditLogs({ q: query, action: action || undefined, resourceType: resourceType || undefined, limit: pageSize, offset: page * pageSize }).then((payload) => { setLogs(payload.logs); setTotal(payload.total); }).catch(() => undefined).finally(() => setLoading(false)); }, [query, action, resourceType, page]);
  const exportLogs = async () => { setExporting(true); try { await api.downloadAuditLogs({ q: query, action: action || undefined, resourceType: resourceType || undefined }); } finally { setExporting(false); } };
  const actionOptions = Array.from(new Set(logs.map((log) => log.action))).sort();
  return <section className="panel"><header className="panel-header"><div><span className="eyebrow">AUDIT LOG</span><h2>审计与安全</h2><p className="panel-subtitle">记录管理员、项目方与机构的关键操作，支持按动作和资源筛选。</p></div><button className="secondary-button" disabled={exporting} onClick={() => void exportLogs()}>{exporting ? "导出中…" : "导出 CSV"}</button></header><div className="audit-toolbar"><input value={query} onChange={(event) => { setPage(0); setQuery(event.target.value); }} placeholder="搜索操作、资源 ID 或操作人"/><select value={action} onChange={(event) => { setPage(0); setAction(event.target.value); }}><option value="">全部操作</option>{actionOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select><select value={resourceType} onChange={(event) => { setPage(0); setResourceType(event.target.value); }}><option value="">全部资源</option><option value="auth_account">账号</option><option value="project">项目</option><option value="bp_file">BP</option><option value="bp_request">BP 申请</option><option value="contact_request">对接需求</option><option value="article">资讯</option></select></div>{loading ? <EmptyState message="正在加载审计日志…"/> : logs.length ? <div className="audit-list">{logs.map((log) => <div key={log.id}><span className="audit-dot"/><div><b>{log.action}</b><p>{log.actorName ?? log.actorUserId} · {log.resourceType} · {log.resourceId}</p>{Object.keys(log.metadata).length > 0 && <small className="audit-metadata">{JSON.stringify(log.metadata)}</small>}</div><time>{new Date(log.occurredAt).toLocaleString("zh-CN")}</time></div>)}</div> : <EmptyState message="没有符合条件的审计记录"/>}<div className="audit-pagination"><span>共 {total} 条</span><button className="secondary-button" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>上一页</button><button className="secondary-button" disabled={(page + 1) * pageSize >= total} onClick={() => setPage((value) => value + 1)}>下一页</button></div></section>;
}

export default function App() {
  const [activeView, setActiveView] = useState<View>(() => typeof window === "undefined" ? "overview" : viewFromPath(window.location.pathname));
  const [overview, setOverview] = useState<Overview | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [contacts, setContacts] = useState<GovernmentContact[]>([]);
  const [contactRequests, setContactRequests] = useState<ContactRequest[]>([]);
  const [articles, setArticles] = useState<AdminArticle[]>([]);
  const [authAccounts, setAuthAccounts] = useState<AuthAccount[]>([]);
  const [identitySubmissions, setIdentitySubmissions] = useState<IdentitySubmission[]>([]);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authAccountFilter, setAuthAccountFilter] = useState<AuthAccountStatus | "all">("all");
  const [authRoleFilter, setAuthRoleFilter] = useState<AuthAccount["role"] | "all">("all");
  const [authAccountQuery, setAuthAccountQuery] = useState("");
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [identitySavingId, setIdentitySavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; kind: "success" | "error" } | null>(null);

  const flash = (message: string, kind: "success" | "error" = "success") => {
    setToast({ message, kind });
    window.setTimeout(() => setToast(null), 3200);
  };

  const navigateTo = (view: View) => {
    const path = viewPaths[view];
    if (window.location.pathname !== path) window.history.pushState({}, "", path);
    setActiveView(view);
    setNotificationOpen(false);
    setProfileOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    const handlePopState = () => setActiveView(viewFromPath(window.location.pathname));
    const initialPath = viewPaths[viewFromPath(window.location.pathname)];
    if (window.location.pathname !== initialPath) window.history.replaceState({}, "", initialPath);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    Promise.all([api.overview(), api.projects(), api.governmentContacts(), api.contactRequests(), api.articles(), api.authAccounts(), api.identitySubmissions()])
      .then(([overviewPayload, projectPayload, contactPayload, requestPayload, articlePayload, authAccountPayload, identityPayload]) => {
        setOverview(overviewPayload); setProjects(projectPayload.projects); setContacts(contactPayload.contacts);
        setContactRequests(requestPayload.requests); setArticles(articlePayload.articles); setAuthAccounts(authAccountPayload.accounts); setIdentitySubmissions(identityPayload.submissions);
      })
      .catch((requestError: Error) => setError(requestError.message))
      .finally(() => setLoading(false));
    api.notifications().then((payload) => { setNotifications(payload.notifications); setUnreadCount(payload.unreadCount); }).catch(() => undefined);
  }, []);

  const organizationOptions = useMemo(() => {
    const entries = [
      ...authAccounts.map((account) => [account.organizationId, account.organizationName] as const),
      ...projects.filter((project) => project.ownerOrganizationId && project.ownerOrganizationName).map((project) => [project.ownerOrganizationId!, project.ownerOrganizationName!] as const),
    ];
    return Array.from(new Map(entries).entries()).map(([id, name]) => ({ id, name }));
  }, [authAccounts, projects]);

  const refreshOverview = async () => setOverview(await api.overview());
  const updateAuthAccount = async (userId: string, status: AuthAccountStatus) => {
    setApprovingId(userId);
    try {
      await api.updateAuthAccountStatus(userId, status);
      const [accountPayload, overviewPayload] = await Promise.all([api.authAccounts(), api.overview()]);
      setAuthAccounts(accountPayload.accounts); setOverview(overviewPayload); flash("账号状态已更新");
    } catch (requestError) { flash(requestError instanceof Error ? requestError.message : "账号状态更新失败", "error"); }
    finally { setApprovingId(null); }
  };
  const updateProjectStatus = async (id: string, status: "approved" | "rejected") => {
    try { await api.updateProjectStatus(id, status); setProjects((await api.projects()).projects); await refreshOverview(); flash(status === "approved" ? "项目已发布" : "项目已驳回"); }
    catch (requestError) { flash(requestError instanceof Error ? requestError.message : "项目状态更新失败", "error"); }
  };
  const createProject = async (input: AdminProjectInput) => {
    await api.createAdminProject(input); setProjects((await api.projects()).projects); await refreshOverview(); flash("项目已提交审核");
  };
  const updateIdentityStatus = async (id: string, status: "approved" | "rejected" | "archived", reason?: string) => {
    setIdentitySavingId(id);
    try { await api.updateIdentitySubmissionStatus(id, status, reason); const [submissionPayload, overviewPayload] = await Promise.all([api.identitySubmissions(), api.overview()]); setIdentitySubmissions(submissionPayload.submissions); setOverview(overviewPayload); flash(status === "approved" ? "内容已发布" : status === "rejected" ? "内容已驳回" : "内容已下架"); }
    catch (requestError) { flash(requestError instanceof Error ? requestError.message : "审核操作失败", "error"); }
    finally { setIdentitySavingId(null); }
  };
  const createGovernmentContact = async (input: GovernmentContactInput) => { await api.createGovernmentContact(input); setContacts((await api.governmentContacts()).contacts); await refreshOverview(); flash("联系人已保存"); };
  const updateContactRequest = async (id: string, status: ContactRequest["status"], note: string) => { try { await api.updateContactRequest(id, { status, note }); setContactRequests((await api.contactRequests()).requests); flash("跟进记录已保存"); } catch (requestError) { flash(requestError instanceof Error ? requestError.message : "跟进记录保存失败", "error"); } };
  const createArticle = async (input: { title: string; summary: string; content: string; category: string }) => { await api.createArticle(input); setArticles((await api.articles()).articles); await refreshOverview(); flash("资讯草稿已保存"); };
  const updateArticleStatus = async (id: string, status: AdminArticle["status"]) => { try { await api.updateArticle(id, { status }); setArticles((await api.articles()).articles); await refreshOverview(); flash(status === "published" ? "资讯已发布" : "资讯已下架"); } catch (requestError) { flash(requestError instanceof Error ? requestError.message : "资讯状态更新失败", "error"); } };
  const markNotificationRead = async (id: string) => { await api.markNotificationRead(id); setNotifications((items) => items.map((item) => item.id === id ? { ...item, readAt: new Date().toISOString() } : item)); setUnreadCount((count) => Math.max(0, count - 1)); };
  const markAllNotificationsRead = async () => { await api.markAllNotificationsRead(); setNotifications((items) => items.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() }))); setUnreadCount(0); };

  const title = useMemo(() => navigation.find((item) => item.id === activeView)?.label ?? "运营总览", [activeView]);
  let content = <EmptyState message="正在载入平台数据…" />;
  if (error) content = <EmptyState message={`载入失败：${error}`} />;
  else if (!loading && overview) {
    if (activeView === "overview") content = <OverviewView overview={overview} projects={projects} onNavigate={navigateTo} />;
    if (activeView === "reviews") content = <ReviewsView accounts={authAccountFilter === "all" ? authAccounts : authAccounts.filter((account) => account.status === authAccountFilter)} filter={authAccountFilter} onFilterChange={setAuthAccountFilter} roleFilter={authRoleFilter} onRoleFilterChange={setAuthRoleFilter} query={authAccountQuery} onQueryChange={setAuthAccountQuery} onStatus={updateAuthAccount} approvingId={approvingId} onNavigate={navigateTo} />;
    if (activeView === "identity") content = <IdentityReviewView submissions={identitySubmissions} onDecision={updateIdentityStatus} savingId={identitySavingId} />;
    if (activeView === "projects") content = <ProjectsView projects={projects} onStatus={updateProjectStatus} onCreate={createProject} organizationOptions={organizationOptions} />;
    if (activeView === "government") content = <GovernmentView contacts={contacts} onCreate={createGovernmentContact} organizationOptions={organizationOptions} />;
    if (activeView === "leads") content = <LeadsView requests={contactRequests} onUpdate={updateContactRequest} />;
    if (activeView === "articles") content = <ArticlesView articles={articles} onCreate={createArticle} onStatus={updateArticleStatus} />;
    if (activeView === "audit") content = <AuditLogView />;
  }

  return (
    <div className="app-shell admin-shell">
      <aside className="sidebar">
        <div className="brand"><img className="qifeng-logo" src={qifengLogoUrl} alt="启峰创投" /></div>
        <button className="workspace" onClick={() => navigateTo("overview")}><span>当前工作台</span><b>平台总管理后台</b><Icon name="chevron" size={14} /></button>
        <div className="nav-caption">工作台</div>
        <nav>{navigation.map((item) => <button key={item.id} className={activeView === item.id ? "active" : ""} onClick={() => navigateTo(item.id)}><Icon name={item.icon} size={17} /><span>{item.label}</span>{item.badge && <em>{item.badge}</em>}</button>)}</nav>
        <div className="sidebar-foot"><span className="status-dot"/><div><b>服务运行正常</b><small>本地 MVP · SQLite</small></div><Icon name="settings" size={16} /></div>
      </aside>
      <main>
        <header className="topbar"><div className="page-title"><span className="breadcrumb">启峰创投 / 平台管理</span><h1>{title}</h1></div><div className="top-actions"><div className="notification-wrap"><button className="icon-button notification-button" aria-label="通知" onClick={() => { setNotificationOpen((value) => !value); setProfileOpen(false); }}><Icon name="bell" size={18} />{unreadCount > 0 && <span className="notification-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>}</button>{notificationOpen && <div className="notification-popover"><div className="popover-header"><div><b>通知</b><small>{unreadCount ? `${unreadCount} 条未读` : "全部已读"}</small></div><button className="text-button" onClick={() => void markAllNotificationsRead()}>全部已读</button></div>{notifications.length ? notifications.slice(0, 6).map((notification) => <button className={`notification-item ${notification.readAt ? "read" : "unread"}`} key={notification.id} onClick={() => void markNotificationRead(notification.id)}><span className="notification-dot"/><span><b>{notification.title}</b><small>{notification.body}</small><time>{new Date(notification.createdAt).toLocaleString("zh-CN")}</time></span></button>) : <div className="popover-empty">暂无平台通知</div>}</div>}</div><button className="admin-profile" onClick={() => { setProfileOpen((value) => !value); setNotificationOpen(false); }}><span className="admin-avatar">管</span><span><b>平台管理员</b><small>超级管理员</small></span><Icon name="chevron" size={15} /></button>{profileOpen && <div className="profile-popover"><div className="profile-summary"><span className="admin-avatar">管</span><div><b>平台管理员</b><small>平台最高权限</small></div></div><button onClick={() => navigateTo("overview")}><Icon name="home" size={15} />返回运营总览</button><button onClick={() => { setProfileOpen(false); flash("当前为平台管理员工作台"); }}><Icon name="settings" size={15} />权限说明</button></div>}</div></header>
        <div className={`content ${activeView === "overview" ? "dashboard-content" : "inner-content"}`}>{content}</div>
      </main>
      {toast && <div className={`toast toast-${toast.kind}`}><span>{toast.kind === "success" ? "✓" : "!"}</span>{toast.message}</div>}
    </div>
  );
}
