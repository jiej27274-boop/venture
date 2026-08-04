const { request } = require("../../utils/api");

Page({
  data: { projects: [], contacts: [], loading: true },
  onLoad() { this.loadData(); },
  onPullDownRefresh() { this.loadData().finally(() => wx.stopPullDownRefresh()); },
  async loadData() {
    try {
      const [projectPayload, contactPayload] = await Promise.all([
        request("/api/projects"), request("/api/government-contacts")
      ]);
      this.setData({ projects: projectPayload.projects.slice(0, 3), contacts: contactPayload.contacts.slice(0, 2), loading: false });
    } catch (error) {
      this.setData({ loading: false });
      wx.showToast({ title: "请先启动本地 API", icon: "none" });
    }
  },
  openProject(event) { wx.navigateTo({ url: `/pages/project-detail/project-detail?id=${event.currentTarget.dataset.id}` }); },
  openProjects() { wx.switchTab({ url: "/pages/projects/projects" }); },
  openGovernment() { wx.switchTab({ url: "/pages/government/government" }); },
  openOrganizations() { wx.navigateTo({ url: "/pages/organizations/organizations" }); },
  openArticles() { wx.switchTab({ url: "/pages/articles/articles" }); }
});
