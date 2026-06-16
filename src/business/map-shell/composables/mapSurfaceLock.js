import { lockScroll, resetScrollLock, unlockScroll } from '../../../composables/useScrollLock.js';

/** 弹层打开：禁用底图交互并拦截穿透滚动 */
export function lockMapSurface(options = {}) {
	lockScroll({ map: options.map !== false });
}

/** 与 lockMapSurface 配对 */
export function unlockMapSurface(options = {}) {
	unlockScroll({ map: options.map !== false });
}

/** 强制释放所有锁定（页面卸载时） */
export function resetMapSurfaceLock() {
	resetScrollLock();
}
