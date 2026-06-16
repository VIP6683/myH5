/**
 * 单点登录 / 退出登录跳转（部署后可改，无需重新打包）
 * 对齐参考项目 htzy-web-dz public/config/setting.js
 */
window.AppConfig = {
	/** SSO 登录失败或未登录时跳转的统一权限登录页 */
	loginUrl: {
		url: ''
	},
	/** 退出登录后跳转的统一权限注销页 */
	logoutConfigUrl: '',

	/**
	 * 微信 JSSDK（用于微信内「到这里去」→ wx.openLocation）
	 * jssdkSignUrl：后端签名接口，GET 参数 url=当前页完整地址（不含 #）
	 * 接口需返回 { appId, timestamp, nonceStr, signature }（或包在 data 字段内）
	 */
	wechat: {
		appId: '',
		jssdkSignUrl: '',
		debug: false
	}
};

