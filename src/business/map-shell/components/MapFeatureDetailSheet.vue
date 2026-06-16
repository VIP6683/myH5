<script setup>
import { computed, inject, onBeforeUnmount, ref, watch } from 'vue';
import { MAP_UI_OVERLAY_KEY } from '../composables/useMapUiOverlay.js';

const visible = defineModel('visible', { type: Boolean, default: false });

const props = defineProps({
	detail: {
		type: Object,
		default: null
	}
});

const emit = defineEmits(['start-verify', 'close']);

const mapUiOverlay = inject(MAP_UI_OVERLAY_KEY, null);

const rendered = ref(false);
const animClass = ref('');

let leaveTimer = null;

const title = computed(() => (props.detail?.kind === 'line' ? '线状详情' : '图斑详情'));

const rows = computed(() => {
	const detail = props.detail;
	if (!detail) {
		return [];
	}

	const commonRows = [
		{ label: '变电站编号', value: detail.substationNo },
		{ label: '期数', value: detail.phase },
		detail.kind === 'line'
			? { label: '线段长度(m)', value: detail.lineLength }
			: { label: '图斑面积(m²)', value: detail.patchArea },
		{ label: '异物编号', value: detail.objectNo },
		{ label: '异物类型', value: detail.objectTypeLabel },
		{ label: '异物距离(m)', value: detail.objectDistance }
	];

	return commonRows.filter(
		(row) => row.value !== undefined && row.value !== null && row.value !== ''
	);
});

const clearLeaveTimer = () => {
	if (leaveTimer) {
		clearTimeout(leaveTimer);
		leaveTimer = null;
	}
};

const playEnter = () => {
	clearLeaveTimer();
	rendered.value = true;
	animClass.value = '';
	mapUiOverlay?.enterOverlay();
	requestAnimationFrame(() => {
		animClass.value = 'map-feature-detail-sheet--enter';
	});
};

const playLeave = (onDone) => {
	clearLeaveTimer();
	animClass.value = 'map-feature-detail-sheet--leave';
	leaveTimer = setTimeout(() => {
		rendered.value = false;
		animClass.value = '';
		mapUiOverlay?.exitOverlay();
		leaveTimer = null;
		onDone?.();
	}, 280);
};

const close = () => {
	visible.value = false;
};

const onStartVerify = () => {
	emit('start-verify', props.detail);
};

watch(visible, (open) => {
	if (open) {
		playEnter();
		return;
	}
	if (rendered.value) {
		playLeave(() => emit('close'));
	}
});

onBeforeUnmount(() => {
	clearLeaveTimer();
	if (rendered.value) {
		mapUiOverlay?.exitOverlay();
	}
});
</script>

<template>
	<Teleport to="body">
		<div
			v-if="rendered"
			class="map-feature-detail-sheet"
			:class="animClass"
			role="dialog"
			aria-modal="true"
			:aria-label="title"
			@wheel.stop
		>
			<div class="map-feature-detail-sheet__shade" @click="close" />

			<div class="map-feature-detail-sheet__panel">
				<header class="map-feature-detail-sheet__header">
					<h2 class="map-feature-detail-sheet__title">{{ title }}</h2>
					<button
						type="button"
						class="map-feature-detail-sheet__action"
						@click="onStartVerify"
					>
						开始核查
					</button>
				</header>

				<dl class="map-feature-detail-sheet__list">
					<div v-for="row in rows" :key="row.label" class="map-feature-detail-sheet__row">
						<dt class="map-feature-detail-sheet__label">{{ row.label }}</dt>
						<dd class="map-feature-detail-sheet__value">{{ row.value }}</dd>
					</div>
				</dl>
			</div>
		</div>
	</Teleport>
</template>

<style scoped lang="scss">
.map-feature-detail-sheet {
	position: fixed;
	inset: 0;
	z-index: 2500;
	display: flex;
	flex-direction: column;
	justify-content: flex-end;
	width: 100%;
	max-width: 100%;
	overflow: hidden;
	pointer-events: auto;
	backface-visibility: hidden;
}

.map-feature-detail-sheet__shade {
	position: absolute;
	inset: 0;
	background: rgba(0, 0, 0, 0.35);
	opacity: 0;
	transition: opacity 0.28s ease;
	will-change: opacity;
}

.map-feature-detail-sheet__panel {
	position: relative;
	width: 100%;
	max-width: 100%;
	box-sizing: border-box;
	overflow: hidden;
	pointer-events: auto;
	background: #1a1a1a;
	border-radius: 14px 14px 0 0;
	padding-bottom: env(safe-area-inset-bottom, 0px);
	max-height: min(58vh, 420px);
	display: flex;
	flex-direction: column;
	transform: translate3d(0, 100%, 0);
	transition: transform 0.28s cubic-bezier(0.32, 0.72, 0, 1);
	will-change: transform;
	backface-visibility: hidden;
	touch-action: pan-y;
	overscroll-behavior: contain;
}

.map-feature-detail-sheet--enter .map-feature-detail-sheet__shade {
	opacity: 1;
}

.map-feature-detail-sheet--enter .map-feature-detail-sheet__panel {
	transform: translate3d(0, 0, 0);
}

.map-feature-detail-sheet--leave .map-feature-detail-sheet__shade {
	opacity: 0;
}

.map-feature-detail-sheet--leave .map-feature-detail-sheet__panel {
	transform: translate3d(0, 100%, 0);
}

.map-feature-detail-sheet__header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	padding: 16px 16px 12px;
	flex-shrink: 0;
}

.map-feature-detail-sheet__title {
	margin: 0;
	font-size: 16px;
	font-weight: 500;
	color: var(--app-accent, #1cded4);
	line-height: 1.3;
}

.map-feature-detail-sheet__action {
	flex-shrink: 0;
	padding: 6px 16px;
	border: 0;
	border-radius: 999px;
	background: var(--app-accent, #1cded4);
	color: #fff;
	font-size: 13px;
	font-weight: 500;
	line-height: 1.4;
	cursor: pointer;
	-webkit-tap-highlight-color: transparent;
	transition: opacity 0.15s ease;

	&:active {
		opacity: 0.85;
	}
}

.map-feature-detail-sheet__list {
	margin: 0;
	padding: 0 16px 16px;
	min-width: 0;
	overflow-x: hidden;
	overflow-y: auto;
	-webkit-overflow-scrolling: touch;
	overscroll-behavior: contain;
	touch-action: pan-y;
	box-sizing: border-box;
}

.map-feature-detail-sheet__row {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 16px;
	min-width: 0;
	padding: 14px 0;
	border-bottom: 1px solid rgba(255, 255, 255, 0.06);

	&:last-child {
		border-bottom: 0;
	}
}

.map-feature-detail-sheet__label {
	margin: 0;
	flex-shrink: 0;
	font-size: 14px;
	font-weight: 400;
	color: rgba(255, 255, 255, 0.55);
	line-height: 1.4;
}

.map-feature-detail-sheet__value {
	margin: 0;
	min-width: 0;
	text-align: right;
	font-size: 14px;
	font-weight: 400;
	color: #fff;
	line-height: 1.4;
	word-break: break-all;
	overflow-wrap: anywhere;
}
</style>
