const defaultBaseUrl = "http://127.0.0.1:8787";

function request(path, options = {}) {
  const identity = getApp().globalData.identity;
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${getApp().globalData.apiBaseUrl || defaultBaseUrl}${path}`,
      method: options.method || "GET",
      data: options.data,
      header: {
        "content-type": "application/json",
        "x-user-id": identity.userId,
        "x-organization-id": identity.organizationId,
        ...(options.header || {})
      },
      success(response) {
        if (response.statusCode >= 200 && response.statusCode < 300) resolve(response.data);
        else reject(new Error(response.data && response.data.error ? response.data.error : `HTTP ${response.statusCode}`));
      },
      fail: reject
    });
  });
}

module.exports = { request, defaultBaseUrl };
