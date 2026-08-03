const { request } = require("../../utils/api");

Page({
  data: { organizations: [], filtered: [], activeType: "全部", types: ["全部", "投资机构", "FA", "政府"] },
  onLoad() { this.loadOrganizations(); },
  async loadOrganizations() {
    try { const payload = await request("/api/organizations"); this.allOrganizations = payload.organizations; this.applyFilter("全部"); }
    catch { wx.showToast({ title: "机构加载失败", icon: "none" }); }
  },
  chooseType(event) { this.applyFilter(event.currentTarget.dataset.type); },
  applyFilter(activeType) {
    const typeMap = { "投资机构": "investor", "FA": "fa", "政府": "government" };
    const filtered = activeType === "全部" ? (this.allOrganizations || []) : (this.allOrganizations || []).filter((item) => item.type === typeMap[activeType]);
    this.setData({ activeType, filtered });
  }
});
