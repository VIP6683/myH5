<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useBottomSheetSnap } from '../composables/useBottomSheetSnap.js';
import { usePopupLayer } from '../composables/usePopupLayer.js';

const APP_CONTENT_SELECTOR = '#app-content';

const visible = defineModel('visible', { type: Boolean, default: false });
const expanded = defineModel('expanded', { type: Boolean, default: false });
const snap = defineModel('snap', {
	type: String,
	default: 'collapsed',
	validator: (value) => ['collapsed', 'peek', 'expanded'].includes(value)
});

const props = defineProps({
	ariaLabel: {
		type: String,
		default: '底部面板'
	},
	zIndex: {
		type: Number,
		default: 2600
	},
	peekHeight: {
		type: [Number, String],
		default: '42vh'
	},
	collapsedHeight: {
		type: [Number, String],
		default: 20
	},
	topInset: {
		type: [Number, String],
		default: 'env(safe-area-inset-top, 0px)'
	},
	bottomInset: {
		type: [Number, String],
		default: 0
	},
	closeOnShade: {
		type: Boolean,
		default: true
	},
	panelClass: {
		type: String,
		default: ''
	},
	shadeOpacity: {
		type: Number,
		default: 0.35
	},
	theme: {
		type: String,
		default: 'dark',
		validator: (value) => ['light', 'dark'].includes(value)
	},
	bodyScroll: {
		type: String,
		default: 'auto',
		validator: (value) => ['auto', 'inner'].includes(value)
	},
	/** 半屏时允许操作背后地图与顶栏，全屏后再锁定背景 */
	peekPassThrough: {
		type: Boolean,
		default: false
	},
	/** 常驻停靠：默认折叠横条，筛选等场景不整页弹出 */
	persistent: {
		type: Boolean,
		default: false
	},
	allowDrag: {
		type: Boolean,
		default: true
	},
	dragSurface: {
		type: String,
		default: 'auto',
		validator: (value) => ['auto', 'panel', 'header'].includes(value)
	}
});

const emit = defineEmits(['close', 'after-close']);

const rendered = ref(false);
const animPhase = ref('');
const dragEnabled = ref(false);
const enterOffsetPx = ref(null);
const suppressHandleClick = ref(false);

let leaveTimer = null;

const popupLayer = usePopupLayer();

const {
	panelRef,
	bodyRef,
	headerRef,
	handleRef,
	isDragging,
	panelStyle,
	metrics,
	recalcMetrics,
	mountPanelDrag,
	resetDrag
} = useBottomSheetSnap({
	expanded,
	snap,
	tripleSnap: props.persistent,
	dragSurface: computed(() =>
		props.dragSurface === 'auto' ? (props.persistent ? 'header' : 'panel') : props.dragSurface
	),
	peekHeight: computed(() => props.peekHeight),
	collapsedHeight: computed(() => props.collapsedHeight),
	topInset: computed(() => props.topInset),
	bottomInset: computed(() => props.bottomInset),
	enabled: computed(() => dragEnabled.value && props.allowDrag)
});

const isFullyExpanded = computed(() =>
	props.persistent ? snap.value === 'expanded' : expanded.value
);

const rootStyle = computed(() => ({
	zIndex: props.zIndex
}));

const shadeBgStyle = computed(() => ({
	backgroundColor: `rgba(0, 0, 0, ${props.shadeOpacity})`
}));

const isPeekPassThroughActive = computed(
	() => props.peekPassThrough && rendered.value && !isFullyExpanded.value
);

/** 常驻抽屉折叠/半屏时遮罩不拦截地图手势（双指缩放等） */
const isShadePassThrough = computed(
	() =>
		isPeekPassThroughActive.value ||
		(props.persistent && rendered.value && snap.value !== 'expanded')
);

const panelClasses = computed(() => [
	'draggable-bottom-sheet__panel',
	`draggable-bottom-sheet__panel--${props.theme}`,
	props.panelClass,
	animPhase.value,
	{
		'is-dragging': isDragging.value,
		'is-expanded': isFullyExpanded.value,
		'is-collapsed': props.persistent && snap.value === 'collapsed',
		'is-inner-scroll': props.bodyScroll === 'inner'
	}
]);

const effectivePanelStyle = computed(() => {
	if (!props.persistent && animPhase.value === 'draggable-bottom-sheet--leave') {
		return {
			...panelStyle.value,
			transform: 'translate3d(0, 100%, 0)'
		};
	}

	if (!props.persistent && enterOffsetPx.value != null) {
		return {
			...panelStyle.value,
			transform: `translate3d(0, ${enterOffsetPx.value}px, 0)`
		};
	}

	return panelStyle.value;
});

const clearLeaveTimer = () => {
	if (leaveTimer) {
		clearTimeout(leaveTimer);
		leaveTimer = null;
	}
};

const close = () => {
	if (props.persistent) {
		snap.value = 'collapsed';
		return;
	}
	visible.value = false;
};

const onShadeClick = () => {
	if (props.persistent && snap.value === 'expanded') {
		snap.value = 'peek';
		return;
	}

	if (props.closeOnShade) {
		close();
	}
};

const syncPeekScrollLock = () => {
	if (!props.peekPassThrough || !rendered.value) {
		return;
	}

	if (isFullyExpanded.value) {
		popupLayer.acquire();
		return;
	}

	popupLayer.release();
};

const mountPersistent = () => {
	clearLeaveTimer();
	rendered.value = true;
	animPhase.value = '';
	dragEnabled.value = true;
	enterOffsetPx.value = null;
	suppressHandleClick.value = false;
	resetDrag();
	recalcMetrics();
	syncPeekScrollLock();

	nextTick(() => {
		mountPanelDrag();
		recalcMetrics();
		requestAnimationFrame(() => {
			recalcMetrics();
			requestAnimationFrame(() => {
				recalcMetrics();
			});
		});
	});
};

const playEnter = () => {
	if (props.persistent) {
		mountPersistent();
		return;
	}

	clearLeaveTimer();
	rendered.value = true;
	if (!props.peekPassThrough) {
		popupLayer.acquire();
	}
	animPhase.value = '';
	expanded.value = false;
	dragEnabled.value = false;
	resetDrag();
	recalcMetrics();
	enterOffsetPx.value = metrics.value.expandedHeightPx;

	requestAnimationFrame(() => {
		recalcMetrics();
		enterOffsetPx.value = metrics.value.expandedHeightPx;
		requestAnimationFrame(() => {
			enterOffsetPx.value = null;
			animPhase.value = 'draggable-bottom-sheet--enter';
			mountPanelDrag();
		});
	});

	leaveTimer = setTimeout(() => {
		dragEnabled.value = true;
		animPhase.value = '';
		leaveTimer = null;
	}, 280);
};

const playLeave = (onDone) => {
	clearLeaveTimer();
	dragEnabled.value = false;
	enterOffsetPx.value = null;
	resetDrag();

	if (props.persistent) {
		rendered.value = false;
		animPhase.value = '';
		popupLayer.release();
		onDone?.();
		return;
	}

	animPhase.value = 'draggable-bottom-sheet--leave';

	leaveTimer = setTimeout(() => {
		rendered.value = false;
		animPhase.value = '';
		if (!props.persistent) {
			expanded.value = false;
		}
		popupLayer.release();
		leaveTimer = null;
		onDone?.();
	}, 280);
};

const onHandlePointerDown = () => {
	suppressHandleClick.value = false;
};

const onHandleClick = () => {
	if (!props.persistent || suppressHandleClick.value) {
		suppressHandleClick.value = false;
		return;
	}

	if (snap.value === 'collapsed') {
		snap.value = 'peek';
	}
};

watch(isDragging, (dragging) => {
	if (dragging) {
		suppressHandleClick.value = true;
	}
});

watch(visible, (open) => {
	if (open) {
		playEnter();
		return;
	}

	if (rendered.value) {
		playLeave(() => {
			emit('close');
			emit('after-close');
		});
	}
}, { immediate: true });

watch(isFullyExpanded, () => {
	syncPeekScrollLock();
});

onBeforeUnmount(() => {
	clearLeaveTimer();
	popupLayer.release();
});
</script>

<template>
	<Teleport :to="APP_CONTENT_SELECTOR">
		<div
			v-if="rendered"
			class="draggable-bottom-sheet"
			:class="[
				animPhase,
				{
					'draggable-bottom-sheet--persistent': persistent,
					'draggable-bottom-sheet--peek-pass-through': isPeekPassThroughActive
				}
			]"
			:style="rootStyle"
			role="presentation"
			@wheel.stop
		>
			<div
				class="draggable-bottom-sheet__shade"
				:class="{ 'is-pass-through': isShadePassThrough }"
				:style="shadeBgStyle"
				@click="onShadeClick"
			/>

			<div
				ref="panelRef"
				:class="panelClasses"
				:style="effectivePanelStyle"
				role="dialog"
				aria-modal="true"
				:aria-label="ariaLabel"
			>
				<div
					ref="handleRef"
					class="draggable-bottom-sheet__handle-wrap"
					data-bottom-sheet-handle
					@pointerdown="onHandlePointerDown"
					@click="onHandleClick"
				>
					<span class="draggable-bottom-sheet__handle" aria-hidden="true" />
				</div>

				<header v-if="$slots.header" ref="headerRef" class="draggable-bottom-sheet__header">
					<slot name="header" />
				</header>

				<div
					ref="bodyRef"
					class="draggable-bottom-sheet__body"
					:class="{ 'is-scrollable': isFullyExpanded && props.bodyScroll === 'auto' }"
				>
					<slot />
				</div>

				<footer v-if="$slots.footer" class="draggable-bottom-sheet__footer">
					<slot name="footer" />
				</footer>
			</div>
		</div>
	</Teleport>
</template>

<style scoped lang="scss">
.draggable-bottom-sheet {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	display: block;
	max-width: 100%;
	overflow: hidden;
	pointer-events: auto;

	&--peek-pass-through {
		pointer-events: none;
	}

	&--persistent {
		pointer-events: none;
	}
}

.draggable-bottom-sheet--persistent .draggable-bottom-sheet__panel {
	pointer-events: auto;
	padding-bottom: 0;
}

.draggable-bottom-sheet__shade {
	position: absolute;
	inset: 0;
	opacity: 0;
	transition: opacity 0.28s ease;
	will-change: opacity;

	&.is-pass-through {
		pointer-events: none;
	}
}

.draggable-bottom-sheet--peek-pass-through .draggable-bottom-sheet__panel {
	pointer-events: auto;
}

.draggable-bottom-sheet__panel {
	position: absolute;
	left: 0;
	right: 0;
	bottom: 0;
	box-sizing: border-box;
	display: flex;
	flex-direction: column;
	overflow: hidden;
	pointer-events: auto;
	border-radius: 14px 14px 0 0;
	transform: translate3d(0, 100%, 0);
	transition:
		transform 0.28s cubic-bezier(0.32, 0.72, 0, 1),
		height 0.28s cubic-bezier(0.32, 0.72, 0, 1),
		bottom 0.28s cubic-bezier(0.32, 0.72, 0, 1);
	overscroll-behavior: contain;

	&.is-dragging,
	.draggable-bottom-sheet--enter &,
	.draggable-bottom-sheet--leave & {
		will-change: transform;
	}

	&.is-dragging {
		transition: none;
		touch-action: none;
	}

	&--light {
		background: #fff;
		color: #1a1a1a;
	}

	&--dark {
		background: var(--app-drawer-bg, rgba(25, 28, 33, 1));
		color: #fff;
	}

	&.is-collapsed {
		.draggable-bottom-sheet__header,
		.draggable-bottom-sheet__body,
		.draggable-bottom-sheet__footer {
			visibility: hidden;
			flex: 0 0 0;
			height: 0;
			min-height: 0;
			overflow: hidden;
			padding: 0;
			margin: 0;
			pointer-events: none;
		}

		.draggable-bottom-sheet__handle-wrap {
			padding: 8px 0;
		}
	}
}

.draggable-bottom-sheet--enter .draggable-bottom-sheet__shade {
	opacity: 1;
}

.draggable-bottom-sheet--leave .draggable-bottom-sheet__shade {
	opacity: 0;
}

.draggable-bottom-sheet--leave .draggable-bottom-sheet__panel {
	transform: translate3d(0, 100%, 0) !important;
	transition: transform 0.28s cubic-bezier(0.32, 0.72, 0, 1);
}

.draggable-bottom-sheet__handle-wrap {
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	padding: 10px 0 4px;
	cursor: grab;
	touch-action: none;

	&:active {
		cursor: grabbing;
	}
}

.draggable-bottom-sheet__handle {
	display: block;
	width: 36px;
	height: 4px;
	border-radius: 999px;
}

.draggable-bottom-sheet__panel--light .draggable-bottom-sheet__handle {
	background: rgba(0, 0, 0, 0.16);
}

.draggable-bottom-sheet__panel--dark .draggable-bottom-sheet__handle {
	background: rgba(255, 255, 255, 0.63);
}

.draggable-bottom-sheet__header {
	flex-shrink: 0;
	touch-action: manipulation;
}

.draggable-bottom-sheet__body {
	flex: 1;
	min-height: 0;
	min-width: 0;
	display: flex;
	flex-direction: column;
	overflow-x: hidden;
	overflow-y: hidden;
	overscroll-behavior: contain;
	-webkit-overflow-scrolling: touch;

	&.is-scrollable {
		display: block;
		overflow-y: auto;
		touch-action: pan-y;
	}
}

.draggable-bottom-sheet__footer {
	flex-shrink: 0;
}
</style>
