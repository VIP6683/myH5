/**
 * 单点登录 / 退出登录跳转（部署后可改，无需重新打包）
 * 对齐参考项目 htzy-web-dz public/config/setting.js
 */
window.AppConfig = {
	/** 业务接口根地址（留空则使用 vite.config.js 打包地址；部署后可填覆盖，无需重新打包） */
	apiBaseUrl: '',

	/**
	 * 移动端调试（vConsole）
	 * true：强制开启；false 时仅 URL 带 ?debug=1 可开
	 */
	mobileDebug: false,

	/** SSO 登录失败或未登录时跳转的统一权限登录页 */
	loginUrl: {
		url: ''
	},
	/** 退出登录后跳转的统一权限注销页 */
	logoutConfigUrl: '',

	/**
	 * 微信 JSSDK（微信内定位 wx.getLocation、导航 wx.openLocation）
	 * jssdkSignUrl：签名接口路径，默认 /result/wechat/signature（POST，body: { url }，走 apiBaseUrl + Token）
	 * appId：可选兜底；优先使用签名接口返回的 appId
	 * 访问域名需加入公众号「JS 接口安全域名」
	 */
	wechat: {
		appId: '',
		jssdkSignUrl: '/result/wechat/signature',
		debug: false
	}
};

