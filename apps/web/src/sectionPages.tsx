import { useMemo, useState, type ReactNode } from "react";

type SectionPageProps = { onBackHome: () => void };

const investmentRows = [
  { name: "工业具身智能平台", sector: "人工智能 / 机器人", stage: "A 轮", amount: "3000–5000 万", region: "上海", status: "开放对接" },
  { name: "医疗器械国产替代", sector: "生物医药", stage: "天使轮", amount: "800–1500 万", region: "杭州", status: "已完成初筛" },
  { name: "苏州某新能源材料项目", sector: "新能源", stage: "Pre-A 轮", amount: "1500–3000 万", region: "苏州", status: "匿名展示" },
  { name: "企业级智能风控", sector: "企业服务", stage: "种子轮", amount: "500–800 万", region: "北京", status: "近期更新" },
];

const companyRows = [
  { name: "云际机器人", tag: "先进制造", summary: "面向工厂的柔性机器人与视觉系统", region: "深圳", growth: "+38%" },
  { name: "澄明生物", tag: "生物医药", summary: "新型诊断试剂与临床转化服务", region: "杭州", growth: "+27%" },
  { name: "远川储能", tag: "新能源", summary: "工商业储能系统与运营平台", region: "苏州", growth: "+42%" },
  { name: "知行数据", tag: "企业服务", summary: "为产业园区提供数据治理工具", region: "北京", growth: "+19%" },
];

const regionRows = [
  { name: "上海临港", city: "上海", focus: "集成电路、智能制造、新能源", support: "空间 + 基金 + 场景", level: "重点区域" },
  { name: "杭州未来科技城", city: "杭州", focus: "人工智能、生命科学、数字经济", support: "人才 + 研发 + 产业链", level: "重点区域" },
  { name: "苏州工业园区", city: "苏州", focus: "生物医药、高端装备、新材料", support: "厂房 + 政策 + 基金", level: "持续招引" },
];

const industryRows = [
  { name: "人工智能", count: 128, trend: "↑ 24%", color: "blue", children: ["具身智能", "大模型应用", "视觉算法"] },
  { name: "新能源", count: 96, trend: "↑ 18%", color: "teal", children: ["储能", "固态电池", "能源管理"] },
  { name: "生物医药", count: 74, trend: "↑ 13%", color: "violet", children: ["创新药", "医疗器械", "诊断服务"] },
  { name: "先进制造", count: 63, trend: "↑ 9%", color: "orange", children: ["工业软件", "机器人", "新材料"] },
  { name: "企业服务", count: 51, trend: "↑ 7%", color: "navy", children: ["数据治理", "供应链", "安全合规"] },
  { name: "消费科技", count: 38, trend: "↑ 5%", color: "pink", children: ["智能硬件", "新零售", "内容科技"] },
];

const reportRows = [
  { title: "2026 产业资本观察：从融资热度到真实订单", category: "市场观察", read: "12 分钟", date: "2026.08.01", badge: "精选" },
  { title: "政府招商对接前的五项准备", category: "招商指南", read: "8 分钟", date: "2026.07.28", badge: "实操" },
  { title: "具身智能项目 BP 结构拆解", category: "融资方法", read: "15 分钟", date: "2026.07.21", badge: "方法论" },
];

const institutionRows = [
  { name: "远景创投", kind: "投资机构", region: "北京", focus: "先进制造 · 企业服务", ticket: "1000–5000 万", logo: "远" },
  { name: "启航资本顾问", kind: "FA 机构", region: "上海", focus: "消费科技 · 新能源", ticket: "协助融资", logo: "启" },
  { name: "星河产业基金", kind: "产业资本", region: "深圳", focus: "人工智能 · 生物医药", ticket: "3000 万起", logo: "星" },
  { name: "长三角科创母基金", kind: "母基金", region: "苏州", focus: "硬科技全阶段", ticket: "联合投资", logo: "长" },
];

const eventRows = [
  { date: "08.18", title: "长三角硬科技项目闭门对接会", place: "上海 · 临港", type: "线下活动", status: "报名中" },
  { date: "08.24", title: "产业资本如何判断早期项目", place: "线上直播", type: "公开课", status: "即将开始" },
  { date: "09.05", title: "新能源材料项目路演日", place: "苏州 · 工业园区", type: "项目路演", status: "招募项目" },
];

const serviceRows = [
  { title: "项目曝光", text: "发布公开摘要，获得投资机构与产业方关注。", icon: "↗", action: "发布项目" },
  { title: "资本对接", text: "基于行业、阶段与区域偏好，匹配合适的投资人。", icon: "◎", action: "了解对接" },
  { title: "政府招商", text: "连接区域招商联系人，提交线下落地需求。", icon: "⌂", action: "提交需求" },
  { title: "研究支持", text: "获取行业图谱、融资方法与区域招商洞察。", icon: "▱", action: "浏览内容" },
];

function PageShell({ eyebrow, title, description, children, onBackHome, tone = "blue" }: SectionPageProps & { eyebrow: string; title: string; description: string; children: ReactNode; tone?: string }) {
  return <main className={`independent-page independent-${tone}`}><section className="independent-hero"><div className="section-wrap"><button className="independent-back" onClick={onBackHome}>← 返回首页</button><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div></section>{children}</main>;
}

function SectionToolbar({ value, onChange, placeholder, filters = [] }: { value: string; onChange: (value: string) => void; placeholder: string; filters?: string[] }) {
  return <div className="independent-toolbar"><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={placeholder}/>{filters.map((filter) => <button type="button" key={filter}>{filter}</button>)}</div>;
}

export function InvestmentPage({ onBackHome }: SectionPageProps) {
  const [query, setQuery] = useState("");
  const rows = useMemo(() => investmentRows.filter((row) => !query || Object.values(row).some((value) => value.includes(query))), [query]);
  return <PageShell eyebrow="INVESTMENT MARKET" title="投融资机会" description="聚合项目、资本与产业资源，快速发现正在发生的投资机会。" onBackHome={onBackHome} tone="blue"><section className="section-wrap independent-content"><div className="independent-metrics"><div><b>3,286</b><span>公开项目</span></div><div><b>486</b><span>活跃机构</span></div><div><b>¥ 126.8 亿</b><span>融资需求</span></div><div><b>92%</b><span>信息已核验</span></div></div><div className="independent-panel"><div className="independent-panel-head"><div><span className="eyebrow">OPPORTUNITY BOARD</span><h2>最新融资机会</h2></div><span className="data-state">模拟数据 · API 待接入</span></div><SectionToolbar value={query} onChange={setQuery} placeholder="搜索项目、行业或地区" filters={["全部阶段", "全部行业", "全部地区"]}/>{rows.length ? <div className="investment-table">{rows.map((row) => <button className="investment-row" key={row.name}><span><b>{row.name}</b><small>{row.sector} · {row.region}</small></span><em>{row.stage}</em><strong>{row.amount}</strong><i>{row.status}</i><span>→</span></button>)}</div> : <div className="independent-empty"><b>暂无匹配的融资机会</b><span>调整关键词或筛选条件后再试。</span></div>}</div></section></PageShell>;
}

export function CompaniesPage({ onBackHome }: SectionPageProps) {
  const [query, setQuery] = useState("");
  const rows = companyRows.filter((row) => !query || Object.values(row).some((value) => value.includes(query)));
  return <PageShell eyebrow="COMPANY DIRECTORY" title="公司" description="了解正在成长的科技企业，关注产品、团队与产业化进展。" onBackHome={onBackHome} tone="mint"><section className="section-wrap independent-content"><SectionToolbar value={query} onChange={setQuery} placeholder="搜索公司名称、行业或地区" filters={["行业筛选", "发展阶段", "所在地区"]}/><div className="company-grid">{rows.map((row) => <article className="company-card" key={row.name}><div className="company-card-top"><span>{row.tag}</span><b>{row.growth}</b></div><h2>{row.name}</h2><p>{row.summary}</p><div><small>{row.region}</small><button type="button">查看公司档案 →</button></div></article>)}</div>{!rows.length && <div className="independent-empty"><b>暂无公司数据</b><span>公司名录正在持续登记中。</span></div>}</section></PageShell>;
}

export function GovernmentOpportunityPage({ onBackHome }: SectionPageProps) {
  return <PageShell eyebrow="REGIONAL OPPORTUNITY" title="政府对接" description="连接各地区招商部门与产业园区，为项目落地寻找合适的政策、空间与产业伙伴。" onBackHome={onBackHome} tone="gold"><section className="section-wrap independent-content"><div className="opportunity-callout"><div><span>OFFLINE MATCHING</span><h2>提交一份招商对接需求</h2><p>平台运营人员将在 1 个工作日内为你匹配区域联系人。</p></div><button className="primary">提交需求 →</button></div><div className="region-grid">{regionRows.map((row) => <article className="region-card" key={row.name}><div className="region-card-top"><span>{row.level}</span><small>{row.city}</small></div><h2>{row.name}</h2><p>{row.focus}</p><div className="region-support"><small>可提供支持</small><b>{row.support}</b></div><button className="outline">查看招商联系人</button></article>)}</div></section></PageShell>;
}

export function IndustryMapPage({ onBackHome }: SectionPageProps) {
  const [selected, setSelected] = useState(industryRows[0].name);
  const active = industryRows.find((row) => row.name === selected) ?? industryRows[0];
  return <PageShell eyebrow="INDUSTRY MAP" title="行业图谱" description="从项目、机构与区域三个维度观察产业结构。数据源接入后将支持实时更新。" onBackHome={onBackHome} tone="violet"><section className="section-wrap independent-content"><div className="data-reserved"><span>DATA SOURCE RESERVED</span><b>行业数据接口预留</b><small>当前为页面演示数据，后续接入行业标签、融资事件与政策数据源。</small></div><div className="industry-layout"><div className="industry-map-grid">{industryRows.map((row) => <button type="button" className={`industry-node ${row.color}${selected === row.name ? " active" : ""}`} key={row.name} onClick={() => setSelected(row.name)}><span>{row.name}</span><b>{row.count}</b><small>{row.trend}</small></button>)}</div><aside className="industry-detail"><span className="eyebrow">SELECTED INDUSTRY</span><h2>{active.name}</h2><p>已收录项目与机构的关注方向，支持后续扩展产业链上下游关系。</p><div className="industry-progress"><span>项目热度</span><b>{active.count} 个</b><i><em style={{ width: `${Math.min(92, active.count / 1.5)}%` }}/></i></div><div className="tag-list">{active.children.map((item) => <span key={item}>{item}</span>)}</div></aside></div></section></PageShell>;
}

export function ReportsPage({ onBackHome }: SectionPageProps) {
  const [query, setQuery] = useState("");
  const rows = reportRows.filter((row) => !query || Object.values(row).some((value) => value.includes(query)));
  return <PageShell eyebrow="RESEARCH ROOM" title="研究报告" description="沉淀一级市场、产业趋势与区域招商的研究内容。数据源接入后将支持在线阅读与下载。" onBackHome={onBackHome} tone="violet"><section className="section-wrap independent-content"><div className="data-reserved report-reserved"><span>CONTENT API RESERVED</span><b>研究报告接口预留</b><small>报告目录、全文阅读和下载能力将在后续接入内容服务后开放。</small></div><SectionToolbar value={query} onChange={setQuery} placeholder="搜索报告标题或关键词" filters={["全部分类", "最新发布"]}/><div className="report-grid">{rows.map((row) => <article className="report-card" key={row.title}><div className="report-cover"><span>{row.badge}</span><b>VL<br/><small>REPORT</small></b></div><div><span className="report-category">{row.category}</span><h2>{row.title}</h2><p>{row.date} · 阅读 {row.read}</p><button type="button">查看报告摘要 →</button></div></article>)}</div>{!rows.length && <div className="independent-empty"><b>暂无匹配报告</b><span>报告内容正在整理中。</span></div>}</section></PageShell>;
}

export function InstitutionsPage({ onBackHome }: SectionPageProps) {
  return <PageShell eyebrow="CAPITAL NETWORK" title="创投机构" description="发现投资机构、FA 与产业资本的投资偏好和服务能力。" onBackHome={onBackHome} tone="blue"><section className="section-wrap independent-content"><div className="institution-filter"><button className="active">全部机构</button><button>投资机构</button><button>FA 机构</button><button>产业资本</button><span>模拟目录 · 后续接入机构 API</span></div><div className="institution-grid">{institutionRows.map((row) => <article className="institution-card" key={row.name}><div className="institution-brand"><span>{row.logo}</span><small>{row.kind}</small></div><h2>{row.name}</h2><p>{row.region} · {row.focus}</p><div className="institution-card-bottom"><b>{row.ticket}</b><button type="button">查看机构档案 →</button></div></article>)}</div></section></PageShell>;
}

export function EventsPage({ onBackHome }: SectionPageProps) {
  return <PageShell eyebrow="VENTURE EVENTS" title="新闻事件" description="关注创投活动、项目路演和产业合作的最新动态。" onBackHome={onBackHome} tone="orange"><section className="section-wrap independent-content"><div className="event-highlight"><span>UPCOMING</span><h2>创投智联 8 月活动日历</h2><p>线下对接、线上公开课与区域路演，持续更新中。</p></div><div className="event-list">{eventRows.map((row) => <article className="event-row" key={row.title}><time><b>{row.date.split(".")[1]}</b><small>{row.date.split(".")[0]} 月</small></time><div><span>{row.type}</span><h2>{row.title}</h2><p>{row.place}</p></div><button className={row.status === "报名中" ? "primary" : "outline"}>{row.status}</button></article>)}</div><div className="independent-empty compact"><b>更多新闻事件即将上线</b><span>后续将接入资讯与活动数据源。</span></div></section></PageShell>;
}

export function ServicesPage({ onBackHome }: SectionPageProps) {
  return <PageShell eyebrow="PLATFORM SERVICES" title="产品服务" description="围绕项目、资本与政府产业资源，提供从发现到对接的协同工具。" onBackHome={onBackHome} tone="teal"><section className="section-wrap independent-content"><div className="service-grid">{serviceRows.map((row) => <article className="service-card" key={row.title}><span>{row.icon}</span><h2>{row.title}</h2><p>{row.text}</p><button className="outline">{row.action} →</button></article>)}</div><div className="service-empty"><div><span>COMING SOON</span><h2>企业会员与数据订阅服务</h2><p>机构画像、行业数据导出和项目批量管理功能正在规划中。</p></div><button className="primary">登记产品需求</button></div></section></PageShell>;
}
