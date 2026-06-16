import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const DRAG_THRESHOLD = 8;
const SNAP_VELOCITY = 0.45;

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

/**
 * 底部抽屉双档位（半屏 / 全屏）拖拽吸附逻辑
 */
export function useBottomSheetSnap(options) {
	const expanded = options.expanded;
	const peekHeight = options.peekHeight;
	const topInset = options.topInset;
	const enabled = options.enabled ?? ref(true);

	const panelRef = ref(null);
	const bodyRef = ref(null);
	const headerRef = ref(null);

	const isDragging = ref(false);
	const dragOffsetPx = ref(0);
	const metrics = ref({
		expandedHeightPx: 0,
		peekHeightPx: 0,
		collapsedOffsetPx: 0
	});

	let touchStartY = 0;
	let touchStartTime = 0;
	let dragMode = null;
	let dragFromHandle = false;
	let activePointerId = null;

	const recalcMetrics = () => {
		const viewportHeight = getViewportHeight();
		const insetPx = resolveTopInset(topInset?.value ?? topInset ?? 0, viewportHeight);
		const expandedHeightPx = Math.max(0, viewportHeight - insetPx);
		const peekHeightPx = Math.min(
			resolveLength(peekHeight?.value ?? peekHeight ?? '42vh', viewportHeight),
			expandedHeightPx
		);
		const collapsedOffsetPx = Math.max(0, expandedHeightPx - peekHeightPx);

		metrics.value = {
			expandedHeightPx,
			peekHeightPx,
			collapsedOffsetPx
		};
	};

	const baseOffsetPx = computed(() =>
		expanded.value ? 0 : metrics.value.collapsedOffsetPx
	);

	const translateYPx = computed(() => {
		const maxOffset = metrics.value.expandedHeightPx;
		const next = baseOffsetPx.value + dragOffsetPx.value;
		return Math.max(0, Math.min(maxOffset, next));
	});

	const panelStyle = computed(() => ({
		height: `${metrics.value.expandedHeightPx}px`,
		transform: `translate3d(0, ${translateYPx.value}px, 0)`
	}));

	const resetDrag = () => {
		isDragging.value = false;
		dragOffsetPx.value = 0;
		dragMode = null;
		dragFromHandle = false;
		activePointerId = null;
	};

	const snapToNearest = (velocity) => {
		const { collapsedOffsetPx } = metrics.value;
		const offset = translateYPx.value;

		if (velocity > SNAP_VELOCITY) {
			expanded.value = false;
		} else if (velocity < -SNAP_VELOCITY) {
			expanded.value = true;
		} else if (offset > collapsedOffsetPx * 0.45) {
			expanded.value = false;
		} else if (offset < collapsedOffsetPx * 0.55) {
			expanded.value = true;
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
		return Boolean(
			handleEl?.contains(target) || headerEl?.contains(target)
		);
	};

	const shouldDragSheet = (dy) => {
		const bodyEl = bodyRef.value;

		if (dragFromHandle) {
			return true;
		}

		if (!expanded.value && dy < 0) {
			return true;
		}

		if (expanded.value && bodyEl && bodyEl.scrollTop <= 0 && dy > 0) {
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

		dragFromHandle = canStartSheetDrag(event.target);
		touchStartY = event.clientY;
		touchStartTime = Date.now();
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
		unbindPanel = bindDragSurface(panelRef.value);
	};

	watch(
		() => enabled.value,
		(isEnabled) => {
			if (!isEnabled) {
				resetDrag();
			}
		}
	);

	watch(expanded, (isExpanded) => {
		if (!isDragging.value) {
			dragOffsetPx.value = 0;
		}

		if (!isExpanded && bodyRef.value) {
			bodyRef.value.scrollTop = 0;
		}
	});

	onMounted(() => {
		recalcMetrics();
		mountPanelDrag();
		window.addEventListener('resize', recalcMetrics);
		window.visualViewport?.addEventListener('resize', recalcMetrics);
	});

	onBeforeUnmount(() => {
		unbindPanel();
		window.removeEventListener('resize', recalcMetrics);
		window.visualViewport?.removeEventListener('resize', recalcMetrics);
	});

	return {
		panelRef,
		bodyRef,
		headerRef,
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
