App({
  globalData: {
    apiBaseUrl: "http://127.0.0.1:8787",
    identity: {
      userId: "user-investor",
      organizationId: "org-investor",
      label: "远景创投 · 投资经理"
    }
  },
  onLaunch() {
    const savedIdentity = wx.getStorageSync("venture_identity");
    const savedApiBaseUrl = wx.getStorageSync("venture_api_base_url");
    if (savedIdentity) this.globalData.identity = savedIdentity;
    if (savedApiBaseUrl) this.globalData.apiBaseUrl = savedApiBaseUrl;
  },
  setIdentity(identity) {
    this.globalData.identity = identity;
    wx.setStorageSync("venture_identity", identity);
  }
});
