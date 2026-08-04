const { request } = require("../../utils/api");

Page({
  data: { article: null, loading: true },
  onLoad(options) { this.loadArticle(options.id); },
  async loadArticle(id) {
    try {
      const payload = await request(`/api/articles/${encodeURIComponent(id)}`);
      this.setData({ article: payload.article, loading: false });
      wx.setNavigationBarTitle({ title: payload.article.title.slice(0, 12) });
    } catch { this.setData({ loading: false }); wx.showToast({ title: "资讯加载失败", icon: "none" }); }
  }
});
