import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api, type AdminArticle, type AuditLog, type AuthAccount, type AuthAccountStatus, type ContactRequest, type GovernmentContact, type IdentitySubmission, type IdentitySubmissionStatus, type IdentitySubmissionType, type Overview, type ProjectSummary } from "./api.ts";
import qifengLogoUrl from "./qifeng-capital-logo.png";

type View = "overview" | "reviews" | "identity" | "projects" | "government" | "leads" | "articles" | "audit";

const navigation: Array<{ id: View; label: string; badge?: string }> = [
  { id: "overview", label: "运营总览" },
  { id: "reviews", label: "账号审核" },
  { id: "identity", label: "身份内容审核" },
  { id: "projects", label: "项目与 BP" },
  { id: "government", label: "政府联系人" },
  { id: "leads", label: "对接线索" },
  { id: "articles", label: "资讯管理" },
  { id: "audit", label: "审计与安全" },
];

const reviewItems = [
  { type: "机构认证", subject: "待核验投资人", detail: "个人投资人 · 身份材料待复核", level: "高" },
  { type: "项目审核", subject: "新能源材料项目", detail: "公开摘要发生重大修改", level: "中" },
];

function Metric({ label, value, hint }: { label: string; value: number | string; hint: string }) {
  return (
    <article className="metric-card">
      <div className="metric-label">{label}</div>
      <strong>{value}</strong>
      <span>{hint}</span>
    </article>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="empty-state">{message}</div>;
}

function OverviewView({ overview, projects }: { overview: Overview; projects: ProjectSummary[] }) {
  const funnel = [
    ["提交申请", overview.funnel.requested, "blue"],
    ["接受对接", overview.funnel.accepted, "teal"],
    ["完成约谈", overview.funnel.meetings, "green"],
    ["持续推进", overview.funnel.progressing, "gold"],
  ] as const;
  return (
    <>
      <section className="metric-grid">
        <Metric label="认证组织" value={overview.verifiedOrganizations} hint={`共 ${overview.organizations} 个组织`} />
        <Metric label="在库项目" value={overview.projects} hint="公开摘要均已脱敏" />
        <Metric label="政府联系人" value={overview.governmentContacts} hint="均挂靠认证组织" />
        <Metric label="待处理审核" value={overview.pendingReviews} hint="建议 24 小时内响应" />
      </section>

      <section className="two-column">
        <article className="panel">
          <header className="panel-header">
            <div><span className="eyebrow">MATCHING</span><h2>撮合漏斗</h2></div>
            <span className="panel-note">试点期演示数据</span>
          </header>
          <div className="funnel">
            {funnel.map(([label, value, color], index) => (
              <div className="funnel-row" key={label}>
                <span>{label}</span>
                <div className="funnel-track">
                  <div className={`funnel-value ${color}`} style={{ width: `${100 - index * 19}%` }}>
                    {value}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <header className="panel-header">
            <div><span className="eyebrow">TRUST</span><h2>信任与安全</h2></div>
            <span className="status-chip ok">运行正常</span>
          </header>
          <div className="trust-list">
            <div><span>跨组织越权策略</span><b>14 项测试通过</b></div>
            <div><span>BP 访问授权</span><b>默认拒绝</b></div>
            <div><span>管理员直接读取 BP</span><b>禁止</b></div>
            <div><span>访问审计覆盖</span><b>100%</b></div>
          </div>
        </article>
      </section>

      <section className="panel">
        <header className="panel-header">
          <div><span className="eyebrow">PROJECTS</span><h2>近期项目</h2></div>
          <button className="secondary-button">查看全部</button>
        </header>
        <div className="project-table">
          {projects.map((project) => (
            <div className="project-row" key={project.id}>
              <div className="project-mark" />
              <div className="project-main"><b>{project.name}</b><span>{project.summary}</span></div>
              <span>{project.industry}</span><span>{project.stage}</span><span>{project.region}</span>
              <span className="status-chip">BP 需申请</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function LegacyReviewsView() {
  return (
    <section className="panel">
      <header className="panel-header">
        <div><span className="eyebrow">REVIEW QUEUE</span><h2>待处理审核</h2></div>
        <button className="primary-button">批量分配</button>
      </header>
      <div className="review-list">
        {reviewItems.map((item) => (
          <div className="review-item" key={item.subject}>
            <span className={`risk ${item.level === "高" ? "high" : "medium"}`}>{item.level}</span>
            <div><b>{item.subject}</b><span>{item.type} · {item.detail}</span></div>
            <button className="secondary-button">开始审核</button>
          </div>
        ))}
      </div>
    </section>
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

function ReviewsView({ accounts, filter, onFilterChange, roleFilter, onRoleFilterChange, query, onQueryChange, onStatus, approvingId }: {
  accounts: AuthAccount[];
  filter: AuthAccountStatus | "all";
  onFilterChange: (value: AuthAccountStatus | "all") => void;
  roleFilter: AuthAccount["role"] | "all";
  onRoleFilterChange: (value: AuthAccount["role"] | "all") => void;
  query: string;
  onQueryChange: (value: string) => void;
  onStatus: (userId: string, status: AuthAccountStatus) => Promise<void>;
  approvingId: string | null;
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
    <section className="panel">
      <header className="panel-header"><div><span className="eyebrow">CONTENT REVIEW</span><h2>其他审核队列</h2></div><button className="secondary-button">批量分配</button></header>
      <div className="review-list">
        {reviewItems.map((item) => <div className="review-item" key={item.subject}>
          <span className="risk medium">{item.level}</span>
          <div><b>{item.subject}</b><span>{item.type} · {item.detail}</span></div>
          <button className="secondary-button">开始审核</button>
        </div>)}
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

function ProjectsView({ projects, onStatus }: { projects: ProjectSummary[]; onStatus: (id: string, status: "approved" | "rejected") => Promise<void> }) {
  return (
    <section className="panel">
      <header className="panel-header">
        <div><span className="eyebrow">PROJECT GOVERNANCE</span><h2>项目与 BP</h2></div>
        <div className="toolbar"><input placeholder="搜索项目、行业或地区" /><button className="primary-button">新增项目</button></div>
      </header>
      <div className="project-cards">
        {projects.map((project) => (
          <article className="project-card" key={project.id}>
            <div className="project-card-top"><span>{project.industry}</span><span className={`status-chip ${project.reviewStatus === "approved" ? "ok" : project.reviewStatus === "rejected" ? "rejected" : ""}`}>{project.reviewStatus === "approved" ? "已发布" : project.reviewStatus === "rejected" ? "已驳回" : "待审核"}</span></div>
            <h3>{project.name}</h3><p>{project.summary}</p>
            <div className="project-meta"><span>{project.stage}</span><span>{project.region}</span><span>{project.financingRange}</span><span>{project.ownerOrganizationName ?? "未标注主体"}</span>{project.bpFileName && <span>BP：{project.bpFileName}</span>}</div>
            <div className="project-actions">{project.reviewStatus === "pending" && <><button className="primary-button" onClick={() => void onStatus(project.id, "approved")}>通过并发布</button><button className="secondary-button" onClick={() => void onStatus(project.id, "rejected")}>驳回</button></>}{project.reviewStatus === "approved" && <button className="secondary-button" onClick={() => void onStatus(project.id, "rejected")}>下架</button>}{project.reviewStatus === "rejected" && <button className="secondary-button" onClick={() => void onStatus(project.id, "approved")}>重新发布</button>}</div>
          </article>
        ))}
      </div>
    </section>
  );
}

function GovernmentView({ contacts }: { contacts: GovernmentContact[] }) {
  return (
    <section className="panel">
      <header className="panel-header">
        <div><span className="eyebrow">REGIONAL NETWORK</span><h2>政府联系人网络</h2></div>
        <button className="primary-button">邀请联系人入驻</button>
      </header>
      <div className="contact-grid">
        {contacts.map((contact) => (
          <article className="contact-card" key={contact.id}>
            <div className="contact-avatar">{contact.name.slice(0, 1)}</div>
            <div className="contact-content"><div><b>{contact.organizationName}</b><span className="status-chip ok">已认证</span></div>
              <p>{contact.name} · {contact.title}</p><p>{contact.region}</p>
              <div className="tag-row">{contact.industries.map((industry) => <span key={industry}>{industry}</span>)}</div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

const leadStatusLabels: Record<ContactRequest["status"], string> = { new: "待处理", contacted: "已联系", progressing: "对接中", completed: "已完成", closed: "已关闭" };

function LeadsView({ requests, onUpdate }: { requests: ContactRequest[]; onUpdate: (id: string, status: ContactRequest["status"], note: string) => Promise<void> }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState<ContactRequest["status"]>("new");
  const [note, setNote] = useState("");
  const startEdit = (request: ContactRequest) => { setEditingId(request.id); setStatus(request.status); setNote(""); };
  const save = async (requestId: string) => { await onUpdate(requestId, status, note || "平台跟进状态更新"); setEditingId(null); setNote(""); };
  return (
    <section className="panel">
      <header className="panel-header">
        <div><span className="eyebrow">MATCHING LEADS</span><h2>线下对接线索</h2></div>
        <span className="status-chip ok">{requests.filter((request) => request.status === "new").length} 条待跟进</span>
      </header>
      {requests.length === 0 ? <EmptyState message="暂无用户提交的对接需求" /> : <div className="lead-table">
        {requests.map((request) => <article className="lead-row" key={request.id}>
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
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true);
    try { await onCreate(form); setForm({ title: "", summary: "", content: "", category: "市场观察" }); setShowForm(false); }
    finally { setSaving(false); }
  };
  return <>
    {showForm && <section className="panel article-editor"><header className="panel-header"><div><span className="eyebrow">NEW ARTICLE</span><h2>新建资讯</h2></div><button className="secondary-button" onClick={() => setShowForm(false)}>取消</button></header>
      <form onSubmit={submit}><label>标题<input required minLength={4} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })}/></label><label>分类<input required minLength={2} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}/></label><label className="wide">摘要<textarea required minLength={10} value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })}/></label><label className="wide">正文<textarea className="content-input" required minLength={20} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })}/></label><button className="primary-button" disabled={saving}>{saving ? "保存中…" : "保存为草稿"}</button></form>
    </section>}
    <section className="panel"><header className="panel-header"><div><span className="eyebrow">CONTENT CENTER</span><h2>资讯管理</h2></div><button className="primary-button" onClick={() => setShowForm(true)}>新增资讯</button></header>
      <div className="article-admin-list">{articles.map((article) => <article key={article.id}><div><span className={`status-chip ${article.status === "published" ? "ok" : ""}`}>{article.status === "published" ? "已发布" : article.status === "draft" ? "草稿" : "已下架"}</span><small>{article.category}</small></div><div><b>{article.title}</b><p>{article.summary}</p></div><time>{new Date(article.updatedAt).toLocaleDateString("zh-CN")}</time><div className="project-actions">{article.status !== "published" && <button className="primary-button" onClick={() => void onStatus(article.id, "published")}>发布</button>}{article.status === "published" && <button className="secondary-button" onClick={() => void onStatus(article.id, "archived")}>下架</button>}</div></article>)}</div>
    </section>
  </>;
}

function AuditView() {
  const events = [
    ["BP 访问被拒绝", "未授权机构尝试读取 bp-robotics", "刚刚"],
    ["主体认证更新", "上海临港招商中心认证有效期已复核", "12 分钟前"],
    ["项目摘要发布", "工业具身智能平台 V3 已发布", "1 小时前"],
  ];
  return (
    <section className="panel">
      <header className="panel-header"><div><span className="eyebrow">AUDIT LOG</span><h2>审计与安全</h2></div><button className="secondary-button">导出需审批</button></header>
      <div className="audit-list">
        {events.map(([title, detail, time]) => <div key={title}><span className="audit-dot"/><div><b>{title}</b><p>{detail}</p></div><time>{time}</time></div>)}
      </div>
    </section>
  );
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
  const [activeView, setActiveView] = useState<View>("overview");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [contacts, setContacts] = useState<GovernmentContact[]>([]);
  const [contactRequests, setContactRequests] = useState<ContactRequest[]>([]);
  const [articles, setArticles] = useState<AdminArticle[]>([]);
  const [authAccounts, setAuthAccounts] = useState<AuthAccount[]>([]);
  const [identitySubmissions, setIdentitySubmissions] = useState<IdentitySubmission[]>([]);
  const [authAccountFilter, setAuthAccountFilter] = useState<AuthAccountStatus | "all">("all");
  const [authRoleFilter, setAuthRoleFilter] = useState<AuthAccount["role"] | "all">("all");
  const [authAccountQuery, setAuthAccountQuery] = useState("");
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [identitySavingId, setIdentitySavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.overview(), api.projects(), api.governmentContacts(), api.contactRequests(), api.articles(), api.authAccounts(), api.identitySubmissions()])
      .then(([overviewPayload, projectPayload, contactPayload, requestPayload, articlePayload, authAccountPayload, identityPayload]) => {
        setOverview(overviewPayload); setProjects(projectPayload.projects); setContacts(contactPayload.contacts);
        setContactRequests(requestPayload.requests); setArticles(articlePayload.articles); setAuthAccounts(authAccountPayload.accounts); setIdentitySubmissions(identityPayload.submissions);
      })
      .catch((requestError: Error) => setError(requestError.message));
  }, []);

  const updateAuthAccount = async (userId: string, status: AuthAccountStatus) => {
    setApprovingId(userId);
    try {
      await api.updateAuthAccountStatus(userId, status);
      const [accountPayload, overviewPayload] = await Promise.all([api.authAccounts(), api.overview()]);
      setAuthAccounts(accountPayload.accounts);
      setOverview(overviewPayload);
    } finally {
      setApprovingId(null);
    }
  };

  const updateProjectStatus = async (id: string, status: "approved" | "rejected") => {
    await api.updateProjectStatus(id, status);
    setProjects((await api.projects()).projects);
  };

  const updateIdentityStatus = async (id: string, status: "approved" | "rejected" | "archived", reason?: string) => {
    setIdentitySavingId(id);
    try {
      await api.updateIdentitySubmissionStatus(id, status, reason);
      const [submissionPayload, overviewPayload] = await Promise.all([api.identitySubmissions(), api.overview()]);
      setIdentitySubmissions(submissionPayload.submissions);
      setOverview(overviewPayload);
    } finally {
      setIdentitySavingId(null);
    }
  };

  const updateContactRequest = async (id: string, status: ContactRequest["status"], note: string) => {
    await api.updateContactRequest(id, { status, note });
    setContactRequests((await api.contactRequests()).requests);
  };

  const createArticle = async (input: { title: string; summary: string; content: string; category: string }) => {
    await api.createArticle(input);
    setArticles((await api.articles()).articles);
  };
  const updateArticleStatus = async (id: string, status: AdminArticle["status"]) => {
    await api.updateArticle(id, { status });
    setArticles((await api.articles()).articles);
  };

  const title = useMemo(() => navigation.find((item) => item.id === activeView)?.label ?? "运营总览", [activeView]);
  let content = <EmptyState message="正在载入平台数据…" />;
  if (error) content = <EmptyState message={`载入失败：${error}`} />;
  else if (overview) {
    if (activeView === "overview") content = <OverviewView overview={overview} projects={projects} />;
    if (activeView === "reviews") content = <ReviewsView accounts={authAccountFilter === "all" ? authAccounts : authAccounts.filter((account) => account.status === authAccountFilter)} filter={authAccountFilter} onFilterChange={setAuthAccountFilter} roleFilter={authRoleFilter} onRoleFilterChange={setAuthRoleFilter} query={authAccountQuery} onQueryChange={setAuthAccountQuery} onStatus={updateAuthAccount} approvingId={approvingId} />;
    if (activeView === "identity") content = <IdentityReviewView submissions={identitySubmissions} onDecision={updateIdentityStatus} savingId={identitySavingId} />;
    if (activeView === "projects") content = <ProjectsView projects={projects} onStatus={updateProjectStatus} />;
    if (activeView === "government") content = <GovernmentView contacts={contacts} />;
    if (activeView === "leads") content = <LeadsView requests={contactRequests} onUpdate={updateContactRequest} />;
    if (activeView === "articles") content = <ArticlesView articles={articles} onCreate={createArticle} onStatus={updateArticleStatus} />;
    if (activeView === "audit") content = <AuditLogView />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><img className="qifeng-logo" src={qifengLogoUrl} alt="启峰创投" /></div>
        <div className="workspace"><span>当前工作台</span><b>平台总管理后台</b></div>
        <nav>{navigation.map((item) => <button key={item.id} className={activeView === item.id ? "active" : ""} onClick={() => setActiveView(item.id)}><span>{item.label}</span>{item.badge && <em>{item.badge}</em>}</button>)}</nav>
        <div className="sidebar-foot"><span className="status-dot"/><div><b>服务运行正常</b><small>本地 MVP · SQLite</small></div></div>
      </aside>
      <main>
        <header className="topbar"><div><span className="eyebrow">PLATFORM CONTROL</span><h1>{title}</h1></div><div className="top-actions"><button className="icon-button" aria-label="通知">●</button><div className="admin-avatar">管</div><div><b>平台管理员</b><small>超级管理员</small></div></div></header>
        <div className="content">{content}</div>
      </main>
    </div>
  );
}
