import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  api,
  type Article,
  type AuthActor,
  type FavoriteResourceType,
  type Favorite,
  type RecentView,
  type Notification,
  type Pagination,
  type BpRequest,
  type IncomingBpRequest,
  type MyContactRequest,
  type GovernmentContact,
  type Organization,
  type Project,
} from "./api.ts";

type View = "home" | "projects" | "organizations" | "government" | "articles" | "auth" | "account";

const navItems: Array<{ id: View; label: string }> = [
  { id: "home", label: "首页" },
  { id: "projects", label: "投融资" },
  { id: "organizations", label: "公司" },
  { id: "government", label: "政府对接" },
  { id: "projects", label: "行业图谱" },
  { id: "articles", label: "研究报告" },
  { id: "organizations", label: "创投机构" },
  { id: "articles", label: "新闻事件" },
  { id: "articles", label: "产品服务" },
];

const organizationType = { investor: "投资机构", fa: "FA 机构", government: "政府招商" } as const;

function SectionTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return <div className="section-title"><span>{eyebrow}</span><h2>{title}</h2>{description && <p>{description}</p>}</div>;
}

function PaginationControls({ page, totalPages, total, onChange }: { page: number; totalPages: number; total: number; onChange: (page: number) => void }) {
  if (totalPages <= 1) return null;
  return <div className="pagination" aria-label="分页"><span>共 {total} 条</span><button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)}>上一页</button><b>{page} / {totalPages}</b><button type="button" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>下一页</button></div>;
}

function VentureLogo() {
  return <span className="venture-logo" aria-hidden="true"><svg viewBox="0 0 40 40" focusable="false"><defs><linearGradient id="venture-logo-gradient" x1="6" y1="4" x2="33" y2="35" gradientUnits="userSpaceOnUse"><stop stopColor="#2b8bea"/><stop offset="1" stopColor="#13b6a4"/></linearGradient></defs><path d="M7 8 17 31 27 8" fill="none" stroke="url(#venture-logo-gradient)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/><path d="m23 13 9-9m0 0h-8m8 0v8" fill="none" stroke="#2b8bea" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/><circle cx="7" cy="8" r="3" fill="#2b8bea"/><circle cx="17" cy="31" r="3" fill="#13b6a4"/><circle cx="27" cy="8" r="3" fill="#2b8bea"/></svg></span>;
}

function FavoriteButton({ active, onClick }: { active: boolean; onClick?: () => void }) {
  return <button type="button" className={`favorite-button${active ? " active" : ""}`} onClick={(event) => { event.stopPropagation(); onClick?.(); }} aria-label={active ? "取消收藏" : "收藏"}>{active ? "★" : "☆"}</button>;
}

function ProjectCard({ project, onOpen, favorite, onToggleFavorite }: { project: Project; onOpen: (project: Project) => void; favorite?: boolean; onToggleFavorite?: () => void }) {
  const visualKey = project.id.replace("project-", "");
  return (
    <article className="project-card reveal">
      <div className={`project-visual visual-${visualKey}`}><i/><span/><b>{project.industry}</b></div>
      <div className="project-card-content">
        <div className="card-topline"><span>{project.industry}</span><div className="card-actions"><em>{project.identityMode === "anonymous" ? "匿名项目" : "实名项目"}</em><FavoriteButton active={Boolean(favorite)} onClick={onToggleFavorite}/></div></div>
        <h3>{project.name}</h3><p>{project.summary}</p>
        <div className="tag-list"><span>{project.stage}</span><span>{project.region}</span><span>{project.financingRange}</span></div>
        <button className="text-button" onClick={() => onOpen(project)}>查看项目详情 <b>→</b></button>
      </div>
    </article>
  );
}

function OrganizationCard({ organization, favorite, onToggleFavorite }: { organization: Organization; favorite?: boolean; onToggleFavorite?: () => void }) {
  return (
    <article className="organization-card reveal">
      <div className={`org-mark ${organization.type}`}>{organization.name.slice(0, 1)}</div>
      <div><div className="org-heading"><span className="org-type">{organizationType[organization.type]}</span><FavoriteButton active={Boolean(favorite)} onClick={onToggleFavorite}/></div><h3>{organization.name}</h3><b>{organization.tagline}</b><p>{organization.description}</p>
        <div className="tag-list"><span>{organization.region}</span>{organization.focus.map((item) => <span key={item}>{item}</span>)}</div>
      </div>
    </article>
  );
}

type SearchTarget = Exclude<View, "home" | "auth" | "account">;
type SearchMatch = { id: string; target: SearchTarget; title: string; meta: string };

const searchTargetLabels: Record<SearchTarget, string> = {
  projects: "项目",
  organizations: "机构",
  government: "政府联系人",
  articles: "资讯",
};

function GlobalSearch({ projects, organizations, contacts, articles, onSearch }: {
  projects: Project[];
  organizations: Organization[];
  contacts: GovernmentContact[];
  articles: Article[];
  onSearch: (query: string, target: SearchTarget) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const matches = useMemo<SearchMatch[]>(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    const includes = (values: string[]) => values.some((value) => value.toLowerCase().includes(normalized));
    return [
      ...projects.filter((project) => includes([project.name, project.summary, project.industry, project.region, project.stage])).map((project) => ({ id: project.id, target: "projects" as const, title: project.name, meta: `${project.industry} · ${project.region}` })),
      ...organizations.filter((organization) => includes([organization.name, organization.tagline, organization.description, organization.region, ...organization.focus])).map((organization) => ({ id: organization.id, target: "organizations" as const, title: organization.name, meta: `${searchTargetLabels.organizations} · ${organization.region}` })),
      ...contacts.filter((contact) => includes([contact.name, contact.organizationName, contact.title, contact.region, ...contact.industries])).map((contact) => ({ id: contact.id, target: "government" as const, title: `${contact.name} · ${contact.organizationName}`, meta: `${searchTargetLabels.government} · ${contact.region}` })),
      ...articles.filter((article) => includes([article.title, article.summary, article.content, article.category])).map((article) => ({ id: article.id, target: "articles" as const, title: article.title, meta: `${searchTargetLabels.articles} · ${article.category}` })),
    ].slice(0, 8);
  }, [articles, contacts, organizations, projects, query]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const normalized = query.trim();
    if (!normalized) return;
    onSearch(normalized, matches[0]?.target ?? "projects");
    setOpen(false);
  };
  return <div className="global-search">
    <form onSubmit={submit} role="search"><input aria-label="全站搜索" value={query} onChange={(event) => { setQuery(event.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder="搜索项目、机构、资讯"/><button aria-label="提交搜索" type="submit">⌕</button></form>
    {open && query.trim() && <div className="search-results" role="listbox">
      {matches.length ? matches.map((match) => <button key={`${match.target}-${match.id}`} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { onSearch(query.trim(), match.target); setOpen(false); }}><span>{match.title}</span><small>{match.meta}</small></button>) : <div className="search-empty">未找到匹配内容，按回车查看项目库</div>}
    </div>}
  </div>;
}

const portalTargets: Array<{ id: SearchTarget; label: string }> = [
  { id: "projects", label: "查项目" },
  { id: "organizations", label: "查机构" },
  { id: "government", label: "查政府联系人" },
  { id: "articles", label: "查创投资讯" },
];

type StatIconName = "company" | "events" | "institution" | "person" | "industry" | "rocket";
function StatIcon({ name }: { name: StatIconName }) {
  const props = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "company") return <svg viewBox="0 0 24 24" {...props}><path d="M5 20V6.5L12 4l7 2.5V20"/><path d="M8 9h1M8 12h1M8 15h1M12 9h1M12 12h1M12 15h1M16 9h1M16 12h1M16 15h1"/><path d="M3.5 20h17"/></svg>;
  if (name === "events") return <svg viewBox="0 0 24 24" {...props}><path d="m12 4 8 4-8 4-8-4 8-4Z"/><path d="m4 12 8 4 8-4M4 16l8 4 8-4"/></svg>;
  if (name === "institution") return <svg viewBox="0 0 24 24" {...props}><path d="m3 8 9-4 9 4-9 4-9-4Z"/><path d="M5 10v7M9 10v7M15 10v7M19 10v7M3 19h18"/></svg>;
  if (name === "person") return <svg viewBox="0 0 24 24" {...props}><circle cx="12" cy="8" r="3"/><path d="M5 20c.5-3.7 3-5.5 7-5.5s6.5 1.8 7 5.5"/></svg>;
  if (name === "industry") return <svg viewBox="0 0 24 24" {...props}><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg>;
  return <svg viewBox="0 0 24 24" {...props}><path d="m4 16 7-9 9-3-3 9-9 7-4-4Z"/><path d="m11 7 6 6M8 17l-2 3M15 6l3-2"/><circle cx="15" cy="9" r="1"/></svg>;
}

function PortalHero({ projects, organizations, contacts, articles, go }: {
  projects: Project[];
  organizations: Organization[];
  contacts: GovernmentContact[];
  articles: Article[];
  go: (view: View, query?: string) => void;
}) {
  const [target, setTarget] = useState<SearchTarget>("projects");
  const [query, setQuery] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    go(target, query.trim());
  };
  const industryCount = new Set([...projects.map((project) => project.industry), ...organizations.flatMap((organization) => organization.focus)]).size;
  const activeInvestors = organizations.filter((organization) => organization.type === "investor").length;
  const stats = [
    { value: projects.length.toLocaleString(), label: "公司", tone: "blue", icon: "company" as const },
    { value: "—", label: "投资事件", tone: "violet", icon: "events" as const },
    { value: activeInvestors.toLocaleString(), label: "活跃投资机构", tone: "cyan", icon: "institution" as const },
    { value: "—", label: "投资人", tone: "green", icon: "person" as const },
    { value: industryCount.toLocaleString(), label: "行业", tone: "orange", icon: "industry" as const },
    { value: projects.length.toLocaleString(), label: "新经济新公司", tone: "navy", icon: "rocket" as const },
  ];
  return <>
    <section className="portal-hero">
      <div className="portal-hero-bg" aria-hidden="true" />
      <div className="section-wrap portal-hero-inner">
        <div className="portal-copy">
          <span className="portal-kicker">VENTURE LINK · DATA PORTAL</span>
          <h1>发现<span>优质项目</span><br />掌握<span>投资机会</span></h1>
          <p>连接项目、资本与政府产业资源，发现值得长期同行的机会。</p>
        </div>
        <form className="portal-search" onSubmit={submit} role="search">
          <div className="portal-search-tabs">
            {portalTargets.map((item) => <button key={item.id} type="button" className={target === item.id ? "active" : ""} onClick={() => setTarget(item.id)}>{item.label}</button>)}
          </div>
          <div className="portal-search-control">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="输入项目、机构、行业或地区关键词" aria-label="门户搜索" />
            <button type="submit">搜索</button>
          </div>
          <div className="portal-hot">热门搜索：<button type="button" onClick={() => { setTarget("projects"); setQuery("人工智能"); }}>人工智能</button><button type="button" onClick={() => { setTarget("projects"); setQuery("新能源"); }}>新能源</button><button type="button" onClick={() => { setTarget("organizations"); setQuery("投资机构"); }}>投资机构</button></div>
        </form>
      </div>
    </section>
    <section className="portal-stats section-wrap" aria-label="平台数据概览">
      {stats.map((stat) => <div className="portal-stat" key={stat.label}><span className={`portal-stat-icon ${stat.tone}`} aria-hidden="true"><StatIcon name={stat.icon}/></span><div><b>{stat.value}</b><small>{stat.label}</small></div></div>)}
    </section>
  </>;
}

function PortalDataDashboard({ projects, organizations, articles, go, openArticle }: {
  projects: Project[];
  organizations: Organization[];
  articles: Article[];
  go: (view: View, query?: string) => void;
  openArticle: (article: Article) => void;
}) {
  const industryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    projects.forEach((project) => counts.set(project.industry, (counts.get(project.industry) ?? 0) + 1));
    organizations.forEach((organization) => organization.focus.forEach((item) => counts.set(item, (counts.get(item) ?? 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [organizations, projects]);
  const rankedOrganizations = organizations.slice(0, 5);
  return <section className="portal-dashboard section-wrap">
    <div className="portal-dashboard-main">
      <article className="portal-panel portal-financing">
        <div className="portal-panel-heading"><div><span>PROJECT PIPELINE</span><h2>最新项目</h2></div><button onClick={() => go("projects")}>查看更多&nbsp;›</button></div>
        <div className="portal-table-wrap"><table><thead><tr><th>项目</th><th>阶段</th><th>融资需求</th><th>地区</th><th>行业</th><th>信息状态</th></tr></thead><tbody>{projects.slice(0, 6).map((project) => <tr key={project.id}><td><b>{project.name}</b></td><td>{project.stage}</td><td>{project.financingRange || "未披露"}</td><td>{project.region}</td><td>{project.industry}</td><td><span className="portal-status">已审核</span></td></tr>)}</tbody></table></div>
        {projects.length === 0 && <div className="portal-empty">暂无公开项目</div>}
      </article>
      <div className="portal-banners">
        <button className="portal-banner blue" onClick={() => go("projects")}><span>创投数据产品</span><b>用数据发现下一笔机会</b><small>浏览公开项目与产业方向&nbsp;›</small><i aria-hidden="true" /></button>
        <button className="portal-banner violet" onClick={() => go("articles")}><span>行业研究报告</span><b>洞察产业趋势与融资方法</b><small>阅读创投资讯与研究内容&nbsp;›</small><i aria-hidden="true" /></button>
      </div>
      <article className="portal-panel portal-featured">
        <div className="portal-panel-heading"><div><span>FEATURED INSIGHTS</span><h2>精选内容</h2></div><button onClick={() => go("articles")}>更多&nbsp;›</button></div>
        <div className="portal-featured-grid">{articles.slice(0, 4).map((article, index) => <button key={article.id} onClick={() => openArticle(article)}><span className={`portal-featured-art tone-${index % 3}`} /><b>{article.title}</b><small>{article.category} · {article.publishedAt || "日期未披露"}</small></button>)}</div>
        {articles.length === 0 && <div className="portal-empty">暂无公开资讯</div>}
      </article>
    </div>
    <aside className="portal-dashboard-side">
      <article className="portal-panel portal-industries"><div className="portal-panel-heading"><div><span>INDUSTRY MAP</span><h2>行业图谱</h2></div><button onClick={() => go("projects")}>更多&nbsp;›</button></div><div className="portal-industry-grid">{industryCounts.map(([industry, count]) => <button key={industry} onClick={() => go("projects", industry)}><span className="portal-industry-dot" />{industry}<b>{count}</b></button>)}{industryCounts.length === 0 && <div className="portal-empty">暂无行业数据</div>}</div></article>
      <article className="portal-panel portal-ranking"><div className="portal-panel-heading"><div><span>NETWORK</span><h2>入驻机构</h2></div><button onClick={() => go("organizations")}>更多&nbsp;›</button></div><ol>{rankedOrganizations.map((organization, index) => <li key={organization.id}><em>{index + 1}</em><span><b>{organization.name}</b><small>{organization.region} · {organization.tagline}</small></span><i>{organization.type === "investor" ? "投资机构" : organization.type === "fa" ? "FA 机构" : "政府招商"}</i></li>)}</ol>{rankedOrganizations.length === 0 && <div className="portal-empty">暂无机构数据</div>}</article>
      <article className="portal-panel portal-news"><div className="portal-panel-heading"><div><span>NEWSROOM</span><h2>热门新闻</h2></div><button onClick={() => go("articles")}>更多&nbsp;›</button></div><ul>{articles.slice(0, 5).map((article) => <li key={article.id}><button onClick={() => openArticle(article)}>{article.title}</button><time>{article.publishedAt || "日期未披露"}</time></li>)}</ul>{articles.length === 0 && <div className="portal-empty">暂无新闻</div>}</article>
    </aside>
  </section>;
}

function HomeView({ projects, organizations, contacts, articles, go, openProject, openArticle, favoriteKeys, onToggleFavorite }: {
  projects: Project[];
  organizations: Organization[];
  contacts: GovernmentContact[];
  articles: Article[];
  go: (view: View, query?: string) => void;
  openProject: (project: Project) => void;
  openArticle: (article: Article) => void;
  favoriteKeys: Set<string>;
  onToggleFavorite: (type: FavoriteResourceType, id: string) => void;
}) {
  return <>
    <PortalHero projects={projects} organizations={organizations} contacts={contacts} articles={articles} go={go}/>
    <PortalDataDashboard projects={projects} organizations={organizations} articles={articles} go={go} openArticle={openArticle}/>
    <section className="section-wrap home-section">
      <div className="section-heading-row reveal"><SectionTitle eyebrow="FEATURED PROJECTS" title="精选项目" description="公开摘要经过审核，敏感项目支持匿名展示。"/><button className="outline" onClick={() => go("projects")}>查看全部项目</button></div>
      <div className="project-grid">{projects.slice(0, 3).map((project) => <ProjectCard key={project.id} project={project} onOpen={openProject} favorite={favoriteKeys.has(`project:${project.id}`)} onToggleFavorite={() => onToggleFavorite("project", project.id)}/>)}</div>
    </section>

    <section className="section-wrap home-section">
      <div className="section-heading-row reveal"><SectionTitle eyebrow="INSIGHTS" title="创投与招商洞察" description="关注一级市场、产业趋势与区域招商实践。"/><button className="outline" onClick={() => go("articles")}>阅读更多</button></div>
      <div className="article-grid">{articles.slice(0, 3).map((article, index) => <button className="article-card reveal" key={article.id} onClick={() => openArticle(article)}><span className={`article-art tone-${index % 3}`}><em>{article.category}</em></span><small>{article.category}</small><h3>{article.title}</h3><p>{article.summary}</p><b>阅读全文 →</b></button>)}</div>
    </section>
  </>;
}

function ProjectsView({ projects, openProject, initialQuery = "", favoriteKeys, onToggleFavorite }: { projects: Project[]; openProject: (project: Project) => void; initialQuery?: string; favoriteKeys: Set<string>; onToggleFavorite: (type: FavoriteResourceType, id: string) => void }) {
  const [q, setQ] = useState(initialQuery); const [industry, setIndustry] = useState(""); const [region, setRegion] = useState(""); const [stage, setStage] = useState("");
  const [page, setPage] = useState(1); const [result, setResult] = useState<{ items: Project[]; pagination: Pagination }>({ items: projects, pagination: { page: 1, pageSize: projects.length || 9, total: projects.length, totalPages: 1 } }); const [loading, setLoading] = useState(false);
  useEffect(() => setQ(initialQuery), [initialQuery]);
  useEffect(() => { setPage(1); }, [q, industry, region, stage]);
  useEffect(() => { let cancelled = false; setLoading(true); api.projects({ q, industry, region, stage, page, pageSize: 9 }).then((payload) => { if (!cancelled) setResult({ items: payload.projects, pagination: payload.pagination }); }).finally(() => { if (!cancelled) setLoading(false); }); return () => { cancelled = true; }; }, [q, industry, region, stage, page]);
  const options = (key: "industry" | "region" | "stage") => [...new Set(projects.map((project) => project[key]))];
  return <main className="page"><section className="page-hero"><div className="section-wrap reveal"><span>PROJECT DISCOVERY</span><h1>发现值得长期同行的项目</h1><p>项目公开信息均经审核，完整 BP 需要项目方授权后查看。</p></div></section><section className="section-wrap page-content">
    <div className="filter-bar"><input aria-label="搜索项目" value={q} onChange={(event) => setQ(event.target.value)} placeholder="搜索项目、产业关键词"/>
      <select aria-label="选择行业" value={industry} onChange={(event) => setIndustry(event.target.value)}><option value="">全部行业</option>{options("industry").map((value) => <option key={value}>{value}</option>)}</select>
      <select aria-label="选择地区" value={region} onChange={(event) => setRegion(event.target.value)}><option value="">全部地区</option>{options("region").map((value) => <option key={value}>{value}</option>)}</select>
      <select aria-label="选择轮次" value={stage} onChange={(event) => setStage(event.target.value)}><option value="">全部轮次</option>{options("stage").map((value) => <option key={value}>{value}</option>)}</select>
    </div><div className="result-line">找到 <b>{result.pagination.total}</b> 个公开项目{loading && <small> · 正在更新</small>}</div><div className="project-grid">{result.items.map((project) => <ProjectCard key={project.id} project={project} onOpen={openProject} favorite={favoriteKeys.has(`project:${project.id}`)} onToggleFavorite={() => onToggleFavorite("project", project.id)}/>)}</div><PaginationControls {...result.pagination} onChange={setPage}/>
  </section></main>;
}

function OrganizationsView({ organizations, initialQuery = "", favoriteKeys, onToggleFavorite }: { organizations: Organization[]; initialQuery?: string; favoriteKeys: Set<string>; onToggleFavorite: (type: FavoriteResourceType, id: string) => void }) {
  const [type, setType] = useState<"all" | Organization["type"]>("all"); const [region, setRegion] = useState(""); const [q, setQ] = useState(initialQuery);
  const [page, setPage] = useState(1); const [result, setResult] = useState<{ items: Organization[]; pagination: Pagination }>({ items: organizations, pagination: { page: 1, pageSize: organizations.length || 9, total: organizations.length, totalPages: 1 } }); const [loading, setLoading] = useState(false);
  useEffect(() => setQ(initialQuery), [initialQuery]);
  useEffect(() => { setPage(1); }, [q, type, region]);
  useEffect(() => { let cancelled = false; setLoading(true); api.organizations({ q, type, region, page, pageSize: 9 }).then((payload) => { if (!cancelled) setResult({ items: payload.organizations, pagination: payload.pagination }); }).finally(() => { if (!cancelled) setLoading(false); }); return () => { cancelled = true; }; }, [q, type, region, page]);
  return <main className="page"><section className="page-hero"><div className="section-wrap reveal"><span>INSTITUTION NETWORK</span><h1>连接专业资本与产业服务</h1><p>机构信息来自线下登记与平台核验，持续完善投资偏好和服务能力。</p></div></section><section className="section-wrap page-content">
    <div className="tabs"><button className={type === "all" ? "active" : ""} onClick={() => setType("all")}>全部机构</button>{(["investor", "fa", "government"] as const).map((value) => <button key={value} className={type === value ? "active" : ""} onClick={() => setType(value)}>{organizationType[value]}</button>)}<select className="filter-select" value={region} onChange={(event) => setRegion(event.target.value)}><option value="">全部地区</option>{[...new Set(organizations.map((organization) => organization.region))].map((value) => <option key={value}>{value}</option>)}</select></div>
    <div className="result-line">{q ? <>搜索“{q}”找到 </> : <>找到 </>}<b>{result.pagination.total}</b> 个机构{loading && <small> · 正在更新</small>}</div><div className="organization-list">{result.items.map((organization) => <OrganizationCard key={organization.id} organization={organization} favorite={favoriteKeys.has(`organization:${organization.id}`)} onToggleFavorite={() => onToggleFavorite("organization", organization.id)}/>)}</div><PaginationControls {...result.pagination} onChange={setPage}/>
  </section></main>;
}

function GovernmentView({ contacts, openContact, initialQuery = "" }: { contacts: GovernmentContact[]; openContact: (contact?: GovernmentContact) => void; initialQuery?: string }) {
  const [q, setQ] = useState(initialQuery); const [region, setRegion] = useState(""); useEffect(() => setQ(initialQuery), [initialQuery]);
  const [page, setPage] = useState(1); const [result, setResult] = useState<{ items: GovernmentContact[]; pagination: Pagination }>({ items: contacts, pagination: { page: 1, pageSize: contacts.length || 9, total: contacts.length, totalPages: 1 } }); const [loading, setLoading] = useState(false);
  useEffect(() => { setPage(1); }, [q, region]);
  useEffect(() => { let cancelled = false; setLoading(true); api.contacts({ q, region, page, pageSize: 9 }).then((payload) => { if (!cancelled) setResult({ items: payload.contacts, pagination: payload.pagination }); }).finally(() => { if (!cancelled) setLoading(false); }); return () => { cancelled = true; }; }, [q, region, page]);
  return <main className="page"><section className="page-hero government-hero"><div className="section-wrap reveal"><span>REGIONAL OPPORTUNITY</span><h1>让产业项目找到合适的落地区域</h1><p>联系方式不直接公开。提交需求后，平台运营人员将为你安排线下对接。</p><button className="primary large" onClick={() => openContact()}>提交招商对接需求</button></div></section><section className="section-wrap page-content"><SectionTitle eyebrow="GOVERNMENT CONTACTS" title="区域招商联系人" description="联系人均挂靠政府招商部门或园区机构，并经过平台核验。"/><div className="filter-bar"><input aria-label="搜索政府联系人" value={q} onChange={(event) => setQ(event.target.value)} placeholder="搜索地区、联系人或产业"/><select aria-label="选择地区" value={region} onChange={(event) => setRegion(event.target.value)}><option value="">全部地区</option>{[...new Set(contacts.map((contact) => contact.region))].map((value) => <option key={value}>{value}</option>)}</select></div><div className="result-line">{q ? <>搜索“{q}”找到 </> : <>找到 </>}<b>{result.pagination.total}</b> 位联系人{loading && <small> · 正在更新</small>}</div><div className="contact-grid">{result.items.map((contact) => <article className="contact-card reveal" key={contact.id}><div className="contact-avatar">{contact.name.slice(0, 1)}</div><div><span>{contact.organizationName}</span><h3>{contact.name} · {contact.title}</h3><p>{contact.region}</p><div className="tag-list">{contact.industries.map((item) => <span key={item}>{item}</span>)}</div><button className="outline" onClick={() => openContact(contact)}>申请联系</button></div></article>)}</div><PaginationControls {...result.pagination} onChange={setPage}/></section></main>;
}

function ArticlesView({ articles, openArticle, initialQuery = "", favoriteKeys, onToggleFavorite }: { articles: Article[]; openArticle: (article: Article) => void; initialQuery?: string; favoriteKeys: Set<string>; onToggleFavorite: (type: FavoriteResourceType, id: string) => void }) {
  const [q, setQ] = useState(initialQuery); const [category, setCategory] = useState(""); useEffect(() => setQ(initialQuery), [initialQuery]);
  const [page, setPage] = useState(1); const [result, setResult] = useState<{ items: Article[]; pagination: Pagination }>({ items: articles, pagination: { page: 1, pageSize: articles.length || 9, total: articles.length, totalPages: 1 } }); const [loading, setLoading] = useState(false);
  useEffect(() => { setPage(1); }, [q, category]);
  useEffect(() => { let cancelled = false; setLoading(true); api.articles({ q, category, page, pageSize: 9 }).then((payload) => { if (!cancelled) setResult({ items: payload.articles, pagination: payload.pagination }); }).finally(() => { if (!cancelled) setLoading(false); }); return () => { cancelled = true; }; }, [q, category, page]);
  return <main className="page"><section className="page-hero"><div className="section-wrap reveal"><span>VENTURE INSIGHTS</span><h1>创投与产业招商资讯</h1><p>提供市场观察、融资方法与招商实践，不构成投资建议。</p></div></section><section className="section-wrap page-content"><div className="filter-bar"><input aria-label="搜索资讯" value={q} onChange={(event) => setQ(event.target.value)} placeholder="搜索标题、行业或关键词"/><select aria-label="选择资讯分类" value={category} onChange={(event) => setCategory(event.target.value)}><option value="">全部分类</option>{[...new Set(articles.map((article) => article.category))].map((value) => <option key={value}>{value}</option>)}</select></div><div className="result-line">{q ? <>搜索“{q}”找到 </> : <>找到 </>}<b>{result.pagination.total}</b> 篇资讯{loading && <small> · 正在更新</small>}</div><div className="article-grid wide">{result.items.map((article, index) => <button className="article-card reveal" key={article.id} onClick={() => openArticle(article)}><span className={`article-art tone-${index % 3}`}><em>{article.category}</em></span><div className="article-card-top"><small>{article.category}</small><span role="button" tabIndex={0} className={`favorite-inline${favoriteKeys.has(`article:${article.id}`) ? " active" : ""}`} onClick={(event) => { event.stopPropagation(); onToggleFavorite("article", article.id); }} onKeyDown={(event) => { if (event.key === "Enter") { event.stopPropagation(); onToggleFavorite("article", article.id); } }}>{favoriteKeys.has(`article:${article.id}`) ? "★ 已收藏" : "☆ 收藏"}</span></div><h3>{article.title}</h3><p>{article.summary}</p><b>阅读全文 →</b></button>)}</div><PaginationControls {...result.pagination} onChange={setPage}/></section></main>;
}

function ContactModal({ contact, onClose }: { contact?: GovernmentContact; onClose: () => void }) {
  const [form, setForm] = useState({ name: "", phone: "", organization: "", need: "", targetRegion: contact?.region ?? "" });
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const submit = async (event: FormEvent) => { event.preventDefault(); setState("submitting"); try { await api.submitContact({ ...form, contactId: contact?.id }); setState("success"); } catch { setState("error"); } };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-label="申请政府招商对接"><button className="modal-close" aria-label="关闭" onClick={onClose}>×</button>{state === "success" ? <div className="success-state"><span>✓</span><h2>需求已提交</h2><p>平台运营人员将在 1 个工作日内与你联系。</p><button className="primary" onClick={onClose}>完成</button></div> : <><span className="eyebrow">OFFLINE MATCHING</span><h2>申请招商对接</h2><p className="modal-intro">{contact ? `目标联系人：${contact.organizationName} · ${contact.name}` : "填写需求后，由平台匹配合适的区域联系人。"}</p><form onSubmit={submit}><label>姓名<input required minLength={2} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="请输入姓名"/></label><label>手机号<input required pattern="1[3-9][0-9]{9}" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="用于平台回访"/></label><label>公司 / 机构<input required minLength={2} value={form.organization} onChange={(event) => setForm({ ...form, organization: event.target.value })} placeholder="请输入机构名称"/></label><label>目标地区<input required minLength={2} value={form.targetRegion} onChange={(event) => setForm({ ...form, targetRegion: event.target.value })} placeholder="例如：上海、长三角"/></label><label>对接需求<textarea required minLength={10} value={form.need} onChange={(event) => setForm({ ...form, need: event.target.value })} placeholder="请描述产业方向、发展阶段、空间需求与期望支持"/></label>{state === "error" && <p className="form-error">提交失败，请检查信息后重试。</p>}<button className="primary submit" disabled={state === "submitting"}>{state === "submitting" ? "正在提交…" : "提交对接需求"}</button><small className="privacy-note">提交即表示同意平台为本次线下对接使用以上信息。</small></form></>}</section></div>;
}

function ProjectModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const [purpose, setPurpose] = useState("");
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!window.localStorage.getItem("venture_session")) { window.location.hash = "auth"; return; }
    setState("submitting");
    try { await api.requestBp(project.id, purpose); setState("success"); }
    catch { setState("error"); }
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal project-modal" role="dialog" aria-modal="true" aria-label="项目详情"><button className="modal-close" aria-label="关闭" onClick={onClose}>×</button><span className="eyebrow">PROJECT PROFILE</span><div className="card-topline"><span>{project.industry}</span><em>{project.identityMode === "anonymous" ? "匿名公开" : "实名公开"}</em></div><h2>{project.name}</h2><p className="project-summary">{project.summary}</p><div className="detail-grid"><div><small>融资阶段</small><b>{project.stage}</b></div><div><small>所在地区</small><b>{project.region}</b></div><div><small>融资需求</small><b>{project.financingRange}</b></div></div><div className="bp-notice"><span>BP</span><div><b>商业计划书受授权保护</b><p>请填写查看用途，项目方审核后开放材料访问。</p></div></div>{state === "success" ? <div className="bp-request-success"><b>申请已提交</b><p>项目方审核后，你会获得授权通知。</p></div> : <form className="bp-request-form" onSubmit={submit}><textarea required minLength={10} value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="请说明查看 BP 的用途（至少 10 字）"/>{state === "error" && <p className="form-error">提交失败，请确认已完成主体认证。</p>}<button className="primary submit" disabled={state === "submitting"}>{state === "submitting" ? "提交中…" : "提交 BP 查看申请"}</button></form>}</section></div>;
}

function ArticleModal({ article, onClose }: { article: Article; onClose: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><article className="modal article-modal" role="dialog" aria-modal="true" aria-label="资讯详情"><button className="modal-close" aria-label="关闭" onClick={onClose}>×</button><span className="eyebrow">{article.category}</span><h2>{article.title}</h2><p className="article-lead">{article.summary}</p><div className="article-body">{article.content}</div><p className="article-disclaimer">本文仅供行业交流，不构成任何投资或招商承诺。</p></article></div>;
}

type RoleId = "user" | "investor" | "fa" | "government" | "project";
type RoleIconName = "user" | "investor" | "fa" | "government" | "project";
const roleOptions: Array<{ id: RoleId; label: string; description: string; icon: RoleIconName }> = [
  { id: "user", label: "普通用户", description: "浏览项目 · 关注创投资讯", icon: "user" },
  { id: "investor", label: "投资机构", description: "发现项目 · 管理关注", icon: "investor" },
  { id: "fa", label: "FA", description: "连接资源 · 推荐项目", icon: "fa" },
  { id: "government", label: "政府招商", description: "产业招商 · 项目引进", icon: "government" },
  { id: "project", label: "项目方", description: "发布项目 · 获取融资", icon: "project" },
];

function RoleIcon({ name }: { name: RoleIconName }) {
  const common = { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (name === "user") return <svg {...common}><circle cx="12" cy="8" r="3"/><path d="M5 20c.8-3.2 3.1-5 7-5s6.2 1.8 7 5"/></svg>;
  if (name === "investor") return <svg {...common}><path d="M4 20h16M6 20V8l6-4 6 4v12M9 11h1M14 11h1M9 15h1M14 15h1"/></svg>;
  if (name === "fa") return <svg {...common}><path d="m4 10 3-3 4 2 2-2 6 4-3 6-4-2-4 2-4-3z"/><path d="m9 12 2 2 4-4"/></svg>;
  if (name === "government") return <svg {...common}><path d="M3 20h18M5 20v-8M9 20v-8M15 20v-8M19 20v-8M3 10l9-6 9 6M12 4V3"/></svg>;
  return <svg {...common}><path d="M14 4c3-1 5 0 6 1 1 1 2 3 1 6l-5 5-4-4-5 5-2-2 5-5-4-4 5-5z"/><circle cx="16" cy="7" r="1"/></svg>;
}

function RoleSelectionModal({ onClose, onSelect }: { onClose: () => void; onSelect: (role: RoleId) => void }) {
  const [selectedRole, setSelectedRole] = useState<RoleId>("user");
  return <div className="role-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="role-modal" role="dialog" aria-modal="true" aria-labelledby="role-title"><button className="role-close" aria-label="关闭" onClick={onClose}>×</button><span className="role-eyebrow">CHOOSE YOUR ROLE</span><h2 id="role-title">你想以什么身份进入创投智联？</h2><p className="role-intro">不同身份会进入对应工作台，Demo 中可以随时切换。</p><label className="role-select-label">选择身份<select className="role-select" aria-label="选择身份" value={selectedRole} onChange={(event) => { const next = event.target.value as RoleId; setSelectedRole(next); onSelect(next); }}>{roleOptions.map((role) => <option value={role.id} key={role.id}>{role.label}</option>)}</select></label><div className="role-grid">{roleOptions.map((role) => <button className={`role-card${selectedRole === role.id ? " selected" : ""}`} key={role.id} onClick={() => { setSelectedRole(role.id); onSelect(role.id); }}><span className={`role-icon role-icon-${role.id}`}><RoleIcon name={role.icon}/></span><b>{role.label}</b><small>{role.description}</small></button>)}</div><button className="role-continue" onClick={onClose}>继续浏览公开市场</button></section></div>;
}

const authRoleLabels: Record<string, string> = { user: "普通用户", project: "项目方", investor: "投资机构", fa: "FA 机构", government: "政府招商", platform: "平台管理员" };

function AccountView({ go }: { go: (view: View) => void }) {
  const [actor, setActor] = useState<AuthActor>();
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [projectSaving, setProjectSaving] = useState(false);
  const [projectMessage, setProjectMessage] = useState("");
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [recentViews, setRecentViews] = useState<RecentView[]>([]);
  const [projectForm, setProjectForm] = useState({ name: "", summary: "", industry: "", region: "", stage: "", financingRange: "", identityMode: "named" as "named" | "anonymous", anonymousName: "" });
  useEffect(() => { api.session().then((result) => { setActor(result.actor); setState("ready"); api.favorites().then((payload) => setFavorites(payload.favorites)).catch(() => undefined); api.recentViews().then((payload) => setRecentViews(payload.views)).catch(() => undefined); }).catch(() => setState("error")); }, []);
  const logout = async () => { try { await api.logout(); } catch { /* session may already be expired */ } finally { window.localStorage.removeItem("venture_session"); go("home"); } };
  const submitProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setProjectSaving(true); setProjectMessage("");
    try {
      const result = await api.submitProject(projectForm);
      const file = (event.currentTarget.elements.namedItem("bp") as HTMLInputElement | null)?.files?.[0];
      if (file) await api.uploadBp(result.project.id, file);
      setProjectMessage("项目已提交，等待平台审核。审核通过后会进入公开项目库。");
      setProjectForm({ name: "", summary: "", industry: "", region: "", stage: "", financingRange: "", identityMode: "named", anonymousName: "" });
    } catch (error) { setProjectMessage(error instanceof Error ? error.message : "提交失败，请稍后重试"); }
    finally { setProjectSaving(false); }
  };
  if (state === "loading") return <main className="account-page"><div className="account-state">正在加载账号信息…</div></main>;
  if (state === "error" || !actor) return <main className="account-page"><div className="account-state"><h2>登录状态已失效</h2><p>请重新登录后再查看账号中心。</p><button className="primary" onClick={() => go("auth")}>重新登录</button></div></main>;
  return <main className="account-page"><section className="section-wrap account-shell"><div className="account-heading"><div><span className="eyebrow">ACCOUNT CENTER</span><h1>账号中心</h1><p>查看你的平台身份和当前可用入口。</p></div><button className="outline" onClick={logout}>退出登录</button></div><div className="account-grid"><article className="account-profile"><div className="account-avatar">{(actor.displayName ?? "用").slice(0, 1)}</div><div><span className="account-label">当前身份</span><h2>{actor.displayName ?? "平台用户"}</h2><p>{authRoleLabels[actor.organizationType] ?? "平台用户"} · {actor.organizationName ?? "创投智联"}</p></div></article><article className="account-card"><span className="account-label">账号状态</span><strong className="account-status"><i/>已激活</strong><small>{actor.organizationVerified ? "主体已通过平台认证" : "当前主体等待进一步认证"}</small></article><article className="account-card"><span className="account-label">登录方式</span><strong>{actor.email ?? actor.phone ?? "未设置"}</strong><small>{actor.email ? "邮箱地址" : "手机号"}</small></article><article className="account-card"><span className="account-label">账号标识</span><strong>{actor.userId.slice(0, 8)}…</strong><small>注册于 {actor.createdAt ? new Date(actor.createdAt).toLocaleDateString("zh-CN") : "近期"}</small></article></div><section className="favorites-panel"><div className="account-heading"><div><span className="eyebrow">MY COLLECTION</span><h2>我的收藏</h2><p>收藏的项目、机构和资讯会在这里保留。</p></div><strong>{favorites.length} 项</strong></div>{favorites.length ? <div className="favorite-list">{favorites.map((favorite) => <button key={`${favorite.resourceType}:${favorite.resourceId}`} onClick={() => go(favorite.resourceType === "project" ? "projects" : favorite.resourceType === "organization" ? "organizations" : "articles")}><span>{favorite.resourceType === "project" ? "项目" : favorite.resourceType === "organization" ? "机构" : "资讯"}</span><b>{favorite.resourceId}</b><small>›</small></button>)}</div> : <div className="favorite-empty">还没有收藏内容，去项目库和机构库看看吧。</div>}</section>{actor.organizationType === "project" && <section className="project-submit-panel"><div className="account-heading"><div><span className="eyebrow">PROJECT SUBMISSION</span><h2>提交项目与 BP</h2><p>填写项目公开摘要，上传 PDF/PPT/PPTX，提交后由平台审核。</p></div><button className="outline" onClick={() => setShowProjectForm((value) => !value)}>{showProjectForm ? "收起" : "新增项目"}</button></div>{showProjectForm && <form className="project-submit-form" onSubmit={submitProject}><input required placeholder="项目名称" value={projectForm.name} onChange={(event) => setProjectForm({ ...projectForm, name: event.target.value })}/><input required placeholder="行业标签" value={projectForm.industry} onChange={(event) => setProjectForm({ ...projectForm, industry: event.target.value })}/><input required placeholder="所在地区" value={projectForm.region} onChange={(event) => setProjectForm({ ...projectForm, region: event.target.value })}/><input required placeholder="融资阶段" value={projectForm.stage} onChange={(event) => setProjectForm({ ...projectForm, stage: event.target.value })}/><input required placeholder="融资需求，如 1000 万" value={projectForm.financingRange} onChange={(event) => setProjectForm({ ...projectForm, financingRange: event.target.value })}/><select value={projectForm.identityMode} onChange={(event) => setProjectForm({ ...projectForm, identityMode: event.target.value as "named" | "anonymous" })}><option value="named">实名展示</option><option value="anonymous">匿名展示</option></select><textarea required minLength={20} placeholder="项目公开摘要（至少 20 字）" value={projectForm.summary} onChange={(event) => setProjectForm({ ...projectForm, summary: event.target.value })}/>{projectForm.identityMode === "anonymous" && <input required placeholder="匿名项目名称" value={projectForm.anonymousName} onChange={(event) => setProjectForm({ ...projectForm, anonymousName: event.target.value })}/>}<label className="file-field">上传 BP（可选）<input name="bp" type="file" accept=".pdf,.ppt,.pptx" /></label><button className="primary" disabled={projectSaving}>{projectSaving ? "提交中…" : "提交审核"}</button>{projectMessage && <p className="project-submit-message">{projectMessage}</p>}</form>}</section>}<div className="account-actions"><div><span className="eyebrow">DISCOVER MORE</span><h2>继续探索平台</h2></div><div><button className="primary" onClick={() => go("projects")}>浏览项目</button><button className="outline" onClick={() => go("organizations")}>查看机构</button><button className="outline" onClick={() => go("articles")}>阅读资讯</button></div></div></section></main>;
}

function AuthView({ initialRole, go }: { initialRole?: RoleId; go: (view: View) => void }) {
  const [mode, setMode] = useState<"login" | "register" | "forgot">(initialRole ? "register" : "login");
  const [role, setRole] = useState<RoleId>(initialRole ?? "user");
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [emailRequired, setEmailRequired] = useState(false);
  const [captcha, setCaptcha] = useState<{ captchaId: string; image: string } | null>(null);
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [resetComplete, setResetComplete] = useState(false);
  const [form, setForm] = useState({ userName: "", organization: "", contact: "", phone: "", email: "", password: "", confirm: "", captchaCode: "" });
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const refreshCaptcha = async () => {
    setCaptchaLoading(true);
    try { const next = await api.captcha(); setCaptcha({ captchaId: next.captchaId, image: next.image }); update("captchaCode", ""); }
    catch { setError("验证码加载失败，请刷新页面重试。"); }
    finally { setCaptchaLoading(false); }
  };
  useEffect(() => { void api.authConfig().then((config) => setEmailRequired(config.emailRequired)).catch(() => undefined); }, []);
  useEffect(() => { if (mode === "register" && !captcha) void refreshCaptcha(); }, [mode, captcha]);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      if (mode === "register") {
        if (!captcha) throw new Error("请先加载验证码");
        await api.register({ email: form.email || undefined, phone: form.phone || undefined, password: form.password, confirmPassword: form.confirm, role, organizationName: role === "user" ? undefined : form.organization, contactName: role === "user" ? undefined : form.contact, userName: role === "user" ? form.userName : undefined, captchaId: captcha.captchaId, captchaCode: form.captchaCode });
      } else if (mode === "forgot") {
        if (!resetToken) {
          const result = await api.requestPasswordReset(form.email);
          setResetToken(result.previewToken ?? "");
          if (!result.previewToken) setSubmitted(true);
        } else {
          await api.confirmPasswordReset(resetToken, form.password, form.confirm);
          setResetComplete(true);
          setSubmitted(true);
        }
      } else {
        const result = await api.login({ identifier: form.email, password: form.password });
        window.localStorage.setItem("venture_session", result.session);
      }
      setSubmitted(true);
    } catch (reason) {
      const code = reason instanceof Error ? reason.message : "operation_failed";
      setError(code === "invalid_captcha" ? "验证码错误或已过期，请重新输入。" : code === "identifier_taken" ? "手机号或邮箱已注册。" : code === "email_required" ? "请输入邮箱地址。" : code);
      if (code === "invalid_captcha") void refreshCaptcha();
    } finally { setSaving(false); }
  };
  const switchMode = (next: "login" | "register" | "forgot") => { setMode(next); setSubmitted(false); setError(""); setResetToken(""); setResetComplete(false); if (next === "register") void refreshCaptcha(); };
  const selectedRole = roleOptions.find((item) => item.id === role);
  return (
    <main className="auth-page">
      <ForgotPasswordCard />
      <section className="auth-story">
        <div className="auth-story-inner">
          <button className="auth-brand" onClick={() => go("home")}><VentureLogo/><span><b>创投智联</b><small>VENTURE LINK</small></span></button>
          <div className="auth-copy"><span>VENTURE LINK NETWORK</span><h1>让每一次连接，<strong>都更有价值。</strong></h1><p>一个更高效的创投连接平台，让项目、资本与产业资源在可信的环境里彼此成就。</p></div>
          <div className="auth-network-card">
            <div className="auth-network-top"><span>ONE PLATFORM</span><b>05 ROLES</b></div>
            <div className="auth-network-orbit orbit-a"/><div className="auth-network-orbit orbit-b"/>
            <div className="auth-network-core"><small>连接</small><b>创投</b></div>
            <i className="auth-node node-project">项目</i><i className="auth-node node-capital">资本</i><i className="auth-node node-fa">FA</i><i className="auth-node node-government">政府</i><i className="auth-node node-user">用户</i>
            <div className="auth-network-bottom"><span>DISCOVER · MATCH · MOVE</span><b>现在，进入你的下一步</b></div>
          </div>
          <div className="auth-trust"><span>✓ 主体与项目审核</span><span>✓ 信息边界清晰</span></div>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-panel-top">
          <span>{mode === "register" ? "已有账号？" : "还没有账号？"}<button onClick={() => switchMode(mode === "register" ? "login" : "register")}>{mode === "register" ? "直接登录" : "立即注册"}</button></span>
          <button onClick={() => go("home")}>返回首页</button>
        </div>
        <div className="auth-form-shell">
          <span className="auth-kicker">{mode === "register" ? "CREATE YOUR ACCOUNT" : "WELCOME BACK"}</span>
          <h2>{mode === "register" ? "加入创投智联" : "欢迎回到创投智联"}</h2>
          <p>{mode === "register" ? "选择身份并完善信息，开启你的专属入口。" : "登录后继续发现项目、资本与产业机会。"}</p>
          <div className="auth-mode-toggle">
            <button className={mode === "login" ? "active" : ""} onClick={() => switchMode("login")}>登录</button>
            <button className={mode === "register" ? "active" : ""} onClick={() => switchMode("register")}>注册</button>
          </div>
          {submitted ? (
            <div className="auth-success">
              <span>✓</span>
              <h3>{mode === "register" && role === "user" ? "注册成功，请直接登录" : mode === "register" ? "注册信息已提交" : "登录成功"}</h3>
              <p>{mode === "register" && role !== "user" ? "机构账号将在管理员审核通过后开放登录。" : "你的账号已准备就绪。"}</p>
              <button className="auth-primary" onClick={() => mode === "register" && role === "user" ? switchMode("login") : mode === "login" ? go("account") : go("home")}>{mode === "register" && role === "user" ? "去登录" : mode === "login" ? "进入账号中心" : "返回公开市场"}&nbsp;→</button>
            </div>
          ) : (
            <form className="auth-form" onSubmit={submit}>
              {mode === "register" && (
                <>
                  <label className="auth-full">身份
                    <select value={role} onChange={(event) => setRole(event.target.value as RoleId)}>
                      {roleOptions.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}
                    </select>
                  </label>
                  <div className="auth-role-grid">
                    {roleOptions.map((item) => <button type="button" key={item.id} className={role === item.id ? "selected" : ""} onClick={() => setRole(item.id)}><span className={`auth-role-icon role-icon-${item.id}`}><RoleIcon name={item.icon}/></span><b>{item.label}</b><small>{item.description}</small></button>)}
                  </div>
                  {role === "user" ? (
                    <label className="auth-full">用户名称<input required minLength={2} value={form.userName} onChange={(event) => update("userName", event.target.value)} placeholder="请输入用户名称"/></label>
                  ) : (
                    <>
                      <label>机构名称<input required value={form.organization} onChange={(event) => update("organization", event.target.value)} placeholder="请输入机构名称"/></label>
                      <label>联系人姓名<input required value={form.contact} onChange={(event) => update("contact", event.target.value)} placeholder="请输入联系人姓名"/></label>
                    </>
                  )}
                  <label>手机号<input required pattern="1[3-9][0-9]{9}" value={form.phone} onChange={(event) => update("phone", event.target.value)} placeholder="请输入手机号"/></label>
                </>
              )}
              <label className={mode === "login" ? "auth-full" : ""}>邮箱地址{mode === "register" && !emailRequired ? "（选填）" : ""}
                <input required={mode === "login" || emailRequired} type={mode === "login" ? "text" : "email"} value={form.email} onChange={(event) => update("email", event.target.value)} placeholder={mode === "login" ? "邮箱或手机号" : "name@company.com"}/>
              </label>
              <label className={mode === "login" ? "auth-full" : ""}>密码
                <input required minLength={6} type="password" value={form.password} onChange={(event) => update("password", event.target.value)} placeholder="至少 6 位密码"/>
              </label>
              {mode === "register" && (
                <>
                  <label>确认密码<input required minLength={6} type="password" value={form.confirm} onChange={(event) => update("confirm", event.target.value)} placeholder="再次输入密码"/></label>
                  <label className="captcha-input">英文字母验证码<input required minLength={5} maxLength={5} value={form.captchaCode} onChange={(event) => update("captchaCode", event.target.value.toUpperCase())} placeholder="输入图片中的字母"/></label>
                  <div className="captcha-box">
                    <div className="captcha-image-wrap">{captcha ? <img src={captcha.image} alt="英文字母验证码"/> : <span>加载中</span>}</div>
                    <button type="button" className="captcha-refresh" onClick={() => void refreshCaptcha()} disabled={captchaLoading} title="刷新验证码">↻</button>
                  </div>
                </>
              )}
              {error && <p className="auth-error">{error}</p>}
              <button disabled={saving} className="auth-primary auth-submit">{saving ? "提交中…" : mode === "register" ? `完成注册进入${selectedRole?.label ?? "平台"}` : "登录创投智联"}&nbsp;→</button>
              <button type="button" className="auth-public" onClick={() => go("home")}>继续浏览公开项目&nbsp;→</button>
            </form>
          )}
        </div>
        <small className="auth-legal">继续操作即表示你同意创投智联的服务条款与隐私说明。</small>
      </section>
    </main>
  );
}

function ForgotPasswordCard() {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<"request" | "confirm" | "done">("request");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const submitRequest = async (event: FormEvent) => { event.preventDefault(); setSaving(true); setMessage(""); try { const result = await api.requestPasswordReset(email); if (result.previewToken) { setToken(result.previewToken); setPhase("confirm"); setMessage("开发环境已生成一次性重置令牌，请继续设置新密码。"); } else { setPhase("done"); setMessage("如果邮箱已注册，重置链接会发送到你的邮箱，请查收。"); } } catch { setMessage("请输入有效的注册邮箱。"); } finally { setSaving(false); } };
  const submitConfirm = async (event: FormEvent) => { event.preventDefault(); setSaving(true); setMessage(""); try { await api.confirmPasswordReset(token, password, confirm); setPhase("done"); setMessage("密码已重置，请返回登录。"); } catch { setMessage("令牌无效、已过期或两次密码不一致。"); } finally { setSaving(false); } };
  return <aside className={`password-reset-card${open ? " open" : ""}`}>{!open ? <button type="button" className="password-reset-trigger" onClick={() => setOpen(true)}>忘记密码？</button> : <div><div className="password-reset-heading"><div><span className="eyebrow">ACCOUNT RECOVERY</span><b>找回登录密码</b></div><button type="button" className="password-reset-close" onClick={() => setOpen(false)}>×</button></div>{phase === "request" && <form onSubmit={submitRequest}><input required type="email" placeholder="注册邮箱" value={email} onChange={(event) => setEmail(event.target.value)}/><button className="primary" disabled={saving}>{saving ? "发送中…" : "发送找回链接"}</button></form>}{phase === "confirm" && <form onSubmit={submitConfirm}><input required placeholder="一次性令牌" value={token} onChange={(event) => setToken(event.target.value)}/><input required minLength={8} type="password" placeholder="新密码（至少 8 位）" value={password} onChange={(event) => setPassword(event.target.value)}/><input required minLength={8} type="password" placeholder="确认新密码" value={confirm} onChange={(event) => setConfirm(event.target.value)}/><button className="primary" disabled={saving}>{saving ? "保存中…" : "完成密码重置"}</button></form>}{phase === "done" && <p className="password-reset-done">{message}</p>}{message && phase !== "done" && <p className="password-reset-message">{message}</p>}</div>}</aside>;
}

function RecentViewsStrip({ views, projects, articles, go }: { views: RecentView[]; projects: Project[]; articles: Article[]; go: (view: View, query?: string) => void }) {
  const label = (view: RecentView) => {
    if (view.resourceType === "project") return projects.find((project) => project.id === view.resourceId)?.name ?? view.resourceId;
    if (view.resourceType === "article") return articles.find((article) => article.id === view.resourceId)?.title ?? view.resourceId;
    return view.resourceId;
  };
  return <section className="section-wrap recent-views-strip"><div className="section-heading-row"><SectionTitle eyebrow="RECENTLY VIEWED" title="最近浏览" description="登录后自动保留最近查看的项目与资讯。"/><span className="recent-count">{views.length} 条</span></div>{views.length ? <div className="recent-view-list">{views.slice(0, 6).map((view) => <button key={`${view.resourceType}:${view.resourceId}`} onClick={() => go(view.resourceType === "project" ? "projects" : "articles")}><span>{view.resourceType === "project" ? "项目" : "资讯"}</span><b>{label(view)}</b><small>{new Date(view.viewedAt).toLocaleDateString("zh-CN")}</small></button>)}</div> : <div className="recent-empty">还没有浏览记录，去项目库或资讯页看看吧。</div>}</section>;
}

function MyProjectsStrip() {
  const [projects, setProjects] = useState<import("./api.ts").OwnedProject[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { api.myProjects().then((payload) => setProjects(payload.projects)).catch(() => undefined).finally(() => setLoaded(true)); }, []);
  if (!loaded || !projects.length) return null;
  const labels = { pending: "待审核", approved: "已发布", rejected: "已驳回" } as const;
  return <section className="section-wrap my-projects-strip"><div className="section-heading-row"><SectionTitle eyebrow="MY PROJECTS" title="我的项目" description="查看项目审核状态和 BP 上传情况。"/><span className="recent-count">{projects.length} 个</span></div><div className="my-project-list">{projects.map((project) => <article key={project.id}><div><b>{project.name}</b><p>{project.industry} · {project.region} · {project.stage}</p></div><span className={`project-review-status ${project.reviewStatus}`}>{labels[project.reviewStatus]}</span><small>{project.bpFileName ? `BP：${project.bpFileName}` : "尚未上传 BP"}</small></article>)}</div></section>;
}

function MyBpRequestsStrip() {
  const [requests, setRequests] = useState<BpRequest[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { api.myBpRequests().then((payload) => setRequests(payload.requests)).catch(() => undefined).finally(() => setLoaded(true)); }, []);
  if (!loaded || !requests.length) return null;
  const labels = { pending: "待审核", approved: "已通过", rejected: "已拒绝" } as const;
  return <section className="section-wrap bp-requests-strip"><div className="section-heading-row"><SectionTitle eyebrow="BP REQUESTS" title="我的 BP 申请" description="查看你提交过的商业计划书访问申请。"/><span className="recent-count">{requests.length} 条</span></div><div className="my-project-list">{requests.map((request) => <article key={request.id}><div><b>{request.projectName}</b><p>{request.purpose}</p></div><span className={`project-review-status ${request.status === "approved" ? "approved" : request.status === "rejected" ? "rejected" : "pending"}`}>{labels[request.status]}</span><small>{new Date(request.createdAt).toLocaleDateString("zh-CN")}</small></article>)}</div></section>;
}

function IncomingBpRequestsStrip() {
  const [requests, setRequests] = useState<IncomingBpRequest[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const refresh = () => { void api.incomingBpRequests().then((payload) => setRequests(payload.requests)).catch(() => undefined).finally(() => setLoaded(true)); };
  useEffect(refresh, []);
  const decide = async (requestId: string, decision: "approved" | "rejected") => { setSavingId(requestId); try { await api.decideBpRequest(requestId, decision); refresh(); } finally { setSavingId(null); } };
  if (!loaded || !requests.length) return null;
  return <section className="section-wrap bp-requests-strip"><div className="section-heading-row"><SectionTitle eyebrow="INCOMING BP REQUESTS" title="收到的 BP 申请" description="项目方可在这里审核材料访问申请。"/><span className="recent-count">{requests.filter((request) => request.status === "pending").length} 条待处理</span></div><div className="my-project-list">{requests.map((request) => <article key={request.id}><div><b>{request.projectName} · {request.requesterOrganizationName}</b><p>{request.purpose}</p></div>{request.status === "pending" ? <div className="bp-action-buttons"><button className="primary" disabled={savingId === request.id} onClick={() => void decide(request.id, "approved")}>批准</button><button className="outline" disabled={savingId === request.id} onClick={() => void decide(request.id, "rejected")}>拒绝</button></div> : <span className={`project-review-status ${request.status === "approved" ? "approved" : "rejected"}`}>{request.status === "approved" ? "已通过" : "已拒绝"}</span>}</article>)}</div></section>;
}

function MyContactRequestsStrip() {
  const [requests, setRequests] = useState<MyContactRequest[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { api.myContactRequests().then((payload) => setRequests(payload.requests)).catch(() => undefined).finally(() => setLoaded(true)); }, []);
  if (!loaded || !requests.length) return null;
  const labels = { new: "待处理", contacted: "已联系", progressing: "对接中", completed: "已完成", closed: "已关闭" } as const;
  return <section className="section-wrap bp-requests-strip"><div className="section-heading-row"><SectionTitle eyebrow="MY MATCHING REQUESTS" title="我的对接需求" description="查看你提交的政府招商与产业对接需求进度。"/><span className="recent-count">{requests.length} 条</span></div><div className="my-project-list">{requests.map((request) => <article key={request.id}><div><b>{request.organization} · {request.targetRegion || "待匹配地区"}</b><p>{request.need}</p></div><span className={`project-review-status ${request.status === "completed" ? "approved" : request.status === "closed" ? "rejected" : "pending"}`}>{labels[request.status]}</span><small>{new Date(request.createdAt).toLocaleDateString("zh-CN")}</small></article>)}</div></section>;
}

function AccountSecurityStrip() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [state, setState] = useState<"idle" | "saving" | "success" | "error">("idle");
  const submit = async (event: FormEvent) => { event.preventDefault(); setState("saving"); try { await api.changePassword(form); setForm({ currentPassword: "", newPassword: "", confirmPassword: "" }); setState("success"); } catch { setState("error"); } };
  return <section className="section-wrap security-strip"><div className="section-heading-row"><SectionTitle eyebrow="ACCOUNT SECURITY" title="账号安全" description="定期更新密码，保护项目与 BP 访问权限。"/></div><form className="security-form" onSubmit={submit}><input required minLength={6} type="password" placeholder="当前密码" value={form.currentPassword} onChange={(event) => setForm({ ...form, currentPassword: event.target.value })}/><input required minLength={8} type="password" placeholder="新密码（至少 8 位）" value={form.newPassword} onChange={(event) => setForm({ ...form, newPassword: event.target.value })}/><input required minLength={8} type="password" placeholder="确认新密码" value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })}/><button className="primary" disabled={state === "saving"}>{state === "saving" ? "保存中…" : "更新密码"}</button>{state === "success" && <span className="security-message success">密码已更新</span>}{state === "error" && <span className="security-message error">当前密码错误或新密码不符合要求</span>}</form></section>;
}

function AccountProfileStrip() {
  const [form, setForm] = useState({ displayName: "", email: "", phone: "" });
  const [state, setState] = useState<"loading" | "idle" | "saving" | "success" | "error">("loading");
  useEffect(() => { api.session().then(({ actor }) => setForm({ displayName: actor.displayName ?? "", email: actor.email ?? "", phone: actor.phone ?? "" })).catch(() => undefined).finally(() => setState("idle")); }, []);
  const submit = async (event: FormEvent) => { event.preventDefault(); setState("saving"); try { await api.updateProfile({ displayName: form.displayName, email: form.email || undefined, phone: form.phone || undefined }); setState("success"); } catch { setState("error"); } };
  return <section className="section-wrap profile-strip"><div className="section-heading-row"><SectionTitle eyebrow="PROFILE SETTINGS" title="资料设置" description="修改公开联系信息前，请确保邮箱或手机号至少保留一项。"/></div><form className="profile-form" onSubmit={submit}><input required minLength={2} placeholder="显示名称" value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })}/><input type="email" placeholder="邮箱地址（选填）" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })}/><input pattern="1[3-9][0-9]{9}" placeholder="手机号（选填）" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })}/><button className="primary" disabled={state === "loading" || state === "saving"}>{state === "saving" ? "保存中…" : "保存资料"}</button>{state === "success" && <span className="security-message success">资料已保存</span>}{state === "error" && <span className="security-message error">邮箱或手机号已被使用，或资料格式不正确</span>}</form></section>;
}

function EmailVerificationStrip() {
  const [email, setEmail] = useState<string | null>(null);
  const [verifiedAt, setVerifiedAt] = useState<string | null>(null);
  const [previewToken, setPreviewToken] = useState("");
  const [state, setState] = useState<"loading" | "idle" | "saving" | "error">("loading");
  useEffect(() => { api.session().then(({ actor }) => { setEmail(actor.email ?? null); setVerifiedAt(actor.emailVerifiedAt ?? null); }).catch(() => undefined).finally(() => setState("idle")); }, []);
  const request = async () => { setState("saving"); try { const result = await api.requestEmailVerification(); setPreviewToken(result.previewToken ?? ""); } catch { setState("error"); } finally { setState((current) => current === "error" ? current : "idle"); } };
  const confirm = async () => { if (!previewToken) return; setState("saving"); try { const result = await api.confirmEmailVerification(previewToken); setVerifiedAt(result.emailVerifiedAt); setPreviewToken(""); } catch { setState("error"); } finally { setState((current) => current === "error" ? current : "idle"); } };
  if (state === "loading" || !email || verifiedAt) return null;
  return <section className="section-wrap email-verify-strip"><div className="section-heading-row"><SectionTitle eyebrow="EMAIL VERIFICATION" title="验证邮箱" description={`当前邮箱：${email}。验证后可用于找回密码和接收重要通知。`}/><span className="email-verify-status">未验证</span></div>{previewToken ? <div className="email-preview-row"><code>{previewToken}</code><button className="primary" onClick={() => void confirm()} disabled={state === "saving"}>确认验证</button></div> : <div className="email-preview-row"><button className="primary" onClick={() => void request()} disabled={state === "saving"}>{state === "saving" ? "发送中…" : "发送验证邮件"}</button>{state === "error" && <span className="security-message error">验证请求失败，请稍后重试</span>}</div>}</section>;
}

function NotificationsStrip() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const refresh = () => { api.notifications().then((payload) => { setNotifications(payload.notifications); setUnreadCount(payload.unreadCount); }).catch(() => undefined).finally(() => setLoaded(true)); };
  useEffect(refresh, []);
  const markRead = async (notification: Notification) => {
    if (notification.readAt) return;
    setSaving(notification.id);
    try { await api.markNotificationRead(notification.id); setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item)); setUnreadCount((count) => Math.max(0, count - 1)); } finally { setSaving(null); }
  };
  const markAllRead = async () => { if (!unreadCount) return; setSaving("all"); try { await api.markAllNotificationsRead(); setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() }))); setUnreadCount(0); } finally { setSaving(null); } };
  const typeLabels: Record<Notification["type"], string> = { system: "系统", account: "账号", project: "项目", bp: "BP", contact: "对接" };
  return <section className="section-wrap notifications-strip"><div className="section-heading-row"><SectionTitle eyebrow="NOTIFICATION CENTER" title="通知中心" description="账号审核、项目审核、BP 申请和对接需求的最新状态会在这里汇总。"/><div className="notification-toolbar"><span className="recent-count">{unreadCount} 条未读</span><button className="outline" disabled={!unreadCount || saving === "all"} onClick={() => void markAllRead()}>{saving === "all" ? "处理中…" : "全部已读"}</button></div></div>{!loaded ? <div className="notification-empty">正在加载通知…</div> : notifications.length ? <div className="notification-list">{notifications.map((notification) => <button key={notification.id} className={`notification-item ${notification.readAt ? "read" : "unread"}`} disabled={saving === notification.id} onClick={() => void markRead(notification)}><span className={`notification-dot ${notification.readAt ? "" : "active"}`} /><span className="notification-content"><span className="notification-meta"><b>{typeLabels[notification.type]}</b><small>{new Date(notification.createdAt).toLocaleString("zh-CN")}</small></span><strong>{notification.title}</strong><p>{notification.body}</p></span>{!notification.readAt && <em>未读</em>}</button>)}</div> : <div className="notification-empty">暂无通知。完成注册、提交项目或发起对接后，平台会在这里同步进度。</div>}</section>;
}

export default function App() {
  useEffect(() => { if (window.location.pathname !== "/") window.history.replaceState({}, "", `/${window.location.hash}`); }, []);
  const [view, setView] = useState<View>(() => (window.location.hash.slice(1) as View) || "home");
  const [projects, setProjects] = useState<Project[]>([]); const [organizations, setOrganizations] = useState<Organization[]>([]); const [contacts, setContacts] = useState<GovernmentContact[]>([]); const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [menuOpen, setMenuOpen] = useState(false);
  const [favoriteKeys, setFavoriteKeys] = useState<Set<string>>(new Set());
  const [recentViews, setRecentViews] = useState<RecentView[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProject, setSelectedProject] = useState<Project>(); const [selectedArticle, setSelectedArticle] = useState<Article>(); const [contactModal, setContactModal] = useState<{ open: boolean; contact?: GovernmentContact }>({ open: false }); const [roleModalOpen, setRoleModalOpen] = useState(false); const [selectedRole, setSelectedRole] = useState<RoleId>();
  useEffect(() => { const onHash = () => { const next = window.location.hash.slice(1) as View; if (next === "auth" || next === "account" || navItems.some((item) => item.id === next)) setView(next); }; window.addEventListener("hashchange", onHash); return () => window.removeEventListener("hashchange", onHash); }, []);
  useEffect(() => { Promise.all([api.projects({ page: 1, pageSize: 50 }), api.organizations({ page: 1, pageSize: 50 }), api.contacts({ page: 1, pageSize: 50 }), api.articles({ page: 1, pageSize: 50 })]).then(([p, o, c, a]) => { setProjects(p.projects); setOrganizations(o.organizations); setContacts(c.contacts); setArticles(a.articles); }).catch((reason: Error) => setError(reason.message)).finally(() => setLoading(false)); }, []);
  useEffect(() => { if (!window.localStorage.getItem("venture_session")) return; api.favorites().then(({ favorites }) => setFavoriteKeys(new Set(favorites.map((favorite) => `${favorite.resourceType}:${favorite.resourceId}`)))).catch(() => undefined); }, []);
  useEffect(() => { if (!window.localStorage.getItem("venture_session")) return; api.recentViews().then(({ views }) => setRecentViews(views)).catch(() => undefined); }, [view]);
  useEffect(() => {
    if (loading) return;
    const elements = document.querySelectorAll<HTMLElement>(".reveal");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      elements.forEach((element) => element.classList.add("visible"));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [loading, view]);
  const go = (next: View, query = "") => { setView(next); setSearchQuery(query); window.location.hash = next; window.scrollTo({ top: 0, behavior: "smooth" }); setMenuOpen(false); };
  const handleSearch = (query: string, target: SearchTarget) => go(target, query);
  const openProject = (project: Project) => { if (window.localStorage.getItem("venture_session")) { void api.recordRecentView("project", project.id); setRecentViews((current) => [{ resourceType: "project" as const, resourceId: project.id, viewedAt: new Date().toISOString() }, ...current.filter((view) => !(view.resourceType === "project" && view.resourceId === project.id))].slice(0, 20)); } setSelectedProject(project); void api.project(project.id).then(({ project: detail }) => setSelectedProject((current) => current?.id === project.id ? { ...current, ...detail } : current)).catch(() => undefined); };
  const openArticle = (article: Article) => { if (window.localStorage.getItem("venture_session")) { void api.recordRecentView("article", article.id); setRecentViews((current) => [{ resourceType: "article" as const, resourceId: article.id, viewedAt: new Date().toISOString() }, ...current.filter((view) => !(view.resourceType === "article" && view.resourceId === article.id))].slice(0, 20)); } setSelectedArticle(article); void api.article(article.slug).then(({ article: detail }) => setSelectedArticle((current) => current?.id === article.id ? detail : current)).catch(() => undefined); };
  const toggleFavorite = async (resourceType: FavoriteResourceType, resourceId: string) => {
    if (!window.localStorage.getItem("venture_session")) { go("auth"); return; }
    const key = `${resourceType}:${resourceId}`;
    try {
      if (favoriteKeys.has(key)) { await api.removeFavorite(resourceType, resourceId); setFavoriteKeys((current) => { const next = new Set(current); next.delete(key); return next; }); }
      else { await api.addFavorite(resourceType, resourceId); setFavoriteKeys((current) => new Set(current).add(key)); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "收藏失败"); }
  };
  let content = <HomeView projects={projects} organizations={organizations} contacts={contacts} articles={articles} go={go} openProject={openProject} openArticle={openArticle} favoriteKeys={favoriteKeys} onToggleFavorite={toggleFavorite}/>;
  if (view === "projects") content = <ProjectsView projects={projects} openProject={openProject} initialQuery={searchQuery} favoriteKeys={favoriteKeys} onToggleFavorite={toggleFavorite}/>;
  if (view === "organizations") content = <OrganizationsView organizations={organizations} initialQuery={searchQuery} favoriteKeys={favoriteKeys} onToggleFavorite={toggleFavorite}/>;
  if (view === "government") content = <GovernmentView contacts={contacts} openContact={(contact) => setContactModal({ open: true, contact })} initialQuery={searchQuery}/>;
  if (view === "articles") content = <ArticlesView articles={articles} openArticle={openArticle} initialQuery={searchQuery} favoriteKeys={favoriteKeys} onToggleFavorite={toggleFavorite}/>;
  if (view === "auth") content = <AuthView initialRole={selectedRole} go={go}/>;
  if (view === "account") content = <><AccountView go={go}/><NotificationsStrip/><AccountProfileStrip/><EmailVerificationStrip/><AccountSecurityStrip/><MyProjectsStrip/><MyBpRequestsStrip/><IncomingBpRequestsStrip/><MyContactRequestsStrip/><RecentViewsStrip views={recentViews} projects={projects} articles={articles} go={go}/></>;
  return <div className={`site-shell view-${view}`}><header className="site-header"><div className="header-inner"><button className="brand" onClick={() => go("home")}><span>V</span><div><b>创投智联</b><small>VENTURE LINK</small></div></button><button className="menu-button" aria-label="打开导航" onClick={() => setMenuOpen(!menuOpen)}><i/><i/><i/></button><nav className={menuOpen ? "open" : ""}>{navItems.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => go(item.id)}>{item.label}</button>)}</nav><GlobalSearch projects={projects} organizations={organizations} contacts={contacts} articles={articles} onSearch={handleSearch}/><button className="header-cta" onClick={() => setRoleModalOpen(true)}>选择身份</button></div></header>{loading ? <div className="loading">正在连接创投资源…</div> : error ? <div className="loading error">载入失败：{error}</div> : content}<footer><div className="section-wrap footer-grid"><div><div className="footer-brand"><span>V</span><b>创投智联</b></div><p>连接项目、资本与政府产业资源。</p></div><div><b>平台导航</b><button onClick={() => go("projects")}>项目库</button><button onClick={() => go("organizations")}>机构库</button><button onClick={() => go("government")}>政府对接</button></div><div><b>安全原则</b><span>主体认证</span><span>最小权限</span><span>访问留痕</span></div><div><b>当前版本</b><span>试点 MVP</span><span>线下登记与对接</span><span>正式上线需备案域名</span></div></div><div className="footer-bottom">© 2026 创投智联 · 本平台信息仅供交流，不构成投资建议</div></footer>{roleModalOpen && <RoleSelectionModal onClose={() => setRoleModalOpen(false)} onSelect={(role) => { setSelectedRole(role); setRoleModalOpen(false); go("auth"); }}/>} {contactModal.open && <ContactModal contact={contactModal.contact} onClose={() => setContactModal({ open: false })}/>} {selectedProject && <ProjectModal project={selectedProject} onClose={() => setSelectedProject(undefined)}/>} {selectedArticle && <ArticleModal article={selectedArticle} onClose={() => setSelectedArticle(undefined)}/>}</div>;
}
