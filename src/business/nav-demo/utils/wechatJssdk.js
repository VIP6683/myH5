import { fetchWechatSignature } from '../../../api/wechat.js';

const LOG_PREFIX = '[NavMap][WeChat]';
const JWX_SCRIPT_URL = 'https://res.wx.qq.com/open/js/jweixin-1.6.0.js';
/** 与后端约定的签名接口路径（走 api request，自动带 Bearer） */
const DEFAULT_JSSDK_SIGN_PATH = '/result/wechat/signature';

let scriptLoadPromise = null;
let configPromise = null;
let activeSignUrl = null;
let configGeneration = 0;

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

function isIosWeChat() {
	const ua = navigator.userAgent || '';
	return /MicroMessenger/i.test(ua) && /iPhone|iPad|iPod/i.test(ua);
}

function getWeChatConfig() {
	return window.AppConfig?.wechat || {};
}

function normalizeSignUrl(url) {
	return String(url || '').split('#')[0];
}

function getCurrentSignUrl() {
	return normalizeSignUrl(window.location.href);
}

function getEntrySignUrl() {
	return normalizeSignUrl(window.__WECHAT_ENTRY_URL__ || window.location.href);
}

/**
 * 微信 JSSDK 签名 URL 候选列表。
 * iOS 微信 SPA 内校验 entry URL；Android 校验当前 URL。失败时依次尝试另一项。
 */
function getSignUrlCandidates() {
	const entryUrl = getEntrySignUrl();
	const currentUrl = getCurrentSignUrl();
	const candidates = isIosWeChat() ? [entryUrl, currentUrl] : [currentUrl, entryUrl];
	return [...new Set(candidates.filter(Boolean))];
}

function getPrimarySignUrl() {
	return getSignUrlCandidates()[0];
}

function isInvalidSignatureError(err) {
	const errMsg = String(err?.errMsg || err?.message || '');
	return /invalid signature/i.test(errMsg);
}

function resetWeChatJssdkConfig() {
	configGeneration += 1;
	configPromise = null;
	activeSignUrl = null;
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

async function fetchJssdkSignature(signUrl) {
	const { jssdkSignUrl } = getWeChatConfig();
	const signPath = jssdkSignUrl || DEFAULT_JSSDK_SIGN_PATH;
	const pageUrl = normalizeSignUrl(signUrl);
	const currentUrl = getCurrentSignUrl();
	const entryUrl = getEntrySignUrl();

	wechatLog('请求 JSSDK 签名', { signPath, pageUrl, currentUrl, entryUrl, platform: isIosWeChat() ? 'ios' : 'android' });

	const sign = await fetchWechatSignature(pageUrl, signPath);

	if (!sign?.timestamp || !sign?.nonceStr || !sign?.signature) {
		throw new Error('签名接口缺少 timestamp / nonceStr / signature');
	}

	return sign;
}

async function configureWeChatJssdk(signUrl) {
	await loadJWeixinScript();

	const generation = configGeneration;
	const sign = await fetchJssdkSignature(signUrl);
	const { appId, debug = false } = getWeChatConfig();
	const timestamp = String(sign.timestamp);
	const nonceStr = String(sign.nonceStr);
	const signature = String(sign.signature);

	await new Promise((resolve, reject) => {
		let settled = false;

		const finish = (fn, payload) => {
			if (settled || generation !== configGeneration) {
				return;
			}
			settled = true;
			fn(payload);
		};

		window.wx.config({
			debug: Boolean(debug),
			appId: sign.appId || appId,
			timestamp,
			nonceStr,
			signature,
			jsApiList: ['openLocation', 'getLocation']
		});

		window.wx.ready(() => {
			wechatLog('JSSDK 初始化成功', { signUrl: normalizeSignUrl(signUrl) });
			finish(resolve);
		});

		window.wx.error((err) => {
			wechatLog('JSSDK 初始化失败', { signUrl: normalizeSignUrl(signUrl), err });
			finish(reject, err || new Error('wx.config 失败'));
		});
	});

	return window.wx;
}

/**
 * 初始化微信 JSSDK（wx.config），成功后 resolve(wx)
 * @param {{ signUrl?: string }} [options]
 */
export function ensureWeChatJssdkReady(options = {}) {
	if (!isWeChatEnv()) {
		return Promise.reject(new Error('非微信环境'));
	}

	const signUrl = normalizeSignUrl(options.signUrl || getPrimarySignUrl());

	if (configPromise && activeSignUrl === signUrl) {
		return configPromise;
	}

	if (configPromise && activeSignUrl !== signUrl) {
		resetWeChatJssdkConfig();
	}

	activeSignUrl = signUrl;
	configPromise = configureWeChatJssdk(signUrl).catch((error) => {
		resetWeChatJssdkConfig();
		throw error;
	});

	return configPromise;
}

async function runWithWeChatJssdk(action) {
	const candidates = getSignUrlCandidates();
	let lastError;

	for (const signUrl of candidates) {
		try {
			const wx = await ensureWeChatJssdkReady({ signUrl });
			return await action(wx);
		} catch (error) {
			lastError = error;
			if (!isInvalidSignatureError(error.wechatError || error)) {
				throw error;
			}
			wechatLog('签名 URL 不匹配，尝试下一个', {
				signUrl,
				errMsg: error.wechatError?.errMsg || error.message
			});
			resetWeChatJssdkConfig();
		}
	}

	throw lastError || new Error('微信 JSSDK 签名失败');
}

async function requestWeChatCurrentLocation(wx, options = {}) {
	const coordinateType = options.coordinateType || 'wgs84';

	wechatLog('调用 wx.getLocation', { coordinateType });

	return new Promise((resolve, reject) => {
		wx.getLocation({
			type: coordinateType,
			isHighAccuracy: options.enableHighAccuracy !== false,
			highAccuracyExpireTime: options.timeout || 15000,
			success: (res) => {
				wechatLog('wx.getLocation 成功', res);
				// 安卓微信常返回字符串经纬度，统一转 number，避免后续 .toFixed 报错
				const lng = Number(res.longitude);
				const lat = Number(res.latitude);
				resolve({
					lng,
					lat,
					accuracy: res.accuracy != null ? Number(res.accuracy) : res.accuracy,
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
 * 微信内获取当前位置（需已配置 JSSDK 签名与安全域名）
 */
export function getWeChatCurrentLocation(options = {}) {
	return runWithWeChatJssdk((wx) => requestWeChatCurrentLocation(wx, options));
}

/**
 * 微信内预加载 JSSDK，减少首次点击「到这里去」的等待
 */
export function preloadWeChatJssdk() {
	if (!isWeChatEnv()) return;

	runWithWeChatJssdk(async () => window.wx).catch((error) => {
		wechatLog('预加载失败（首次定位时会重试）', error);
	});
}

async function requestOpenWeChatLocation(wx, poi) {
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
				const error = new Error(err?.errMsg || 'wx.openLocation 失败');
				error.wechatError = err;
				reject(error);
			},
			cancel: () => {
				reject(new Error('用户取消'));
			}
		});
	});
}

/**
 * 调用微信内置地图页（用户可在该页点「导航」再选第三方 App）
 * @param {{ name: string, lng: number, lat: number, address?: string, desc?: string }} poi
 */
export function openWeChatLocation(poi) {
	return runWithWeChatJssdk((wx) => requestOpenWeChatLocation(wx, poi));
}
