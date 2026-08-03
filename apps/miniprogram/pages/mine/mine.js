Page({
  data: { identity: null },
  onShow() { this.setData({ identity: getApp().globalData.identity }); },
  switchIdentity() {
    const identities = [
      { userId: "user-investor", organizationId: "org-investor", label: "远景创投 · 投资经理" },
      { userId: "user-fa", organizationId: "org-fa", label: "启航资本顾问 · FA" },
      { userId: "user-government", organizationId: "org-government", label: "临港招商中心 · 招商经理" },
    ];
    wx.showActionSheet({ itemList: identities.map((item) => item.label), success: (result) => { getApp().setIdentity(identities[result.tapIndex]); this.setData({ identity: identities[result.tapIndex] }); wx.showToast({ title: "身份已切换", icon: "success" }); } });
  }
});
