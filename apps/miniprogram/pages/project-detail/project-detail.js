const { request } = require("../../utils/api");
Page({
  data: { project: null, requesting: false, requestStatus: "" },
  onLoad(options) { this.projectId = options.id || "project-robotics"; this.loadProject(); },
  async loadProject() {
    try { const payload = await request(`/api/projects/${this.projectId}`); this.setData({ project: payload.project }); }
    catch (error) { wx.showToast({ title: "项目不存在", icon: "none" }); }
  },
  async requestBp() {
    if (this.data.requesting) return;
    this.setData({ requesting: true });
    try {
      await request(`/api/projects/${this.projectId}/bp-requests`, { method: "POST", data: { purpose: "用于投资评估与内部项目讨论" } });
      this.setData({ requestStatus: "申请已提交，等待项目方授权" });
      wx.showToast({ title: "申请已提交", icon: "success" });
    } catch (error) { wx.showToast({ title: error.message === "organization_not_verified" ? "请先完成认证" : "申请失败", icon: "none" }); }
    finally { this.setData({ requesting: false }); }
  }
});
