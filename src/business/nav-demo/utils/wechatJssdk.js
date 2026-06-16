const LOG_PREFIX = '[NavMap][WeChat]';
const JWX_SCRIPT_URL = 'https://res.wx.qq.com/open/js/jweixin-1.6.0.js';

let scriptLoadPromise = null;
let configPromise = null;

function wechatLog(label, data) {
	if (data !== undefined) {
		console.log(`${LOG_PREFIX} ${label}`, data);
	} else {
		console.log(`${LOG_PREFIX} ${label}`);
	}
}

export function isWeChatEnv() {
	return /MicroMessenger/i.test(navigator.userAgent || '');
}

function getWeChatConfig() {
	return window.AppConfig?.wechat || {};
}

function loadJWeixinScript() {
	if (typeof window.wx !== 'undefined') {
		return Promise.resolve();
	}

	if (scriptLoadPromise) {
		return scriptLoadPromise;
	}

	scriptLoadPromise = new Promise((resolve, reject) => {
		const script = document.createElement('script');
		script.src = JWX_SCRIPT_URL;
		script.async = true;
		script.onload = () => resolve();
		script.onerror = () => {
			scriptLoadPromise = null;
			reject(new Error('微信 JSSDK 脚本加载失败'));
		};
		document.head.appendChild(script);
	});

	return scriptLoadPromise;
}

function resolveSignPayload(payload) {
	if (!payload || typeof payload !== 'object') {
		throw new Error('签名接口返回格式无效');
	}

	if (payload.data && typeof payload.data === 'object') {
		return payload.data;
	}

	return payload;
}

async function fetchJssdkSignature() {
	const { jssdkSignUrl } = getWeChatConfig();

	if (!jssdkSignUrl) {
		throw new Error('未配置微信 JSSDK 签名接口（AppConfig.wechat.jssdkSignUrl）');
	}

	const pageUrl = encodeURIComponent(window.location.href.split('#')[0]);
	const signUrl = jssdkSignUrl.includes('?')
		? `${jssdkSignUrl}&url=${pageUrl}`
		: `${jssdkSignUrl}?url=${pageUrl}`;

	wechatLog('请求 JSSDK 签名', signUrl);

	const response = await fetch(signUrl);
	if (!response.ok) {
		throw new Error(`签名接口请求失败（${response.status}）`);
	}

	const payload = await response.json();
	const sign = resolveSignPayload(payload);

	if (!sign.timestamp || !sign.nonceStr || !sign.signature) {
		throw new Error('签名接口缺少 timestamp / nonceStr / signature');
	}

	return sign;
}

/**
 * 初始化微信 JSSDK（wx.config），成功后 resolve(wx)
 */
export function ensureWeChatJssdkReady() {
	if (!isWeChatEnv()) {
		return Promise.reject(new Error('非微信环境'));
	}

	if (configPromise) {
		return configPromise;
	}

	configPromise = (async () => {
		await loadJWeixinScript();

		const sign = await fetchJssdkSignature();
		const { appId, debug = false } = getWeChatConfig();

		await new Promise((resolve, reject) => {
			window.wx.config({
				debug: Boolean(debug),
				appId: sign.appId || appId,
				timestamp: sign.timestamp,
				nonceStr: sign.nonceStr,
				signature: sign.signature,
				jsApiList: ['openLocation', 'getLocation']
			});

			window.wx.ready(() => {
				wechatLog('JSSDK 初始化成功');
				resolve();
			});

			window.wx.error((err) => {
				wechatLog('JSSDK 初始化失败', err);
				reject(err || new Error('wx.config 失败'));
			});
		});

		return window.wx;
	})().catch((error) => {
		configPromise = null;
		throw error;
	});

	return configPromise;
}

/**
 * 微信内获取当前位置（需已配置 JSSDK 签名与安全域名）
 */
export async function getWeChatCurrentLocation(options = {}) {
	const { jssdkSignUrl } = getWeChatConfig();
	if (!jssdkSignUrl) {
		const error = new Error('微信 JSSDK 未配置');
		error.reason = 'wechat_jssdk_not_configured';
		throw error;
	}

	const wx = await ensureWeChatJssdkReady();
	const coordinateType = options.coordinateType || 'gcj02';

	wechatLog('调用 wx.getLocation', { coordinateType });

	return new Promise((resolve, reject) => {
		wx.getLocation({
			type: coordinateType,
			isHighAccuracy: options.enableHighAccuracy !== false,
			highAccuracyExpireTime: options.timeout || 15000,
			success: (res) => {
				wechatLog('wx.getLocation 成功', res);
				resolve({
					lng: res.longitude,
					lat: res.latitude,
					accuracy: res.accuracy,
					source: 'wechat',
					coordinateType
				});
			},
			fail: (err) => {
				wechatLog('wx.getLocation 失败', err);
				const error = new Error(err?.errMsg || 'wx.getLocation 失败');
				error.code = 1;
				error.wechatError = err;
				reject(error);
			},
			cancel: () => {
				const error = new Error('用户取消微信定位授权');
				error.code = 1;
				reject(error);
			}
		});
	});
}

/**
 * 微信内预加载 JSSDK，减少首次点击「到这里去」的等待
 */
export function preloadWeChatJssdk() {
	if (!isWeChatEnv()) return;

	ensureWeChatJssdkReady().catch((error) => {
		wechatLog('预加载失败（首次导航时会重试）', error);
	});
}

/**
 * 调用微信内置地图页（用户可在该页点「导航」再选第三方 App）
 * @param {{ name: string, lng: number, lat: number, address?: string, desc?: string }} poi
 */
export async function openWeChatLocation(poi) {
	const wx = await ensureWeChatJssdkReady();

	wechatLog('调用 wx.openLocation', {
		name: poi.name,
		lng: poi.lng,
		lat: poi.lat
	});

	return new Promise((resolve, reject) => {
		wx.openLocation({
			latitude: Number(poi.lat),
			longitude: Number(poi.lng),
			name: poi.name || '',
			address: poi.address || poi.desc || '',
			scale: 18,
			infoUrl: '',
			success: (res) => {
				wechatLog('wx.openLocation 成功', res);
				resolve(res);
			},
			fail: (err) => {
				wechatLog('wx.openLocation 失败', err);
				reject(err || new Error('wx.openLocation 失败'));
			},
			cancel: () => {
				reject(new Error('用户取消'));
			}
		});
	});
}
