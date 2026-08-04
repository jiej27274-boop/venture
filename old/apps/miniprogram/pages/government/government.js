const { request } = require("../../utils/api");
Page({
  data: { contacts: [], regions: ["全部", "上海", "江苏", "浙江", "安徽"], activeRegion: "全部" },
  onLoad() { this.loadContacts(); },
  async loadContacts() { try { const payload = await request("/api/government-contacts"); this.allContacts = payload.contacts; this.setData({ contacts: payload.contacts }); } catch (error) { wx.showToast({ title: "载入失败", icon: "none" }); } },
  chooseRegion(event) { const activeRegion = event.currentTarget.dataset.region; const contacts = activeRegion === "全部" ? this.allContacts : this.allContacts.filter((contact) => contact.region.includes(activeRegion)); this.setData({ activeRegion, contacts }); },
  contact() { wx.showModal({ title: "提交联系申请", content: "联系方式默认不公开。对方接受后，平台才会交换联系方式。", confirmText: "提交", success(result) { if (result.confirm) wx.showToast({ title: "已提交", icon: "success" }); } }); }
});
