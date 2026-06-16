/** @type {number | null} */
let latestHeading = null;

/** @type {number | null} */
let filteredHeading = null;

/** @type {number | null} */
let lastNotifiedHeading = null;

/** @type {Set<(heading: number | null) => void>} */
const listeners = new Set();

/** @type {number} */
let watchRefCount = 0;

/** @type {((event: DeviceOrientationEvent) => void) | null} */
let orientationHandler = null;

/** @type {boolean} */
let rafScheduled = false;

/** @type {number | null} */
let pendingHeading = null;

/** @type {boolean | null} */
let orientationPermissionGranted = null;

/** 低通滤波系数，越小越平滑 */
const SMOOTH_FACTOR = 0.15;

/** 方向变化阈值（度），低于此值不通知订阅者，减少地图箭头抖动 */
const HEADING_THRESHOLD = 2;

/**
 * 将任意角度标准化到 [0, 360) 范围
 * @param {number} value
 * @returns {number | null}
 */
function normalizeHeading(value) {
	if (typeof value !== 'number' || Number.isNaN(value)) {
		return null;
	}

	return ((value % 360) + 360) % 360;
}

/**
 * 计算两个角度之间的最短差值（-180 ~ 180）
 * 用于处理 359° -> 1° 等跨 0° 跳变
 * @param {number} from
 * @param {number} to
 * @returns {number}
 */
function shortestAngleDiff(from, to) {
	let diff = to - from;
	while (diff > 180) {
		diff -= 360;
	}
	while (diff < -180) {
		diff += 360;
	}
	return diff;
}

/**
 * 对设备朝向做低通滤波平滑
 * @param {number | null} current 当前平滑后的朝向
 * @param {number | null} target 新采样朝向
 * @returns {number | null}
 */
function smoothHeading(current, target) {
	if (target == null) {
		return current;
	}
	if (current == null) {
		return normalizeHeading(target);
	}

	const diff = shortestAngleDiff(current, target);
	return normalizeHeading(current + diff * SMOOTH_FACTOR);
}

/**
 * 从 DeviceOrientationEvent 解析设备朝向（度，0=北，顺时针）
 * 优先 webkitCompassHeading（iOS），其次 alpha（Android）
 * @param {DeviceOrientationEvent} event
 * @returns {number | null}
 */
export function resolveDeviceHeading(event) {
	if (!event) {
		return null;
	}

	if (typeof event.webkitCompassHeading === 'number' && !Number.isNaN(event.webkitCompassHeading)) {
		return normalizeHeading(event.webkitCompassHeading);
	}

	if (typeof event.alpha === 'number' && !Number.isNaN(event.alpha)) {
		return normalizeHeading(360 - event.alpha);
	}

	return null;
}

/**
 * 获取最近一次已通知的平滑朝向
 * @returns {number | null}
 */
export function getLatestDeviceHeading() {
	return latestHeading;
}

/**
 * 通过 requestAnimationFrame 统一调度朝向通知，避免高频 DeviceOrientation 事件导致重绘卡顿
 * @param {number} heading
 */
function scheduleHeadingNotify(heading) {
	pendingHeading = heading;

	if (rafScheduled) {
		return;
	}

	rafScheduled = true;

	globalThis.requestAnimationFrame(() => {
		rafScheduled = false;

		const nextHeading = pendingHeading;
		pendingHeading = null;

		if (nextHeading == null) {
			return;
		}

		const shouldSkipNotify =
			lastNotifiedHeading != null &&
			Math.abs(shortestAngleDiff(lastNotifiedHeading, nextHeading)) < HEADING_THRESHOLD;

		latestHeading = nextHeading;

		if (shouldSkipNotify) {
			return;
		}

		lastNotifiedHeading = nextHeading;

		for (const listener of listeners) {
			try {
				listener(nextHeading);
			} catch (error) {
				console.error('[deviceHeading] listener error:', error);
			}
		}
	});
}

/**
 * 绑定全局 DeviceOrientation 事件监听（单例）
 */
function ensureOrientationListeners() {
	if (orientationHandler || typeof window === 'undefined') {
		return;
	}

	orientationHandler = (event) => {
		const rawHeading = resolveDeviceHeading(event);
		if (rawHeading == null) {
			return;
		}

		filteredHeading = smoothHeading(filteredHeading, rawHeading);
		scheduleHeadingNotify(filteredHeading);
	};

	window.addEventListener('deviceorientation', orientationHandler, true);
	window.addEventListener('deviceorientationabsolute', orientationHandler, true);
}

/**
 * 移除全局 DeviceOrientation 事件监听并重置内部状态
 */
function teardownOrientationListeners() {
	if (typeof window === 'undefined' || !orientationHandler) {
		orientationHandler = null;
		return;
	}

	window.removeEventListener('deviceorientation', orientationHandler, true);
	window.removeEventListener('deviceorientationabsolute', orientationHandler, true);
	orientationHandler = null;

	rafScheduled = false;
	pendingHeading = null;
	filteredHeading = null;
	lastNotifiedHeading = null;
	latestHeading = null;
	// 下次点击定位时允许重新评估/申请陀螺仪权限，避免权限状态变化后必须整页刷新
	orientationPermissionGranted = null;
}

/**
 * iOS 13+ 需在用户手势中请求陀螺仪/指南针权限
 * 同时兼容 DeviceOrientationEvent 与 DeviceMotionEvent 的 requestPermission
 * @returns {Promise<boolean>}
 */
export async function ensureDeviceOrientationPermission() {
	if (typeof window === 'undefined') {
		return false;
	}

	if (orientationPermissionGranted === true) {
		return true;
	}

	const OrientationEvent = window.DeviceOrientationEvent;
	const MotionEvent = window.DeviceMotionEvent;

	if (!OrientationEvent && !MotionEvent) {
		orientationPermissionGranted = false;
		return false;
	}

	const needsOrientationPermission =
		OrientationEvent && typeof OrientationEvent.requestPermission === 'function';
	const needsMotionPermission = MotionEvent && typeof MotionEvent.requestPermission === 'function';

	if (!needsOrientationPermission && !needsMotionPermission) {
		orientationPermissionGranted = true;
		return true;
	}

	try {
		if (needsOrientationPermission) {
			const orientationState = await OrientationEvent.requestPermission();
			if (orientationState === 'granted') {
				orientationPermissionGranted = true;
				return true;
			}
		}

		if (needsMotionPermission) {
			const motionState = await MotionEvent.requestPermission();
			orientationPermissionGranted = motionState === 'granted';
			return orientationPermissionGranted;
		}

		orientationPermissionGranted = false;
		return false;
	} catch {
		orientationPermissionGranted = false;
		return false;
	}
}

/**
 * 开始监听设备朝向（多订阅者 + 引用计数）
 * @param {(heading: number | null) => void} [onHeading] 朝向更新回调
 * @returns {() => void} 取消当前订阅的函数
 */
export function startDeviceHeadingWatch(onHeading) {
	if (typeof window === 'undefined') {
		return () => {};
	}

	if (typeof onHeading === 'function') {
		listeners.add(onHeading);
	}

	const isFirstSubscriber = watchRefCount === 0;
	watchRefCount += 1;

	if (isFirstSubscriber) {
		filteredHeading = null;
		lastNotifiedHeading = null;
	}

	ensureOrientationListeners();

	return () => stopDeviceHeadingWatch(onHeading);
}

/**
 * 停止设备朝向监听
 * 传入回调时仅取消该订阅；无参时取消全部订阅
 * @param {(heading: number | null) => void} [onHeading]
 */
export function stopDeviceHeadingWatch(onHeading) {
	if (typeof window === 'undefined') {
		listeners.clear();
		watchRefCount = 0;
		latestHeading = null;
		return;
	}

	if (typeof onHeading === 'function') {
		if (listeners.has(onHeading)) {
			listeners.delete(onHeading);
			watchRefCount = Math.max(0, watchRefCount - 1);
		}
	} else {
		listeners.clear();
		watchRefCount = 0;
	}

	if (watchRefCount === 0) {
		teardownOrientationListeners();
	}
}
