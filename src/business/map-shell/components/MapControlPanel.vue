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
} from '../../../map-kit/mapApi.js';
import SystemTipModal from './SystemTipModal.vue';
import MapMeasureIcon from './MapMeasureIcon.vue';
import locateIcon from '../../../assets/images/profile/locate.svg';
import measureClearIcon from '../../../assets/images/profile/measure-clear.svg';

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

const emit = defineEmits(['clear-screen', 'location-success']);

const activeTool = ref('');
const activeTouch = ref('');
const locating = ref(false);
const tipVisible = ref(false);
const tipMessage = ref('');
const tipConfirmHandler = ref(null);
const measureState = ref(getMeasureState());

const MEASURE_TOOLS = [
	{ id: 'point', label: '测点' },
	{ id: 'distance', label: '测距' },
	{ id: 'area', label: '测面' }
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
const showMeasureActions = computed(() => {
	// 移动端交互：进入测距/测面后固定显示“确定”
	return LINE_MEASURE_TOOLS.has(activeTool.value);
});

const showMeasureClearButton = computed(() => {
	if (LINE_MEASURE_TOOLS.has(activeTool.value)) {
		// 移动端交互：进入测距/测面后固定显示“清除”
		return true;
	}
	if (activeTool.value !== 'point') return false;
	return (
		measureState.value.hasPointMeasure ||
		measureState.value.showActions ||
		measureState.value.clearable
	);
});

const syncMeasureState = () => {
	measureState.value = getMeasureState();
	if (measureState.value.hasPointMeasure) {
		activeTool.value = 'point';
		return;
	}
	if (
		activeTool.value === 'point' &&
		!measureState.value.isDrawing &&
		!measureState.value.isEditing &&
		!measureState.value.hasMeasure
	) {
		activeTool.value = '';
	}
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
			<div class="map-control-panel__toolbar map-control-panel__toolbar--measure">
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
								<MapMeasureIcon :name="tool.id" />
							</span>
							<span class="map-control-panel__label">{{ tool.label }}</span>
						</button>
					</li>
				</ul>
			</div>

			<div class="map-control-panel__toolbar map-control-panel__toolbar--utility">
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
				</ul>
			</div>

			<div v-if="showMeasureClearButton" class="map-control-panel__actions">
				<button
					v-if="showMeasureActions"
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
					aria-label="清除"
					:class="{ 'is-touch': activeTouch === 'measure-clear' }"
					@touchstart.passive="onTouchStart('measure-clear')"
					@touchend.passive="onTouchEnd"
					@touchcancel.passive="onTouchEnd"
					@mousedown="onTouchStart('measure-clear')"
					@mouseup="onTouchEnd"
					@mouseleave="onTouchEnd"
					@click="handleMeasureClear"
				>
					<img
						:src="measureClearIcon"
						alt=""
						class="map-control-panel__action-icon"
						aria-hidden="true"
					/>
					<span class="map-control-panel__action-label">清除</span>
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
			<img :src="locateIcon" alt="" class="map-control-panel__locate-icon" aria-hidden="true" />
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
	bottom: calc(108px + env(safe-area-inset-bottom, 0px));
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
	width: 40px;
	padding: 3px 0;
	border-radius: 8px;
	background: rgba(20, 22, 26, 0.88);
	border: 1px solid rgba(255, 255, 255, 0.08);
	box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
	backdrop-filter: blur(8px);
	-webkit-backdrop-filter: blur(8px);
}

.map-control-panel__toolbar--measure,
.map-control-panel__toolbar--utility {
	display: flex;
	flex-direction: column;
}

.map-control-panel__actions {
	display: flex;
	flex-direction: column;
	gap: 6px;
	width: 40px;
}

.map-control-panel__action-btn {
	width: 40px;
	height: 40px;
	padding: 6px 0;
	border: 0;
	border-radius: 8px;
	font-size: 11px;
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
	background: linear-gradient(180deg, #4c8dff 0%, #2f6fe6 100%);
	color: #ffffff;
	box-shadow: 0 2px 8px rgba(47, 111, 230, 0.35);
}

.map-control-panel__action-btn--clear {
	background: rgba(20, 22, 26, 0.92);
	border: 1px solid rgba(255, 255, 255, 0.12);
	color: #fff;
}

.map-control-panel__action-icon {
	display: block;
	width: 18px;
	height: 18px;
	object-fit: contain;
	margin: 0 auto;
}

.map-control-panel__action-label {
	display: block;
	margin-top: 1px;
	font-size: 9px;
	line-height: 1.2;
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
	gap: 1px;
	width: 40px;
	padding: 6px 0;
	border: 0;
	background: transparent;
	color: #fff;
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
	width: 18px;
	height: 18px;
}

.map-control-panel__label {
	font-size: 9px;
	line-height: 1.2;
	white-space: nowrap;
}

.map-control-panel__locate {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 36px;
	height: 36px;
	padding: 0;
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 8px;
	background: rgba(20, 22, 26, 0.88);
	box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
	backdrop-filter: blur(8px);
	-webkit-backdrop-filter: blur(8px);
	cursor: pointer;
	-webkit-tap-highlight-color: transparent;
	transition: transform 0.1s ease;

	&:active,
	&.is-touch {
		transform: scale(0.94);
	}

	&.locating .map-control-panel__locate-icon {
		animation: mapControlLocateSpin 1.2s linear infinite;
	}
}

.map-control-panel__locate-icon {
	display: block;
	width: 22px;
	height: 22px;
	object-fit: contain;
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
		bottom: calc(106px + env(safe-area-inset-bottom, 0px));
	}
}
</style>
