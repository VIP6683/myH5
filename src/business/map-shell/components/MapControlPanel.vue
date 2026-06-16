<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import LocationPermissionDialog from '../../../components/location/LocationPermissionDialog.vue';
import { useLocationRequest } from '../../../composables/useLocationRequest.js';
import {
	clearMeasure,
	confirmMeasureDrawing,
	getMeasureState,
	locateMyPosition,
	onMeasureToolbarStateChange,
	startAreaMeasure,
	startDistanceMeasure,
	startPointMeasure,
	stopMeasureDrawing
} from '../../../map-kit/core/mars3d.js';
import SystemTipModal from './SystemTipModal.vue';

defineProps({
	motionClass: {
		type: String,
		default: ''
	},
	visible: {
		type: Boolean,
		default: true
	}
});

const emit = defineEmits(['clear-screen', 'open-tutorial', 'location-success']);

const activeTool = ref('');
const activeTouch = ref('');
const locating = ref(false);
const tipVisible = ref(false);
const tipMessage = ref('');
const tipConfirmHandler = ref(null);
const measureState = ref(getMeasureState());

const MEASURE_TOOLS = [
	{ id: 'point', label: '测点' },
	{ id: 'distance', label: '距' },
	{ id: 'area', label: '面' }
];

const LINE_MEASURE_TOOLS = new Set(['distance', 'area']);

let unbindMeasureState = null;

const {
	dialogVisible: locationDialogVisible,
	dialogMode: locationDialogMode,
	dialogErrorMessage: locationDialogMessage,
	requestLocation,
	onDialogConfirm: onLocationDialogConfirm
} = useLocationRequest({
	onSuccess: (coords) => {
		emit('location-success', coords);
	}
});

// 测距/测面选中且已在地图上落点或量算完成后才显示（误触控件时不出现）
const showMeasureActions = computed(
	() => LINE_MEASURE_TOOLS.has(activeTool.value) && measureState.value.showActions
);

const syncMeasureState = () => {
	measureState.value = getMeasureState();
};

const onTouchStart = (key) => {
	activeTouch.value = key;
};

const onTouchEnd = () => {
	activeTouch.value = '';
};

const openSystemTip = (message, onConfirm = null) => {
	tipMessage.value = message;
	tipConfirmHandler.value = onConfirm;
	tipVisible.value = true;
};

const handleTipConfirm = () => {
	const handler = tipConfirmHandler.value;
	tipConfirmHandler.value = null;
	handler?.();
};

const startLineMeasure = (toolId) => {
	if (activeTool.value === toolId) {
		stopMeasureDrawing();
		clearMeasure();
		activeTool.value = '';
		syncMeasureState();
		return;
	}

	stopMeasureDrawing();
	clearMeasure();
	activeTool.value = toolId;
	syncMeasureState();

	const runner = toolId === 'distance' ? () => startDistanceMeasure() : () => startAreaMeasure();

	runner().catch((error) => {
		console.warn('[mapControl] measure failed', error);
		if (activeTool.value === toolId) {
			activeTool.value = '';
		}
		syncMeasureState();
	});
};

const handleMeasure = async (toolId) => {
	if (toolId === 'point') {
		if (activeTool.value === 'point') {
			stopMeasureDrawing();
			activeTool.value = '';
			syncMeasureState();
			return;
		}

		stopMeasureDrawing();
		activeTool.value = 'point';
		try {
			await startPointMeasure();
		} catch (error) {
			console.warn('[mapControl] point measure failed', error);
			activeTool.value = '';
		} finally {
			syncMeasureState();
		}
		return;
	}

	if (LINE_MEASURE_TOOLS.has(toolId)) {
		startLineMeasure(toolId);
	}
};

const handleMeasureConfirm = () => {
	const confirmed = confirmMeasureDrawing();
	syncMeasureState();

	if (!confirmed && !measureState.value.isDrawing && !measureState.value.isEditing) {
		activeTool.value = '';
	}
};

const handleMeasureClear = () => {
	clearMeasure();
	activeTool.value = '';
	syncMeasureState();
};

const handleLocateMyPosition = async () => {
	if (locating.value) return;

	locating.value = true;
	try {
		const coords = await requestLocation();
		if (coords) {
			await locateMyPosition({ lng: coords.lng, lat: coords.lat });
		}
	} catch (error) {
		if (error?.message !== 'cancelled' && error?.message !== 'denied') {
			console.warn('[mapControl] location request failed', error);
			openSystemTip('当前位置获取失败，请稍后重试');
		}
	} finally {
		locating.value = false;
	}
};

const handleClearScreen = () => {
	emit('clear-screen');
};

const handleOpenTutorial = () => {
	emit('open-tutorial');
};

onMounted(() => {
	unbindMeasureState = onMeasureToolbarStateChange(() => {
		syncMeasureState();
	});
});

onBeforeUnmount(() => {
	unbindMeasureState?.();
	unbindMeasureState = null;
	stopMeasureDrawing();
});
</script>

<template>
	<div v-show="visible" class="map-control-panel" :class="motionClass">
		<div class="map-control-panel__stack">
			<div class="map-control-panel__toolbar">
				<ul class="map-control-panel__measure-list">
					<li
						v-for="tool in MEASURE_TOOLS"
						:key="tool.id"
						class="map-control-panel__item"
						:class="{
							'is-active': activeTool === tool.id,
							'is-touch': activeTouch === tool.id
						}"
					>
						<button
							type="button"
							class="map-control-panel__btn"
							:aria-pressed="activeTool === tool.id"
							@touchstart.passive="onTouchStart(tool.id)"
							@touchend.passive="onTouchEnd"
							@touchcancel.passive="onTouchEnd"
							@mousedown="onTouchStart(tool.id)"
							@mouseup="onTouchEnd"
							@mouseleave="onTouchEnd"
							@click="handleMeasure(tool.id)"
						>
							<span class="map-control-panel__icon" aria-hidden="true">
								<svg
									v-if="tool.id === 'point'"
									viewBox="0 0 24 24"
									fill="none"
									xmlns="http://www.w3.org/2000/svg"
								>
									<circle cx="12" cy="12" r="3" fill="currentColor" />
									<path
										d="M12 3v3M12 18v3M3 12h3M18 12h3"
										stroke="currentColor"
										stroke-width="1.8"
										stroke-linecap="round"
									/>
									<circle
										cx="12"
										cy="12"
										r="8.5"
										stroke="currentColor"
										stroke-width="1.8"
									/>
								</svg>
								<svg
									v-else-if="tool.id === 'distance'"
									viewBox="0 0 24 24"
									fill="none"
									xmlns="http://www.w3.org/2000/svg"
								>
									<path
										d="M4 18l16-12"
										stroke="currentColor"
										stroke-width="1.8"
										stroke-linecap="round"
									/>
									<circle cx="4" cy="18" r="2" fill="currentColor" />
									<circle cx="20" cy="6" r="2" fill="currentColor" />
								</svg>
								<svg
									v-else
									viewBox="0 0 24 24"
									fill="none"
									xmlns="http://www.w3.org/2000/svg"
								>
									<path
										d="M6 8l6-3 6 3v8l-6 3-6-3V8Z"
										stroke="currentColor"
										stroke-width="1.8"
										stroke-linejoin="round"
									/>
								</svg>
							</span>
							<span class="map-control-panel__label">{{ tool.label }}</span>
						</button>
					</li>
				</ul>

				<div class="map-control-panel__divider" />

				<ul class="map-control-panel__utility-list">
					<li
						class="map-control-panel__item"
						:class="{ 'is-touch': activeTouch === 'clear' }"
					>
						<button
							type="button"
							class="map-control-panel__btn map-control-panel__btn--utility"
							aria-label="清屏"
							@touchstart.passive="onTouchStart('clear')"
							@touchend.passive="onTouchEnd"
							@touchcancel.passive="onTouchEnd"
							@mousedown="onTouchStart('clear')"
							@mouseup="onTouchEnd"
							@mouseleave="onTouchEnd"
							@click="handleClearScreen"
						>
							<span class="map-control-panel__icon" aria-hidden="true">
								<svg
									viewBox="0 0 24 24"
									fill="none"
									xmlns="http://www.w3.org/2000/svg"
								>
									<rect
										x="5"
										y="5"
										width="14"
										height="14"
										rx="2"
										stroke="currentColor"
										stroke-width="1.8"
									/>
									<path
										d="M9 12h6"
										stroke="currentColor"
										stroke-width="1.8"
										stroke-linecap="round"
									/>
								</svg>
							</span>
							<span class="map-control-panel__label">清屏</span>
						</button>
					</li>
					<li
						class="map-control-panel__item"
						:class="{ 'is-touch': activeTouch === 'help' }"
					>
						<button
							type="button"
							class="map-control-panel__btn map-control-panel__btn--utility"
							aria-label="帮助"
							@touchstart.passive="onTouchStart('help')"
							@touchend.passive="onTouchEnd"
							@touchcancel.passive="onTouchEnd"
							@mousedown="onTouchStart('help')"
							@mouseup="onTouchEnd"
							@mouseleave="onTouchEnd"
							@click="handleOpenTutorial"
						>
							<span class="map-control-panel__icon" aria-hidden="true">
								<svg
									viewBox="0 0 24 24"
									fill="none"
									xmlns="http://www.w3.org/2000/svg"
								>
									<circle
										cx="12"
										cy="12"
										r="8.5"
										stroke="currentColor"
										stroke-width="1.8"
									/>
									<path
										d="M9.5 9.2a2.6 2.6 0 0 1 4.6 1.4c0 1.6-2.1 2-2.1 3.4"
										stroke="currentColor"
										stroke-width="1.8"
										stroke-linecap="round"
									/>
									<circle cx="12" cy="16.8" r="1" fill="currentColor" />
								</svg>
							</span>
							<span class="map-control-panel__label">帮助</span>
						</button>
					</li>
				</ul>
			</div>

			<div v-if="showMeasureActions" class="map-control-panel__actions">
				<button
					type="button"
					class="map-control-panel__action-btn map-control-panel__action-btn--confirm"
					:class="{ 'is-touch': activeTouch === 'measure-confirm' }"
					@touchstart.passive="onTouchStart('measure-confirm')"
					@touchend.passive="onTouchEnd"
					@touchcancel.passive="onTouchEnd"
					@mousedown="onTouchStart('measure-confirm')"
					@mouseup="onTouchEnd"
					@mouseleave="onTouchEnd"
					@click="handleMeasureConfirm"
				>
					确定
				</button>
				<button
					type="button"
					class="map-control-panel__action-btn map-control-panel__action-btn--clear"
					:class="{ 'is-touch': activeTouch === 'measure-clear' }"
					@touchstart.passive="onTouchStart('measure-clear')"
					@touchend.passive="onTouchEnd"
					@touchcancel.passive="onTouchEnd"
					@mousedown="onTouchStart('measure-clear')"
					@mouseup="onTouchEnd"
					@mouseleave="onTouchEnd"
					@click="handleMeasureClear"
				>
					清除
				</button>
			</div>
		</div>

		<button
			type="button"
			class="map-control-panel__locate"
			:class="{ locating, 'is-touch': activeTouch === 'location' }"
			aria-label="我的位置"
			@touchstart.passive="onTouchStart('location')"
			@touchend.passive="onTouchEnd"
			@touchcancel.passive="onTouchEnd"
			@mousedown="onTouchStart('location')"
			@mouseup="onTouchEnd"
			@mouseleave="onTouchEnd"
			@click="handleLocateMyPosition"
		>
			<svg
				viewBox="0 0 24 24"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
				aria-hidden="true"
			>
				<circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.8" />
				<circle cx="12" cy="12" r="2.5" fill="currentColor" />
				<path
					d="M12 3v3M12 18v3M3 12h3M18 12h3"
					stroke="currentColor"
					stroke-width="1.8"
					stroke-linecap="round"
				/>
			</svg>
		</button>

		<LocationPermissionDialog
			v-model:visible="locationDialogVisible"
			:mode="locationDialogMode"
			:error-message="locationDialogMessage"
			@confirm="onLocationDialogConfirm"
		/>

		<SystemTipModal
			v-model:visible="tipVisible"
			:message="tipMessage"
			@confirm="handleTipConfirm"
			@close="tipConfirmHandler = null"
		/>
	</div>
</template>

<style scoped lang="scss">
.map-control-panel {
	position: absolute;
	top: calc(var(--map-top-bar-height, 96px) + 12px);
	right: 8px;
	bottom: calc(66px + env(safe-area-inset-bottom, 0px));
	z-index: 999;
	display: flex;
	flex-direction: column;
	justify-content: space-between;
	align-items: flex-end;
	pointer-events: none;
}

.map-control-panel__stack,
.map-control-panel__locate {
	pointer-events: auto;
}

.map-control-panel__stack {
	display: flex;
	flex-direction: column;
	align-items: flex-end;
	gap: 8px;
}

.map-control-panel__toolbar {
	width: 44px;
	padding: 4px 0;
	border-radius: 8px;
	background: rgba(20, 22, 26, 0.88);
	border: 1px solid rgba(255, 255, 255, 0.08);
	box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
	backdrop-filter: blur(8px);
	-webkit-backdrop-filter: blur(8px);
}

.map-control-panel__actions {
	display: flex;
	flex-direction: column;
	gap: 6px;
	width: 44px;
}

.map-control-panel__action-btn {
	width: 44px;
	padding: 8px 0;
	border: 0;
	border-radius: 8px;
	font-size: 12px;
	line-height: 1.2;
	font-weight: 500;
	cursor: pointer;
	-webkit-tap-highlight-color: transparent;
	transition:
		transform 0.1s ease,
		opacity 0.15s ease;

	&:active,
	&.is-touch {
		transform: scale(0.94);
	}
}

.map-control-panel__action-btn--confirm {
	background: var(--app-accent, #1cded4);
	color: #0a1412;
	box-shadow: 0 2px 8px rgba(45, 212, 191, 0.35);
}

.map-control-panel__action-btn--clear {
	background: rgba(20, 22, 26, 0.92);
	color: rgba(255, 255, 255, 0.88);
	border: 1px solid rgba(255, 255, 255, 0.12);
}

.map-control-panel__measure-list,
.map-control-panel__utility-list {
	margin: 0;
	padding: 0;
	list-style: none;
}

.map-control-panel__item {
	margin: 0;
	padding: 0;
}

.map-control-panel__btn {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 2px;
	width: 44px;
	padding: 8px 0;
	border: 0;
	background: transparent;
	color: rgba(255, 255, 255, 0.72);
	cursor: pointer;
	-webkit-tap-highlight-color: transparent;
	transition:
		color 0.15s ease,
		transform 0.1s ease;

	&:active,
	.map-control-panel__item.is-touch & {
		transform: scale(0.94);
	}
}

.map-control-panel__item.is-active .map-control-panel__btn {
	color: var(--app-accent, #1cded4);
}

.map-control-panel__icon {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 22px;
	height: 22px;
}

.map-control-panel__icon svg {
	width: 100%;
	height: 100%;
}

.map-control-panel__label {
	font-size: 10px;
	line-height: 1.2;
	white-space: nowrap;
}

.map-control-panel__divider {
	height: 1px;
	margin: 2px 8px;
	background: rgba(255, 255, 255, 0.12);
}

.map-control-panel__locate {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 40px;
	height: 40px;
	padding: 0;
	border: 0;
	border-radius: 50%;
	background: rgba(20, 22, 26, 0.92);
	border: 1px solid rgba(255, 255, 255, 0.1);
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
	color: #fff;
	cursor: pointer;
	-webkit-tap-highlight-color: transparent;
	transition: transform 0.1s ease;

	svg {
		width: 22px;
		height: 22px;
	}

	&:active,
	&.is-touch {
		transform: scale(0.94);
	}

	&.locating svg {
		animation: mapControlLocateSpin 1.2s linear infinite;
	}
}

@keyframes mapControlLocateSpin {
	from {
		transform: rotate(0deg);
	}
	to {
		transform: rotate(360deg);
	}
}

@media screen and (min-width: 900px) {
	.map-control-panel {
		top: 16px;
		right: 12px;
		bottom: calc(64px + env(safe-area-inset-bottom, 0px));
	}
}
</style>
