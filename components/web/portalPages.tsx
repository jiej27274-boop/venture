import { useState, type ReactNode } from "react";

type PortalPageShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  onBackHome: () => void;
  tone: "blue" | "violet" | "teal";
};

const industryRows = [
  { name: "人工智能", count: 128, trend: "↑ 24%", color: "blue", children: ["具身智能", "大模型应用", "视觉算法"] },
  { name: "新能源", count: 96, trend: "↑ 18%", color: "teal", children: ["储能", "固态电池", "能源管理"] },
  { name: "生物医药", count: 74, trend: "↑ 13%", color: "violet", children: ["创新药", "医疗器械", "诊断服务"] },
  { name: "先进制造", count: 63, trend: "↑ 9%", color: "orange", children: ["工业软件", "机器人", "新材料"] },
  { name: "企业服务", count: 51, trend: "↑ 7%", color: "navy", children: ["数据治理", "供应链", "安全合规"] },
  { name: "消费科技", count: 38, trend: "↑ 5%", color: "pink", children: ["智能硬件", "新零售", "内容科技"] },
] as const;

type ServiceDestination = "projects" | "institutions" | "government" | "research" | "auth";
type ServiceIconName = "project" | "capital" | "government" | "research";

const serviceRows: Array<{ title: string; text: string; icon: ServiceIconName; action: string; destination: Exclude<ServiceDestination, "auth"> }> = [
  { title: "项目曝光", text: "发布公开摘要，获得投资机构与产业方关注。", icon: "project", action: "发布项目", destination: "projects" },
  { title: "资本对接", text: "基于行业、阶段与区域偏好，匹配合适的投资人。", icon: "capital", action: "了解对接", destination: "institutions" },
  { title: "政府招商", text: "连接区域招商联系人，提交线下落地需求。", icon: "government", action: "提交需求", destination: "government" },
  { title: "研究支持", text: "获取行业图谱、融资方法与区域招商洞察。", icon: "research", action: "浏览内容", destination: "research" },
];

function PortalPageShell({ eyebrow, title, description, children, onBackHome, tone }: PortalPageShellProps) {
  return <main className={`portal-section-page portal-section-${tone}`}>
    <section className="portal-section-hero">
      <div className="section-wrap portal-section-hero-inner">
        <button className="portal-section-back" type="button" onClick={onBackHome}>← 返回首页</button>
        <span className="portal-section-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </section>
    {children}
  </main>;
}

function ServiceIcon({ name }: { name: ServiceIconName }) {
  const props = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "project") return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path d="M5 19V7l7-3 7 3v12"/><path d="M8 10h1M12 10h1M16 10h1M8 14h1M12 14h1M16 14h1"/><path d="M3 19h18"/></svg>;
  if (name === "capital") return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path d="m4 8 8-4 8 4-8 4-8-4Z"/><path d="M6 10v6M10 10v6M14 10v6M18 10v6M4 19h16"/></svg>;
  if (name === "government") return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path d="m3 9 9-5 9 5"/><path d="M5 10v7M9 10v7M15 10v7M19 10v7M3 19h18"/><path d="M12 4v2"/></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Z"/><path d="M8 4v13a3 3 0 0 0 3 3M9 9h6M9 13h6"/></svg>;
}

export function IndustryMapPage({ onBackHome }: { onBackHome: () => void }) {
  const [selected, setSelected] = useState<string>(industryRows[0].name);
  const active = industryRows.find((row) => row.name === selected) ?? industryRows[0];

  return <PortalPageShell eyebrow="INDUSTRY MAP" title="行业图谱" description="从项目、机构与区域三个维度观察产业结构。数据源接入后将支持实时更新。" onBackHome={onBackHome} tone="violet">
    <section className="section-wrap portal-section-content">
      <div className="portal-data-note" role="note">
        <span>DATA SOURCE RESERVED</span>
        <div><b>行业数据接口预留</b><small>当前为页面演示数据，后续接入行业标签、融资事件与政策数据源。</small></div>
      </div>
      <div className="portal-industry-layout">
        <div className="portal-industry-map" aria-label="行业分类">
          {industryRows.map((row) => <button type="button" className={`portal-industry-node ${row.color}${selected === row.name ? " active" : ""}`} key={row.name} aria-pressed={selected === row.name} onClick={() => setSelected(row.name)}>
            <span>{row.name}</span><b>{row.count}</b><small>{row.trend}</small>
          </button>)}
        </div>
        <aside className="portal-industry-detail" aria-live="polite">
          <span className="portal-detail-eyebrow">SELECTED INDUSTRY</span>
          <h2>{active.name}</h2>
          <p>已收录项目与机构的关注方向，支持后续扩展产业链上下游关系。</p>
          <div className="portal-industry-progress"><span>项目热度</span><b>{active.count} 个</b><i><em style={{ width: `${Math.min(92, active.count / 1.5)}%` }} /></i></div>
          <div className="portal-tag-list">{active.children.map((item) => <span key={item}>{item}</span>)}</div>
        </aside>
      </div>
    </section>
  </PortalPageShell>;
}

export function ServicesPage({ onBackHome, onNavigate }: { onBackHome: () => void; onNavigate: (destination: ServiceDestination) => void }) {
  return <PortalPageShell eyebrow="PLATFORM SERVICES" title="产品服务" description="围绕项目、资本与政府产业资源，提供从发现到对接的协同工具。" onBackHome={onBackHome} tone="teal">
    <section className="section-wrap portal-section-content">
      <div className="portal-service-note" role="note"><span>LOCAL DEMO</span><p>当前为本地演示版本，按钮会跳转到平台已有功能入口。</p></div>
      <div className="portal-service-grid">
        {serviceRows.map((row) => <article className="portal-service-card" key={row.title}>
          <span className="portal-service-icon"><ServiceIcon name={row.icon} /></span>
          <h2>{row.title}</h2>
          <p>{row.text}</p>
          <button className="portal-service-link" type="button" onClick={() => onNavigate(row.destination)}>{row.action}<span aria-hidden="true">→</span></button>
        </article>)}
      </div>
      <div className="portal-service-cta">
        <div><span>COMING SOON</span><h2>企业会员与数据订阅服务</h2><p>机构画像、行业数据导出和项目批量管理功能正在规划中。</p></div>
        <button className="primary" type="button" onClick={() => onNavigate("auth")}>登记产品需求 <span aria-hidden="true">→</span></button>
      </div>
    </section>
  </PortalPageShell>;
}
