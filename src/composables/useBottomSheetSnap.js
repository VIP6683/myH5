import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const DRAG_THRESHOLD = 8;
const SNAP_VELOCITY = 0.45;
const INNER_SCROLL_SELECTOR = '[data-bottom-sheet-scroll]';

function resolveBodyScrollEl(bodyEl) {
	if (!bodyEl) {
		return null;
	}

	const delegated = bodyEl.querySelector(INNER_SCROLL_SELECTOR);
	return delegated || bodyEl;
}

function isInnerScrollTarget(bodyEl, target) {
	const scrollEl = resolveBodyScrollEl(bodyEl);
	return Boolean(scrollEl && scrollEl !== bodyEl && scrollEl.contains(target));
}

function resolveLength(value, referencePx) {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value;
	}

	const text = String(value ?? '').trim();
	if (!text) {
		return 0;
	}

	if (text.endsWith('vh')) {
		return (parseFloat(text) / 100) * referencePx;
	}
	if (text.endsWith('vw')) {
		return (parseFloat(text) / 100) * window.innerWidth;
	}
	if (text.endsWith('px')) {
		return parseFloat(text);
	}
	if (text.endsWith('%')) {
		return (parseFloat(text) / 100) * referencePx;
	}

	const parsed = parseFloat(text);
	return Number.isFinite(parsed) ? parsed : 0;
}

function getViewportHeight() {
	return window.visualViewport?.height ?? window.innerHeight;
}

function getAppContentEl() {
	if (typeof document === 'undefined') {
		return null;
	}
	return document.getElementById('app-content');
}

function getSheetViewportHeight() {
	const contentEl = getAppContentEl();
	if (contentEl) {
		const height = contentEl.getBoundingClientRect().height;
		if (height > 0) {
			return height;
		}
	}
	return getViewportHeight();
}

function resolveSheetTopInset(value, viewportHeight) {
	if (getAppContentEl()) {
		return 0;
	}
	return resolveTopInset(value, viewportHeight);
}

function measureSafeAreaTop() {
	if (typeof document === 'undefined') {
		return 0;
	}

	const probe = document.createElement('div');
	probe.style.cssText =
		'position:fixed;top:0;left:0;padding-top:env(safe-area-inset-top,0px);visibility:hidden;pointer-events:none;';
	document.body.appendChild(probe);
	const inset = parseFloat(getComputedStyle(probe).paddingTop) || 0;
	document.body.removeChild(probe);
	return inset;
}

function resolveTopInset(value, viewportHeight) {
	const text = String(value ?? '').trim();
	if (text.includes('safe-area-inset-top')) {
		return measureSafeAreaTop();
	}
	return resolveLength(value, viewportHeight);
}

function measureSafeAreaBottom() {
	if (typeof document === 'undefined') {
		return 0;
	}

	const probe = document.createElement('div');
	probe.style.cssText =
		'position:fixed;bottom:0;left:0;padding-bottom:env(safe-area-inset-bottom,0px);visibility:hidden;pointer-events:none;';
	document.body.appendChild(probe);
	const inset = parseFloat(getComputedStyle(probe).paddingBottom) || 0;
	document.body.removeChild(probe);
	return inset;
}

function measureTabBarBottomOffset() {
	if (typeof document === 'undefined') {
		return 0;
	}

	const tabBar = document.querySelector('.map-floating-tab-bar-wrap');
	if (!tabBar) {
		return 52 + measureSafeAreaBottom();
	}

	const style = getComputedStyle(tabBar);
	if (parseFloat(style.opacity) === 0) {
		return 0;
	}

	const rect = tabBar.getBoundingClientRect();
	if (rect.height <= 0) {
		return 52 + measureSafeAreaBottom();
	}

	const vv = window.visualViewport;
	const visualBottom = (vv?.offsetTop ?? 0) + (vv?.height ?? window.innerHeight);
	return Math.max(0, Math.round(visualBottom - rect.top));
}

function resolveBottomInset(value, viewportHeight) {
	const text = String(value ?? '').trim();
	if (getAppContentEl() && (text === 'tab-bar' || text.includes('tab-bar'))) {
		return 0;
	}
	if (!text || text === 'tab-bar') {
		return text === 'tab-bar' ? measureTabBarBottomOffset() : 0;
	}

	if (
		text.includes('tab-bar') ||
		text.includes('--app-tab-bar') ||
		text.includes('calc') ||
		text.includes('safe-area-inset-bottom')
	) {
		return measureTabBarBottomOffset();
	}

	return resolveLength(value, viewportHeight);
}

function measureCollapsedHeight(panelEl, fallback) {
	const handleWrap = panelEl?.querySelector?.('[data-bottom-sheet-handle]');
	if (!handleWrap) {
		return fallback;
	}

	const height = handleWrap.getBoundingClientRect().height;
	return height > 0 ? height : fallback;
}

function getSnapHeightPx(level, { collapsedHeightPx, peekHeightPx, expandedHeightPx }) {
	if (level === 'collapsed') {
		return collapsedHeightPx;
	}
	if (level === 'peek') {
		return peekHeightPx;
	}
	return expandedHeightPx;
}

const SNAP_LEVELS = ['collapsed', 'peek', 'expanded'];

function stepSnapLevel(currentLevel, direction) {
	const index = SNAP_LEVELS.indexOf(currentLevel);
	if (index < 0) {
		return direction > 0 ? 'peek' : 'collapsed';
	}

	const nextIndex = Math.max(0, Math.min(SNAP_LEVELS.length - 1, index + direction));
	return SNAP_LEVELS[nextIndex];
}

function resolveSnapLevel(snapRef, expandedRef, tripleSnap) {
	if (tripleSnap) {
		return snapRef.value;
	}
	return expandedRef.value ? 'expanded' : 'peek';
}

/**
 * 底部抽屉吸附逻辑：双档（半屏 / 全屏）或三档（折叠 / 半屏 / 全屏）
 */
export function useBottomSheetSnap(options) {
	const expanded = options.expanded;
	const snap = options.snap;
	const tripleSnap = options.tripleSnap ?? false;
	const dragSurface = options.dragSurface ?? 'auto';
	const peekHeight = options.peekHeight;
	const collapsedHeight = options.collapsedHeight;
	const topInset = options.topInset;
	const bottomInset = options.bottomInset;
	const enabled = options.enabled ?? ref(true);

	const panelRef = ref(null);
	const bodyRef = ref(null);
	const headerRef = ref(null);
	const handleRef = ref(null);

	const isDragging = ref(false);
	const dragOffsetPx = ref(0);
	const metrics = ref({
		expandedHeightPx: 0,
		peekHeightPx: 0,
		collapsedHeightPx: 0,
		peekOffsetPx: 0,
		collapsedOffsetPx: 0
	});

	let touchStartY = 0;
	let touchStartTime = 0;
	let dragMode = null;
	let dragFromHandle = false;
	let dragFromInnerScroll = false;
	let activePointerId = null;

	let snapAtDragStart = 'collapsed';

	const recalcMetrics = () => {
		const viewportHeight = getSheetViewportHeight();
		const topPx = resolveSheetTopInset(topInset?.value ?? topInset ?? 0, viewportHeight);
		const bottomPx = resolveBottomInset(bottomInset?.value ?? bottomInset ?? 0, viewportHeight);
		const expandedHeightPx = Math.max(0, viewportHeight - topPx - bottomPx);
		const peekHeightPx = Math.min(
			resolveLength(peekHeight?.value ?? peekHeight ?? '42vh', viewportHeight),
			expandedHeightPx
		);
		const collapsedFallback = resolveLength(
			collapsedHeight?.value ?? collapsedHeight ?? 20,
			viewportHeight
		);
		const collapsedHeightPx = tripleSnap
			? Math.min(measureCollapsedHeight(panelRef.value, collapsedFallback), expandedHeightPx)
			: peekHeightPx;
		const peekOffsetPx = Math.max(0, expandedHeightPx - peekHeightPx);
		const collapsedOffsetPx = tripleSnap
			? Math.max(0, expandedHeightPx - collapsedHeightPx)
			: peekOffsetPx;

		metrics.value = {
			expandedHeightPx,
			peekHeightPx,
			collapsedHeightPx,
			peekOffsetPx,
			collapsedOffsetPx
		};
	};

	const baseOffsetPx = computed(() => {
		const { peekOffsetPx, collapsedOffsetPx } = metrics.value;

		if (tripleSnap) {
			const level = snap.value;
			if (level === 'expanded') {
				return 0;
			}
			if (level === 'peek') {
				return peekOffsetPx;
			}
			return collapsedOffsetPx;
		}

		return expanded.value ? 0 : collapsedOffsetPx;
	});

	const translateYPx = computed(() => {
		const maxOffset = metrics.value.expandedHeightPx;
		const next = baseOffsetPx.value + dragOffsetPx.value;
		return Math.max(0, Math.min(maxOffset, next));
	});

	const panelStyle = computed(() => {
		const viewportHeight = getSheetViewportHeight();
		const topPx = resolveSheetTopInset(topInset?.value ?? topInset ?? 0, viewportHeight);
		const level = tripleSnap ? snap.value : expanded.value ? 'expanded' : 'peek';
		const insetBottomPx = resolveBottomInset(
			bottomInset?.value ?? bottomInset ?? 0,
			viewportHeight
		);
		const fullExpandedHeightPx = Math.max(0, viewportHeight - topPx);
		const { collapsedHeightPx, peekHeightPx } = metrics.value;
		const useDocked =
			tripleSnap &&
			insetBottomPx > 0 &&
			(level !== 'expanded' || (isDragging.value && snapAtDragStart !== 'expanded'));

		if (useDocked) {
			if (isDragging.value) {
				const startHeight = getSnapHeightPx(snapAtDragStart, {
					collapsedHeightPx,
					peekHeightPx,
					expandedHeightPx: fullExpandedHeightPx
				});
				const nextHeight = Math.max(
					collapsedHeightPx,
					Math.min(fullExpandedHeightPx, startHeight - dragOffsetPx.value)
				);
				const isNearlyExpanded = nextHeight >= fullExpandedHeightPx * 0.92;

				return {
					height: `${Math.round(isNearlyExpanded ? fullExpandedHeightPx : nextHeight)}px`,
					bottom: `${Math.round(isNearlyExpanded ? 0 : insetBottomPx)}px`,
					transform: 'translate3d(0, 0, 0)'
				};
			}

			const heightPx = level === 'collapsed' ? collapsedHeightPx : peekHeightPx;

			return {
				height: `${Math.round(heightPx)}px`,
				bottom: `${Math.round(insetBottomPx)}px`,
				transform: 'translate3d(0, 0, 0)'
			};
		}

		const bottomPx = level === 'expanded' ? 0 : insetBottomPx;
		const expandedHeightPx = Math.max(0, viewportHeight - topPx - bottomPx);

		return {
			height: `${Math.round(expandedHeightPx)}px`,
			bottom: `${Math.round(bottomPx)}px`,
			transform: `translate3d(0, ${Math.round(translateYPx.value)}px, 0)`
		};
	});

	const resetDrag = () => {
		isDragging.value = false;
		dragOffsetPx.value = 0;
		dragMode = null;
		dragFromHandle = false;
		dragFromInnerScroll = false;
		activePointerId = null;
	};

	const snapDual = (velocity, offset, peekOffsetPx) => {
		if (velocity > SNAP_VELOCITY) {
			expanded.value = false;
		} else if (velocity < -SNAP_VELOCITY) {
			expanded.value = true;
		} else if (offset > peekOffsetPx * 0.45) {
			expanded.value = false;
		} else if (offset < peekOffsetPx * 0.55) {
			expanded.value = true;
		}
	};

	const snapTriple = (velocity, offset, startLevel) => {
		const { peekOffsetPx, collapsedOffsetPx } = metrics.value;

		if (velocity < -SNAP_VELOCITY) {
			snap.value = stepSnapLevel(startLevel, 1);
			return;
		}

		if (velocity > SNAP_VELOCITY) {
			snap.value = stepSnapLevel(startLevel, -1);
			return;
		}

		const boundaryExpandedPeek = peekOffsetPx * 0.5;
		const boundaryPeekCollapsed = peekOffsetPx + (collapsedOffsetPx - peekOffsetPx) * 0.5;

		if (offset <= boundaryExpandedPeek) {
			snap.value = 'expanded';
		} else if (offset <= boundaryPeekCollapsed) {
			snap.value = 'peek';
		} else {
			snap.value = 'collapsed';
		}
	};

	const snapTripleDocked = (velocity) => {
		const viewportHeight = getSheetViewportHeight();
		const topPx = resolveSheetTopInset(topInset?.value ?? topInset ?? 0, viewportHeight);
		const fullHeight = viewportHeight - topPx;
		const { collapsedHeightPx, peekHeightPx } = metrics.value;
		const startHeight = getSnapHeightPx(snapAtDragStart, {
			collapsedHeightPx,
			peekHeightPx,
			expandedHeightPx: fullHeight
		});
		const currentHeight = Math.max(
			collapsedHeightPx,
			Math.min(fullHeight, startHeight - dragOffsetPx.value)
		);

		if (velocity < -SNAP_VELOCITY) {
			if (snapAtDragStart === 'collapsed') {
				snap.value = 'peek';
			} else if (snapAtDragStart === 'peek') {
				snap.value = 'expanded';
			}
			return;
		}

		if (velocity > SNAP_VELOCITY) {
			if (snapAtDragStart === 'peek') {
				snap.value = 'collapsed';
			} else if (snapAtDragStart === 'expanded') {
				snap.value = 'peek';
			}
			return;
		}

		const expandBoundary = (fullHeight + peekHeightPx) * 0.5;
		const peekBoundary = (peekHeightPx + collapsedHeightPx) * 0.5;

		if (currentHeight >= expandBoundary) {
			snap.value = 'expanded';
		} else if (currentHeight >= peekBoundary) {
			snap.value = 'peek';
		} else {
			snap.value = 'collapsed';
		}
	};

	const snapToNearest = (velocity) => {
		const viewportHeight = getViewportHeight();
		const insetBottomPx = resolveBottomInset(
			bottomInset?.value ?? bottomInset ?? 0,
			viewportHeight
		);
		const dockedDrag = tripleSnap && insetBottomPx > 0 && snapAtDragStart !== 'expanded';

		if (dockedDrag) {
			snapTripleDocked(velocity);
			resetDrag();
			return;
		}

		const offset = translateYPx.value;

		if (tripleSnap) {
			snapTriple(velocity, offset, snapAtDragStart);
		} else {
			snapDual(velocity, offset, metrics.value.peekOffsetPx);
		}

		resetDrag();
	};

	const isInteractiveTarget = (target) =>
		Boolean(
			target?.closest?.(
				'button, a, input, textarea, select, label, [contenteditable="true"], [data-no-sheet-drag]'
			)
		);

	const canStartSheetDrag = (target) => {
		const headerEl = headerRef.value;
		const handleEl = panelRef.value?.querySelector('[data-bottom-sheet-handle]');
		return Boolean(handleEl?.contains(target) || headerEl?.contains(target));
	};

	const isHeaderOnlyDrag = () => (dragSurface?.value ?? dragSurface) === 'header';

	const shouldDragSheet = (dy) => {
		const bodyEl = bodyRef.value;
		const scrollEl = resolveBodyScrollEl(bodyEl);
		const level = resolveSnapLevel(snap, expanded, tripleSnap);

		if (dragFromHandle) {
			return true;
		}

		// Gestures that start inside the delegated scroll area always prefer
		// native scrolling. Collapse/expand the sheet via the handle or header.
		if (dragFromInnerScroll) {
			return false;
		}

		if (level !== 'expanded' && dy < 0) {
			return true;
		}

		if (level === 'expanded' && scrollEl && scrollEl.scrollTop <= 0 && dy > 0) {
			return true;
		}

		return false;
	};

	const onPointerDown = (event) => {
		if (!enabled.value || activePointerId != null) {
			return;
		}

		if (isInteractiveTarget(event.target)) {
			return;
		}

		const bodyEl = bodyRef.value;
		const collapsedLevel = tripleSnap && snap.value === 'collapsed';
		dragFromHandle = canStartSheetDrag(event.target) || collapsedLevel;
		dragFromInnerScroll = isInnerScrollTarget(bodyEl, event.target);

		if (isHeaderOnlyDrag() && !dragFromHandle) {
			return;
		}

		if (!dragFromHandle && dragFromInnerScroll) {
			return;
		}

		touchStartY = event.clientY;
		touchStartTime = Date.now();
		snapAtDragStart = tripleSnap ? snap.value : expanded.value ? 'expanded' : 'peek';
		dragMode = null;
		activePointerId = event.pointerId;
		isDragging.value = false;

		event.currentTarget?.setPointerCapture?.(event.pointerId);
	};

	const onPointerMove = (event) => {
		if (!enabled.value || event.pointerId !== activePointerId) {
			return;
		}

		const dy = event.clientY - touchStartY;

		if (dragMode === 'scroll') {
			return;
		}

		if (dragMode == null) {
			if (Math.abs(dy) < DRAG_THRESHOLD) {
				return;
			}

			if (shouldDragSheet(dy)) {
				dragMode = 'sheet';
			} else {
				dragMode = 'scroll';
				event.currentTarget?.releasePointerCapture?.(event.pointerId);
				activePointerId = null;
				return;
			}
		}

		isDragging.value = true;
		dragOffsetPx.value = dy;
		event.preventDefault();
	};

	const onPointerUp = (event) => {
		if (!enabled.value || event.pointerId !== activePointerId) {
			return;
		}

		event.currentTarget?.releasePointerCapture?.(event.pointerId);

		if (dragMode === 'sheet') {
			const duration = Math.max(Date.now() - touchStartTime, 1);
			const velocity = (event.clientY - touchStartY) / duration;
			snapToNearest(velocity);
			return;
		}

		resetDrag();
	};

	const onPointerCancel = (event) => {
		if (event.pointerId !== activePointerId) {
			return;
		}
		resetDrag();
	};

	const bindDragSurface = (el) => {
		if (!el) {
			return () => {};
		}

		el.addEventListener('pointerdown', onPointerDown);
		el.addEventListener('pointermove', onPointerMove);
		el.addEventListener('pointerup', onPointerUp);
		el.addEventListener('pointercancel', onPointerCancel);

		return () => {
			el.removeEventListener('pointerdown', onPointerDown);
			el.removeEventListener('pointermove', onPointerMove);
			el.removeEventListener('pointerup', onPointerUp);
			el.removeEventListener('pointercancel', onPointerCancel);
		};
	};

	let unbindPanel = () => {};

	const mountPanelDrag = () => {
		unbindPanel();
		if (isHeaderOnlyDrag()) {
			const unbinders = [bindDragSurface(handleRef.value), bindDragSurface(headerRef.value)];
			unbindPanel = () => {
				unbinders.forEach((unbind) => unbind());
			};
			return;
		}

		unbindPanel = bindDragSurface(panelRef.value);
	};

	const syncExpandedFromSnap = () => {
		if (!tripleSnap || !expanded) {
			return;
		}
		expanded.value = snap.value === 'expanded';
	};

	watch(
		() => enabled.value,
		(isEnabled) => {
			if (!isEnabled) {
				resetDrag();
			}
		}
	);

	if (tripleSnap && snap) {
		watch(snap, () => {
			if (!isDragging.value) {
				dragOffsetPx.value = 0;
			}

			syncExpandedFromSnap();

			if (snap.value !== 'expanded' && bodyRef.value) {
				bodyRef.value.scrollTop = 0;
				resolveBodyScrollEl(bodyRef.value)?.scrollTo?.(0, 0);
			}

			requestAnimationFrame(() => {
				recalcMetrics();
			});
		});
	} else {
		watch(expanded, (isExpanded) => {
			if (!isDragging.value) {
				dragOffsetPx.value = 0;
			}

			if (!isExpanded && bodyRef.value) {
				bodyRef.value.scrollTop = 0;
				resolveBodyScrollEl(bodyRef.value)?.scrollTo?.(0, 0);
			}
		});
	}

	watch(
		() => [topInset?.value ?? topInset, bottomInset?.value ?? bottomInset, peekHeight?.value ?? peekHeight],
		() => {
			requestAnimationFrame(() => {
				recalcMetrics();
			});
		}
	);

	let tabBarObserver = null;
	let contentObserver = null;

	onMounted(() => {
		recalcMetrics();
		mountPanelDrag();
		syncExpandedFromSnap();
		window.addEventListener('resize', recalcMetrics);
		window.visualViewport?.addEventListener('resize', recalcMetrics);
		window.visualViewport?.addEventListener('scroll', recalcMetrics);

		const tabBar = document.querySelector('.map-floating-tab-bar-wrap');
		if (tabBar && typeof ResizeObserver !== 'undefined') {
			tabBarObserver = new ResizeObserver(() => {
				recalcMetrics();
			});
			tabBarObserver.observe(tabBar);
		}

		const contentEl = getAppContentEl();
		if (contentEl && typeof ResizeObserver !== 'undefined') {
			contentObserver = new ResizeObserver(() => {
				recalcMetrics();
			});
			contentObserver.observe(contentEl);
		}
	});

	onBeforeUnmount(() => {
		unbindPanel();
		tabBarObserver?.disconnect();
		contentObserver?.disconnect();
		window.removeEventListener('resize', recalcMetrics);
		window.visualViewport?.removeEventListener('resize', recalcMetrics);
		window.visualViewport?.removeEventListener('scroll', recalcMetrics);
	});

	return {
		panelRef,
		bodyRef,
		headerRef,
		handleRef,
		isDragging,
		expanded,
		panelStyle,
		translateYPx,
		metrics,
		recalcMetrics,
		mountPanelDrag,
		resetDrag
	};
}
