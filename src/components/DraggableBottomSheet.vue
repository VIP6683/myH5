<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useBottomSheetSnap } from '../composables/useBottomSheetSnap.js';
import { usePopupLayer } from '../composables/usePopupLayer.js';

const visible = defineModel('visible', { type: Boolean, default: false });
const expanded = defineModel('expanded', { type: Boolean, default: false });

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
	topInset: {
		type: [Number, String],
		default: 'env(safe-area-inset-top, 0px)'
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
	/** 半屏时允许操作背后地图与顶栏，全屏后再锁定背景 */
	peekPassThrough: {
		type: Boolean,
		default: false
	}
});

const emit = defineEmits(['close', 'after-close']);

const rendered = ref(false);
const animPhase = ref('');
const dragEnabled = ref(false);
const enterOffsetPx = ref(null);

let leaveTimer = null;

const popupLayer = usePopupLayer();

const {
	panelRef,
	bodyRef,
	headerRef,
	isDragging,
	panelStyle,
	metrics,
	recalcMetrics,
	mountPanelDrag,
	resetDrag
} = useBottomSheetSnap({
	expanded,
	peekHeight: computed(() => props.peekHeight),
	topInset: computed(() => props.topInset),
	enabled: dragEnabled
});

const rootStyle = computed(() => ({
	zIndex: props.zIndex
}));

const shadeBgStyle = computed(() => ({
	backgroundColor: `rgba(0, 0, 0, ${props.shadeOpacity})`
}));

const isPeekPassThroughActive = computed(
	() => props.peekPassThrough && rendered.value && !expanded.value
);

const panelClasses = computed(() => [
	'draggable-bottom-sheet__panel',
	`draggable-bottom-sheet__panel--${props.theme}`,
	props.panelClass,
	animPhase.value,
	{
		'is-dragging': isDragging.value,
		'is-expanded': expanded.value
	}
]);

const effectivePanelStyle = computed(() => {
	if (animPhase.value === 'draggable-bottom-sheet--leave') {
		return {
			...panelStyle.value,
			transform: 'translate3d(0, 100%, 0)'
		};
	}

	if (enterOffsetPx.value != null) {
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
	visible.value = false;
};

const onShadeClick = () => {
	if (props.closeOnShade) {
		close();
	}
};

const syncPeekScrollLock = () => {
	if (!props.peekPassThrough || !rendered.value) {
		return;
	}

	if (expanded.value) {
		popupLayer.acquire();
		return;
	}

	popupLayer.release();
};

const playEnter = () => {
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
	animPhase.value = 'draggable-bottom-sheet--leave';

	leaveTimer = setTimeout(() => {
		rendered.value = false;
		animPhase.value = '';
		expanded.value = false;
		popupLayer.release();
		leaveTimer = null;
		onDone?.();
	}, 280);
};

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
});

watch(expanded, () => {
	syncPeekScrollLock();
});

onBeforeUnmount(() => {
	clearLeaveTimer();
	popupLayer.release();
});
</script>

<template>
	<Teleport to="body">
		<div
			v-if="rendered"
			class="draggable-bottom-sheet"
			:class="[animPhase, { 'draggable-bottom-sheet--peek-pass-through': isPeekPassThroughActive }]"
			:style="rootStyle"
			role="presentation"
			@wheel.stop
		>
			<div
				class="draggable-bottom-sheet__shade"
				:class="{ 'is-pass-through': isPeekPassThroughActive }"
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
				<div class="draggable-bottom-sheet__handle-wrap" data-bottom-sheet-handle>
					<span class="draggable-bottom-sheet__handle" aria-hidden="true" />
				</div>

				<header
					v-if="$slots.header"
					ref="headerRef"
					class="draggable-bottom-sheet__header"
				>
					<slot name="header" />
				</header>

				<div
					ref="bodyRef"
					class="draggable-bottom-sheet__body"
					:class="{ 'is-scrollable': expanded }"
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
	position: fixed;
	inset: 0;
	display: block;
	width: 100%;
	max-width: 100%;
	overflow: hidden;
	pointer-events: auto;
	backface-visibility: hidden;

	&--peek-pass-through {
		pointer-events: none;
	}
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
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	box-sizing: border-box;
	display: flex;
	flex-direction: column;
	overflow: hidden;
	pointer-events: auto;
	border-radius: 14px 14px 0 0;
	padding-bottom: env(safe-area-inset-bottom, 0px);
	transform: translate3d(0, 100%, 0);
	transition: transform 0.28s cubic-bezier(0.32, 0.72, 0, 1);
	will-change: transform;
	backface-visibility: hidden;
	overscroll-behavior: contain;

	&.is-dragging {
		transition: none;
		touch-action: none;
	}

	&--light {
		background: #fff;
		color: #1a1a1a;
	}

	&--dark {
		background: #1a1a1a;
		color: #fff;
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
	background: rgba(255, 255, 255, 0.22);
}

.draggable-bottom-sheet__header {
	flex-shrink: 0;
	touch-action: none;
}

.draggable-bottom-sheet__body {
	flex: 1;
	min-height: 0;
	min-width: 0;
	overflow-x: hidden;
	overflow-y: hidden;
	overscroll-behavior: contain;
	-webkit-overflow-scrolling: touch;

	&.is-scrollable {
		overflow-y: auto;
		touch-action: pan-y;
	}
}

.draggable-bottom-sheet__footer {
	flex-shrink: 0;
}
</style>
