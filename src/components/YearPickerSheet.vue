<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { usePopupLayer } from '../composables/usePopupLayer.js';

const visible = defineModel('visible', { type: Boolean, default: false });

const props = defineProps({
	modelValue: {
		type: [String, Number],
		default: ''
	},
	years: {
		type: Array,
		default: () => ['2026', '2025', '2024', '2023']
	}
});

const emit = defineEmits(['update:modelValue', 'confirm', 'cancel', 'open', 'close']);

const ITEM_HEIGHT = 44;

const rendered = ref(false);
const animClass = ref('');
const wheelRef = ref(null);
const draftYear = ref('');

let leaveTimer = null;

const popupLayer = usePopupLayer();

const clearLeaveTimer = () => {
	if (leaveTimer) {
		clearTimeout(leaveTimer);
		leaveTimer = null;
	}
};

const getIndexByYear = (year) => {
	const index = props.years.indexOf(String(year));
	return index >= 0 ? index : 0;
};

const scrollToIndex = (index, behavior = 'auto') => {
	const wheel = wheelRef.value;
	if (!wheel) {
		return;
	}
	wheel.scrollTo({
		top: index * ITEM_HEIGHT,
		behavior
	});
};

const readSelectedYear = () => {
	const wheel = wheelRef.value;
	if (!wheel) {
		return props.years[0] ?? '';
	}
	const index = Math.round(wheel.scrollTop / ITEM_HEIGHT);
	const clamped = Math.max(0, Math.min(props.years.length - 1, index));
	return props.years[clamped] ?? '';
};

const getCurrentYear = () => String(new Date().getFullYear());

const syncDraftFromModel = () => {
	const currentYear = getCurrentYear();
	const fallback = props.years.includes(currentYear) ? currentYear : (props.years[0] ?? '');
	draftYear.value = String(props.modelValue || fallback);
};

const playEnter = () => {
	clearLeaveTimer();
	rendered.value = true;
	animClass.value = '';
	syncDraftFromModel();
	emit('open');
	popupLayer.acquire();
	nextTick(() => {
		scrollToIndex(getIndexByYear(draftYear.value));
		requestAnimationFrame(() => {
			animClass.value = 'year-picker-sheet--enter';
		});
	});
};

const playLeave = (onDone) => {
	clearLeaveTimer();
	animClass.value = 'year-picker-sheet--leave';
	leaveTimer = setTimeout(() => {
		rendered.value = false;
		animClass.value = '';
		leaveTimer = null;
		emit('close');
		popupLayer.release();
		onDone?.();
	}, 260);
};

const onCancel = () => {
	visible.value = false;
	emit('cancel');
};

const onConfirm = () => {
	const year = readSelectedYear();
	draftYear.value = year;
	emit('update:modelValue', year);
	emit('confirm', year);
	visible.value = false;
};

const onWheelScroll = () => {
	draftYear.value = readSelectedYear();
};

watch(visible, (open) => {
	if (open) {
		playEnter();
		return;
	}
	if (rendered.value) {
		playLeave();
	}
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
			class="year-picker-sheet"
			:class="animClass"
			role="dialog"
			aria-modal="true"
			aria-label="选择年份"
		>
			<div class="year-picker-sheet__shade" @click="onCancel" />

			<div class="year-picker-sheet__panel">
				<header class="year-picker-sheet__header">
					<button
						type="button"
						class="year-picker-sheet__action is-muted"
						@click="onCancel"
					>
						取消
					</button>
					<button
						type="button"
						class="year-picker-sheet__action is-primary"
						@click="onConfirm"
					>
						确定
					</button>
				</header>

				<div class="year-picker-sheet__wheel-wrap">
					<div class="year-picker-sheet__highlight" aria-hidden="true" />
					<div
						ref="wheelRef"
						class="year-picker-sheet__wheel"
						data-no-sheet-drag
						@scroll.passive="onWheelScroll"
					>
						<div class="year-picker-sheet__spacer" />
						<button
							v-for="year in years"
							:key="year"
							type="button"
							class="year-picker-sheet__item"
							:class="{ 'is-selected': draftYear === year }"
							@click="scrollToIndex(years.indexOf(year), 'smooth')"
						>
							{{ year }}年
						</button>
						<div class="year-picker-sheet__spacer" />
					</div>
				</div>
			</div>
		</div>
	</Teleport>
</template>

<style scoped lang="scss">
.year-picker-sheet {
	position: fixed;
	left: var(--app-vv-offset-left, 0px);
	top: var(--app-vv-offset-top, 0px);
	width: var(--app-vv-width, 100%);
	height: var(--app-vv-height, 100%);
	z-index: 3000;
	display: flex;
	flex-direction: column;
	justify-content: flex-end;
	pointer-events: auto;
	overscroll-behavior: contain;
	touch-action: none;
}

.year-picker-sheet__shade {
	position: absolute;
	inset: 0;
	background: rgba(0, 0, 0, 0.45);
	opacity: 0;
	transition: opacity 0.26s ease;
	touch-action: none;
}

.year-picker-sheet__panel {
	position: relative;
	z-index: 1;
	background: #1a1a1a;
	border-radius: 12px 12px 0 0;
	transform: translate3d(0, 100%, 0);
	transition: transform 0.28s cubic-bezier(0.32, 0.72, 0, 1);
	padding-bottom: env(safe-area-inset-bottom, 0px);
	touch-action: none;
}

.year-picker-sheet--enter .year-picker-sheet__shade {
	opacity: 1;
}

.year-picker-sheet--enter .year-picker-sheet__panel {
	transform: translate3d(0, 0, 0);
}

.year-picker-sheet--leave .year-picker-sheet__shade {
	opacity: 0;
}

.year-picker-sheet--leave .year-picker-sheet__panel {
	transform: translate3d(0, 100%, 0);
}

.year-picker-sheet__header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	height: 48px;
	padding: 0 16px;
	border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.year-picker-sheet__action {
	border: 0;
	background: transparent;
	font-size: 16px;
	line-height: 1;
	cursor: pointer;
	padding: 8px 4px;
	-webkit-tap-highlight-color: transparent;

	&.is-muted {
		color: rgba(255, 255, 255, 0.55);
	}

	&.is-primary {
		color: var(--app-accent, #1cded4);
		font-weight: 500;
	}
}

.year-picker-sheet__wheel-wrap {
	position: relative;
	height: 220px;
	overflow: hidden;
	touch-action: none;
}

.year-picker-sheet__highlight {
	position: absolute;
	left: 16px;
	right: 16px;
	top: 50%;
	height: 44px;
	margin-top: -22px;
	border-radius: 8px;
	background: rgba(255, 255, 255, 0.06);
	pointer-events: none;
}

.year-picker-sheet__wheel {
	height: 100%;
	overflow-y: auto;
	scroll-snap-type: y mandatory;
	-webkit-overflow-scrolling: touch;
	overscroll-behavior: contain;
	touch-action: pan-y;
	scrollbar-width: none;

	&::-webkit-scrollbar {
		display: none;
	}
}

.year-picker-sheet__spacer {
	height: 88px;
	flex-shrink: 0;
}

.year-picker-sheet__item {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 100%;
	height: 44px;
	border: 0;
	background: transparent;
	color: rgba(255, 255, 255, 0.38);
	font-size: 18px;
	line-height: 1;
	cursor: pointer;
	scroll-snap-align: center;
	-webkit-tap-highlight-color: transparent;
	transition: color 0.15s ease;

	&.is-selected {
		color: var(--app-accent, #1cded4);
		font-weight: 600;
	}
}
</style>
