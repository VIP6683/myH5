import {
	lockMapCameraInteraction,
	unlockMapCameraInteraction,
	getMapInstance
} from '../map-kit/mapApi.js';

const MAP_HOST_LOCK_CLASS = 'map-host--interaction-locked';
const BODY_LOCK_CLASS = 'is-scroll-locked';

/** 弹层内允许滚动的区域（不含页面背景列表） */
const SCROLL_ALLOW_SELECTOR = [
	'.draggable-bottom-sheet__body',
	'.map-verify-form-sheet__scroll',
	'[data-bottom-sheet-scroll]',
	'.map-patch-list-sheet__table-wrap',
	'.map-feature-detail-sheet__list',
	'.map-filter-panel__body',
	'.map-modal-card__body',
	'.year-picker-sheet__wheel'
].join(',');

/** 识别弹层根节点，用于遮罩区拦截滚动 */
const OVERLAY_SELECTOR = [
	'.draggable-bottom-sheet',
	'.map-verify-form-sheet',
	'.map-feature-detail-sheet',
	'.nav-action-sheet',
	'.map-modal',
	'.year-picker-sheet',
	'.map-top-bar__filter-wrap'
].join(',');

/** 弹层打开时需要冻结滚动的页面背景区域 */
const BACKGROUND_FREEZE_SELECTORS = ['.map-data-stats-panel__table-wrap'];

let lockDepth = 0;
let mapLockDepth = 0;
let savedBodyState = null;
let savedHtmlOverflow = '';
let frozenBackgroundStates = [];
let lastTouchY = null;
let lastTouchX = null;
let guardsBound = false;

function shouldUseFixedBodyLock() {
	const ua = navigator.userAgent || '';
	return /iP(hone|od|ad)/i.test(ua) || /MicroMessenger|wxwork/i.test(ua);
}

function lockBody() {
	const body = document.body;
	const html = document.documentElement;

	savedBodyState = {
		overflow: body.style.overflow,
		overflowX: body.style.overflowX,
		position: body.style.position,
		top: body.style.top,
		left: body.style.left,
		right: body.style.right,
		width: body.style.width,
		scrollTop: window.scrollY || html.scrollTop || 0
	};
	savedHtmlOverflow = html.style.overflow;

	body.classList.add(BODY_LOCK_CLASS);

	if (shouldUseFixedBodyLock()) {
		body.style.position = 'fixed';
		body.style.top = `-${savedBodyState.scrollTop}px`;
		body.style.left = '0';
		body.style.right = '0';
		body.style.width = '100%';
		body.style.overflow = 'hidden';
	} else {
		body.style.overflow = 'hidden';
		body.style.overflowX = 'hidden';
		html.style.overflow = 'hidden';
	}
}

function unlockBody() {
	const body = document.body;
	const html = document.documentElement;

	if (!savedBodyState) {
		body.classList.remove(BODY_LOCK_CLASS);
		return;
	}

	const { scrollTop, overflow, overflowX, position, top, left, right, width } = savedBodyState;

	body.style.overflow = overflow;
	body.style.overflowX = overflowX;
	body.style.position = position;
	body.style.top = top;
	body.style.left = left;
	body.style.right = right;
	body.style.width = width;
	html.style.overflow = savedHtmlOverflow;
	body.classList.remove(BODY_LOCK_CLASS);

	if (shouldUseFixedBodyLock()) {
		window.scrollTo(0, scrollTop);
	}

	savedBodyState = null;
	savedHtmlOverflow = '';
}

function freezeBackgroundScrollers() {
	frozenBackgroundStates = [];

	for (const selector of BACKGROUND_FREEZE_SELECTORS) {
		document.querySelectorAll(selector).forEach((el) => {
			frozenBackgroundStates.push({
				el,
				scrollTop: el.scrollTop,
				overflow: el.style.overflow,
				pointerEvents: el.style.pointerEvents,
				touchAction: el.style.touchAction
			});

			el.style.overflow = 'hidden';
			el.style.pointerEvents = 'none';
			el.style.touchAction = 'none';
		});
	}
}

function restoreBackgroundScrollers() {
	for (const state of frozenBackgroundStates) {
		const { el, scrollTop, overflow, pointerEvents, touchAction } = state;
		el.style.overflow = overflow;
		el.style.pointerEvents = pointerEvents;
		el.style.touchAction = touchAction;
		el.scrollTop = scrollTop;
	}
	frozenBackgroundStates = [];
}

function resolveMapHost() {
	const viewerContainer = getMapInstance()?.viewer?.container || getMapInstance()?.container;
	return viewerContainer?.closest?.('.mapHost') || document.querySelector('.mapHost');
}

function lockMapHost() {
	resolveMapHost()?.classList.add(MAP_HOST_LOCK_CLASS);
	lockMapCameraInteraction();
}

function unlockMapHost() {
	unlockMapCameraInteraction();
	resolveMapHost()?.classList.remove(MAP_HOST_LOCK_CLASS);
}

function findScrollableAncestor(target) {
	let el = target;

	while (el && el !== document.documentElement) {
		if (!el.matches?.(SCROLL_ALLOW_SELECTOR)) {
			el = el.parentElement;
			continue;
		}

		const { overflowY } = getComputedStyle(el);
		const canScrollY =
			(overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
			el.scrollHeight > el.clientHeight + 1;

		if (canScrollY) {
			return el;
		}

		el = el.parentElement;
	}

	return null;
}

function isInsideOverlay(target) {
	return Boolean(target?.closest?.(OVERLAY_SELECTOR));
}

function isMapInteractionTarget(target) {
	return Boolean(
		target?.closest?.('.mapHost, .mars3d-container, .leaflet-container')
	);
}

function canScrollElement(el, deltaY) {
	if (!el || el.scrollHeight <= el.clientHeight + 1) {
		return false;
	}

	const { scrollTop, scrollHeight, clientHeight } = el;

	if (deltaY < 0) {
		return scrollTop > 0;
	}

	if (deltaY > 0) {
		return scrollTop + clientHeight < scrollHeight - 1;
	}

	return false;
}

function handleTouchStart(event) {
	lastTouchY = event.touches[0]?.clientY ?? null;
	lastTouchX = event.touches[0]?.clientX ?? null;
}

function handleTouchMove(event) {
	const touch = event.touches[0];

	if (touch && lastTouchX != null && lastTouchY != null && isInsideOverlay(event.target)) {
		const dx = Math.abs(touch.clientX - lastTouchX);
		const dy = Math.abs(touch.clientY - lastTouchY);

		if (dx > dy && dx > 4) {
			event.preventDefault();
			return;
		}
	}

	const scrollEl = findScrollableAncestor(event.target);

	if (scrollEl) {
		if (scrollEl.scrollHeight <= scrollEl.clientHeight + 1) {
			event.preventDefault();
			return;
		}

		const currentY = event.touches[0]?.clientY;
		if (currentY == null || lastTouchY == null) {
			return;
		}

		const dy = currentY - lastTouchY;
		lastTouchY = currentY;
		lastTouchX = event.touches[0]?.clientX ?? lastTouchX;

		const atTop = scrollEl.scrollTop <= 0;
		const atBottom = scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 1;

		if ((dy > 0 && atTop) || (dy < 0 && atBottom)) {
			event.preventDefault();
		}

		return;
	}

	if (isInsideOverlay(event.target) || lockDepth > 0) {
		if (isMapInteractionTarget(event.target)) {
			return;
		}
		event.preventDefault();
	}
}

function handleWheel(event) {
	const scrollEl = findScrollableAncestor(event.target);

	if (scrollEl && canScrollElement(scrollEl, event.deltaY)) {
		event.stopPropagation();
		return;
	}

	if (isInsideOverlay(event.target) || lockDepth > 0) {
		if (isMapInteractionTarget(event.target)) {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
	}
}

function handleTouchEnd() {
	lastTouchY = null;
	lastTouchX = null;
}

function bindDocumentGuards() {
	if (guardsBound) {
		return;
	}

	document.addEventListener('touchstart', handleTouchStart, { passive: true, capture: true });
	document.addEventListener('touchmove', handleTouchMove, { passive: false, capture: true });
	document.addEventListener('touchend', handleTouchEnd, { passive: true, capture: true });
	document.addEventListener('touchcancel', handleTouchEnd, { passive: true, capture: true });
	document.addEventListener('wheel', handleWheel, { passive: false, capture: true });
	guardsBound = true;
}

function unbindDocumentGuards() {
	if (!guardsBound) {
		return;
	}

	document.removeEventListener('touchstart', handleTouchStart, { capture: true });
	document.removeEventListener('touchmove', handleTouchMove, { capture: true });
	document.removeEventListener('touchend', handleTouchEnd, { capture: true });
	document.removeEventListener('touchcancel', handleTouchEnd, { capture: true });
	document.removeEventListener('wheel', handleWheel, { capture: true });
	guardsBound = false;
	lastTouchY = null;
	lastTouchX = null;
}

/**
 * 锁定页面滚动（引用计数）。弹层打开时调用，关闭时配对 unlockScroll。
 * @param {{ map?: boolean }} options map=true 时同时锁定地图交互
 */
export function lockScroll(options = {}) {
	const lockMap = options.map === true;

	if (lockDepth === 0) {
		lockBody();
		freezeBackgroundScrollers();
		bindDocumentGuards();
	}

	if (lockMap) {
		if (mapLockDepth === 0) {
			lockMapHost();
		}
		mapLockDepth += 1;
	}

	lockDepth += 1;
}

/** 与 lockScroll 配对 */
export function unlockScroll(options = {}) {
	const unlockMap = options.map === true;

	if (lockDepth <= 0) {
		return;
	}

	lockDepth -= 1;

	if (unlockMap && mapLockDepth > 0) {
		mapLockDepth -= 1;
		if (mapLockDepth === 0) {
			unlockMapHost();
		}
	}

	if (lockDepth === 0) {
		unbindDocumentGuards();
		restoreBackgroundScrollers();
		unlockBody();
		mapLockDepth = 0;
		unlockMapHost();
	}
}

/** 页面卸载时强制释放所有锁定 */
export function resetScrollLock() {
	lockDepth = 0;
	mapLockDepth = 0;
	unbindDocumentGuards();
	restoreBackgroundScrollers();
	unlockBody();
	unlockMapHost();
}

export function isScrollLocked() {
	return lockDepth > 0;
}
