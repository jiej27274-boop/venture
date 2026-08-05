import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  api,
  clearPublicSession,
  getPublicSession,
  notifyAuthChanged,
  PUBLIC_SESSION_KEY,
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
  type IdentitySubmission,
  type IdentitySubmissionType,
  type GovernmentContact,
  type Organization,
  type Project,
} from "./api.ts";
import qifengLogoAsset from "./qifeng-capital-logo.png";
import { IndustryMapPage, ServicesPage } from "./portalPages.tsx";

function imageUrl(asset: unknown) {
  if (typeof asset === "string") return asset;
  if (asset && typeof asset === "object" && "src" in asset) return String((asset as { src: unknown }).src);
  return "";
}

const qifengLogoUrl = imageUrl(qifengLogoAsset);

type View = "home" | "projects" | "organizations" | "institutions" | "government" | "research" | "events" | "articles" | "industries" | "services" | "auth" | "account";

const navItems: Array<{ id: View; label: string }> = [
  { id: "home", label: "首页" },
  { id: "projects", label: "投融资" },
  { id: "organizations", label: "公司" },
  { id: "institutions", label: "创投机构" },
  { id: "government", label: "政府对接" },
  { id: "research", label: "研究报告" },
  { id: "events", label: "创投电报" },
  { id: "industries", label: "行业图谱" },
  { id: "services", label: "产品服务" },
];

const secondaryViews: View[] = ["industries", "services"];

const viewToPath: Record<View, string> = { home: "/", projects: "/projects", organizations: "/organizations", institutions: "/institutions", government: "/government", research: "/research", events: "/events", articles: "/articles", industries: "/industries", services: "/services", auth: "/auth", account: "/account" };

type EditorialKind = "research" | "events";
type EditorialSection = { index: string; label: string; title: string; body: string };
type EditorialStory = {
  kind: EditorialKind;
  navLabel: string;
  eyebrow: string;
  dateLabel: string;
  title: string;
  subtitle: string;
  lead: string;
  metrics: Array<{ value: string; label: string }>;
  sections: EditorialSection[];
  pullQuote: string;
};

const editorialStories: Record<EditorialKind, EditorialStory> = {
  research: {
    kind: "research",
    navLabel: "研究报告",
    eyebrow: "VENTURE RESEARCH · FIELD NOTE",
    dateLabel: "本期观察 · 2026.08",
    title: "产业资本进入验证期",
    subtitle: "从追逐风口，到把技术、产能和落地场景放在同一张表里。",
    lead: "这一期不追逐热词。我们把视线放回项目真正能不能落地：谁在付费、谁能交付、谁愿意共同承担下一阶段的不确定性。",
    metrics: [
      { value: "01", label: "核心判断" },
      { value: "03", label: "观察信号" },
      { value: "12 min", label: "建议阅读" },
    ],
    sections: [
      { index: "01", label: "判断", title: "资本的耐心，正在被产业结果重新定义", body: "当融资节奏放缓，项目的表达重点也在变化。单一技术亮点很难独立支撑下一轮判断，真实客户、交付周期和单位经济模型开始成为更早被追问的内容。" },
      { index: "02", label: "信号", title: "能把复杂事情讲清楚的团队，更容易获得下一次沟通", body: "优秀的项目不再把材料写成愿景目录，而是把产业链位置、验证进度和下一步要解决的问题排成一条清晰的路径。信息越具体，合作方越容易找到自己的切入口。" },
      { index: "03", label: "建议", title: "先证明一件事，再谈更大的想象空间", body: "对于项目方，建议把下一阶段拆成可验收的三个动作；对于资金方，除了看增长曲线，也要看团队是否具备持续拿到现场反馈并完成迭代的能力。" },
    ],
    pullQuote: "真正有价值的增长，不是把故事讲得更大，而是让下一次验证变得更近。",
  },
  events: {
    kind: "events",
    navLabel: "创投电报",
    eyebrow: "EVENT BRIEF · PLATFORM DESK",
    dateLabel: "事件观察 · 2026.08",
    title: "一次产业合作，怎样从接触走到落地",
    subtitle: "真正重要的新闻，不只发生在签约台上。",
    lead: "我们记录一条项目落地链路：需求从哪里出现，证据如何被核验，政府、资本和项目方又怎样在同一张时间表上重新对齐。",
    metrics: [
      { value: "04", label: "关键节点" },
      { value: "03", label: "参与角色" },
      { value: "01", label: "落地目标" },
    ],
    sections: [
      { index: "01", label: "接触", title: "需求先于方案出现", body: "一次有效的对接，往往不是从介绍产品开始，而是从确认现场问题开始。需求越具体，项目方越能快速判断自己的技术和交付能力是否真的适配。" },
      { index: "02", label: "核验", title: "把纸面能力变成现场证据", body: "技术参数、客户反馈、产能安排和团队分工，是合作从意向进入验证的几个关键切面。公开信息只负责建立信任，现场证据才负责推动下一步。" },
      { index: "03", label: "协同", title: "让三方站到同一张时间表上", body: "项目方关注交付，资本关注节奏，地方关注产业贡献。把各自的目标拆成可以互相确认的节点，合作才不会停留在一次会议之后。" },
      { index: "04", label: "落地", title: "让承诺进入排产表和预算表", body: "落地不是一句口号，而是明确的空间、设备、人员和资金安排。最终决定合作质量的，通常是这些不够热闹但可以被复盘的细节。" },
    ],
    pullQuote: "新闻的终点不是热度，而是一个项目开始真正改变现场。",
  },
};

const telegraphCategories = [
  { id: "investment", label: "投资事件" },
  { id: "acquisition", label: "收购事件" },
  { id: "merger", label: "合并事件" },
  { id: "listing", label: "上市事件" },
  { id: "ipo", label: "IPO 排队" },
  { id: "exit", label: "退出事件" },
  { id: "fundraising", label: "募资事件" },
  { id: "personnel", label: "人事变动" },
  { id: "product", label: "产品发布" },
  { id: "negative", label: "坏消息" },
  { id: "vc-insight", label: "VC 洞见" },
  { id: "institution", label: "机构要闻" },
  { id: "equity", label: "股权转让" },
] as const;
type TelegraphCategory = (typeof telegraphCategories)[number]["id"];
type TelegraphEntry = {
  id: string;
  category: TelegraphCategory;
  date: string;
  timeLabel: string;
  title: string;
  summary: string;
  detail: string;
};

const telegraphEntries: TelegraphEntry[] = [
  { id: "telegraph-investment-1", category: "investment", date: "2026-08-03", timeLabel: "33 分钟前", title: "澜序智能完成 1000 万元种子轮融资", summary: "澜序智能是一家面向工业现场的 AI 服务团队，本轮资金将用于完善数据采集、模型验证和首批客户交付。", detail: "团队把融资拆成三个明确动作：先完成两类现场数据的标准化，再把模型部署到真实生产环境，最后围绕交付周期建立可复用的实施方法。相比单纯扩大模型参数，这种节奏更接近产业客户真正愿意付费的地方。" },
  { id: "telegraph-investment-2", category: "investment", date: "2026-08-03", timeLabel: "49 分钟前", title: "广达盛贸易获得新一轮投资", summary: "广达盛贸易长期服务食品与消费品供应链，新增资金将用于区域仓配网络和数字化采购能力建设。", detail: "这笔投资的看点不在门店数量，而在供应链效率。企业正在把采购、仓储和渠道反馈放到同一套数据流程中，试图用更短的周转时间换取更稳定的毛利空间。" },
  { id: "telegraph-investment-3", category: "investment", date: "2026-08-03", timeLabel: "1 小时前", title: "光年探索获得数千万元 Pre-A 轮融资", summary: "光年探索专注工业化运载与火箭结构产品，资金将用于核心结构研发、测试验证和小批量制造。", detail: "项目进入 Pre-A 阶段后，投资人关注的重点从技术可行性转向工程化能力。下一阶段能否稳定完成测试、控制交付成本，将直接影响它从技术团队走向产业供应商的速度。" },
  { id: "telegraph-investment-4", category: "investment", date: "2026-08-02", timeLabel: "昨天", title: "迈创峰获得数千万美元天使轮融资", summary: "迈创峰为新能源设备提供核心零部件和检测服务，首笔资金将支持实验线建设与下游客户验证。", detail: "早期资金首先要买来验证时间。对这类设备项目而言，实验线、样品迭代和客户测试是最重要的三项支出，能否把验证周期压缩下来，比过早扩张产能更关键。" },
  { id: "telegraph-acquisition-1", category: "acquisition", date: "2026-08-02", timeLabel: "昨天", title: "恒川科技完成对微澜数据的战略收购", summary: "双方将整合工业数据接口和行业客户资源，收购完成后保留微澜数据的产品团队与独立交付体系。", detail: "这不是简单的客户并表。收购方需要把接口能力真正嵌入原有产品，同时保留被收购团队对行业现场的理解，整合周期和产品边界值得继续观察。" },
  { id: "telegraph-merger-1", category: "merger", date: "2026-08-01", timeLabel: "2 天前", title: "两家产业服务平台宣布合并运营", summary: "合并后的平台将把区域招商服务与项目交付能力放到同一条业务线上，先从华东市场展开试点。", detail: "合并之后最先需要解决的是业务协同，而不是品牌更换。双方正在统一客户分层、项目跟进和交付节点，能否减少重复沟通将决定这次整合的实际价值。" },
  { id: "telegraph-listing-1", category: "listing", date: "2026-07-31", timeLabel: "3 天前", title: "北辰储能提交上市辅导备案", summary: "北辰储能主营工商业储能系统与运维服务，当前计划优先提升项目交付和应收账款管理能力。", detail: "上市准备让企业重新审视经营质量。除了收入规模，储能项目的回款周期、售后责任和资产使用效率都会进入更细的核验阶段。" },
  { id: "telegraph-ipo-1", category: "ipo", date: "2026-07-30", timeLabel: "4 天前", title: "云栖医疗进入 IPO 排队阶段", summary: "云栖医疗围绕基层诊疗设备和数据服务展开业务，后续将继续推进产品注册与渠道合规。", detail: "进入排队并不意味着终点。医疗项目仍要回到产品注册、渠道合规和真实使用反馈，资本市场的时间表最终要和临床及商业化节奏对齐。" },
  { id: "telegraph-exit-1", category: "exit", date: "2026-07-29", timeLabel: "5 天前", title: "远景资本完成一笔早期项目退出", summary: "该项目经过四年产品迭代后被产业方接手，原投资团队将继续以顾问身份参与业务交接。", detail: "一笔健康的退出不只看回报数字，也看项目是否找到更适合下一阶段的经营者。产业方的渠道和交付能力，是这次交易能够落地的重要原因。" },
  { id: "telegraph-fundraising-1", category: "fundraising", date: "2026-07-28", timeLabel: "6 天前", title: "杉木基金完成首期人民币基金募集", summary: "基金重点关注先进制造、产业软件与新能源服务，首期规模将以早期和成长期项目为主。", detail: "新基金把募资节奏放得更稳，重点不是覆盖更多赛道，而是围绕有限的产业方向建立持续的项目来源和投后协同能力。" },
  { id: "telegraph-personnel-1", category: "personnel", date: "2026-07-27", timeLabel: "7 天前", title: "启明产业资本任命新的投后负责人", summary: "新负责人将重点推进被投企业之间的供应链协作、客户引荐和区域落地项目。", detail: "投后服务正在从活动组织转向具体业务协作。负责人背景和企业资源是否匹配，将比职位名称更能说明机构的服务能力。" },
  { id: "telegraph-product-1", category: "product", date: "2026-07-26", timeLabel: "8 天前", title: "数桥发布面向制造业的现金流预测工具", summary: "新工具将订单、采购、库存和回款信息放到同一视图，先在装备制造和零部件企业中试用。", detail: "产品没有从复杂报表开始，而是先回答企业最常见的一个问题：未来八周的现金流缺口在哪里。能否接入真实业务系统，是产品下一阶段的关键。" },
  { id: "telegraph-negative-1", category: "negative", date: "2026-07-25", timeLabel: "9 天前", title: "某智能硬件项目暂停新一轮扩产计划", summary: "项目方表示将先完成现有客户交付和库存消化，再决定下一阶段的产能投入。", detail: "暂停扩产不等于项目结束。对硬件团队来说，先把交付、库存和现金流重新拉回可控范围，往往比在需求不确定时继续加码更重要。" },
  { id: "telegraph-vc-1", category: "vc-insight", date: "2026-07-24", timeLabel: "10 天前", title: "VC 洞见：项目估值正在回到交付证据", summary: "在产业项目的早期判断里，客户验证、交付能力和团队复盘速度成为越来越高频的观察项。", detail: "估值不是一个孤立的数字。项目能否持续拿到现场反馈，并把反馈变成产品和交付上的改进，正在成为判断成长空间的重要证据。" },
  { id: "telegraph-institution-1", category: "institution", date: "2026-07-23", timeLabel: "11 天前", title: "海岳创投开放先进制造项目征集窗口", summary: "本次征集关注工业软件、关键零部件和绿色制造服务，优先考虑已有明确客户验证的团队。", detail: "机构把征集条件写得更具体，说明项目来源正在从广泛覆盖转向产业匹配。对项目方而言，准备真实客户反馈比堆叠概念更有效。" },
  { id: "telegraph-equity-1", category: "equity", date: "2026-07-22", timeLabel: "12 天前", title: "一家产业服务企业完成股权结构调整", summary: "调整后创始团队与产业股东的职责边界更加清晰，后续将围绕区域交付和产品化服务展开。", detail: "股权变化通常会带来治理节奏的变化。此次调整把经营权、产业资源和长期激励重新分开安排，重点是让决策链条更短、更容易被执行。" },
];

const organizationType = { investor: "投资机构", fa: "FA 机构", government: "政府招商" } as const;

function SectionTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return <div className="section-title"><span>{eyebrow}</span><h2>{title}</h2>{description && <p>{description}</p>}</div>;
}

type DropdownOption = { value: string; label: string };

function Dropdown({ value, options, onChange, ariaLabel, className = "" }: { value: string; options: DropdownOption[]; onChange: (value: string) => void; ariaLabel: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return <div className={`dropdown${className ? ` ${className}` : ""}`} ref={rootRef}>
    <button type="button" className={`dropdown-trigger${open ? " open" : ""}`} aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
      <span>{selected?.label ?? value}</span><i aria-hidden="true" />
    </button>
    {open && <div className="dropdown-menu" role="listbox" aria-label={ariaLabel}>{options.map((option) => <button type="button" role="option" aria-selected={option.value === value} className={option.value === value ? "selected" : ""} key={option.value} onClick={() => { onChange(option.value); setOpen(false); }}>{option.label}</button>)}</div>}
  </div>;
}

function QifengLogo() {
  return <img className="qifeng-logo" src={qifengLogoUrl} alt="启峰创投" />;
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

type SearchTarget = "projects" | "organizations" | "government";
type SearchMatch = { id: string; target: SearchTarget; title: string; meta: string };

const searchTargetLabels: Record<SearchTarget, string> = {
  projects: "项目",
  organizations: "机构",
  government: "政府联系人",
};

function GlobalSearch({ projects, organizations, contacts, onSearch }: {
  projects: Project[];
  organizations: Organization[];
  contacts: GovernmentContact[];
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
    ].slice(0, 8);
  }, [contacts, organizations, projects, query]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const normalized = query.trim();
    if (!normalized) return;
    onSearch(normalized, matches[0]?.target ?? "projects");
    setOpen(false);
  };
  return <div className="global-search">
    <form onSubmit={submit} role="search"><input aria-label="全站搜索" value={query} onChange={(event) => { setQuery(event.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder="搜索项目、机构或行业"/><button aria-label="提交搜索" type="submit"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="4.5"/><path d="m12 12 4 4"/></svg></button></form>
    {open && query.trim() && <div className="search-results" role="listbox">
      {matches.length ? matches.map((match) => <button key={`${match.target}-${match.id}`} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { onSearch(query.trim(), match.target); setOpen(false); }}><span>{match.title}</span><small>{match.meta}</small></button>) : <div className="search-empty">未找到匹配内容，按回车查看项目库</div>}
    </div>}
  </div>;
}

const portalTargets: Array<{ id: SearchTarget; label: string }> = [
  { id: "projects", label: "查项目" },
  { id: "organizations", label: "查机构" },
  { id: "government", label: "查政府联系人" },
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

function CountUp({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setDisplayValue(0);
    if (reduceMotion || value <= 0) {
      setDisplayValue(value);
      return;
    }

    const startedAt = performance.now();
    const duration = 900;
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <>{displayValue.toLocaleString("zh-CN")}</>;
}

function PortalHero({ projects, organizations, contacts, go }: {
  projects: Project[];
  organizations: Organization[];
  contacts: GovernmentContact[];
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
    { value: projects.length, label: "公开项目", tone: "blue", icon: "company" as const },
    { value: organizations.length, label: "入驻机构", tone: "blue", icon: "institution" as const },
    { value: activeInvestors, label: "活跃投资机构", tone: "blue", icon: "person" as const },
    { value: industryCount, label: "覆盖行业", tone: "blue", icon: "industry" as const },
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
      {stats.map((stat) => <div className="portal-stat" key={stat.label}><span className={`portal-stat-icon ${stat.tone}`} aria-hidden="true"><StatIcon name={stat.icon}/></span><div><b><CountUp value={stat.value} /></b><small>{stat.label}</small></div></div>)}
    </section>
  </>;
}

function PortalDataDashboard({ projects, organizations, go }: {
  projects: Project[];
  organizations: Organization[];
  go: (view: View, query?: string) => void;
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
      <article className="portal-panel portal-featured">
        <div className="portal-panel-heading"><div><span>FEATURED EDITORIAL</span><h2>精选专题</h2></div><button onClick={() => go("research")}>查看研究&nbsp;›</button></div>
        <div className="portal-featured-grid">{(["research", "events"] as const).map((kind) => { const story = editorialStories[kind]; return <button key={kind} onClick={() => go(kind)}><span className={`portal-featured-art editorial-art-${kind}`}><em>{story.navLabel}</em></span><b>{story.title}</b><small>{story.dateLabel}</small></button>; })}</div>
      </article>
      <article className="portal-panel portal-observation">
        <div className="portal-panel-heading"><div><span>WEEKLY OBSERVATION</span><h2>本周观察</h2></div><button onClick={() => go("research")}>查看报告&nbsp;›</button></div>
        <div className="portal-observation-body"><p>产业资本正在从追逐风口，转向验证项目能不能持续交付。比故事更早被问到的，是客户反馈、交付周期和现金流。</p><div className="portal-observation-signals"><span><b>客户验证</b><small>先看真实反馈</small></span><span><b>交付周期</b><small>再看能否复制</small></span><span><b>现金流</b><small>最后看增长质量</small></span></div></div>
      </article>
    </div>
    <aside className="portal-dashboard-side">
      <article className="portal-panel portal-industries"><div className="portal-panel-heading"><div><span>INDUSTRY MAP</span><h2>行业图谱</h2></div><button onClick={() => go("industries")}>进入图谱&nbsp;›</button></div><div className="portal-industry-grid">{industryCounts.map(([industry, count]) => <button key={industry} onClick={() => go("projects", industry)}><span className="portal-industry-dot" />{industry}<b>{count}</b></button>)}{industryCounts.length === 0 && <div className="portal-empty">暂无行业数据</div>}</div></article>
      <article className="portal-panel portal-ranking"><div className="portal-panel-heading"><div><span>NETWORK</span><h2>入驻机构</h2></div><button onClick={() => go("organizations")}>更多&nbsp;›</button></div><ol>{rankedOrganizations.map((organization, index) => <li key={organization.id}><em>{index + 1}</em><span><b>{organization.name}</b><small>{organization.region} · {organization.tagline}</small></span><i>{organization.type === "investor" ? "投资机构" : organization.type === "fa" ? "FA 机构" : "政府招商"}</i></li>)}</ol>{rankedOrganizations.length === 0 && <div className="portal-empty">暂无机构数据</div>}</article>
      <article className="portal-panel portal-news"><div className="portal-panel-heading"><div><span>VENTURE TELEGRAPH</span><h2>创投电报</h2></div><button onClick={() => go("events")}>进入电报&nbsp;›</button></div><div className="portal-event-note"><b>{editorialStories.events.title}</b><p>{editorialStories.events.lead}</p><button onClick={() => go("events")}>查看创投电报 <span aria-hidden="true">→</span></button></div></article>
    </aside>
  </section>;
}

function HomeView({ projects, organizations, contacts, go, openProject, favoriteKeys, onToggleFavorite }: {
  projects: Project[];
  organizations: Organization[];
  contacts: GovernmentContact[];
  go: (view: View, query?: string) => void;
  openProject: (project: Project) => void;
  favoriteKeys: Set<string>;
  onToggleFavorite: (type: FavoriteResourceType, id: string) => void;
}) {
  return <>
    <PortalHero projects={projects} organizations={organizations} contacts={contacts} go={go}/>
    <PortalDataDashboard projects={projects} organizations={organizations} go={go}/>
    <section className="section-wrap home-section">
      <div className="section-heading-row reveal"><SectionTitle eyebrow="FEATURED PROJECTS" title="精选项目" description="公开摘要经过审核，敏感项目支持匿名展示。"/><button className="outline" onClick={() => go("projects")}>查看全部项目</button></div>
      <div className="project-grid">{projects.slice(0, 3).map((project) => <ProjectCard key={project.id} project={project} onOpen={openProject} favorite={favoriteKeys.has(`project:${project.id}`)} onToggleFavorite={() => onToggleFavorite("project", project.id)}/>)}</div>
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
      <Dropdown ariaLabel="选择行业" value={industry} onChange={setIndustry} options={[{ value: "", label: "全部行业" }, ...options("industry").map((value) => ({ value, label: value }))]} />
      <Dropdown ariaLabel="选择地区" value={region} onChange={setRegion} options={[{ value: "", label: "全部地区" }, ...options("region").map((value) => ({ value, label: value }))]} />
      <Dropdown ariaLabel="选择轮次" value={stage} onChange={setStage} options={[{ value: "", label: "全部轮次" }, ...options("stage").map((value) => ({ value, label: value }))]} />
    </div><div className="result-line">找到 <b>{result.pagination.total}</b> 个公开项目{loading && <small> · 正在更新</small>}</div><div className="project-grid">{result.items.map((project) => <ProjectCard key={project.id} project={project} onOpen={openProject} favorite={favoriteKeys.has(`project:${project.id}`)} onToggleFavorite={() => onToggleFavorite("project", project.id)}/>)}</div><PaginationControls {...result.pagination} onChange={setPage}/>
    {/*
      <select aria-label="选择行业" value={industry} onChange={(event) => setIndustry(event.target.value)}><option value="">全部行业</option>{options("industry").map((value) => <option key={value}>{value}</option>)}</select>
      <select aria-label="选择地区" value={region} onChange={(event) => setRegion(event.target.value)}><option value="">全部地区</option>{options("region").map((value) => <option key={value}>{value}</option>)}</select>
      <select aria-label="选择轮次" value={stage} onChange={(event) => setStage(event.target.value)}><option value="">全部轮次</option>{options("stage").map((value) => <option key={value}>{value}</option>)}</select>
    </div><div className="result-line">找到 <b>{result.pagination.total}</b> 个公开项目{loading && <small> · 正在更新</small>}</div><div className="project-grid">{result.items.map((project) => <ProjectCard key={project.id} project={project} onOpen={openProject} favorite={favoriteKeys.has(`project:${project.id}`)} onToggleFavorite={() => onToggleFavorite("project", project.id)}/>)}</div><PaginationControls {...result.pagination} onChange={setPage}/>
    */}
  </section></main>;
}

function CompanyLock() {
  return <svg className="company-lock-icon" viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="7" width="9" height="6" rx="1.5"/><path d="M5.5 7V5.4a2.5 2.5 0 0 1 5 0V7"/></svg>;
}

const companyIndustryOptions = ["全部", "企业服务", "生物科技", "医疗健康", "文化娱乐", "智能制造", "传统行业", "金融", "人工智能", "教育培训", "汽车交通", "生活服务", "电子商务", "能源电力", "大数据", "旅游", "农业", "消费", "物联网", "社区社交", "区块链"];
const companyRoundOptions = ["全部", "种子轮", "天使轮", "A轮", "B轮", "C轮", "D轮", "E轮", "F轮", "G~Pre-IPO(不含)", "Pre-IPO轮", "基石投资", "IPO", "二次上市", "上市公司定增", "上市（非IPO）", "新三板挂牌", "新三板定增", "并购", "私有化"];
const companyTimeOptions = ["全部", "近三个月", "最近半年", "最近一年", "2026", "2025", "2024"];
const companySidebarItems = ["全部公司", "未上市公司", "新股上会公司", "IPO上市公司", "新三板", "公司估值"];

function OrganizationsView({ organizations, initialQuery = "", favoriteKeys, onToggleFavorite }: { organizations: Organization[]; initialQuery?: string; favoriteKeys: Set<string>; onToggleFavorite: (type: FavoriteResourceType, id: string) => void }) {
  const [industry, setIndustry] = useState("");
  const [region, setRegion] = useState<"" | "中国" | "海外">("");
  const [q, setQ] = useState(initialQuery);
  const [headquartersQuery, setHeadquartersQuery] = useState("");
  useEffect(() => setQ(initialQuery), [initialQuery]);
  const normalized = q.trim().toLowerCase();
  const normalizedHeadquarters = headquartersQuery.trim().toLowerCase();
  const industryAliases: Record<string, string[]> = { "智能制造": ["智能制造", "先进制造", "机器人工"], "消费": ["消费", "消费科技"] };
  const industryMatches = (organization: Organization) => !industry || industry === "全部" || organization.focus.some((value) => (industryAliases[industry] ?? [industry]).some((alias) => value.includes(alias) || alias.includes(value)));
  const regionMatches = (organization: Organization) => !region || (region === "中国" ? !organization.region.includes("海外") : organization.region.includes("海外"));
  const filtered = organizations.filter((organization) =>
    industryMatches(organization) &&
    regionMatches(organization) &&
    (!normalizedHeadquarters || organization.region.toLowerCase().includes(normalizedHeadquarters)) &&
    (!normalized || [organization.name, organization.tagline, organization.description, organization.region, ...organization.focus].some((value) => value.toLowerCase().includes(normalized))),
  );
  const clearFilters = () => { setIndustry(""); setRegion(""); setQ(""); setHeadquartersQuery(""); };
  return <main className="page company-directory-page"><section className="section-wrap company-directory-shell"><div className="company-directory-layout">
    <aside className="company-sidebar" aria-label="公司分类导航"><div className="company-sidebar-heading"><span>COMPANY INDEX</span><h1>公司</h1><p>公司主体、上市状态与估值信息。</p></div><nav className="company-sidebar-nav">{companySidebarItems.map((item, index) => <button type="button" key={item} className={index === 0 ? "active" : ""} disabled={index > 0} onClick={index === 0 ? clearFilters : undefined}><StatIcon name={index === 0 ? "company" : index === 3 ? "rocket" : "industry"}/><span className="company-sidebar-item-label">{item}<CompanyLock/></span><small>{index === 0 ? organizations.length : ""}</small></button>)}<div className="company-sidebar-divider"/><div className="company-sidebar-pro"><StatIcon name="industry"/><span>AI标签企业</span><b>Beta</b><em>机构版</em></div><div className="company-sidebar-locked">机构版 <span>解锁</span></div></nav><div className="company-sidebar-note">部分公司指标需升级机构版查看。</div></aside>
    <div className="company-workspace"><div className="company-filter-panel"><div className="company-filter-row"><span className="company-filter-label"><CompanyLock/>睿兽行业</span><div className="company-filter-options">{companyIndustryOptions.map((value, index) => <button type="button" key={value} className={(!industry && index === 0) || industry === value ? "active" : ""} onClick={() => setIndustry(index === 0 ? "" : value)}>{value}</button>)}</div></div><div className="company-filter-row"><span className="company-filter-label"><CompanyLock/>最新轮次</span><div className="company-filter-options company-filter-static-options">{companyRoundOptions.map((value, index) => <span className={index === 0 ? "active" : ""} key={value}>{value}</span>)}</div></div><div className="company-filter-row"><span className="company-filter-label"><CompanyLock/>公司地区</span><div className="company-filter-options">{["全部", "中国", "海外"].map((value) => <button type="button" key={value} className={(!region && value === "全部") || region === value ? "active" : ""} onClick={() => setRegion(value === "全部" ? "" : value as "中国" | "海外")}>{value}</button>)}</div></div><div className="company-filter-row"><span className="company-filter-label"><CompanyLock/>获投时间</span><div className="company-filter-options company-filter-static-options">{companyTimeOptions.map((value, index) => <span className={index === 0 ? "active" : ""} key={value}>{value}</span>)}<span className="company-date-field">▣　开始日期　　至　结束日期</span></div></div><div className="company-filter-row company-filter-row-last"><span className="company-filter-label"><CompanyLock/>其他指标</span><div className="company-other-filters"><label><span>成立时间</span><input readOnly placeholder="开始日期　 至　结束日期" aria-label="成立时间"/></label><label><span>投资方总部</span><input value={headquartersQuery} onChange={(event) => setHeadquartersQuery(event.target.value)} placeholder="请输入地区名称" aria-label="投资方总部"/></label><label><span>标签搜索</span><input value={q} onChange={(event) => setQ(event.target.value)} placeholder="请搜索企业画像标签" aria-label="标签搜索"/></label><span className="company-mini-filter"><b>BP状态</b><i>全部</i><span>有BP</span></span><span className="company-mini-filter"><b>获投状态</b><i>全部</i><span>未获投</span></span></div></div></div>
      <section className="company-results-panel"><div className="company-results-heading"><div><div className="company-results-title"><h2>全部公司</h2><span>{filtered.length} 家结果</span></div><p>{q ? `搜索“${q}”的匹配结果` : "公开展示已完成基础核验的公司信息"}</p></div><span className="company-results-status"><i/>已核验数据</span></div><div className="company-table-wrap"><table className="company-table"><thead><tr><th className="company-check-col">对比</th><th className="company-index-col">序号</th><th>公司</th><th>一句话简介</th><th>行业领域</th><th>地区</th><th>主体类型</th><th>认证状态</th><th className="company-action-col">收藏</th></tr></thead><tbody>{filtered.map((organization, index) => <tr key={organization.id}><td className="company-check-col"><input type="checkbox" aria-label={`选择${organization.name}`}/></td><td className="company-index-col">{String(index + 1).padStart(2, "0")}</td><td><div className="company-name-cell"><div className={`company-table-mark ${organization.type}`}>{organization.name.slice(0, 1)}</div><div><strong>{organization.name}</strong><small>{organizationType[organization.type]}</small></div></div></td><td className="company-tagline-cell">{organization.tagline}</td><td><div className="company-focus-cell">{organization.focus.slice(0, 2).map((value) => <span key={value}>{value}</span>)}</div></td><td>{organization.region}</td><td>{organizationType[organization.type]}</td><td><span className="company-verified"><i/>已核验</span></td><td className="company-action-col"><FavoriteButton active={favoriteKeys.has(`organization:${organization.id}`)} onClick={() => onToggleFavorite("organization", organization.id)}/></td></tr>)}</tbody></table>{filtered.length === 0 && <div className="company-empty"><strong>没有匹配的公司</strong><p>调整行业、地区或关键词后再试。</p><button className="outline" onClick={clearFilters}>清除筛选</button></div>}</div></section></div>
  </div></section></main>;
}

const institutionTypeOptions = ["全部", "孵化基金", "科研院所基金背景", "天使基金", "VC", "PE", "金融服务机构（FA/券商/保险/银行）", "二级市场基金", "家族办公室", "影响力投资"];
const institutionSidebarItems = ["VC/PE", "大企业创投", "国资投资机构", "LP库"];
const institutionSidebarMoreItems = ["基金管理人", "基金", "专题数据", "近期活跃CVC机构", "近期活跃LP", "近期活跃上市公司LP", "正在募集基金", "S基金"];

function InstitutionsView({ organizations, favoriteKeys, onToggleFavorite }: { organizations: Organization[]; favoriteKeys: Set<string>; onToggleFavorite: (type: FavoriteResourceType, id: string) => void }) {
  const [institutionType, setInstitutionType] = useState<"" | "investor" | "fa">("");
  const [industry, setIndustry] = useState("");
  const [region, setRegion] = useState<"" | "中国" | "海外">("");
  const [fundCurrency, setFundCurrency] = useState("");
  const [investmentStage, setInvestmentStage] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const institutionOrganizations = organizations.filter((organization) => organization.type === "investor" || organization.type === "fa");
  const normalizedLocation = locationQuery.trim().toLowerCase();
  const industryAliases: Record<string, string[]> = { "智能制造": ["智能制造", "先进制造", "机器人工"], "消费": ["消费", "消费科技"] };
  const industryMatches = (organization: Organization) => !industry || industry === "全部" || organization.focus.some((value) => (industryAliases[industry] ?? [industry]).some((alias) => value.includes(alias) || alias.includes(value)));
  const regionMatches = (organization: Organization) => !region || (region === "中国" ? !organization.region.includes("海外") : organization.region.includes("海外"));
  const filtered = institutionOrganizations.filter((organization) =>
    (!institutionType || organization.type === institutionType) &&
    industryMatches(organization) &&
    regionMatches(organization) &&
    (!normalizedLocation || organization.region.toLowerCase().includes(normalizedLocation)),
  );
  const chooseInstitutionType = (value: string) => {
    if (value === "VC" || value === "PE") setInstitutionType("investor");
    else if (value.startsWith("金融服务机构")) setInstitutionType("fa");
    else setInstitutionType("");
  };
  const clearFilters = () => { setInstitutionType(""); setIndustry(""); setRegion(""); setFundCurrency(""); setInvestmentStage(""); setLocationQuery(""); };
  return <main className="page institution-directory-page"><section className="section-wrap institution-directory-shell"><div className="institution-directory-layout">
    <aside className="institution-sidebar" aria-label="创投机构分类导航"><div className="institution-sidebar-heading"><span>INSTITUTION INDEX</span><h1>创投机构</h1><p>按机构类型和投资偏好浏览。</p></div><nav className="institution-sidebar-nav">{institutionSidebarItems.map((item, index) => <button type="button" key={item} className={index === 0 && !institutionType ? "active" : ""} disabled={index > 0} onClick={index === 0 ? clearFilters : undefined}><StatIcon name={index === 0 ? "institution" : index === 1 ? "company" : "industry"}/><span className="institution-sidebar-item-label">{item}<CompanyLock/></span><small>{index === 0 ? institutionOrganizations.filter((organization) => organization.type === "investor").length : ""}</small></button>)}<div className="institution-sidebar-divider"/><div className="institution-sidebar-pro"><span>机构版</span><b>解锁</b></div>{institutionSidebarMoreItems.map((item) => <button type="button" key={item} disabled><StatIcon name="institution"/><span className="institution-sidebar-item-label">{item}<CompanyLock/></span></button>)}</nav><div className="institution-sidebar-note">更多机构画像与基金数据需升级机构版。</div></aside>
    <div className="institution-workspace"><div className="institution-filter-panel"><div className="institution-filter-row"><span className="institution-filter-label"><CompanyLock/>机构类型</span><div className="institution-filter-options">{institutionTypeOptions.map((value, index) => { const interactive = index === 0 || value === "VC" || value === "PE" || value.startsWith("金融服务机构"); return interactive ? <button type="button" key={value} className={(!institutionType && index === 0) || ((value === "VC" || value === "PE") && institutionType === "investor") || (value.startsWith("金融服务机构") && institutionType === "fa") ? "active" : ""} onClick={() => chooseInstitutionType(value)}>{value}</button> : <span key={value}>{value}</span>; })}</div></div><div className="institution-filter-row"><span className="institution-filter-label"><CompanyLock/>投资领域</span><div className="institution-filter-options">{companyIndustryOptions.map((value, index) => <button type="button" key={value} className={(!industry && index === 0) || industry === value ? "active" : ""} onClick={() => setIndustry(index === 0 ? "" : value)}>{value}</button>)}</div></div><div className="institution-filter-row"><span className="institution-filter-label"><CompanyLock/>机构地区</span><div className="institution-filter-options">{["全部", "中国", "海外"].map((value) => <button type="button" key={value} className={(!region && value === "全部") || region === value ? "active" : ""} onClick={() => setRegion(value === "全部" ? "" : value as "中国" | "海外")}>{value}</button>)}</div></div><div className="institution-filter-row institution-filter-row-last"><span className="institution-filter-label"><CompanyLock/>其他指标</span><div className="institution-other-filters"><label><span>基金币种</span><Dropdown className="institution-dropdown" ariaLabel="选择基金币种" value={fundCurrency} onChange={setFundCurrency} options={[{ value: "", label: "请选择" }, { value: "人民币", label: "人民币" }, { value: "美元", label: "美元" }]}/></label><label><span>投资阶段</span><Dropdown className="institution-dropdown" ariaLabel="选择投资阶段" value={investmentStage} onChange={setInvestmentStage} options={[{ value: "", label: "请选择" }, { value: "早期", label: "早期" }, { value: "成长期", label: "成长期" }, { value: "成熟期", label: "成熟期" }]}/></label><label><span>成立时间</span><input readOnly placeholder="开始日期　 至　结束日期" aria-label="机构成立时间"/></label><label><span>投资时间</span><input readOnly placeholder="开始日期　 至　结束日期" aria-label="机构投资时间"/></label><label className="institution-location-field"><span>投资项目所在地</span><input value={locationQuery} onChange={(event) => setLocationQuery(event.target.value)} placeholder="请输入地区名称" aria-label="投资项目所在地"/></label><label className="institution-esg-field"><span>ESG机构</span><input type="checkbox" disabled aria-label="ESG机构"/></label></div></div></div>
      <section className="institution-results-panel"><div className="institution-results-heading"><div><div className="institution-results-title"><h2>{institutionType === "fa" ? "FA 机构" : "VC/PE"}</h2><span>{filtered.length} 家结果</span></div><p>公开展示已完成基础核验的创投机构信息</p></div><span className="institution-results-status"><i/>已核验数据</span></div><div className="institution-table-wrap"><table className="institution-table"><thead><tr><th className="institution-check-col">对比</th><th className="institution-index-col">序号</th><th>机构名称</th><th>关联公司</th><th>已投公司数</th><th>投资细分赛道数</th><th>IPO公司数</th><th>投资事件数</th><th>总部所在地</th><th>成立时间</th><th className="institution-action-col">收藏</th></tr></thead><tbody>{filtered.map((organization, index) => <tr key={organization.id}><td className="institution-check-col"><input type="checkbox" aria-label={`选择${organization.name}`}/></td><td className="institution-index-col">{index + 1}</td><td><div className="institution-name-cell"><div className={`institution-table-mark ${organization.type}`}>{organization.name.slice(0, 1)}</div><div><strong>{organization.name}</strong><small>{organization.type === "fa" ? "FA 机构" : "VC/PE"}</small></div></div></td><td className="institution-related-cell">—</td><td>—</td><td>{organization.focus.length}</td><td>—</td><td>—</td><td>{organization.region}</td><td>—</td><td className="institution-action-col"><FavoriteButton active={favoriteKeys.has(`organization:${organization.id}`)} onClick={() => onToggleFavorite("organization", organization.id)}/></td></tr>)}</tbody></table>{filtered.length === 0 && <div className="institution-empty"><strong>没有匹配的机构</strong><p>调整机构类型、投资领域、地区或所在地后再试。</p><button className="outline" onClick={clearFilters}>清除筛选</button></div>}</div></section></div>
  </div></section></main>;
/*
  const [type, setType] = useState<"all" | Organization["type"]>("all"); const [region, setRegion] = useState(""); const [q, setQ] = useState(initialQuery);
  const [page, setPage] = useState(1); const [result, setResult] = useState<{ items: Organization[]; pagination: Pagination }>({ items: organizations, pagination: { page: 1, pageSize: organizations.length || 9, total: organizations.length, totalPages: 1 } }); const [loading, setLoading] = useState(false);
  useEffect(() => setQ(initialQuery), [initialQuery]);
  useEffect(() => { setPage(1); }, [q, type, region]);
  useEffect(() => { let cancelled = false; setLoading(true); api.organizations({ q, type, region, page, pageSize: 9 }).then((payload) => { if (!cancelled) setResult({ items: payload.organizations, pagination: payload.pagination }); }).finally(() => { if (!cancelled) setLoading(false); }); return () => { cancelled = true; }; }, [q, type, region, page]);
  return <main className="page"><section className="page-hero"><div className="section-wrap reveal"><span>INSTITUTION NETWORK</span><h1>连接专业资本与产业服务</h1><p>机构信息来自线下登记与平台核验，持续完善投资偏好和服务能力。</p></div></section><section className="section-wrap page-content">
    <div className="tabs"><button className={type === "all" ? "active" : ""} onClick={() => setType("all")}>全部机构</button>{(["investor", "fa", "government"] as const).map((value) => <button key={value} className={type === value ? "active" : ""} onClick={() => setType(value)}>{organizationType[value]}</button>)}<select className="filter-select" value={region} onChange={(event) => setRegion(event.target.value)}><option value="">全部地区</option>{[...new Set(organizations.map((organization) => organization.region))].map((value) => <option key={value}>{value}</option>)}</select></div>
    <div className="result-line">{q ? <>搜索“{q}”找到 </> : <>找到 </>}<b>{result.pagination.total}</b> 个机构{loading && <small> · 正在更新</small>}</div><div className="organization-list">{result.items.map((organization) => <OrganizationCard key={organization.id} organization={organization} favorite={favoriteKeys.has(`organization:${organization.id}`)} onToggleFavorite={() => onToggleFavorite("organization", organization.id)}/>)}</div><PaginationControls {...result.pagination} onChange={setPage}/>
  </section></main>;
*/
}

function GovernmentView({ contacts, openContact, initialQuery = "" }: { contacts: GovernmentContact[]; openContact: (contact?: GovernmentContact) => void; initialQuery?: string }) {
  const [q, setQ] = useState(initialQuery); const [region, setRegion] = useState(""); useEffect(() => setQ(initialQuery), [initialQuery]);
  const normalized = q.trim().toLowerCase();
  const filtered = contacts.filter((contact) => (!region || contact.region === region) && (!normalized || [contact.name, contact.organizationName, contact.title, contact.region, ...contact.industries].some((value) => value.toLowerCase().includes(normalized))));
  const regions = [...new Set(contacts.map((contact) => contact.region))];
  return (
    <main className="page government-page">
      <section className="page-hero government-hero">
        <div className="section-wrap government-hero-inner reveal">
          <div className="government-hero-copy">
            <span>REGIONAL OPPORTUNITY</span>
            <h1>让产业项目找到合适的落地区域</h1>
            <p>联系方式不直接公开。提交需求后，平台运营人员将为你安排线下对接。</p>
            <button className="primary large" onClick={() => openContact()}>提交招商对接需求 <b aria-hidden="true">→</b></button>
          </div>
          <aside className="government-hero-brief" aria-label="政府对接服务说明">
            <div className="government-brief-topline"><span>OFFLINE MATCHING</span><i aria-hidden="true" /></div>
            <strong>先说清楚项目，再匹配区域。</strong>
            <p>平台根据产业方向、发展阶段和空间需求，安排对应联系人。</p>
            <dl>
              <div><dt>已登记联系人</dt><dd>{contacts.length}</dd></div>
              <div><dt>覆盖区域</dt><dd>{regions.length}</dd></div>
            </dl>
          </aside>
        </div>
      </section>
      <section className="section-wrap page-content government-content">
        <div className="filter-bar government-filter-bar">
          <label className="government-search-field"><span>搜索</span><input aria-label="搜索政府联系人" value={q} onChange={(event) => setQ(event.target.value)} placeholder="地区、联系人或产业关键词" /></label>
          <label className="government-region-field"><span>区域</span><Dropdown className="government-filter-select" ariaLabel="选择地区" value={region} onChange={setRegion} options={[{ value: "", label: "全部地区" }, ...regions.map((value) => ({ value, label: value }))]} /></label>
        </div>
        {q && <div className="result-line">搜索“{q}”找到 <b>{filtered.length}</b> 位联系人</div>}
        {filtered.length ? <div className="contact-grid">{filtered.map((contact, index) => <article className="contact-card reveal" key={contact.id}>
          <div className="contact-card-rail"><span className="contact-card-index">{String(index + 1).padStart(2, "0")}</span><div className="contact-avatar">{contact.name.slice(0, 1)}</div></div>
          <div className="contact-card-main"><div className="contact-card-topline"><span>{contact.organizationName}</span><em>{contact.region}</em></div><h3>{contact.name}</h3><p className="contact-title">{contact.title}</p><div className="tag-list">{contact.industries.map((item) => <span key={item}>{item}</span>)}</div><button className="contact-action" onClick={() => openContact(contact)}>申请联系 <b aria-hidden="true">→</b></button></div>
        </article>)}</div> : <div className="government-empty"><strong>没有找到对应联系人</strong><p>换个地区或关键词试试，也可以直接提交招商对接需求。</p><button className="outline" onClick={() => openContact()}>提交对接需求</button></div>}
      </section>
    </main>
  );
/*
  const [page, setPage] = useState(1); const [result, setResult] = useState<{ items: GovernmentContact[]; pagination: Pagination }>({ items: contacts, pagination: { page: 1, pageSize: contacts.length || 9, total: contacts.length, totalPages: 1 } }); const [loading, setLoading] = useState(false);
  useEffect(() => { setPage(1); }, [q, region]);
  useEffect(() => { let cancelled = false; setLoading(true); api.contacts({ q, region, page, pageSize: 9 }).then((payload) => { if (!cancelled) setResult({ items: payload.contacts, pagination: payload.pagination }); }).finally(() => { if (!cancelled) setLoading(false); }); return () => { cancelled = true; }; }, [q, region, page]);
  return <main className="page"><section className="page-hero government-hero"><div className="section-wrap reveal"><span>REGIONAL OPPORTUNITY</span><h1>让产业项目找到合适的落地区域</h1><p>联系方式不直接公开。提交需求后，平台运营人员将为你安排线下对接。</p><button className="primary large" onClick={() => openContact()}>提交招商对接需求</button></div></section><section className="section-wrap page-content"><SectionTitle eyebrow="GOVERNMENT CONTACTS" title="区域招商联系人" description="联系人均挂靠政府招商部门或园区机构，并经过平台核验。"/><div className="filter-bar"><input aria-label="搜索政府联系人" value={q} onChange={(event) => setQ(event.target.value)} placeholder="搜索地区、联系人或产业"/><select aria-label="选择地区" value={region} onChange={(event) => setRegion(event.target.value)}><option value="">全部地区</option>{[...new Set(contacts.map((contact) => contact.region))].map((value) => <option key={value}>{value}</option>)}</select></div><div className="result-line">{q ? <>搜索“{q}”找到 </> : <>找到 </>}<b>{result.pagination.total}</b> 位联系人{loading && <small> · 正在更新</small>}</div><div className="contact-grid">{result.items.map((contact) => <article className="contact-card reveal" key={contact.id}><div className="contact-avatar">{contact.name.slice(0, 1)}</div><div><span>{contact.organizationName}</span><h3>{contact.name} · {contact.title}</h3><p>{contact.region}</p><div className="tag-list">{contact.industries.map((item) => <span key={item}>{item}</span>)}</div><button className="outline" onClick={() => openContact(contact)}>申请联系</button></div></article>)}</div><PaginationControls {...result.pagination} onChange={setPage}/></section></main>;
*/
}

function ArticlesView({ articles, openArticle, initialQuery = "", favoriteKeys, onToggleFavorite }: { articles: Article[]; openArticle: (article: Article) => void; initialQuery?: string; favoriteKeys: Set<string>; onToggleFavorite: (type: FavoriteResourceType, id: string) => void }) {
  const [q, setQ] = useState(initialQuery); const [category, setCategory] = useState(""); useEffect(() => setQ(initialQuery), [initialQuery]);
  const normalized = q.trim().toLowerCase();
  const filtered = articles.filter((article) => (!category || article.category === category) && (!normalized || [article.title, article.summary, article.content, article.category].some((value) => value.toLowerCase().includes(normalized))));
  return <main className="page"><section className="page-hero"><div className="section-wrap reveal"><span>VENTURE INSIGHTS</span><h1>创投与产业招商资讯</h1><p>提供市场观察、融资方法与招商实践，不构成投资建议。</p></div></section><section className="section-wrap page-content"><div className="filter-bar"><input aria-label="搜索资讯" value={q} onChange={(event) => setQ(event.target.value)} placeholder="搜索标题、行业或关键词"/><Dropdown ariaLabel="选择资讯分类" value={category} onChange={setCategory} options={[{ value: "", label: "全部分类" }, ...[...new Set(articles.map((article) => article.category))].map((value) => ({ value, label: value }))]} /></div>{q && <div className="result-line">搜索“{q}”找到 <b>{filtered.length}</b> 篇资讯</div>}<div className="article-grid wide">{filtered.map((article, index) => <button className="article-card reveal" key={article.id} onClick={() => openArticle(article)}><span className={`article-art tone-${index % 3}`}><em>{article.category}</em></span><div className="article-card-top"><small>{article.category}</small><span role="button" tabIndex={0} className={`favorite-inline${favoriteKeys.has(`article:${article.id}`) ? " active" : ""}`} onClick={(event) => { event.stopPropagation(); onToggleFavorite("article", article.id); }} onKeyDown={(event) => { if (event.key === "Enter") { event.stopPropagation(); onToggleFavorite("article", article.id); } }}>{favoriteKeys.has(`article:${article.id}`) ? "★ 已收藏" : "☆ 收藏"}</span></div><h3>{article.title}</h3><p>{article.summary}</p><b>阅读全文 →</b></button>)}</div></section></main>;
}

type TelegraphTimeFilter = "all" | "3d" | "7d" | "15d" | "30d";
const telegraphTimeOptions: Array<{ id: TelegraphTimeFilter; label: string }> = [
  { id: "all", label: "不限" },
  { id: "3d", label: "3 天" },
  { id: "7d", label: "一周" },
  { id: "15d", label: "15 天" },
  { id: "30d", label: "一个月" },
];

function telegraphCategoryLabel(category: TelegraphCategory) {
  return telegraphCategories.find((item) => item.id === category)?.label ?? "创投电报";
}

function telegraphEntryToStory(entry: TelegraphEntry): EditorialStory {
  const category = telegraphCategoryLabel(entry.category);
  return {
    kind: "events",
    navLabel: "创投电报",
    eyebrow: `VENTURE TELEGRAPH · ${category.toUpperCase()}`,
    dateLabel: `${entry.date} · ${entry.timeLabel}`,
    title: entry.title,
    subtitle: entry.summary,
    lead: entry.detail,
    metrics: [
      { value: entry.date.slice(5).replace("-", "."), label: "发生时间" },
      { value: category, label: "电报分类" },
      { value: "QF", label: "启峰编辑" },
    ],
    sections: [
      { index: "01", label: "电报摘要", title: "这条消息，先看什么", body: entry.summary },
      { index: "02", label: "编辑观察", title: "从公开信息里留下的判断", body: entry.detail },
      { index: "03", label: "继续关注", title: "下一步要看它能否进入现场", body: "创投电报只记录当前可确认的信息。后续融资交割、客户验证、产品交付或治理变化，才会决定这条消息的长期价值。" },
    ],
    pullQuote: "消息是起点，能够被验证的进展才是下一条值得追踪的电报。",
  };
}

function TelegraphView({ entries, go, openEntry }: { entries: TelegraphEntry[]; go: (view: View) => void; openEntry: (entry: TelegraphEntry) => void }) {
  const [query, setQuery] = useState("");
  const [timeFilter, setTimeFilter] = useState<TelegraphTimeFilter>("all");
  const [selectedCategories, setSelectedCategories] = useState<Set<TelegraphCategory>>(() => new Set([telegraphCategories[0].id]));
  const allSelected = selectedCategories.size === telegraphCategories.length;
  const toggleCategory = (category: TelegraphCategory) => {
    setSelectedCategories((current) => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const days = timeFilter === "all" ? null : Number.parseInt(timeFilter, 10);
    const latest = new Date("2026-08-03T23:59:59+08:00").getTime();
    return entries.filter((entry) => {
      const matchesCategory = selectedCategories.has(entry.category);
      const matchesQuery = !normalized || [entry.title, entry.summary, telegraphCategoryLabel(entry.category)].some((value) => value.toLowerCase().includes(normalized));
      const entryTime = new Date(`${entry.date}T23:59:59+08:00`).getTime();
      const matchesTime = days === null || entryTime >= latest - days * 24 * 60 * 60 * 1000;
      return matchesCategory && matchesQuery && matchesTime;
    });
  }, [entries, query, selectedCategories, timeFilter]);
  const groups = useMemo(() => {
    const grouped = new Map<string, TelegraphEntry[]>();
    filtered.forEach((entry) => grouped.set(entry.date, [...(grouped.get(entry.date) ?? []), entry]));
    return [...grouped.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [filtered]);
  return <main className="telegraph-page">
    <section className="telegraph-banner"><div className="section-wrap"><span>VENTURE TELEGRAPH</span><h1>创投电报</h1><p>把融资、并购、产品与机构变化，整理成可以快速读完的一线信息。</p></div></section>
    <section className="section-wrap telegraph-layout">
      <aside className="telegraph-sidebar">
        <div className="telegraph-sidebar-brand"><span>QF</span><div><b>创投电报</b><small>VENTURE TELEGRAPH</small></div></div>
        <label className="telegraph-search"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="请输入关键词搜索" aria-label="搜索创投电报"/><span aria-hidden="true">⌕</span></label>
        <fieldset className="telegraph-filter"><legend>时间选择</legend><div className="telegraph-time-grid">{telegraphTimeOptions.map((option) => <label key={option.id}><input type="radio" name="telegraph-time" checked={timeFilter === option.id} onChange={() => setTimeFilter(option.id)}/><span>{option.label}</span></label>)}</div></fieldset>
        <fieldset className="telegraph-filter"><legend>类型选择</legend><label className="telegraph-check-all"><input type="checkbox" checked={allSelected} onChange={() => setSelectedCategories(allSelected ? new Set([telegraphCategories[0].id]) : new Set(telegraphCategories.map((item) => item.id)))}/><span>全选</span></label><div className="telegraph-category-grid">{telegraphCategories.map((category) => <label key={category.id}><input type="checkbox" checked={selectedCategories.has(category.id)} onChange={() => toggleCategory(category.id)}/><span>{category.label}</span></label>)}</div></fieldset>
        <button className="telegraph-subscribe" onClick={() => go("research")}>订阅研究与电报 <span aria-hidden="true">→</span></button>
        <div className="telegraph-side-links"><button onClick={() => go("research")}>研究报告</button><button onClick={() => go("home")}>返回首页</button></div>
      </aside>
      <section className="telegraph-feed">
        <header className="telegraph-feed-heading"><div><span>VENTURE TELEGRAPH</span><h2>今日电报</h2><p>默认展示投资事件，也可以从左侧打开其他分类。</p></div><strong>{filtered.length}<small> 条</small></strong></header>
        {groups.length ? groups.map(([date, dayEntries]) => <div className="telegraph-day" key={date}><div className="telegraph-day-heading"><span>{date}</span><i/><small>{new Date(`${date}T12:00:00+08:00`).toLocaleDateString("zh-CN", { weekday: "long" })}</small></div>{dayEntries.map((entry) => <article className="telegraph-entry" key={entry.id}><button className="telegraph-entry-main" onClick={() => openEntry(entry)}><div className="telegraph-entry-title"><h3>{entry.title}</h3><span>{telegraphCategoryLabel(entry.category)}</span></div><p>{entry.summary} <b>查看详情</b></p><time>{entry.timeLabel}</time></button><button className="telegraph-share" aria-label={`分享${entry.title}`} onClick={() => navigator.clipboard?.writeText(entry.title).catch(() => undefined)}>分享</button></article>)}</div>) : <div className="telegraph-empty"><b>没有符合条件的电报</b><p>换一个分类或关键词，继续查看创投动态。</p><button onClick={() => { setQuery(""); setSelectedCategories(new Set([telegraphCategories[0].id])); setTimeFilter("all"); }}>恢复默认</button></div>}
      </section>
    </section>
  </main>;
}

function EditorialView({ kind, go, story: storyOverride, backView = "home", backLabel }: { kind: EditorialKind; go: (view: View) => void; story?: EditorialStory; backView?: View; backLabel?: string }) {
  const story = storyOverride ?? editorialStories[kind];
  const otherKind: EditorialKind = kind === "research" ? "events" : "research";
  const otherStory = editorialStories[otherKind];
  return <main className={`editorial-page editorial-${kind}`}>
    <section className="editorial-hero">
      <div className="section-wrap editorial-hero-grid">
        <div className="editorial-hero-copy reveal">
          <button className="editorial-back" onClick={() => go(backView)}>← {backLabel ?? "返回首页"}</button>
          <span className="editorial-eyebrow">{story.eyebrow}</span>
          <h1>{story.title}</h1>
          <p className="editorial-subtitle">{story.subtitle}</p>
          <div className="editorial-meta"><span>{story.dateLabel}</span><span>启峰创投 · 专题编辑</span></div>
        </div>
        <div className="editorial-hero-mark" aria-hidden="true"><span>{kind === "research" ? "R / 01" : "E / 04"}</span><small>{kind === "research" ? "RESEARCH" : "EVENT BRIEF"}</small><i /></div>
      </div>
    </section>
    <section className="section-wrap editorial-intro-grid">
      <article className="editorial-lead reveal"><span>EDITOR'S NOTE</span><p>{story.lead}</p></article>
      <div className="editorial-metrics">{story.metrics.map((metric) => <div key={metric.label}><b>{metric.value}</b><span>{metric.label}</span></div>)}</div>
    </section>
    <section className="section-wrap editorial-story-grid">
      <div className="editorial-section-list">{story.sections.map((section) => <article className="editorial-section reveal" key={section.index}><div className="editorial-section-index"><b>{section.index}</b><span>{section.label}</span></div><div><h2>{section.title}</h2><p>{section.body}</p></div></article>)}</div>
      <aside className="editorial-pullquote reveal"><span>ONE LINE</span><p>“{story.pullQuote}”</p><small>启峰创投专题观察</small></aside>
    </section>
    <section className="section-wrap editorial-next reveal"><div><span>CONTINUE READING</span><h2>{otherStory.navLabel}</h2><p>{otherStory.subtitle}</p></div><button className="primary" onClick={() => go(otherKind)}>打开专题 <span aria-hidden="true">→</span></button></section>
  </main>;
}

/*
  const [page, setPage] = useState(1); const [result, setResult] = useState<{ items: Article[]; pagination: Pagination }>({ items: articles, pagination: { page: 1, pageSize: articles.length || 9, total: articles.length, totalPages: 1 } }); const [loading, setLoading] = useState(false);
  useEffect(() => { setPage(1); }, [q, category]);
  useEffect(() => { let cancelled = false; setLoading(true); api.articles({ q, category, page, pageSize: 9 }).then((payload) => { if (!cancelled) setResult({ items: payload.articles, pagination: payload.pagination }); }).finally(() => { if (!cancelled) setLoading(false); }); return () => { cancelled = true; }; }, [q, category, page]);
  return <main className="page"><section className="page-hero"><div className="section-wrap reveal"><span>VENTURE INSIGHTS</span><h1>创投与产业招商资讯</h1><p>提供市场观察、融资方法与招商实践，不构成投资建议。</p></div></section><section className="section-wrap page-content"><div className="filter-bar"><input aria-label="搜索资讯" value={q} onChange={(event) => setQ(event.target.value)} placeholder="搜索标题、行业或关键词"/><select aria-label="选择资讯分类" value={category} onChange={(event) => setCategory(event.target.value)}><option value="">全部分类</option>{[...new Set(articles.map((article) => article.category))].map((value) => <option key={value}>{value}</option>)}</select></div><div className="result-line">{q ? <>搜索“{q}”找到 </> : <>找到 </>}<b>{result.pagination.total}</b> 篇资讯{loading && <small> · 正在更新</small>}</div><div className="article-grid wide">{result.items.map((article, index) => <button className="article-card reveal" key={article.id} onClick={() => openArticle(article)}><span className={`article-art tone-${index % 3}`}><em>{article.category}</em></span><div className="article-card-top"><small>{article.category}</small><span role="button" tabIndex={0} className={`favorite-inline${favoriteKeys.has(`article:${article.id}`) ? " active" : ""}`} onClick={(event) => { event.stopPropagation(); onToggleFavorite("article", article.id); }} onKeyDown={(event) => { if (event.key === "Enter") { event.stopPropagation(); onToggleFavorite("article", article.id); } }}>{favoriteKeys.has(`article:${article.id}`) ? "★ 已收藏" : "☆ 收藏"}</span></div><h3>{article.title}</h3><p>{article.summary}</p><b>阅读全文 →</b></button>)}</div><PaginationControls {...result.pagination} onChange={setPage}/></section></main>;
*/

function ContactModal({ contact, onClose }: { contact?: GovernmentContact; onClose: () => void }) {
  const [form, setForm] = useState({ name: "", phone: "", organization: "", need: "", targetRegion: contact?.region ?? "" });
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const submit = async (event: FormEvent) => { event.preventDefault(); setState("submitting"); try { await api.submitContact({ ...form, contactId: contact?.id }); setState("success"); } catch { setState("error"); } };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-label="申请政府招商对接"><button className="modal-close" aria-label="关闭" onClick={onClose}>×</button>{state === "success" ? <div className="success-state"><span>✓</span><h2>需求已提交</h2><p>平台运营人员将在 1 个工作日内与你联系。</p><button className="primary" onClick={onClose}>完成</button></div> : <><span className="eyebrow">OFFLINE MATCHING</span><h2>申请招商对接</h2><p className="modal-intro">{contact ? `目标联系人：${contact.organizationName} · ${contact.name}` : "填写需求后，由平台匹配合适的区域联系人。"}</p><form onSubmit={submit}><label>姓名<input required minLength={2} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="请输入姓名"/></label><label>手机号<input required pattern="1[3-9][0-9]{9}" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="用于平台回访"/></label><label>公司 / 机构<input required minLength={2} value={form.organization} onChange={(event) => setForm({ ...form, organization: event.target.value })} placeholder="请输入机构名称"/></label><label>目标地区<input required minLength={2} value={form.targetRegion} onChange={(event) => setForm({ ...form, targetRegion: event.target.value })} placeholder="例如：上海、长三角"/></label><label>对接需求<textarea required minLength={10} value={form.need} onChange={(event) => setForm({ ...form, need: event.target.value })} placeholder="请描述产业方向、发展阶段、空间需求与期望支持"/></label>{state === "error" && <p className="form-error">提交失败，请检查信息后重试。</p>}<button className="primary submit" disabled={state === "submitting"}>{state === "submitting" ? "正在提交…" : "提交对接需求"}</button><small className="privacy-note">提交即表示同意平台为本次线下对接使用以上信息。</small></form></>}</section></div>;
}

function ProjectDetailPage({ projectId, go }: { projectId: string; go: (view: View, query?: string) => void }) {
  const [project, setProject] = useState<Project | null>(null);
  const [loadError, setLoadError] = useState("");
  const [purpose, setPurpose] = useState("");
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  useEffect(() => {
    let cancelled = false;
    setProject(null); setLoadError(""); setPurpose(""); setState("idle");
    if (getPublicSession()) void api.recordRecentView("project", projectId);
    api.project(projectId).then(({ project: detail }) => { if (!cancelled) setProject(detail); }).catch((reason: Error) => { if (!cancelled) setLoadError(reason.message || "项目不存在或已下线"); });
    return () => { cancelled = true; };
  }, [projectId]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!getPublicSession()) { window.location.assign("/auth"); return; }
    setState("submitting");
    try { await api.requestBp(projectId, purpose); setState("success"); }
    catch { setState("error"); }
  };
  return <main className="page project-detail-page">{loadError ? <div className="section-wrap project-detail-state"><div className="loading error">加载失败：{loadError}</div><button className="project-detail-back" onClick={() => go("projects")}>← 返回项目库</button></div> : !project ? <div className="section-wrap project-detail-state"><div className="loading">正在加载项目…</div></div> : <><section className="project-detail-hero"><div className="section-wrap project-detail-hero-inner"><div className="project-detail-crumb"><button className="project-detail-back" onClick={() => go("projects")}>← 返回项目库</button><span>/</span><span>项目详情</span></div><span className="eyebrow">PROJECT PROFILE</span><h1>{project.name}</h1><p className="project-detail-lead">{project.summary}</p><p className="project-detail-meta">{project.industry} · {project.region} · {project.stage} · {project.identityMode === "anonymous" ? "匿名公开" : "实名公开"}</p><div className="project-detail-facts"><div><small>融资阶段</small><b>{project.stage}</b></div><div><small>所在地区</small><b>{project.region}</b></div><div><small>融资需求</small><b>{project.financingRange}</b></div></div></div></section><section className="section-wrap project-detail-body"><article className="project-detail-overview"><span className="eyebrow">OVERVIEW</span><h2>项目概览</h2><dl className="project-detail-spec"><div><dt>01 · 所属行业</dt><dd>{project.industry}</dd></div><div><dt>02 · 所在地区</dt><dd>{project.region}</dd></div><div><dt>03 · 融资阶段</dt><dd>{project.stage}</dd></div><div><dt>04 · 融资需求</dt><dd>{project.financingRange}</dd></div></dl><div className="project-detail-bp-line"><span>BP</span><p>商业计划书受授权保护，填写查看用途后由项目方审核开放。</p></div></article><aside className="project-detail-request"><span className="eyebrow">BP ACCESS</span><h2>申请查看 BP</h2><p className="request-note">说明你的身份与用途，项目方审核通过后开放材料。</p>{state === "success" ? <div className="bp-request-success"><b>申请已提交</b><p>项目方审核后，你会获得授权通知。</p></div> : <form className="bp-request-form" onSubmit={submit}><textarea required minLength={10} value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="请说明查看 BP 的用途（至少 10 字）"/>{state === "error" && <p className="form-error">提交失败，请确认已完成主体认证。</p>}<button className="project-detail-submit" disabled={state === "submitting"}>{state === "submitting" ? "提交中…" : "提交 BP 查看申请"}</button></form>}</aside></section></>}</main>;
}
function ArticleModal({ article, onClose }: { article: Article; onClose: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><article className="modal article-modal" role="dialog" aria-modal="true" aria-label="资讯详情"><button className="modal-close" aria-label="关闭" onClick={onClose}>×</button><span className="eyebrow">{article.category}</span><h2>{article.title}</h2><p className="article-lead">{article.summary}</p><div className="article-body">{article.content}</div><p className="article-disclaimer">本文仅供行业交流，不构成任何投资或招商承诺。</p></article></div>;
}

type RoleId = "user" | "investor" | "fa" | "government" | "project";
type RoleIconName = "user" | "investor" | "fa" | "government" | "project";
const roleOptions: Array<{ id: RoleId; label: string; description: string; icon: RoleIconName }> = [
  { id: "user", label: "普通用户", description: "浏览项目 · 关注研究与事件", icon: "user" },
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
  return <div className="role-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="role-modal" role="dialog" aria-modal="true" aria-labelledby="role-title"><button className="role-close" aria-label="关闭" onClick={onClose}>×</button><span className="role-eyebrow">CHOOSE YOUR ROLE</span><h2 id="role-title">你想以什么身份进入创投智联？</h2><p className="role-intro">不同身份会进入对应工作台，Demo 中可以随时切换。</p><label className="role-select-label">选择身份<Dropdown className="role-select" ariaLabel="选择身份" value={selectedRole} onChange={(value) => { const next = value as RoleId; setSelectedRole(next); onSelect(next); }} options={roleOptions.map((role) => ({ value: role.id, label: role.label }))} /></label><div className="role-grid">{roleOptions.map((role) => <button className={`role-card${selectedRole === role.id ? " selected" : ""}`} key={role.id} onClick={() => { setSelectedRole(role.id); onSelect(role.id); }}><span className={`role-icon role-icon-${role.id}`}><RoleIcon name={role.icon}/></span><b>{role.label}</b><small>{role.description}</small></button>)}</div><button className="role-continue" onClick={onClose}>继续浏览公开市场</button></section></div>;
}

const authRoleLabels: Record<string, string> = { user: "普通用户", project: "项目方", investor: "投资机构", fa: "FA 机构", government: "政府招商", platform: "平台管理员" };

function PublicAccountMenu({ actor, onNavigate, onOpenAdmin, onLogout }: { actor: AuthActor; onNavigate: (view: View) => void; onOpenAdmin: () => void; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const displayName = actor.displayName?.trim() || actor.organizationName?.trim() || actor.email?.split("@")[0] || "平台用户";
  const roleLabel = authRoleLabels[actor.organizationType] ?? "平台用户";
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!menuRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return <div className="public-account-menu" ref={menuRef}>
    <button className="public-account-trigger" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((value) => !value)}>
      <span className="public-account-avatar">{displayName.slice(0, 1)}</span>
      <span className="public-account-copy"><b>{displayName}</b><small>{roleLabel}</small></span>
      <span className="public-account-chevron" aria-hidden="true">⌄</span>
    </button>
    {open && <div className="public-account-popover" role="menu">
      <div className="public-account-summary"><span className="public-account-avatar">{displayName.slice(0, 1)}</span><div><b>{displayName}</b><small>{actor.email ?? actor.phone ?? "已登录"}</small></div></div>
      <button role="menuitem" onClick={() => { setOpen(false); onNavigate("account"); }}>个人中心</button>
      {actor.roles.includes("platform_admin") && <button role="menuitem" onClick={() => { setOpen(false); onOpenAdmin(); }}>管理后台</button>}
      <button className="public-account-logout" role="menuitem" onClick={() => { setOpen(false); onLogout(); }}>退出登录</button>
    </div>}
  </div>;
}

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
  const logout = async () => { try { await api.logout(); } catch { /* session may already be expired */ } finally { clearPublicSession(); notifyAuthChanged(); go("home"); } };
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
  return <main className="account-page"><section className="section-wrap account-shell"><div className="account-heading"><div><span className="eyebrow">ACCOUNT CENTER</span><h1>账号中心</h1><p>查看你的平台身份和当前可用入口。</p></div><button className="outline" onClick={logout}>退出登录</button></div><div className="account-grid"><article className="account-profile"><div className="account-avatar">{(actor.displayName ?? "用").slice(0, 1)}</div><div><span className="account-label">当前身份</span><h2>{actor.displayName ?? "平台用户"}</h2><p>{authRoleLabels[actor.organizationType] ?? "平台用户"} · {actor.organizationName ?? "创投智联"}</p></div></article><article className="account-card"><span className="account-label">账号状态</span><strong className="account-status"><i/>已激活</strong><small>{actor.organizationVerified ? "主体已通过平台认证" : "当前主体等待进一步认证"}</small></article><article className="account-card"><span className="account-label">登录方式</span><strong>{actor.email ?? actor.phone ?? "未设置"}</strong><small>{actor.email ? "邮箱地址" : "手机号"}</small></article><article className="account-card"><span className="account-label">账号标识</span><strong>{actor.userId.slice(0, 8)}…</strong><small>注册于 {actor.createdAt ? new Date(actor.createdAt).toLocaleDateString("zh-CN") : "近期"}</small></article></div><section className="favorites-panel"><div className="account-heading"><div><span className="eyebrow">MY COLLECTION</span><h2>我的收藏</h2><p>收藏的项目、机构和专题会在这里保留。</p></div><strong>{favorites.length} 项</strong></div>{favorites.length ? <div className="favorite-list">{favorites.map((favorite) => <button key={`${favorite.resourceType}:${favorite.resourceId}`} onClick={() => go(favorite.resourceType === "project" ? "projects" : favorite.resourceType === "organization" ? "organizations" : "research")}><span>{favorite.resourceType === "project" ? "项目" : favorite.resourceType === "organization" ? "机构" : "专题"}</span><b>{favorite.resourceId}</b><small>›</small></button>)}</div> : <div className="favorite-empty">还没有收藏内容，去项目库和机构库看看吧。</div>}</section>{actor.organizationType === "project" && <section className="project-submit-panel"><div className="account-heading"><div><span className="eyebrow">PROJECT SUBMISSION</span><h2>提交项目与 BP</h2><p>填写项目公开摘要，上传 PDF/PPT/PPTX，提交后由平台审核。</p></div><button className="outline" onClick={() => setShowProjectForm((value) => !value)}>{showProjectForm ? "收起" : "新增项目"}</button></div>{showProjectForm && <form className="project-submit-form" onSubmit={submitProject}><input required placeholder="项目名称" value={projectForm.name} onChange={(event) => setProjectForm({ ...projectForm, name: event.target.value })}/><input required placeholder="行业标签" value={projectForm.industry} onChange={(event) => setProjectForm({ ...projectForm, industry: event.target.value })}/><input required placeholder="所在地区" value={projectForm.region} onChange={(event) => setProjectForm({ ...projectForm, region: event.target.value })}/><input required placeholder="融资阶段" value={projectForm.stage} onChange={(event) => setProjectForm({ ...projectForm, stage: event.target.value })}/><input required placeholder="融资需求，如 1000 万" value={projectForm.financingRange} onChange={(event) => setProjectForm({ ...projectForm, financingRange: event.target.value })}/><Dropdown className="project-submit-select" ariaLabel="项目身份展示方式" value={projectForm.identityMode} onChange={(value) => setProjectForm({ ...projectForm, identityMode: value as "named" | "anonymous" })} options={[{ value: "named", label: "实名展示" }, { value: "anonymous", label: "匿名展示" }]} /><textarea required minLength={20} placeholder="项目公开摘要（至少 20 字）" value={projectForm.summary} onChange={(event) => setProjectForm({ ...projectForm, summary: event.target.value })}/>{projectForm.identityMode === "anonymous" && <input required placeholder="匿名项目名称" value={projectForm.anonymousName} onChange={(event) => setProjectForm({ ...projectForm, anonymousName: event.target.value })}/>}<label className="file-field">上传 BP（可选）<input name="bp" type="file" accept=".pdf,.ppt,.pptx" /></label><button className="primary" disabled={projectSaving}>{projectSaving ? "提交中…" : "提交审核"}</button>{projectMessage && <p className="project-submit-message">{projectMessage}</p>}</form>}</section>}<div className="account-actions"><div><span className="eyebrow">DISCOVER MORE</span><h2>继续探索平台</h2></div><div><button className="primary" onClick={() => go("projects")}>浏览项目</button><button className="outline" onClick={() => go("organizations")}>查看机构</button><button className="outline" onClick={() => go("research")}>看研究报告</button></div></div></section></main>;
}

function AuthView({ initialRole, go }: { initialRole?: RoleId; go: (view: View) => void }) {
  const [mode, setMode] = useState<"login" | "register" | "forgot">(initialRole ? "register" : "login");
  const [loginMethod, setLoginMethod] = useState<"password" | "otp">("password");
  const [role, setRole] = useState<RoleId>(initialRole ?? "user");
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [emailRequired, setEmailRequired] = useState(false);
  const [otpEnabled, setOtpEnabled] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [emailVerificationToken, setEmailVerificationToken] = useState<string | undefined>();
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpNotice, setOtpNotice] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetComplete, setResetComplete] = useState(false);
  const [form, setForm] = useState({ userName: "", organization: "", contact: "", phone: "", email: "", password: "", confirm: "" });
  const update = (key: keyof typeof form, value: string) => { setForm((current) => ({ ...current, [key]: value })); if (key === "email") { setOtpCode(""); setOtpVerified(false); setEmailVerificationToken(undefined); setOtpNotice(""); } };
  useEffect(() => { void api.authConfig().then((config) => { setEmailRequired(config.emailRequired); setOtpEnabled(config.otpEnabled); }).catch(() => undefined); }, []);
  useEffect(() => { if (!otpCooldown) return; const timer = window.setInterval(() => setOtpCooldown((current) => Math.max(0, current - 1)), 1000); return () => window.clearInterval(timer); }, [otpCooldown]);
  const requestOtp = async () => {
    if (!form.email) { setError("请先输入邮箱地址。"); return; }
    setOtpBusy(true); setError(""); setOtpNotice("");
    try { const result = await api.requestOtp({ email: form.email, purpose: mode === "register" ? "register" : "login" }); setOtpCooldown(60); setOtpCode(result.previewToken ?? ""); setOtpVerified(false); setOtpNotice(result.previewToken ? "本地预览模式已生成验证码，可直接验证。" : "验证码已发送，请检查邮箱，5 分钟内有效。"); }
    catch (reason) { setError(reason instanceof Error && reason.message === "otp_rate_limited" ? "验证码请求太频繁，请稍后再试。" : "验证码发送失败，请检查邮件配置后重试。"); }
    finally { setOtpBusy(false); }
  };
  const verifyEmailOtp = async () => {
    if (!form.email || !/^\d{6}$/.test(otpCode)) { setError("请输入 6 位邮件验证码。"); return; }
    setOtpBusy(true); setError(""); setOtpNotice("");
    try {
      const result = await api.verifyOtp({ email: form.email, token: otpCode, purpose: mode === "register" ? "register" : "login" });
      if (mode === "register") { setEmailVerificationToken(result.emailVerificationToken ?? undefined); setOtpVerified(true); setOtpNotice("邮箱已验证，可以完成注册。"); }
      else if (result.session) { window.localStorage.setItem(PUBLIC_SESSION_KEY, result.session); notifyAuthChanged(); go("account"); }
      return result.emailVerificationToken;
    } catch (reason) {
      const code = reason instanceof Error ? reason.message : "";
      setError(code === "otp_rate_limited" ? "验证码尝试太频繁，请稍后再试。" : code === "account_not_registered" ? "该邮箱尚未注册，请先注册账号。" : code === "account_pending" ? "账号正在等待管理员审核。" : code === "account_rejected" ? "该账号未通过审核，请联系管理员。" : code === "account_suspended" ? "该账号已被停用，请联系管理员。" : "邮箱验证码错误或已过期，请重新发送。");
    }
    finally { setOtpBusy(false); }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      if (mode === "register") {
        let verificationToken = emailVerificationToken;
        let verificationCode: string | undefined;
        if (otpEnabled && (!otpVerified || !verificationToken)) {
          if (!/^\d{6}$/.test(otpCode)) throw new Error("email_verification_code_required");
          verificationCode = otpCode;
        }
        await api.register({ email: form.email || undefined, phone: form.phone || undefined, password: form.password, confirmPassword: form.confirm, role, organizationName: role === "user" ? undefined : form.organization, contactName: role === "user" ? undefined : form.contact, userName: role === "user" ? form.userName : undefined, emailVerificationToken: verificationToken, emailVerificationCode: verificationCode });
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
      } else if (loginMethod === "otp") {
        await verifyEmailOtp();
        return;
      } else {
        const result = await api.login({ identifier: form.email, password: form.password });
        window.localStorage.setItem(PUBLIC_SESSION_KEY, result.session);
        notifyAuthChanged();
        go("account");
        return;
      }
      setSubmitted(true);
    } catch (reason) {
      const code = reason instanceof Error ? reason.message : "operation_failed";
      setError(code === "otp_rate_limited" ? "验证码请求太频繁，请稍后再试。" : code === "email_verification_invalid" ? "邮箱验证码错误或已过期，请重新发送。" : code === "email_verification_required" || code === "email_verification_code_required" ? "请输入 6 位邮箱验证码。" : code === "identifier_taken" ? "手机号或邮箱已注册。" : code === "email_required" ? "请输入邮箱地址。" : code === "otp_delivery_failed" ? "验证码发送失败，请稍后重试。" : code === "account_not_registered" ? "该邮箱尚未注册，请先注册账号。" : code === "account_rejected" ? "该账号未通过审核，请联系管理员。" : code === "account_suspended" ? "该账号已被停用，请联系管理员。" : code);
    } finally { setSaving(false); }
  };
  const switchMode = (next: "login" | "register" | "forgot") => { setMode(next); setLoginMethod("password"); setSubmitted(false); setError(""); setOtpNotice(""); setResetToken(""); setResetComplete(false); setOtpCode(""); setOtpVerified(false); setEmailVerificationToken(undefined); };
  const selectedRole = roleOptions.find((item) => item.id === role);
  return (
    <main className="auth-page">
      <ForgotPasswordCard />
      <section className="auth-story">
        <div className="auth-story-inner">
          <button className="auth-brand" onClick={() => go("home")}><QifengLogo /></button>
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
              {mode === "login" && otpEnabled && <div className="auth-login-method auth-full"><button type="button" className={loginMethod === "password" ? "active" : ""} onClick={() => { setLoginMethod("password"); setError(""); setOtpNotice(""); }}>密码登录</button><button type="button" className={loginMethod === "otp" ? "active" : ""} onClick={() => { setLoginMethod("otp"); setError(""); setOtpNotice(""); }}>邮件验证码登录</button></div>}
              {mode === "register" && (
                <>
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
              <label className={mode === "login" ? "auth-full" : ""}>邮箱地址{mode === "register" && !emailRequired && !otpEnabled ? "（选填）" : ""}
                <input required={mode === "login" ? loginMethod === "otp" : emailRequired || otpEnabled} type={mode === "login" && loginMethod === "password" ? "text" : "email"} value={form.email} onChange={(event) => update("email", event.target.value)} placeholder={mode === "login" && loginMethod === "password" ? "邮箱或手机号" : "name@company.com"}/>
              </label>
              {((mode === "register" && otpEnabled) || (mode === "login" && loginMethod === "otp")) && <div className="auth-otp-row auth-full"><label>邮件验证码<input inputMode="numeric" autoComplete="one-time-code" required maxLength={6} pattern="[0-9]{6}" value={otpCode} onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6 位数字"/></label><button type="button" className="auth-otp-send" disabled={otpBusy || otpCooldown > 0 || !form.email} onClick={() => void requestOtp()}>{otpCooldown ? `${otpCooldown}s 后重发` : otpBusy ? "发送中…" : "发送验证码"}</button>{otpVerified && <span className="auth-otp-verified">邮箱已验证</span>}</div>}
              {mode !== "login" || loginMethod === "password" ? <label className={mode === "login" ? "auth-full" : ""}>密码
                <input required minLength={6} type="password" value={form.password} onChange={(event) => update("password", event.target.value)} placeholder="至少 6 位密码"/>
              </label> : null}
              {mode === "register" && (
                <>
                  <label>确认密码<input required minLength={6} type="password" value={form.confirm} onChange={(event) => update("confirm", event.target.value)} placeholder="再次输入密码"/></label>
                </>
              )}
              {error && <p className="auth-error">{error}</p>}
              {otpNotice && <p className="auth-otp-notice">{otpNotice}</p>}
              <button disabled={saving || otpBusy} className="auth-primary auth-submit">{saving ? "提交中…" : mode === "register" ? `完成注册进入${selectedRole?.label ?? "平台"}` : loginMethod === "otp" ? "验证并登录" : "登录创投智联"}&nbsp;→</button>
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
  return <section className="section-wrap recent-views-strip"><div className="section-heading-row"><SectionTitle eyebrow="RECENTLY VIEWED" title="最近浏览" description="登录后自动保留最近查看的项目与专题。"/><span className="recent-count">{views.length} 条</span></div>{views.length ? <div className="recent-view-list">{views.slice(0, 6).map((view) => <button key={`${view.resourceType}:${view.resourceId}`} onClick={() => { if (view.resourceType === "project") window.location.assign(`/projects/${encodeURIComponent(view.resourceId)}`); else go("research"); }}><span>{view.resourceType === "project" ? "项目" : "专题"}</span><b>{label(view)}</b><small>{new Date(view.viewedAt).toLocaleDateString("zh-CN")}</small></button>)}</div> : <div className="recent-empty">还没有浏览记录，去项目库或研究与事件看看吧。</div>}</section>;
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

type WorkspaceSection = "overview" | "notifications" | "favorites" | "recent" | "profile" | "security" | "publish" | "submissions" | "bpRequests" | "contactRequests";

const workspaceRoleMeta: Record<string, { label: string; eyebrow: string; description: string }> = {
  user: { label: "普通用户", eyebrow: "PERSONAL DESK", description: "关注项目、机构和行业动态" },
  investor: { label: "投资机构", eyebrow: "INVESTMENT DESK", description: "管理投资方向和项目征集" },
  fa: { label: "FA 机构", eyebrow: "ADVISORY DESK", description: "推进项目推荐和资源对接" },
  government: { label: "政府招商", eyebrow: "REGIONAL DESK", description: "发布招商需求和对接进度" },
  project: { label: "项目方", eyebrow: "PROJECT DESK", description: "发布融资项目和管理 BP" },
  platform: { label: "平台管理员", eyebrow: "PLATFORM DESK", description: "管理平台内容和审核事项" },
};

const workspaceSectionMeta: Record<WorkspaceSection, { label: string; description: string }> = {
  overview: { label: "工作台", description: "当前身份的重点事项和快捷入口" },
  notifications: { label: "通知中心", description: "账号、审核、BP 和对接进度" },
  favorites: { label: "我的关注", description: "收藏的项目、机构和研究内容" },
  recent: { label: "最近浏览", description: "最近查看过的项目与专题" },
  profile: { label: "资料设置", description: "更新你的公开联系信息" },
  security: { label: "账号安全", description: "更新密码和登录保护" },
  publish: { label: "发布内容", description: "提交与你的身份匹配的公开内容" },
  submissions: { label: "我的发布", description: "跟踪提交内容的审核状态" },
  bpRequests: { label: "BP 申请", description: "查看或处理商业计划书访问申请" },
  contactRequests: { label: "对接进度", description: "查看平台记录的资源对接需求" },
};

function WorkspaceHeading({ section, actor }: { section: WorkspaceSection; actor: AuthActor }) {
  const role = workspaceRoleMeta[actor.organizationType] ?? workspaceRoleMeta.user;
  const meta = workspaceSectionMeta[section];
  return <div className="workspace-heading"><div><span className="workspace-eyebrow">{role.eyebrow}</span><h1>{meta.label}</h1><p>{meta.description}</p></div><span className="workspace-role-badge">{role.label}</span></div>;
}

function WorkspaceOverview({ actor, favorites, notifications, projects, submissions, go, onSelect }: { actor: AuthActor; favorites: Favorite[]; notifications: Notification[]; projects: import("./api.ts").OwnedProject[]; submissions: IdentitySubmission[]; go: (view: View) => void; onSelect: (section: WorkspaceSection) => void }) {
  const role = workspaceRoleMeta[actor.organizationType] ?? workspaceRoleMeta.user;
  const pendingCount = [...projects.filter((project) => project.reviewStatus === "pending"), ...submissions.filter((submission) => submission.status === "pending")].length;
  const quickActions: Array<{ label: string; section?: WorkspaceSection; view?: View; note: string }> = actor.organizationType === "project"
    ? [{ label: "发布融资项目", section: "publish", note: "提交项目摘要与 BP" }, { label: "处理 BP 申请", section: "bpRequests", note: "查看访问请求" }, { label: "查看项目状态", section: "submissions", note: "跟踪审核进度" }]
    : actor.organizationType === "user"
      ? [{ label: "浏览项目库", view: "projects", note: "发现新的项目机会" }, { label: "查看研究报告", view: "research", note: "关注行业判断" }, { label: "整理我的关注", section: "favorites", note: "回到已收藏内容" }]
      : [{ label: actor.organizationType === "investor" ? "发布投资方向" : actor.organizationType === "fa" ? "发布项目推荐" : "发布招商需求", section: "publish", note: "进入身份发布表单" }, { label: "查看我的发布", section: "submissions", note: "跟踪审核状态" }, { label: "查看对接进度", section: "contactRequests", note: "继续推进资源连接" }];
  return <div className="workspace-overview">
    <section className="workspace-welcome"><div><span className="workspace-eyebrow">{role.eyebrow}</span><h2>{actor.displayName ?? "平台用户"}，欢迎回来</h2><p>{role.description}。这里集中处理与你相关的事项。</p></div><div className="workspace-welcome-mark">{(actor.displayName ?? role.label).slice(0, 1)}</div></section>
    <div className="workspace-metrics"><button onClick={() => onSelect("notifications")}><span>未读通知</span><strong>{notifications.filter((item) => !item.readAt).length}</strong><small>需要及时查看</small></button><button onClick={() => onSelect("favorites")}><span>我的关注</span><strong>{favorites.length}</strong><small>收藏内容</small></button><button onClick={() => onSelect("submissions")}><span>待处理事项</span><strong>{pendingCount}</strong><small>审核中的内容</small></button></div>
    <section className="workspace-panel workspace-quick-panel"><div className="workspace-panel-heading"><div><span className="workspace-eyebrow">QUICK ACTIONS</span><h2>从这里继续</h2></div><span>{role.label}</span></div><div className="workspace-quick-grid">{quickActions.map((action) => <button key={action.label} onClick={() => action.section ? onSelect(action.section) : action.view && go(action.view)}><b>{action.label}</b><small>{action.note}</small><em>↗</em></button>)}</div></section>
    <div className="workspace-overview-grid"><section className="workspace-panel"><div className="workspace-panel-heading"><div><span className="workspace-eyebrow">RECENT ACTIVITY</span><h2>最近动态</h2></div><button className="workspace-text-button" onClick={() => onSelect("notifications")}>查看全部</button></div>{notifications.length ? <div className="workspace-activity-list">{notifications.slice(0, 4).map((item) => <button key={item.id} onClick={() => onSelect("notifications")}><i className={item.readAt ? "" : "active"}/><div><b>{item.title}</b><span>{item.body}</span></div><time>{new Date(item.createdAt).toLocaleDateString("zh-CN")}</time></button>)}</div> : <div className="workspace-empty">完成注册、发布内容或发起对接后，最新动态会出现在这里。</div>}</section><section className="workspace-panel workspace-next-panel"><div className="workspace-panel-heading"><div><span className="workspace-eyebrow">NEXT STEP</span><h2>下一步建议</h2></div></div><div className="workspace-next-card"><span>{pendingCount ? "审核进行中" : "保持资料完整"}</span><strong>{pendingCount ? `你有 ${pendingCount} 项内容正在处理` : "完善你的身份资料和关注内容"}</strong><p>{pendingCount ? "平台审核完成后会通过通知中心同步结果。" : "信息越完整，后续的项目匹配和资源对接越顺畅。"}</p><button className="primary" onClick={() => onSelect(pendingCount ? "submissions" : "profile")}>{pendingCount ? "查看进度" : "完善资料"}</button></div></section></div>
  </div>;
}

function WorkspaceNotifications({ notifications, onMarkRead, onMarkAll }: { notifications: Notification[]; onMarkRead: (notification: Notification) => void; onMarkAll: () => void }) {
  const unread = notifications.filter((item) => !item.readAt).length;
  const typeLabels: Record<Notification["type"], string> = { system: "系统", account: "账号", project: "项目", bp: "BP", contact: "对接" };
  return <section className="workspace-panel workspace-list-panel"><div className="workspace-panel-heading"><div><span className="workspace-eyebrow">NOTIFICATION CENTER</span><h2>通知中心</h2><p>重要状态会在这里汇总。</p></div><button className="outline" disabled={!unread} onClick={onMarkAll}>{unread ? `${unread} 条未读，全部已读` : "已全部读"}</button></div>{notifications.length ? <div className="workspace-notification-list">{notifications.map((item) => <button key={item.id} className={item.readAt ? "" : "unread"} onClick={() => onMarkRead(item)}><i className={item.readAt ? "" : "active"}/><div><span>{typeLabels[item.type]} · {new Date(item.createdAt).toLocaleString("zh-CN")}</span><b>{item.title}</b><p>{item.body}</p></div><em>{item.readAt ? "" : "未读"}</em></button>)}</div> : <div className="workspace-empty">暂无通知。完成注册、提交内容或发起对接后，平台会在这里同步进度。</div>}</section>;
}

function WorkspaceFavorites({ favorites, go }: { favorites: Favorite[]; go: (view: View) => void }) {
  return <section className="workspace-panel workspace-list-panel"><div className="workspace-panel-heading"><div><span className="workspace-eyebrow">MY COLLECTION</span><h2>我的关注</h2><p>收藏的内容会一直保留在这里。</p></div><strong className="workspace-count">{favorites.length}</strong></div>{favorites.length ? <div className="workspace-favorite-grid">{favorites.map((item) => <button key={`${item.resourceType}:${item.resourceId}`} onClick={() => go(item.resourceType === "project" ? "projects" : item.resourceType === "organization" ? "organizations" : "research")}><span>{item.resourceType === "project" ? "项目" : item.resourceType === "organization" ? "机构" : "研究"}</span><b>{item.resourceId}</b><small>查看详情 ↗</small></button>)}</div> : <div className="workspace-empty"><b>还没有关注内容</b><span>去项目库、公司或研究报告里收藏你想持续关注的内容。</span><button className="primary" onClick={() => go("projects")}>浏览项目库</button></div>}</section>;
}

function WorkspaceRecent({ views, projects, articles, go }: { views: RecentView[]; projects: Project[]; articles: Article[]; go: (view: View) => void }) {
  const label = (view: RecentView) => view.resourceType === "project" ? projects.find((project) => project.id === view.resourceId)?.name ?? view.resourceId : view.resourceType === "article" ? articles.find((article) => article.id === view.resourceId)?.title ?? view.resourceId : view.resourceId;
  return <section className="workspace-panel workspace-list-panel"><div className="workspace-panel-heading"><div><span className="workspace-eyebrow">RECENTLY VIEWED</span><h2>最近浏览</h2><p>最近查看过的项目和专题。</p></div><strong className="workspace-count">{views.length}</strong></div>{views.length ? <div className="workspace-recent-list">{views.slice(0, 12).map((item) => <button key={`${item.resourceType}:${item.resourceId}`} onClick={() => go(item.resourceType === "project" ? "projects" : "research")}><span>{item.resourceType === "project" ? "项目" : "专题"}</span><b>{label(item)}</b><time>{new Date(item.viewedAt).toLocaleDateString("zh-CN")}</time><em>↗</em></button>)}</div> : <div className="workspace-empty"><b>还没有浏览记录</b><span>去项目库或研究与事件看看，之后可以从这里继续。</span><button className="primary" onClick={() => go("projects")}>开始探索</button></div>}</section>;
}

function WorkspaceProfilePanel() {
  const [form, setForm] = useState({ displayName: "", email: "", phone: "" });
  const [state, setState] = useState<"loading" | "idle" | "saving" | "success" | "error">("loading");
  useEffect(() => { api.session().then(({ actor }) => setForm({ displayName: actor.displayName ?? "", email: actor.email ?? "", phone: actor.phone ?? "" })).catch(() => undefined).finally(() => setState("idle")); }, []);
  const submit = async (event: FormEvent) => { event.preventDefault(); setState("saving"); try { await api.updateProfile({ displayName: form.displayName, email: form.email || undefined, phone: form.phone || undefined }); setState("success"); } catch { setState("error"); } };
  return <section className="workspace-panel workspace-form-panel"><div className="workspace-panel-heading"><div><span className="workspace-eyebrow">PROFILE SETTINGS</span><h2>资料设置</h2><p>公开联系信息会用于后续资源连接。</p></div></div><form onSubmit={submit} className="workspace-form"><label>显示名称<input required minLength={2} value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })}/></label><label>邮箱地址<input type="email" placeholder="选填" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })}/></label><label>手机号<input pattern="1[3-9][0-9]{9}" placeholder="选填" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })}/></label><div className="workspace-form-actions"><button className="primary" disabled={state === "loading" || state === "saving"}>{state === "saving" ? "保存中…" : "保存资料"}</button>{state === "success" && <span className="form-feedback success">资料已保存</span>}{state === "error" && <span className="form-feedback error">邮箱或手机号不可用</span>}</div></form></section>;
}

function WorkspaceSecurityPanel() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [state, setState] = useState<"idle" | "saving" | "success" | "error">("idle");
  const submit = async (event: FormEvent) => { event.preventDefault(); setState("saving"); try { await api.changePassword(form); setForm({ currentPassword: "", newPassword: "", confirmPassword: "" }); setState("success"); } catch { setState("error"); } };
  return <section className="workspace-panel workspace-form-panel"><div className="workspace-panel-heading"><div><span className="workspace-eyebrow">ACCOUNT SECURITY</span><h2>账号安全</h2><p>定期更新密码，保护项目和 BP 访问权限。</p></div></div><form onSubmit={submit} className="workspace-form workspace-security-form"><label>当前密码<input required minLength={6} type="password" value={form.currentPassword} onChange={(event) => setForm({ ...form, currentPassword: event.target.value })}/></label><label>新密码<input required minLength={8} type="password" placeholder="至少 8 位" value={form.newPassword} onChange={(event) => setForm({ ...form, newPassword: event.target.value })}/></label><label>确认新密码<input required minLength={8} type="password" value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })}/></label><div className="workspace-form-actions"><button className="primary" disabled={state === "saving"}>{state === "saving" ? "更新中…" : "更新密码"}</button>{state === "success" && <span className="form-feedback success">密码已更新</span>}{state === "error" && <span className="form-feedback error">当前密码错误或新密码不一致</span>}</div></form></section>;
}

function WorkspaceIdentityPublisher({ actor, editing, onSaved }: { actor: AuthActor; editing?: IdentitySubmission; onSaved: () => void }) {
  const type = actor.organizationType as "investor" | "fa" | "government";
  const meta = type === "investor" ? { type: "investor_thesis" as const, title: "发布投资方向", eyebrow: "INVESTMENT THESIS", summary: "向项目方说明机构关注的行业、阶段和投资条件。", detailLabel: "投资偏好", detailPlaceholder: "例如：先进制造、工业软件、绿色能源；关注已有客户验证的团队" } : type === "fa" ? { type: "fa_recommendation" as const, title: "发布项目推荐", eyebrow: "FA RECOMMENDATION", summary: "发布你正在服务的项目和融资需求，进入平台审核。", detailLabel: "服务说明", detailPlaceholder: "例如：团队背景、融资节奏、可提供的产业资源" } : { type: "government_demand" as const, title: "发布招商需求", eyebrow: "GOVERNMENT DEMAND", summary: "发布区域产业方向、空间和政策条件，寻找匹配项目。", detailLabel: "空间与政策条件", detailPlaceholder: "例如：目标产业、可用空间、配套政策、落地周期" };
  const [form, setForm] = useState({ title: editing?.title ?? "", summary: editing?.summary ?? "", industry: editing?.industry ?? "", region: editing?.region ?? "", stage: editing?.stage ?? "", financingRange: editing?.financingRange ?? "", detail: editing?.details.primary ?? "" });
  const [state, setState] = useState<"idle" | "saving" | "success" | "error">("idle");
  const save = async (status: "draft" | "pending") => { setState("saving"); try { const payload = { title: form.title, summary: form.summary, industry: form.industry, region: form.region, stage: form.stage, financingRange: form.financingRange, details: { primary: form.detail }, status }; if (editing) await api.updateIdentitySubmission(editing.id, payload); else await api.submitIdentitySubmission({ type: meta.type, ...payload }); setForm({ title: "", summary: "", industry: "", region: "", stage: "", financingRange: "", detail: "" }); setState("success"); onSaved(); } catch { setState("error"); } };
  return <section className="workspace-panel workspace-form-panel"><div className="workspace-panel-heading"><div><span className="workspace-eyebrow">{meta.eyebrow}</span><h2>{editing ? "修改并重提" : meta.title}</h2><p>{editing ? "根据管理员意见补充内容，保存后会生成新的版本并重新进入审核。" : meta.summary}</p></div><span className="workspace-form-note">{editing ? `当前版本 ${editing.version}` : "提交后由平台审核"}</span></div><form className="workspace-form workspace-publish-form" onSubmit={(event) => { event.preventDefault(); void save("pending"); }}><label className="wide">标题<input required minLength={4} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder={type === "investor" ? "例如：关注先进制造和工业软件的早期投资方向" : type === "fa" ? "例如：寻找 A 轮制造业项目的产业投资人" : "例如：临港先进制造产业项目招商需求"}/></label><label>行业领域<input required value={form.industry} onChange={(event) => setForm({ ...form, industry: event.target.value })} placeholder="人工智能、先进制造…"/></label><label>地区<input required value={form.region} onChange={(event) => setForm({ ...form, region: event.target.value })} placeholder="北京、上海或区域名称"/></label><label>阶段/规模<input value={form.stage} onChange={(event) => setForm({ ...form, stage: event.target.value })} placeholder={type === "government" ? "产业阶段或企业规模" : "天使、A 轮、成长期"}/></label><label>额度/空间<input value={form.financingRange} onChange={(event) => setForm({ ...form, financingRange: event.target.value })} placeholder={type === "government" ? "空间规模或政策范围" : "单笔额度或融资需求"}/></label><label className="wide">{meta.detailLabel}<textarea required minLength={10} value={form.detail} onChange={(event) => setForm({ ...form, detail: event.target.value })} placeholder={meta.detailPlaceholder}/></label><label className="wide">公开摘要<textarea required minLength={20} value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} placeholder="面向公开市场的简短说明，至少 20 字"/></label><div className="workspace-form-actions wide"><button type="button" className="outline" disabled={state === "saving"} onClick={() => void save("draft")}>保存草稿</button><button className="primary" disabled={state === "saving"}>{state === "saving" ? "提交中…" : editing ? "重新提交审核" : "提交审核"}</button>{state === "success" && <span className="form-feedback success">内容已保存</span>}{state === "error" && <span className="form-feedback error">提交失败，请检查后重试</span>}</div></form></section>;
}

function WorkspaceSubmissions({ actor, projects, submissions, onSelect, onNew, onEdit }: { actor: AuthActor; projects: import("./api.ts").OwnedProject[]; submissions: IdentitySubmission[]; onSelect: (section: WorkspaceSection) => void; onNew: () => void; onEdit: (submission: IdentitySubmission) => void }) {
  const statusLabel: Record<string, string> = { draft: "草稿", pending: "待审核", approved: "已发布", rejected: "需修改", archived: "已下架" };
  return <section className="workspace-panel workspace-list-panel"><div className="workspace-panel-heading"><div><span className="workspace-eyebrow">MY SUBMISSIONS</span><h2>我的发布</h2><p>查看内容审核状态和平台反馈。</p></div><button className="primary" onClick={onNew}>新建发布</button></div><div className="workspace-submission-list">{actor.organizationType === "project" && projects.map((project) => <article key={project.id}><div className="workspace-submission-type">项目</div><div><b>{project.name}</b><p>{project.industry} · {project.region} · {project.stage}</p></div><span className={`workspace-status ${project.reviewStatus}`}>{statusLabel[project.reviewStatus]}</span><small>{project.bpFileName ? `BP：${project.bpFileName}` : "尚未上传 BP"}</small></article>)}{submissions.map((submission) => <article key={submission.id}><div className="workspace-submission-type">{submission.type === "investor_thesis" ? "投资方向" : submission.type === "fa_recommendation" ? "项目推荐" : "招商需求"}</div><div><b>{submission.title}</b><p>{submission.industry} · {submission.region} · {submission.summary}</p>{submission.rejectionReason && <small className="workspace-rejection">管理员意见：{submission.rejectionReason}</small>}</div><span className={`workspace-status ${submission.status}`}>{statusLabel[submission.status]}</span><div className="workspace-submission-side"><small>版本 {submission.version}</small>{(submission.status === "rejected" || submission.status === "draft") && <button className="workspace-edit-button" onClick={() => onEdit(submission)}>修改重提</button>}</div></article>)}{!projects.length && !submissions.length && <div className="workspace-empty"><b>还没有发布内容</b><span>从你的身份工作台开始发布第一条内容。</span><button className="primary" onClick={onNew}>开始发布</button></div>}</div></section>;
}

function WorkspaceBpPanel({ actor, requests, incoming, onRefresh }: { actor: AuthActor; requests: BpRequest[]; incoming: IncomingBpRequest[]; onRefresh: () => void }) {
  const [savingId, setSavingId] = useState<string | null>(null);
  const decide = async (id: string, decision: "approved" | "rejected") => { setSavingId(id); try { await api.decideBpRequest(id, decision); onRefresh(); } finally { setSavingId(null); } };
  const isProject = actor.organizationType === "project";
  const list = isProject ? incoming : requests;
  return <section className="workspace-panel workspace-list-panel"><div className="workspace-panel-heading"><div><span className="workspace-eyebrow">BP ACCESS</span><h2>{isProject ? "收到的 BP 申请" : "我的 BP 申请"}</h2><p>{isProject ? "审核机构对项目材料的访问请求。" : "查看你提交过的商业计划书访问申请。"}</p></div></div>{list.length ? <div className="workspace-bp-list">{list.map((request) => <article key={request.id}><div><b>{request.projectName}{isProject && " · " + (request as IncomingBpRequest).requesterOrganizationName}</b><p>{request.purpose}</p></div>{isProject && request.status === "pending" ? <div className="workspace-inline-actions"><button className="primary" disabled={savingId === request.id} onClick={() => void decide(request.id, "approved")}>批准</button><button className="outline" disabled={savingId === request.id} onClick={() => void decide(request.id, "rejected")}>拒绝</button></div> : <span className={`workspace-status ${request.status}`}>{request.status === "pending" ? "待审核" : request.status === "approved" ? "已通过" : "已拒绝"}</span>}</article>)}</div> : <div className="workspace-empty"><b>暂无 BP 申请</b><span>{isProject ? "机构提交访问申请后，会出现在这里。" : "浏览项目并提交 BP 查看申请后，可以在这里跟踪。"}</span></div>}</section>;
}

function WorkspaceContactPanel({ requests }: { requests: MyContactRequest[] }) {
  const labels: Record<MyContactRequest["status"], string> = { new: "待处理", contacted: "已联系", progressing: "对接中", completed: "已完成", closed: "已关闭" };
  return <section className="workspace-panel workspace-list-panel"><div className="workspace-panel-heading"><div><span className="workspace-eyebrow">MATCHING PROGRESS</span><h2>对接进度</h2><p>查看你提交的资源对接需求和平台跟进状态。</p></div></div>{requests.length ? <div className="workspace-contact-list">{requests.map((request) => <article key={request.id}><div><b>{request.organization}</b><p>{request.targetRegion || "待匹配地区"} · {request.need}</p></div><span className={`workspace-status ${request.status}`}>{labels[request.status]}</span><time>{new Date(request.createdAt).toLocaleDateString("zh-CN")}</time></article>)}</div> : <div className="workspace-empty"><b>暂无对接记录</b><span>从政府对接页面提交需求后，平台会在这里同步进度。</span></div>}</section>;
}

function AccountWorkspace({ go, projects, articles }: { go: (view: View) => void; projects: Project[]; articles: Article[] }) {
  const [actor, setActor] = useState<AuthActor>();
  const [active, setActive] = useState<WorkspaceSection>("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [views, setViews] = useState<RecentView[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [projectsOwned, setProjectsOwned] = useState<import("./api.ts").OwnedProject[]>([]);
  const [identitySubmissions, setIdentitySubmissions] = useState<IdentitySubmission[]>([]);
  const [editingSubmission, setEditingSubmission] = useState<IdentitySubmission>();
  const [bpRequests, setBpRequests] = useState<BpRequest[]>([]);
  const [incomingBpRequests, setIncomingBpRequests] = useState<IncomingBpRequest[]>([]);
  const [contactRequests, setContactRequests] = useState<MyContactRequest[]>([]);
  const load = async () => {
    try {
      const session = await api.session();
      setActor(session.actor);
      const results = await Promise.allSettled([api.favorites(), api.recentViews(), api.notifications(), api.myProjects(), api.myIdentitySubmissions(), api.myBpRequests(), api.incomingBpRequests(), api.myContactRequests()]);
      const [favoriteResult, viewResult, notificationResult, projectResult, submissionResult, requestResult, incomingResult, contactResult] = results;
      if (favoriteResult.status === "fulfilled") setFavorites(favoriteResult.value.favorites);
      if (viewResult.status === "fulfilled") setViews(viewResult.value.views);
      if (notificationResult.status === "fulfilled") setNotifications(notificationResult.value.notifications);
      if (projectResult.status === "fulfilled") setProjectsOwned(projectResult.value.projects);
      if (submissionResult.status === "fulfilled") setIdentitySubmissions(submissionResult.value.submissions);
      if (requestResult.status === "fulfilled") setBpRequests(requestResult.value.requests);
      if (incomingResult.status === "fulfilled") setIncomingBpRequests(incomingResult.value.requests);
      if (contactResult.status === "fulfilled") setContactRequests(contactResult.value.requests);
      setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "账号信息加载失败"); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const logout = async () => { try { await api.logout(); } catch { /* session may already be expired */ } finally { clearPublicSession(); notifyAuthChanged(); go("home"); } };
  const selectSection = (section: WorkspaceSection) => { setActive(section); setMobileMenuOpen(false); };
  const markRead = async (notification: Notification) => { if (notification.readAt) return; await api.markNotificationRead(notification.id); setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item)); };
  const markAll = async () => { await api.markAllNotificationsRead(); setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() }))); };
  if (loading) return <main className="account-workspace-page"><div className="workspace-loading"><span className="workspace-loading-bar"/><span className="workspace-loading-bar short"/><span className="workspace-loading-card"/></div></main>;
  if (error || !actor) return <main className="account-workspace-page"><div className="workspace-error"><span className="workspace-eyebrow">ACCOUNT CENTER</span><h1>暂时无法打开工作台</h1><p>{error || "登录状态已失效，请重新登录。"}</p><button className="primary" onClick={() => go("auth")}>重新登录</button></div></main>;
  const role = workspaceRoleMeta[actor.organizationType] ?? workspaceRoleMeta.user;
  const roleItems: Array<{ id: WorkspaceSection; label: string }> = actor.organizationType === "user" ? [] : actor.organizationType === "project" ? [{ id: "publish", label: "发布融资项目" }, { id: "submissions", label: "我的项目" }, { id: "bpRequests", label: "收到的 BP 申请" }] : actor.organizationType === "investor" ? [{ id: "publish", label: "投资方向" }, { id: "submissions", label: "我的发布" }, { id: "bpRequests", label: "我的 BP 申请" }] : actor.organizationType === "fa" ? [{ id: "publish", label: "项目推荐" }, { id: "submissions", label: "我的发布" }, { id: "contactRequests", label: "对接进度" }] : [{ id: "publish", label: "招商需求" }, { id: "submissions", label: "我的发布" }, { id: "contactRequests", label: "对接进度" }];
  const sharedItems: Array<{ id: WorkspaceSection; label: string }> = [{ id: "overview", label: "工作台" }, { id: "notifications", label: "通知中心" }, { id: "favorites", label: "我的关注" }, { id: "recent", label: "最近浏览" }];
  const settingsItems: Array<{ id: WorkspaceSection; label: string }> = [{ id: "profile", label: "资料设置" }, { id: "security", label: "账号安全" }];
  const renderSection = () => { if (active === "overview") return <WorkspaceOverview actor={actor} favorites={favorites} notifications={notifications} projects={projectsOwned} submissions={identitySubmissions} go={go} onSelect={selectSection}/>; if (active === "notifications") return <WorkspaceNotifications notifications={notifications} onMarkRead={(notification) => void markRead(notification)} onMarkAll={() => void markAll()}/>; if (active === "favorites") return <WorkspaceFavorites favorites={favorites} go={go}/>; if (active === "recent") return <WorkspaceRecent views={views} projects={projects} articles={articles} go={go}/>; if (active === "profile") return <WorkspaceProfilePanel/>; if (active === "security") return <WorkspaceSecurityPanel/>; if (active === "publish") return actor.organizationType === "project" ? <WorkspaceProjectPublisher onSaved={() => void load()}/> : <WorkspaceIdentityPublisher key={editingSubmission?.id ?? "new"} actor={actor} editing={editingSubmission} onSaved={() => { setEditingSubmission(undefined); void load(); }}/>; if (active === "submissions") return <WorkspaceSubmissions actor={actor} projects={projectsOwned} submissions={identitySubmissions} onSelect={selectSection} onNew={() => { setEditingSubmission(undefined); selectSection("publish"); }} onEdit={(submission) => { setEditingSubmission(submission); selectSection("publish"); }}/>; if (active === "bpRequests") return <WorkspaceBpPanel actor={actor} requests={bpRequests} incoming={incomingBpRequests} onRefresh={() => void load()}/>; return <WorkspaceContactPanel requests={contactRequests}/>; };
  const renderNavGroup = (label: string, items: Array<{ id: WorkspaceSection; label: string }>) => <div className="workspace-nav-group"><span>{label}</span>{items.map((item) => <button key={item.id} className={active === item.id ? "active" : ""} onClick={() => selectSection(item.id)}>{item.label}{item.id === "notifications" && notifications.some((notification) => !notification.readAt) && <i/>}</button>)}</div>;
  return <main className="account-workspace-page"><div className="account-workspace-shell"><aside className={`account-workspace-sidebar${mobileMenuOpen ? " open" : ""}`}><div className="workspace-brand"><img src={qifengLogoUrl} alt="启峰创投"/><span>个人工作台</span></div><div className="workspace-current-role"><div className="workspace-current-avatar">{(actor.displayName ?? role.label).slice(0, 1)}</div><div><b>{actor.displayName ?? "平台用户"}</b><span>{role.label}</span></div><em>⌄</em></div><nav>{renderNavGroup("总览", sharedItems)}{roleItems.length > 0 && renderNavGroup("身份工作台", roleItems)}{renderNavGroup("账户设置", settingsItems)}</nav><div className="workspace-sidebar-footer"><span className="workspace-online-dot"/><div><b>账号状态正常</b><small>{actor.organizationVerified ? "主体已完成认证" : "主体等待认证"}</small></div></div><button className="workspace-logout" onClick={() => void logout()}>退出登录</button></aside>{mobileMenuOpen && <button className="workspace-menu-backdrop" aria-label="关闭个人中心菜单" onClick={() => setMobileMenuOpen(false)}/>}<section className="account-workspace-content"><div className="workspace-mobile-bar"><button aria-label="打开个人中心菜单" aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen((current) => !current)}>☰</button><span>{workspaceSectionMeta[active].label}</span><b>{role.label}</b></div><WorkspaceHeading section={active} actor={actor}/>{renderSection()}</section></div></main>;
}

function WorkspaceProjectPublisher({ onSaved }: { onSaved: () => void }) {
  const [form, setForm] = useState({ name: "", summary: "", industry: "", region: "", stage: "", financingRange: "", identityMode: "named" as "named" | "anonymous", anonymousName: "" });
  const [file, setFile] = useState<File>();
  const [state, setState] = useState<"idle" | "saving" | "success" | "error">("idle");
  const submit = async (event: FormEvent) => { event.preventDefault(); setState("saving"); try { const result = await api.submitProject(form); if (file) await api.uploadBp(result.project.id, file); setForm({ name: "", summary: "", industry: "", region: "", stage: "", financingRange: "", identityMode: "named", anonymousName: "" }); setFile(undefined); setState("success"); onSaved(); } catch { setState("error"); } };
  return <section className="workspace-panel workspace-form-panel"><div className="workspace-panel-heading"><div><span className="workspace-eyebrow">PROJECT SUBMISSION</span><h2>发布融资项目</h2><p>提交项目公开摘要和 BP，审核通过后进入项目库。</p></div><span className="workspace-form-note">平台审核后公开</span></div><form className="workspace-form workspace-publish-form" onSubmit={submit}><label className="wide">项目名称<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })}/></label><label>行业标签<input required value={form.industry} onChange={(event) => setForm({ ...form, industry: event.target.value })}/></label><label>所在地区<input required value={form.region} onChange={(event) => setForm({ ...form, region: event.target.value })}/></label><label>融资阶段<input required value={form.stage} onChange={(event) => setForm({ ...form, stage: event.target.value })}/></label><label>融资需求<input required value={form.financingRange} onChange={(event) => setForm({ ...form, financingRange: event.target.value })}/></label><label>展示方式<select value={form.identityMode} onChange={(event) => setForm({ ...form, identityMode: event.target.value as "named" | "anonymous" })}><option value="named">实名展示</option><option value="anonymous">匿名展示</option></select></label>{form.identityMode === "anonymous" && <label>匿名名称<input required value={form.anonymousName} onChange={(event) => setForm({ ...form, anonymousName: event.target.value })}/></label>}<label className="wide">项目公开摘要<textarea required minLength={20} value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })}/></label><label className="wide workspace-file-field">上传 BP（可选）<input type="file" accept=".pdf,.ppt,.pptx" onChange={(event) => setFile(event.target.files?.[0])}/></label><div className="workspace-form-actions wide"><button className="primary" disabled={state === "saving"}>{state === "saving" ? "提交中…" : "提交审核"}</button>{state === "success" && <span className="form-feedback success">项目已提交，等待平台审核</span>}{state === "error" && <span className="form-feedback error">提交失败，请检查后重试</span>}</div></form></section>;
}

export default function App({ projectId, onLeaveDetail }: { projectId?: string; onLeaveDetail?: () => void }) {
  useEffect(() => { if (!projectId && window.location.pathname !== "/") window.history.replaceState({}, "", `/${window.location.hash}`); }, []);
  const [view, setView] = useState<View>(() => (window.location.hash.slice(1) as View) || "home");
  const [projects, setProjects] = useState<Project[]>([]); const [organizations, setOrganizations] = useState<Organization[]>([]); const [contacts, setContacts] = useState<GovernmentContact[]>([]); const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [menuOpen, setMenuOpen] = useState(false);
  const [publicActor, setPublicActor] = useState<AuthActor | null>(null);
  const [favoriteKeys, setFavoriteKeys] = useState<Set<string>>(new Set());
  const [recentViews, setRecentViews] = useState<RecentView[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedArticle, setSelectedArticle] = useState<Article>(); const [selectedTelegraph, setSelectedTelegraph] = useState<TelegraphEntry>(); const [contactModal, setContactModal] = useState<{ open: boolean; contact?: GovernmentContact }>({ open: false }); const [roleModalOpen, setRoleModalOpen] = useState(false); const [selectedRole, setSelectedRole] = useState<RoleId>();
  useEffect(() => { if (projectId) setView("projects"); }, [projectId]);
  useEffect(() => { const onHash = () => { const next = window.location.hash.slice(1) as View; if (next === "auth" || next === "account" || secondaryViews.includes(next) || navItems.some((item) => item.id === next)) setView(next); }; window.addEventListener("hashchange", onHash); return () => window.removeEventListener("hashchange", onHash); }, []);
  useEffect(() => {
    let mounted = true;
    const refreshActor = async () => {
      if (!getPublicSession()) { if (mounted) setPublicActor(null); return; }
      try {
        const result = await api.session();
        if (mounted) setPublicActor(result.actor);
      } catch {
        clearPublicSession();
        if (mounted) setPublicActor(null);
      }
    };
    const onAuthChanged = () => { void refreshActor(); };
    void refreshActor();
    window.addEventListener("venture-auth-changed", onAuthChanged);
    window.addEventListener("storage", onAuthChanged);
    return () => { mounted = false; window.removeEventListener("venture-auth-changed", onAuthChanged); window.removeEventListener("storage", onAuthChanged); };
  }, []);
  useEffect(() => { Promise.all([api.projects({ page: 1, pageSize: 50 }), api.organizations({ page: 1, pageSize: 50 }), api.contacts({ page: 1, pageSize: 50 }), api.articles({ page: 1, pageSize: 50 })]).then(([p, o, c, a]) => { setProjects(p.projects); setOrganizations(o.organizations); setContacts(c.contacts); setArticles(a.articles); }).catch((reason: Error) => setError(reason.message)).finally(() => setLoading(false)); }, []);
  useEffect(() => { if (!getPublicSession()) return; api.favorites().then(({ favorites }) => setFavoriteKeys(new Set(favorites.map((favorite) => `${favorite.resourceType}:${favorite.resourceId}`)))).catch(() => undefined); }, []);
  useEffect(() => { if (!getPublicSession()) return; api.recentViews().then(({ views }) => setRecentViews(views)).catch(() => undefined); }, [view]);
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
  }, [loading, view, projectId]);
  const go = (next: View, query = "") => { setSelectedTelegraph(undefined); setView(next); setSearchQuery(query); window.location.hash = next; if (projectId) { onLeaveDetail?.(); window.history.replaceState({}, "", viewToPath[next]); } window.scrollTo({ top: 0, behavior: "smooth" }); setMenuOpen(false); };
  const logoutPublic = async () => { try { await api.logout(); } catch { /* session may already be expired */ } finally { clearPublicSession(); setPublicActor(null); notifyAuthChanged(); go("home"); } };
  const handleSearch = (query: string, target: SearchTarget) => go(target, query);
  const openProject = (project: Project) => { if (getPublicSession()) { void api.recordRecentView("project", project.id); setRecentViews((current) => [{ resourceType: "project" as const, resourceId: project.id, viewedAt: new Date().toISOString() }, ...current.filter((view) => !(view.resourceType === "project" && view.resourceId === project.id))].slice(0, 20)); } window.location.assign(`/projects/${encodeURIComponent(project.id)}`); };
  const openArticle = (article: Article) => { if (getPublicSession()) { void api.recordRecentView("article", article.id); setRecentViews((current) => [{ resourceType: "article" as const, resourceId: article.id, viewedAt: new Date().toISOString() }, ...current.filter((view) => !(view.resourceType === "article" && view.resourceId === article.id))].slice(0, 20)); } setSelectedArticle(article); void api.article(article.slug).then(({ article: detail }) => setSelectedArticle((current) => current?.id === article.id ? detail : current)).catch(() => undefined); };
  const openTelegraph = (entry: TelegraphEntry) => { setSelectedTelegraph(entry); setSearchQuery(""); window.location.hash = "events"; window.scrollTo({ top: 0, behavior: "smooth" }); setMenuOpen(false); };
  const toggleFavorite = async (resourceType: FavoriteResourceType, resourceId: string) => {
    if (!getPublicSession()) { go("auth"); return; }
    const key = `${resourceType}:${resourceId}`;
    try {
      if (favoriteKeys.has(key)) { await api.removeFavorite(resourceType, resourceId); setFavoriteKeys((current) => { const next = new Set(current); next.delete(key); return next; }); }
      else { await api.addFavorite(resourceType, resourceId); setFavoriteKeys((current) => new Set(current).add(key)); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "收藏失败"); }
  };
  let content = projectId ? <ProjectDetailPage projectId={projectId} go={go}/> : <HomeView projects={projects} organizations={organizations} contacts={contacts} go={go} openProject={openProject} favoriteKeys={favoriteKeys} onToggleFavorite={toggleFavorite}/>;
  if (!projectId && view === "projects") content = <ProjectsView projects={projects} openProject={openProject} initialQuery={searchQuery} favoriteKeys={favoriteKeys} onToggleFavorite={toggleFavorite}/>;
  if (view === "organizations") content = <OrganizationsView organizations={organizations} initialQuery={searchQuery} favoriteKeys={favoriteKeys} onToggleFavorite={toggleFavorite}/>;
  if (view === "institutions") content = <InstitutionsView organizations={organizations} favoriteKeys={favoriteKeys} onToggleFavorite={toggleFavorite}/>;
  if (view === "government") content = <GovernmentView contacts={contacts} openContact={(contact) => setContactModal({ open: true, contact })} initialQuery={searchQuery}/>;
  if (view === "research") content = <EditorialView kind="research" go={go}/>;
  if (view === "events") content = selectedTelegraph ? <EditorialView kind="events" story={telegraphEntryToStory(selectedTelegraph)} go={go} backView="events" backLabel="返回创投电报"/> : <TelegraphView entries={telegraphEntries} go={go} openEntry={openTelegraph}/>;
  if (view === "articles") content = <ArticlesView articles={articles} openArticle={openArticle} initialQuery={searchQuery} favoriteKeys={favoriteKeys} onToggleFavorite={toggleFavorite}/>;
  if (view === "industries") content = <IndustryMapPage onBackHome={() => go("home")}/>;
  if (view === "services") content = <ServicesPage onBackHome={() => go("home")} onNavigate={(destination) => { if (destination === "auth") setSelectedRole("user"); go(destination); }}/>;
  if (view === "auth") content = <AuthView initialRole={selectedRole} go={go}/>;
  if (view === "account") content = <AccountWorkspace go={go} projects={projects} articles={articles}/>;

  return <div className={`site-shell view-${view}`}><header className="site-header"><div className="header-inner"><button className="brand" onClick={() => go("home")}><QifengLogo /></button><button className="menu-button" aria-label="打开导航" onClick={() => setMenuOpen(!menuOpen)}><i/><i/><i/></button><nav className={menuOpen ? "open" : ""}>{navItems.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => go(item.id)}>{item.label}</button>)}</nav><GlobalSearch projects={projects} organizations={organizations} contacts={contacts} onSearch={handleSearch}/>{publicActor ? <PublicAccountMenu actor={publicActor} onNavigate={go} onOpenAdmin={() => window.location.assign("/admin")} onLogout={() => void logoutPublic()} /> : <button className="header-cta" onClick={() => { setSelectedRole("user"); go("auth"); }}>登录注册</button>}</div></header>{projectId ? content : loading ? <div className="loading">正在连接创投资源…</div> : error ? <div className="loading error">载入失败：{error}</div> : content}<footer><div className="section-wrap footer-grid"><div><div className="footer-brand"><QifengLogo /></div><p>连接项目、资本与政府产业资源。</p></div><div><b>平台导航</b><button onClick={() => go("projects")}>投融资</button><button onClick={() => go("organizations")}>公司</button><button onClick={() => go("institutions")}>创投机构</button><button onClick={() => go("government")}>政府对接</button><button onClick={() => go("research")}>研究报告</button><button onClick={() => go("events")}>创投电报</button><button onClick={() => go("industries")}>行业图谱</button><button onClick={() => go("services")}>产品服务</button></div><div><b>安全原则</b><span>主体认证</span><span>最小权限</span><span>访问留痕</span></div><div><b>当前版本</b><span>试点 MVP</span><span>线下登记与对接</span><span>正式上线需备案域名</span></div></div><div className="footer-bottom">© 2026 创投智联 · 本平台信息仅供交流，不构成投资建议</div></footer>{roleModalOpen && <RoleSelectionModal onClose={() => setRoleModalOpen(false)} onSelect={(role) => { setSelectedRole(role); setRoleModalOpen(false); go("auth"); }}/>} {contactModal.open && <ContactModal contact={contactModal.contact} onClose={() => setContactModal({ open: false })}/>} {selectedArticle && <ArticleModal article={selectedArticle} onClose={() => setSelectedArticle(undefined)}/>}</div>;
}
