import { isWeChatEnv, getWeChatCurrentLocation } from '../business/nav-demo/utils/wechatJssdk.js';

/** Geolocation 错误码 */
export const LOCATION_ERROR = {
	PERMISSION_DENIED: 1,
	POSITION_UNAVAILABLE: 2,
	TIMEOUT: 3
};

const DEFAULT_OPTIONS = {
	enableHighAccuracy: true,
	timeout: 15000,
	maximumAge: 0
};

/**
 * 当前页面是否处于可调用浏览器 Geolocation 的安全上下文（HTTPS / localhost）。
 */
export function isGeolocationSecureContext() {
	if (typeof window === 'undefined') {
		return false;
	}

	if (window.isSecureContext === true) {
		return true;
	}

	const { hostname, protocol } = window.location;
	if (protocol === 'file:') {
		return true;
	}

	return hostname === 'localhost' || hostname === '127.0.0.1';
}

export function canUseNativeGeolocation() {
	return typeof navigator !== 'undefined' && !!navigator.geolocation && isGeolocationSecureContext();
}

/**
 * 当前环境将使用的定位方式。
 * @returns {'wechat' | 'native' | 'unsupported'}
 */
export function getLocationProvider() {
	if (isWeChatEnv()) {
		return 'wechat';
	}

	return canUseNativeGeolocation() ? 'native' : 'unsupported';
}

/**
 * 查询浏览器定位权限状态。
 * iOS Safari / 微信 / 钉钉等环境可能不支持或返回 unknown，按首次授权处理。
 * @returns {Promise<'granted' | 'prompt' | 'denied' | 'unknown'>}
 */
export async function queryGeolocationPermission() {
	if (getLocationProvider() === 'wechat') {
		return 'unknown';
	}

	if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
		return 'unknown';
	}

	try {
		const result = await navigator.permissions.query({ name: 'geolocation' });
		return result.state || 'unknown';
	} catch {
		return 'unknown';
	}
}

function isInsecureOriginError(error) {
	return (
		error?.reason === 'insecure' ||
		/Origin does not have permission to use Geolocation service/i.test(error?.message || '')
	);
}

/**
 * 将 GeolocationPositionError 转为用户可读文案。
 */
export function getLocationErrorMessage(error) {
	if (!error) {
		return '当前位置获取失败，请稍后重试';
	}

	if (error.reason === 'wechat_jssdk_not_configured') {
		return '微信内定位需配置 JSSDK 签名（public/app-config.js 的 wechat.jssdkSignUrl），并将访问域名加入公众号 JS 接口安全域名。';
	}

	if (isInsecureOriginError(error)) {
		return '当前为 HTTP 访问，iOS/微信浏览器禁止页面定位。请改用 HTTPS 域名访问，或在微信内完成 JSSDK 配置后使用微信定位。';
	}

	if (error.wechatError?.errMsg) {
		const errMsg = error.wechatError.errMsg;
		if (/auth deny|permission denied|authorize no/i.test(errMsg)) {
			return '未获得定位权限，请在微信中允许获取位置信息';
		}
		return `微信定位失败：${errMsg}`;
	}

	switch (error.code) {
		case LOCATION_ERROR.PERMISSION_DENIED:
			return '未获得定位权限';
		case LOCATION_ERROR.TIMEOUT:
			return '定位超时，请检查网络或GPS状态';
		case LOCATION_ERROR.POSITION_UNAVAILABLE:
			return '当前位置获取失败，请稍后重试';
		default:
			return error.message || '当前位置获取失败，请稍后重试';
	}
}

function getNativeCurrentLocation(options = {}) {
	return new Promise((resolve, reject) => {
		if (!canUseNativeGeolocation()) {
			const error = new Error('Origin does not have permission to use Geolocation service');
			error.code = LOCATION_ERROR.PERMISSION_DENIED;
			error.reason = 'insecure';
			reject(error);
			return;
		}

		navigator.geolocation.getCurrentPosition(
			(position) => {
				const { longitude: lng, latitude: lat, accuracy, altitude } = position.coords;
				resolve({
					lng,
					lat,
					accuracy,
					altitude: typeof altitude === 'number' ? altitude : undefined,
					source: 'native'
				});
			},
			(error) => {
				reject(error);
			},
			{ ...DEFAULT_OPTIONS, ...options }
		);
	});
}

/**
 * 获取当前设备经纬度。
 * 微信内优先 wx.getLocation；其他环境使用浏览器 Geolocation（需 HTTPS）。
 * @param {PositionOptions & { coordinateType?: 'gcj02' | 'wgs84' }} [options]
 * @returns {Promise<{ lng: number, lat: number, accuracy?: number, altitude?: number, source: string }>}
 */
export async function getCurrentLocation(options = {}) {
	if (getLocationProvider() === 'wechat') {
		return getWeChatCurrentLocation(options);
	}

	if (typeof navigator === 'undefined' || !navigator.geolocation) {
		throw new Error('当前浏览器不支持定位');
	}

	return getNativeCurrentLocation(options);
}
