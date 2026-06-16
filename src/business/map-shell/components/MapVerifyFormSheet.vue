<script setup>
import { computed, inject, onBeforeUnmount, reactive, ref, watch } from 'vue';
import DraggableBottomSheet from '../../../components/DraggableBottomSheet.vue';
import NavMapActionSheet from '../../nav-demo/components/NavMapActionSheet.vue';
import { MAP_UI_OVERLAY_KEY } from '../composables/useMapUiOverlay.js';
import { addPhotoWatermark } from '../utils/addPhotoWatermark.js';

const visible = defineModel('visible', { type: Boolean, default: false });

const props = defineProps({
	detail: {
		type: Object,
		default: null
	}
});

const emit = defineEmits(['submit', 'close', 'back']);

const mapUiOverlay = inject(MAP_UI_OVERLAY_KEY, null);

const navSheetVisible = ref(false);
const photoInputRef = ref(null);
const photoProcessing = ref(false);
const photoPreviewUrl = ref('');
const photoPreviewOpen = ref(false);

const createDefaultForm = () => ({
	includeInLedger: true,
	isVerified: true,
	opinion: '',
	remarks: '',
	photoName: '',
	photoFile: null
});

const form = reactive(createDefaultForm());

const inspectorName = 'M.佑先生';

const verifyTime = computed(() => {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, '0');
	const day = String(now.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
});

const infoRows = computed(() => {
	const detail = props.detail;
	if (!detail) {
		return [];
	}

	const coordinates = detail.coordinates;
	const coordinateText =
		coordinates?.lng !== undefined && coordinates?.lat !== undefined
			? `${coordinates.lng}, ${coordinates.lat}`
			: '';

	return [
		{ label: '图斑编号', value: detail.patchNo || detail.objectNo },
		{ label: '所属变电站', value: detail.substationName },
		{ label: '核查人', value: inspectorName },
		{ label: '核查时间', value: verifyTime.value },
		{ label: '坐标', value: coordinateText }
	].filter((row) => row.value);
});

const navPoi = computed(() => {
	const coordinates = props.detail?.coordinates;
	if (!coordinates) {
		return null;
	}

	return {
		lng: coordinates.lng,
		lat: coordinates.lat,
		name: props.detail?.substationName || '核查位置'
	};
});

const close = () => {
	visible.value = false;
};

const onBack = () => {
	emit('back');
	close();
};

const revokePhotoPreview = () => {
	if (photoPreviewUrl.value) {
		URL.revokeObjectURL(photoPreviewUrl.value);
		photoPreviewUrl.value = '';
	}
	photoPreviewOpen.value = false;
};

const setPhotoPreview = (file) => {
	revokePhotoPreview();
	if (file) {
		photoPreviewUrl.value = URL.createObjectURL(file);
	}
};

const resetForm = () => {
	Object.assign(form, createDefaultForm());
	revokePhotoPreview();
	if (photoInputRef.value) {
		photoInputRef.value.value = '';
	}
};

const getWatermarkOptions = () => {
	const coordinates = props.detail?.coordinates;
	return {
		inspector: inspectorName,
		shotTime: new Date(),
		lng: coordinates?.lng ?? '',
		lat: coordinates?.lat ?? '',
		deviceName: props.detail?.substationName || props.detail?.name || '未知设备'
	};
};

const onPhotoChange = async (event) => {
	const file = event.target.files?.[0];
	if (!file) {
		form.photoName = '';
		form.photoFile = null;
		revokePhotoPreview();
		return;
	}

	photoProcessing.value = true;
	try {
		const watermarkedFile = await addPhotoWatermark(file, getWatermarkOptions());
		form.photoFile = watermarkedFile;
		form.photoName = watermarkedFile.name;
		setPhotoPreview(watermarkedFile);
	} catch (error) {
		console.error('[MapVerify] photo watermark failed', error);
		form.photoName = '';
		form.photoFile = null;
		revokePhotoPreview();
		if (photoInputRef.value) {
			photoInputRef.value.value = '';
		}
	} finally {
		photoProcessing.value = false;
	}
};

const openPhotoPreview = () => {
	if (photoPreviewUrl.value) {
		photoPreviewOpen.value = true;
	}
};

const closePhotoPreview = () => {
	photoPreviewOpen.value = false;
};

const openNavigation = () => {
	if (!navPoi.value) {
		return;
	}
	navSheetVisible.value = true;
};

const onSubmit = () => {
	emit('submit', {
		...form,
		detail: props.detail
	});
	close();
};

const onSheetAfterClose = () => {
	mapUiOverlay?.exitOverlay();
	emit('close');
};

watch(visible, (open) => {
	if (open) {
		resetForm();
		mapUiOverlay?.enterOverlay();
	}
});

onBeforeUnmount(() => {
	revokePhotoPreview();
	if (visible.value) {
		mapUiOverlay?.exitOverlay();
	}
});
</script>

<template>
	<DraggableBottomSheet
		v-model:visible="visible"
		aria-label="核查信息"
		theme="dark"
		panel-class="map-verify-form-sheet__panel"
		peek-height="42vh"
		@after-close="onSheetAfterClose"
	>
		<template #header>
			<div class="map-verify-form-sheet__header">
				<div class="map-verify-form-sheet__header-start">
					<button
						type="button"
						class="map-verify-form-sheet__back"
						aria-label="返回"
						@click="onBack"
					>
						<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
							<path
								d="M15 6L9 12L15 18"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
					</button>
					<h2 class="map-verify-form-sheet__title">核查信息</h2>
				</div>
				<button
					type="button"
					class="map-verify-form-sheet__nav"
					:disabled="!navPoi"
					@click="openNavigation"
				>
					导航
				</button>
			</div>
		</template>

		<div class="map-verify-form-sheet__body">
			<section class="map-verify-form-sheet__info-card">
				<dl class="map-verify-form-sheet__info-list">
					<div
						v-for="row in infoRows"
						:key="row.label"
						class="map-verify-form-sheet__info-row"
					>
						<dt class="map-verify-form-sheet__info-label">{{ row.label }}</dt>
						<dd class="map-verify-form-sheet__info-value">{{ row.value }}</dd>
					</div>
				</dl>
			</section>

			<section class="map-verify-form-sheet__form">
				<div class="map-verify-form-sheet__field">
					<label class="map-verify-form-sheet__field-label">
						<span class="map-verify-form-sheet__required">*</span>
						是否纳入台账
					</label>
					<button
						type="button"
						class="map-verify-form-sheet__switch"
						:class="{ 'is-on': form.includeInLedger }"
						role="switch"
						:aria-checked="form.includeInLedger"
						@click="form.includeInLedger = !form.includeInLedger"
					>
						<span class="map-verify-form-sheet__switch-thumb" />
					</button>
				</div>

				<div class="map-verify-form-sheet__field">
					<label class="map-verify-form-sheet__field-label">
						<span class="map-verify-form-sheet__required">*</span>
						是否核查
					</label>
					<button
						type="button"
						class="map-verify-form-sheet__switch"
						:class="{ 'is-on': form.isVerified }"
						role="switch"
						:aria-checked="form.isVerified"
						@click="form.isVerified = !form.isVerified"
					>
						<span class="map-verify-form-sheet__switch-thumb" />
					</button>
				</div>

				<div class="map-verify-form-sheet__field map-verify-form-sheet__field--photo">
					<div class="map-verify-form-sheet__photo-row">
						<label class="map-verify-form-sheet__field-label">
							<span class="map-verify-form-sheet__required">*</span>
							核查拍照
						</label>
						<label
							class="map-verify-form-sheet__photo-btn"
							:class="{ 'is-disabled': photoProcessing }"
						>
							<input
								ref="photoInputRef"
								class="map-verify-form-sheet__photo-input"
								type="file"
								accept="image/*"
								capture="environment"
								:disabled="photoProcessing"
								@change="onPhotoChange"
							/>
							{{
								photoProcessing
									? '水印处理中...'
									: form.photoFile
										? '重拍'
										: '去拍照'
							}}
						</label>
					</div>
					<button
						v-if="photoPreviewUrl"
						type="button"
						class="map-verify-form-sheet__photo-preview"
						aria-label="预览核查照片"
						@click="openPhotoPreview"
					>
						<img
							class="map-verify-form-sheet__photo-preview-img"
							:src="photoPreviewUrl"
							alt="核查照片预览"
						/>
						<span class="map-verify-form-sheet__photo-preview-hint">点击预览</span>
					</button>
				</div>

				<div class="map-verify-form-sheet__field map-verify-form-sheet__field--input">
					<label class="map-verify-form-sheet__field-label">核查意见</label>
					<input
						v-model="form.opinion"
						class="map-verify-form-sheet__input"
						type="text"
						placeholder="请输入"
					/>
				</div>

				<div class="map-verify-form-sheet__field map-verify-form-sheet__field--input">
					<label class="map-verify-form-sheet__field-label">备注</label>
					<input
						v-model="form.remarks"
						class="map-verify-form-sheet__input"
						type="text"
						placeholder="请输入"
					/>
				</div>
			</section>
		</div>

		<template #footer>
			<footer class="map-verify-form-sheet__footer">
				<button
					type="button"
					class="map-verify-form-sheet__btn map-verify-form-sheet__btn--ghost"
					@click="resetForm"
				>
					重置
				</button>
				<button
					type="button"
					class="map-verify-form-sheet__btn map-verify-form-sheet__btn--primary"
					@click="onSubmit"
				>
					提交
				</button>
			</footer>
		</template>
	</DraggableBottomSheet>

	<NavMapActionSheet v-model:visible="navSheetVisible" :poi="navPoi" />

	<Teleport to="body">
		<div
			v-if="photoPreviewOpen"
			class="map-verify-photo-viewer"
			role="dialog"
			aria-modal="true"
			aria-label="核查照片预览"
			@click="closePhotoPreview"
		>
			<button
				type="button"
				class="map-verify-photo-viewer__close"
				aria-label="关闭预览"
				@click.stop="closePhotoPreview"
			>
				关闭
			</button>
			<img
				class="map-verify-photo-viewer__img"
				:src="photoPreviewUrl"
				alt="核查照片"
				@click.stop
			/>
		</div>
	</Teleport>
</template>

<style scoped lang="scss">
.map-verify-form-sheet__header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	padding: 16px 16px 12px;
	flex-shrink: 0;
}

.map-verify-form-sheet__header-start {
	display: flex;
	align-items: center;
	gap: 4px;
	min-width: 0;
}

.map-verify-form-sheet__back {
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	width: 32px;
	height: 32px;
	margin-left: -6px;
	padding: 0;
	border: 0;
	background: transparent;
	color: var(--app-accent, #1cded4);
	cursor: pointer;
	-webkit-tap-highlight-color: transparent;

	svg {
		display: block;
		width: 22px;
		height: 22px;
	}

	&:active {
		opacity: 0.85;
	}
}

.map-verify-form-sheet__title {
	margin: 0;
	font-size: 16px;
	font-weight: 500;
	color: var(--app-accent, #1cded4);
	line-height: 1.3;
}

.map-verify-form-sheet__nav {
	padding: 0;
	border: 0;
	background: transparent;
	color: var(--app-accent, #1cded4);
	font-size: 14px;
	font-weight: 500;
	line-height: 1.4;
	cursor: pointer;
	-webkit-tap-highlight-color: transparent;

	&:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	&:active:not(:disabled) {
		opacity: 0.85;
	}
}

.map-verify-form-sheet__body {
	padding: 0 16px;
	box-sizing: border-box;
}

.map-verify-form-sheet__info-card {
	margin-bottom: 8px;
	padding: 12px 14px;
	border-radius: 10px;
	background: rgba(255, 255, 255, 0.04);
}

.map-verify-form-sheet__info-list {
	margin: 0;
}

.map-verify-form-sheet__info-row {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 16px;
	min-width: 0;
	padding: 10px 0;

	&:not(:last-child) {
		border-bottom: 1px solid rgba(255, 255, 255, 0.05);
	}
}

.map-verify-form-sheet__info-label {
	margin: 0;
	flex-shrink: 0;
	font-size: 13px;
	color: rgba(255, 255, 255, 0.55);
	line-height: 1.4;
}

.map-verify-form-sheet__info-value {
	margin: 0;
	min-width: 0;
	text-align: right;
	font-size: 13px;
	color: #fff;
	line-height: 1.4;
	word-break: break-all;
	overflow-wrap: anywhere;
}

.map-verify-form-sheet__form {
	padding-bottom: 8px;
}

.map-verify-form-sheet__field {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	min-width: 0;
	padding: 14px 0;
	border-bottom: 1px solid rgba(255, 255, 255, 0.06);

	&--input {
		flex-direction: column;
		align-items: stretch;
		gap: 10px;
	}

	&--photo {
		flex-direction: column;
		align-items: stretch;
		gap: 12px;
	}
}

.map-verify-form-sheet__field-label {
	display: flex;
	align-items: center;
	gap: 2px;
	min-width: 0;
	flex: 1;
	font-size: 14px;
	color: rgba(255, 255, 255, 0.85);
	line-height: 1.4;
}

.map-verify-form-sheet__required {
	color: #ff4d4f;
	font-size: 14px;
	line-height: 1;
}

.map-verify-form-sheet__switch {
	position: relative;
	flex-shrink: 0;
	width: 44px;
	height: 24px;
	padding: 0;
	border: 0;
	border-radius: 999px;
	background: rgba(255, 255, 255, 0.18);
	cursor: pointer;
	transition: background 0.2s ease;
	-webkit-tap-highlight-color: transparent;

	&.is-on {
		background: #22c55e;
	}
}

.map-verify-form-sheet__switch-thumb {
	position: absolute;
	top: 2px;
	left: 2px;
	width: 20px;
	height: 20px;
	border-radius: 50%;
	background: #fff;
	box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
	transition: transform 0.2s ease;
}

.map-verify-form-sheet__switch.is-on .map-verify-form-sheet__switch-thumb {
	transform: translateX(20px);
}

.map-verify-form-sheet__photo-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	min-width: 0;
}

.map-verify-form-sheet__photo-btn {
	flex-shrink: 0;
	max-width: 50%;
	padding: 6px 14px;
	border: 0;
	border-radius: 999px;
	background: var(--app-accent, #1cded4);
	color: #fff;
	font-size: 13px;
	font-weight: 500;
	line-height: 1.4;
	cursor: pointer;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	-webkit-tap-highlight-color: transparent;

	&:active:not(.is-disabled) {
		opacity: 0.85;
	}

	&.is-disabled {
		opacity: 0.65;
		cursor: not-allowed;
		pointer-events: none;
	}
}

.map-verify-form-sheet__photo-input {
	display: none;
}

.map-verify-form-sheet__photo-preview {
	position: relative;
	display: block;
	width: 100%;
	padding: 0;
	border: 0;
	border-radius: 10px;
	overflow: hidden;
	background: rgba(255, 255, 255, 0.04);
	cursor: pointer;
	-webkit-tap-highlight-color: transparent;

	&:active {
		opacity: 0.92;
	}
}

.map-verify-form-sheet__photo-preview-img {
	display: block;
	width: 100%;
	max-height: 180px;
	object-fit: cover;
}

.map-verify-form-sheet__photo-preview-hint {
	position: absolute;
	right: 10px;
	bottom: 10px;
	padding: 4px 10px;
	border-radius: 999px;
	background: rgba(0, 0, 0, 0.55);
	color: #fff;
	font-size: 12px;
	line-height: 1.4;
}

.map-verify-photo-viewer {
	position: fixed;
	inset: 0;
	z-index: 2700;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 16px;
	box-sizing: border-box;
	background: rgba(0, 0, 0, 0.88);
}

.map-verify-photo-viewer__close {
	position: absolute;
	top: calc(12px + env(safe-area-inset-top, 0px));
	right: 16px;
	z-index: 1;
	padding: 6px 14px;
	border: 0;
	border-radius: 999px;
	background: rgba(255, 255, 255, 0.16);
	color: #fff;
	font-size: 14px;
	line-height: 1.4;
	cursor: pointer;
	-webkit-tap-highlight-color: transparent;

	&:active {
		opacity: 0.85;
	}
}

.map-verify-photo-viewer__img {
	display: block;
	max-width: 100%;
	max-height: calc(100vh - 80px);
	max-height: calc(100dvh - 80px);
	object-fit: contain;
}

.map-verify-form-sheet__input {
	width: 100%;
	max-width: 100%;
	box-sizing: border-box;
	padding: 10px 12px;
	border: 0;
	border-radius: 8px;
	background: rgba(255, 255, 255, 0.06);
	color: #fff;
	font-size: 14px;
	line-height: 1.4;
	outline: none;

	&::placeholder {
		color: rgba(255, 255, 255, 0.35);
	}
}

.map-verify-form-sheet__footer {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 16px;
	width: 100%;
	box-sizing: border-box;
	padding: 14px 16px 16px;
	flex-shrink: 0;
}

.map-verify-form-sheet__btn {
	flex: 1;
	min-width: 0;
	max-width: 140px;
	padding: 10px 16px;
	border-radius: 999px;
	font-size: 14px;
	font-weight: 500;
	line-height: 1.4;
	cursor: pointer;
	-webkit-tap-highlight-color: transparent;
	transition: opacity 0.15s ease;

	&:active {
		opacity: 0.85;
	}
}

.map-verify-form-sheet__btn--ghost {
	border: 1px solid rgba(255, 255, 255, 0.18);
	background: transparent;
	color: rgba(255, 255, 255, 0.75);
}

.map-verify-form-sheet__btn--primary {
	border: 0;
	background: var(--app-accent, #1cded4);
	color: #fff;
}
</style>
