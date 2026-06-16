import { isWeChatEnv, openWeChatLocation } from './wechatJssdk.js';

const LOG_PREFIX = '[NavMap]';

/**
 * 检测运行环境
 */
export function detectNavEnv() {
	const ua = navigator.userAgent || '';

	const isIOS = /iPhone|iPad|iPod/i.test(ua);
	const isAndroid = /Android/i.test(ua);
	const isWeChat = /MicroMessenger/i.test(ua);
	const isSafari = /Safari/i.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS/i.test(ua);

	return {
		ua,
		isIOS,
		isAndroid,
		isWeChat,
		isSafari,
		platform: isIOS ? 'iOS' : isAndroid ? 'Android' : 'other'
	};
}

function navLog(label, data) {
	if (data !== undefined) {
		console.log(`${LOG_PREFIX} ${label}`, data);
	} else {
		console.log(`${LOG_PREFIX} ${label}`);
	}
}

/**
 * 构建各地图 App 的唤起 URL（GCJ02 坐标，路线规划页，非直接开始导航）
 * @param {{ name: string, lng: number, lat: number }} poi
 * @param {ReturnType<typeof detectNavEnv>} [env]
 */
export function buildMapNavUrls(poi, env = detectNavEnv()) {
	const { name, lng, lat } = poi;
	const encodedName = encodeURIComponent(name);
	const src = env.isIOS ? 'ios' : 'andr';

	// 高德：path / route = 路线规划（展示方案 +「开始导航」）；navi = 直接导航
	const gaodeNative = env.isIOS
		? `iosamap://path?sourceApplication=myH5App&sid=&sname=&slat=&slon=&did=&dname=${encodedName}&dlat=${lat}&dlon=${lng}&dev=0&t=0`
		: `androidamap://route?sourceApplication=myH5App&slat=&slon=&sname=&did=&dname=${encodedName}&dlat=${lat}&dlon=${lng}&dev=0&t=0`;

	// 百度：direction = 路线规划；navi = 直接导航
	const baiduNative = `baidumap://map/direction?destination=name:${encodedName}|latlng:${lat},${lng}&coord_type=gcj02&mode=driving&src=${src}.myH5App`;

	// 腾讯：routeplan = 路线规划；fromcoord=CurrentLocation 表示起点为「我的位置」
	const tencentNative = `qqmap://map/routeplan?type=drive&fromcoord=CurrentLocation&to=${encodedName}&tocoord=${lat},${lng}&referer=myH5App`;

	return {
		gaode: {
			native: gaodeNative,
			web: `https://uri.amap.com/navigation?to=${lng},${lat},${encodedName}&mode=car&policy=1&src=myH5App&coordinate=gaode`
		},
		baidu: {
			native: baiduNative,
			web: `https://api.map.baidu.com/direction?destination=latlng:${lat},${lng}|name:${encodedName}&coord_type=gcj02&mode=driving&output=html&src=myH5App`
		},
		tencent: {
			native: tencentNative,
			web: `https://apis.map.qq.com/uri/v1/routeplan?type=drive&fromcoord=CurrentLocation&to=${encodedName}&tocoord=${lat},${lng}&referer=myH5App`
		}
	};
}

/**
 * 尝试唤起原生地图 App；页面未切后台时再 fallback 网页版
 * @param {'gaode'|'baidu'|'tencent'} mapId
 * @param {{ name: string, lng: number, lat: number }} poi
 */
export function openMapApp(mapId, poi) {
	const env = detectNavEnv();
	const urls = buildMapNavUrls(poi, env)[mapId];

	if (!urls) {
		navLog('错误：未知地图类型', mapId);
		return;
	}

	const { native, web } = urls;
	const fallbackDelay = env.isIOS ? 2500 : 2000;

	navLog('========== 开始唤起地图 ==========');
	navLog('环境', {
		platform: env.platform,
		isIOS: env.isIOS,
		isAndroid: env.isAndroid,
		isWeChat: env.isWeChat,
		isSafari: env.isSafari
	});
	navLog('目的地', { mapId, name: poi.name, lng: poi.lng, lat: poi.lat });
	navLog('打开模式', '路线规划（展示方案，需用户手动点「开始导航」）');
	navLog('Native Scheme URL', native);
	navLog('Web Fallback URL', web);
	navLog('Fallback 延迟 (ms)', fallbackDelay);

	if (env.isWeChat) {
		navLog('⚠️ 微信内置浏览器通常会拦截自定义 Scheme，可能无法直接唤起 App');
	}

	let appLikelyOpened = false;
	const startAt = Date.now();

	const markAppOpened = (reason) => {
		if (appLikelyOpened) return;
		appLikelyOpened = true;
		navLog(`✅ 判定 App 已唤起（${reason}）`, { elapsed: `${Date.now() - startAt}ms` });
	};

	const onVisibilityChange = () => {
		if (document.hidden) {
			markAppOpened('visibilitychange → hidden');
		}
	};

	const onPageHide = () => markAppOpened('pagehide');
	const onBlur = () => markAppOpened('window blur');

	document.addEventListener('visibilitychange', onVisibilityChange);
	window.addEventListener('pagehide', onPageHide);
	window.addEventListener('blur', onBlur);

	const cleanup = () => {
		document.removeEventListener('visibilitychange', onVisibilityChange);
		window.removeEventListener('pagehide', onPageHide);
		window.removeEventListener('blur', onBlur);
	};

	navLog('唤起方式', env.isIOS ? 'location.href（iOS 用户手势直跳 Scheme）' : 'location.href');

	try {
		window.location.href = native;
		navLog('已执行 location.href = native');
	} catch (err) {
		navLog('❌ location.href 执行异常', err);
	}

	const fallbackTimer = setTimeout(() => {
		cleanup();

		if (appLikelyOpened) {
			navLog('跳过 Web Fallback（App 疑似已打开）');
			navLog('========== 唤起流程结束 ==========');
			return;
		}

		navLog('⏱️ 超时未检测到页面切后台，执行 Web Fallback', {
			elapsed: `${Date.now() - startAt}ms`,
			documentHidden: document.hidden
		});
		navLog('正在跳转网页版…', web);

		try {
			window.location.href = web;
		} catch (err) {
			navLog('❌ Web Fallback 跳转异常', err);
		}

		navLog('========== 唤起流程结束 ==========');
	}, fallbackDelay);

	// 若 App 已打开，提前清理定时器
	const checkInterval = setInterval(() => {
		if (appLikelyOpened) {
			clearInterval(checkInterval);
			clearTimeout(fallbackTimer);
			cleanup();
			navLog('========== 唤起流程结束 ==========');
		}
	}, 200);
}

/**
 * 统一导航入口：微信内直接打开微信地图页，其他环境回退到地图 App 选择面板
 * @param {{ name: string, lng: number, lat: number, address?: string, desc?: string }} poi
 * @returns {Promise<'wechat' | 'fallback'>}
 */
export async function openNavDestination(poi) {
	if (!poi) {
		return 'fallback';
	}

	if (isWeChatEnv()) {
		navLog('微信环境：调用 wx.openLocation');
		try {
			await openWeChatLocation(poi);
			return 'wechat';
		} catch (error) {
			navLog('微信导航失败，回退到地图 App 选择', error);
			return 'fallback';
		}
	}

	return 'fallback';
}
