const { request } = require("../../utils/api");
Page({
  data: { projects: [], filtered: [], activeIndustry: "全部", industries: ["全部", "人工智能", "新能源", "生物医药"] },
  onLoad() { this.loadProjects(); },
  async loadProjects() {
    try { const payload = await request("/api/projects"); this.setData({ projects: payload.projects, filtered: payload.projects }); }
    catch (error) { wx.showToast({ title: "数据载入失败", icon: "none" }); }
  },
  chooseIndustry(event) {
    const activeIndustry = event.currentTarget.dataset.industry;
    const filtered = activeIndustry === "全部" ? this.data.projects : this.data.projects.filter((project) => project.industry.includes(activeIndustry));
    this.setData({ activeIndustry, filtered });
  },
  openProject(event) { wx.navigateTo({ url: `/pages/project-detail/project-detail?id=${event.currentTarget.dataset.id}` }); }
});
