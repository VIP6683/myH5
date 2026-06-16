/** @type {number | null} */
let latestHeading = null;

/** @type {((heading: number | null) => void) | null} */
let headingListener = null;

/** @type {((event: DeviceOrientationEvent) => void) | null} */
let orientationHandler = null;

function normalizeHeading(value) {
	if (typeof value !== 'number' || Number.isNaN(value)) {
		return null;
	}

	return ((value % 360) + 360) % 360;
}

/**
 * 从 DeviceOrientationEvent 解析设备朝向（度，0=北，顺时针）
 * @param {DeviceOrientationEvent} event
 */
export function resolveDeviceHeading(event) {
	if (!event) {
		return null;
	}

	if (typeof event.webkitCompassHeading === 'number' && !Number.isNaN(event.webkitCompassHeading)) {
		return normalizeHeading(event.webkitCompassHeading);
	}

	if (typeof event.alpha === 'number' && !Number.isNaN(event.alpha)) {
		const beta = typeof event.beta === 'number' ? event.beta : 90;
		if (Math.abs(beta) > 45) {
			return null;
		}
		return normalizeHeading(360 - event.alpha);
	}

	return null;
}

export function getLatestDeviceHeading() {
	return latestHeading;
}

/**
 * iOS 13+ 需在用户手势中请求陀螺仪/指南针权限
 */
export async function ensureDeviceOrientationPermission() {
	if (typeof window === 'undefined') {
		return false;
	}

	const OrientationEvent = window.DeviceOrientationEvent;
	if (!OrientationEvent) {
		return false;
	}

	if (typeof OrientationEvent.requestPermission !== 'function') {
		return true;
	}

	try {
		const state = await OrientationEvent.requestPermission();
		return state === 'granted';
	} catch {
		return false;
	}
}

/**
 * 开始监听设备朝向
 * @param {(heading: number | null) => void} [onHeading]
 */
export function startDeviceHeadingWatch(onHeading) {
	if (typeof window === 'undefined') {
		return () => {};
	}

	headingListener = typeof onHeading === 'function' ? onHeading : null;

	if (!orientationHandler) {
		orientationHandler = (event) => {
			const heading = resolveDeviceHeading(event);
			if (heading == null) {
				return;
			}

			latestHeading = heading;
			headingListener?.(heading);
		};

		window.addEventListener('deviceorientation', orientationHandler, true);
		window.addEventListener('deviceorientationabsolute', orientationHandler, true);
	}

	return stopDeviceHeadingWatch;
}

export function stopDeviceHeadingWatch() {
	if (typeof window === 'undefined') {
		headingListener = null;
		latestHeading = null;
		return;
	}

	if (orientationHandler) {
		window.removeEventListener('deviceorientation', orientationHandler, true);
		window.removeEventListener('deviceorientationabsolute', orientationHandler, true);
		orientationHandler = null;
	}

	headingListener = null;
	latestHeading = null;
}
