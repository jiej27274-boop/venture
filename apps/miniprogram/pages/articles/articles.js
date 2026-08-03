const { request } = require("../../utils/api");

Page({
  data: { articles: [], filtered: [], activeCategory: "全部", categories: ["全部", "市场观察", "政策解读", "平台指南"] },
  onLoad() { this.loadArticles(); },
  async loadArticles() {
    try { const payload = await request("/api/articles"); this.allArticles = payload.articles; this.applyFilter("全部"); }
    catch { wx.showToast({ title: "资讯加载失败", icon: "none" }); }
  },
  chooseCategory(event) { this.applyFilter(event.currentTarget.dataset.category); },
  applyFilter(activeCategory) {
    const filtered = activeCategory === "全部" ? (this.allArticles || []) : (this.allArticles || []).filter((item) => item.category.includes(activeCategory));
    this.setData({ activeCategory, filtered });
  },
  openArticle(event) { wx.navigateTo({ url: `/pages/article-detail/article-detail?id=${event.currentTarget.dataset.id}` }); }
});
