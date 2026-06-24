<script setup>
import { computed, inject, onBeforeUnmount, reactive, ref, watch } from 'vue';
import DraggableBottomSheet from '../../../components/DraggableBottomSheet.vue';
import NavMapActionSheet from '../../nav-demo/components/NavMapActionSheet.vue';
import { MAP_UI_OVERLAY_KEY } from '../composables/useMapUiOverlay.js';
import { addPhotoWatermark } from '../utils/addPhotoWatermark.js';
import { calcDistanceMeters, formatDistanceText } from '../utils/calcGeoDistance.js';
import { reverseGeocode } from '../utils/tiandituGeocoder.js';
import { getCurrentLocation } from '../../../utils/locationPermission.js';
import {
	parseAbnormalPhotoUrls,
	saveAbnormalMonitorAdditionalInfo,
	uploadAbnormalSurfacePhotoUrls
} from '../../../api/statistics.js';
import { getUserProfile } from '../../../utils/auth.js';

const visible = defineModel('visible', { type: Boolean, default: false });

const props = defineProps({
	detail: {
		type: Object,
		default: null
	}
});

const emit = defineEmits(['submit', 'success', 'close', 'back']);

const mapUiOverlay = inject(MAP_UI_OVERLAY_KEY, null);

const navSheetVisible = ref(false);
const verifyPhotoInputRef = ref(null);
const verifyPhotoProcessing = ref(false);
const verifyPhotos = ref([]);
const verifyPhotoTip = ref('');

const disposePhotoInputRef = ref(null);
const disposePhotoProcessing = ref(false);
const disposePhotos = ref([]);
const disposePhotoTip = ref('');

const photoPreviewIndex = ref(-1);
const photoPreviewOpen = ref(false);
const photoPreviewGroup = ref('verify'); // 'verify' | 'dispose'
const submitting = ref(false);
const submitTip = ref('');

const createDefaultForm = () => ({
	includeInLedger: true,
	isVerified: true,
	opinion: '',
	remarks: ''
});

const form = reactive(createDefaultForm());

const additionalInfo = computed(() => props.detail?.additionalInfo);

const isCheckReadonly = computed(() => Number(additionalInfo.value?.checkStatus) === 1);

const isDisposeReadonly = computed(() => Number(additionalInfo.value?.disposalStatus) === 1);

const showDisposeSection = computed(() => isCheckReadonly.value || form.isVerified);

const canSubmit = computed(() => !isCheckReadonly.value || !isDisposeReadonly.value);

const sheetTitle = computed(() => (isCheckReadonly.value ? '核查信息（已核查）' : '核查信息'));

const submitButtonLabel = computed(() => {
	if (submitting.value) {
		return '提交中...';
	}
	if (isCheckReadonly.value) {
		return '提交处置';
	}
	return '提交';
});

const inspectorName = computed(
	() => props.detail?.additionalInfo?.checkUserName || getUserProfile().username || '—'
);

const verifyTime = computed(() => {
	const checkTime = props.detail?.additionalInfo?.checkTime;
	if (checkTime) {
		return String(checkTime);
	}

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
	const lng = coordinates?.lng ?? detail.lng;
	const lat = coordinates?.lat ?? detail.lat;
	const coordinateText =
		lng !== undefined &&
		lng !== null &&
		lng !== '' &&
		lat !== undefined &&
		lat !== null &&
		lat !== ''
			? `${lng}, ${lat}`
			: '';

	return [
		{ label: '图斑编号', value: detail.patchNo || detail.objectNo },
		...(detail.kind === 'line' ? [{ label: '线路名称', value: detail.lineName }] : []),
		{ label: '所属变电站', value: detail.substationName },
		{ label: '核查人', value: inspectorName.value },
		{ label: '核查时间', value: verifyTime.value },
		{ label: '坐标', value: coordinateText }
	].filter((row) => row.value);
});

const navPoi = computed(() => {
	const detail = props.detail;
	if (!detail) {
		return null;
	}

	const coordinates = detail.coordinates;
	const lng = coordinates?.lng ?? detail.lng;
	const lat = coordinates?.lat ?? detail.lat;
	if (
		lng === undefined ||
		lng === null ||
		lng === '' ||
		lat === undefined ||
		lat === null ||
		lat === ''
	) {
		return null;
	}

	return {
		lng: Number(lng),
		lat: Number(lat),
		name: detail.substationName || detail.objectNo || '核查位置'
	};
});

const close = () => {
	visible.value = false;
};

const onBack = () => {
	emit('back');
	close();
};

const revokePhotoItem = (item) => {
	if (item?.file && item?.previewUrl?.startsWith('blob:')) {
		URL.revokeObjectURL(item.previewUrl);
	}
};

const revokeAllPhotos = () => {
	verifyPhotos.value.forEach(revokePhotoItem);
	verifyPhotos.value = [];
	disposePhotos.value.forEach(revokePhotoItem);
	disposePhotos.value = [];
	photoPreviewIndex.value = -1;
	photoPreviewOpen.value = false;
	verifyPhotoTip.value = '';
	disposePhotoTip.value = '';
};

const createPhotoItem = (file) => ({
	id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
	file,
	name: file.name,
	previewUrl: URL.createObjectURL(file)
});

const createRemotePhotoItem = (url, index) => ({
	id: `remote-${index}-${url}`,
	url,
	name: `核查照片 ${index + 1}`,
	previewUrl: url
});

const populateFormFromAdditionalInfo = () => {
	const info = props.detail?.additionalInfo;
	if (!info) {
		return;
	}

	if (info.isAccounted !== undefined && info.isAccounted !== null) {
		form.includeInLedger = Number(info.isAccounted) === 1;
	}
	form.opinion = info.checkOpinion || '';
	form.remarks = info.checkRemark || '';

	const checkPhotos = parseAbnormalPhotoUrls(info.checkPhotos);
	verifyPhotos.value = checkPhotos.map((url, index) => createRemotePhotoItem(url, index));

	const disposalPhotos = parseAbnormalPhotoUrls(info.disposalPhotos);
	disposePhotos.value = disposalPhotos.map((url, index) => ({
		...createRemotePhotoItem(url, index),
		name: `处置照片 ${index + 1}`
	}));
};

const resolvePhotoUrls = async (photos, uploadQuery) => {
	const urls = new Array(photos.length);
	const filesToUpload = [];
	const fileIndexes = [];

	photos.forEach((item, index) => {
		if (item.file) {
			filesToUpload.push(item.file);
			fileIndexes.push(index);
			return;
		}

		if (item.url) {
			urls[index] = item.url;
		}
	});

	if (filesToUpload.length) {
		const uploaded = await uploadAbnormalSurfacePhotoUrls(filesToUpload, uploadQuery);
		fileIndexes.forEach((index, uploadIndex) => {
			urls[index] = uploaded[uploadIndex];
		});
	}

	return urls.filter(Boolean);
};

const resetForm = () => {
	submitTip.value = '';

	if (isCheckReadonly.value) {
		disposePhotos.value.forEach(revokePhotoItem);
		disposePhotos.value = [];
		disposePhotoTip.value = '';
		if (disposePhotoInputRef.value) {
			disposePhotoInputRef.value.value = '';
		}

		const disposalPhotos = parseAbnormalPhotoUrls(additionalInfo.value?.disposalPhotos);
		disposePhotos.value = disposalPhotos.map((url, index) => ({
			...createRemotePhotoItem(url, index),
			name: `处置照片 ${index + 1}`
		}));
		return;
	}

	Object.assign(form, createDefaultForm());
	revokeAllPhotos();
	if (verifyPhotoInputRef.value) {
		verifyPhotoInputRef.value.value = '';
	}
	if (disposePhotoInputRef.value) {
		disposePhotoInputRef.value.value = '';
	}
};

const getWatermarkOptions = async () => {
	const patchNo = props.detail?.patchNo || props.detail?.objectNo || '未知';
	const patchCoords = props.detail?.coordinates;
	let lng = patchCoords?.lng ?? '';
	let lat = patchCoords?.lat ?? '';
	let address = '';
	let distance = patchCoords?.lng != null && patchCoords?.lat != null ? '0m（图斑中心）' : '未知';

	try {
		const current = await getCurrentLocation();
		lng = Number(current.lng.toFixed(6));
		lat = Number(current.lat.toFixed(6));

		if (patchCoords?.lng != null && patchCoords?.lat != null) {
			distance = formatDistanceText(
				calcDistanceMeters(
					{ lng: current.lng, lat: current.lat },
					{ lng: patchCoords.lng, lat: patchCoords.lat }
				)
			);
		}
	} catch (error) {
		console.warn('[MapVerify] get current location failed', error);
	}

	if (lng !== '' && lat !== '') {
		try {
			address = await reverseGeocode(Number(lng), Number(lat));
		} catch (error) {
			console.warn('[MapVerify] reverse geocode failed', error);
		}
	}

	return {
		patchNo,
		inspector: inspectorName.value,
		shotTime: new Date(),
		distance,
		lng,
		lat,
		address
	};
};

const onVerifyPhotoChange = async (event) => {
	const files = Array.from(event.target.files || []);
	if (!files.length) {
		return;
	}

	verifyPhotoProcessing.value = true;
	try {
		for (const file of files) {
			const watermarkedFile = await addPhotoWatermark(file, await getWatermarkOptions());
			verifyPhotos.value.push(createPhotoItem(watermarkedFile));
		}
		verifyPhotoTip.value = '';
	} catch (error) {
		console.error('[MapVerify] photo watermark failed', error);
	} finally {
		if (verifyPhotoInputRef.value) {
			verifyPhotoInputRef.value.value = '';
		}
		verifyPhotoProcessing.value = false;
	}
};

const onDisposePhotoChange = async (event) => {
	const files = Array.from(event.target.files || []);
	if (!files.length) {
		return;
	}

	disposePhotoProcessing.value = true;
	try {
		for (const file of files) {
			const watermarkedFile = await addPhotoWatermark(file, await getWatermarkOptions());
			disposePhotos.value.push(createPhotoItem(watermarkedFile));
		}
		disposePhotoTip.value = '';
	} catch (error) {
		console.error('[MapVerify] photo watermark failed', error);
	} finally {
		if (disposePhotoInputRef.value) {
			disposePhotoInputRef.value.value = '';
		}
		disposePhotoProcessing.value = false;
	}
};

const removePhoto = (group, photoId) => {
	const listRef = group === 'dispose' ? disposePhotos : verifyPhotos;
	const index = listRef.value.findIndex((item) => item.id === photoId);
	if (index < 0) {
		return;
	}

	revokePhotoItem(listRef.value[index]);
	listRef.value.splice(index, 1);

	if (
		photoPreviewOpen.value &&
		photoPreviewGroup.value === group &&
		photoPreviewIndex.value === index
	) {
		photoPreviewOpen.value = false;
		photoPreviewIndex.value = -1;
	} else if (photoPreviewIndex.value > index) {
		photoPreviewIndex.value -= 1;
	}
};

const openPhotoPreview = (group, index) => {
	const listRef = group === 'dispose' ? disposePhotos : verifyPhotos;
	if (listRef.value[index]) {
		photoPreviewGroup.value = group;
		photoPreviewIndex.value = index;
		photoPreviewOpen.value = true;
	}
};

const photoPreviewUrl = computed(() => {
	const list = photoPreviewGroup.value === 'dispose' ? disposePhotos.value : verifyPhotos.value;
	return list[photoPreviewIndex.value]?.previewUrl || '';
});

const closePhotoPreview = () => {
	photoPreviewOpen.value = false;
};

const openNavigation = () => {
	if (!navPoi.value) {
		return;
	}
	navSheetVisible.value = true;
};

const onSubmit = async () => {
	if (submitting.value || !canSubmit.value) {
		return;
	}

	submitTip.value = '';
	verifyPhotoTip.value = '';
	disposePhotoTip.value = '';

	const surfaceId = props.detail?.id;
	if (surfaceId === undefined || surfaceId === null || surfaceId === '') {
		submitTip.value = '缺少图斑信息，无法提交';
		return;
	}

	const additionalInfoId = props.detail?.additionalInfoId;
	if (additionalInfoId === undefined || additionalInfoId === null || additionalInfoId === '') {
		submitTip.value = '缺少附加信息，无法提交';
		return;
	}

	const uploadQuery = { id: surfaceId };
	const info = additionalInfo.value;

	if (isCheckReadonly.value) {
		if (!disposePhotos.value.length) {
			disposePhotoTip.value = '请至少拍摄一张处置照片';
			return;
		}
	} else {
		if (!verifyPhotos.value.length) {
			verifyPhotoTip.value = '请至少拍摄一张核查照片';
			return;
		}

		if (form.isVerified && !disposePhotos.value.length) {
			disposePhotoTip.value = '请至少拍摄一张处置照片';
			return;
		}
	}

	submitting.value = true;
	try {
		let payload;
		let checkPhotoUrls = [];
		let disposalPhotoUrls = [];

		if (isCheckReadonly.value) {
			disposalPhotoUrls = await resolvePhotoUrls(disposePhotos.value, uploadQuery);
			payload = {
				id: additionalInfoId,
				isAccounted: info?.isAccounted ?? 0,
				checkStatus: 1,
				checkType: info?.checkType ?? 0,
				disposalStatus: 1,
				checkOpinion: info?.checkOpinion || '',
				checkRemark: info?.checkRemark || '',
				checkPhotos: info?.checkPhotos || JSON.stringify([]),
				disposalPhotos: JSON.stringify(disposalPhotoUrls)
			};
		} else {
			checkPhotoUrls = await resolvePhotoUrls(verifyPhotos.value, uploadQuery);
			disposalPhotoUrls = form.isVerified
				? await resolvePhotoUrls(disposePhotos.value, uploadQuery)
				: [];

			payload = {
				id: additionalInfoId,
				isAccounted: form.includeInLedger ? 1 : 0,
				checkStatus: 1,
				checkType: 0,
				disposalStatus: form.isVerified ? 1 : 0,
				checkOpinion: form.opinion?.trim() || '',
				checkRemark: form.remarks?.trim() || '',
				checkPhotos: JSON.stringify(checkPhotoUrls),
				...(form.isVerified ? { disposalPhotos: JSON.stringify(disposalPhotoUrls) } : {})
			};
		}

		await saveAbnormalMonitorAdditionalInfo(payload);

		const verifyPhotoFiles = verifyPhotos.value.map((item) => item.file).filter(Boolean);
		const disposePhotoFiles = disposePhotos.value.map((item) => item.file).filter(Boolean);

		const submitPayload = {
			...form,
			verifyPhotoFiles,
			verifyPhotoNames: verifyPhotos.value.map((item) => item.name),
			disposePhotoFiles,
			disposePhotoNames: disposePhotos.value.map((item) => item.name),
			checkPhotoUrls,
			disposalPhotoUrls,
			detail: props.detail
		};

		const successMessage = isCheckReadonly.value
			? '处置信息提交成功'
			: form.isVerified
				? '核查处置信息提交成功'
				: '核查信息提交成功';

		emit('submit', submitPayload);
		emit('success', { ...submitPayload, successMessage });
		close();
	} catch (error) {
		console.error('[MapVerify] submit failed', error);
		submitTip.value = error?.message || '提交失败，请稍后重试';
	} finally {
		submitting.value = false;
	}
};

const onSheetAfterClose = () => {
	mapUiOverlay?.exitOverlay();
	emit('close');
};

watch(visible, (open) => {
	if (open) {
		resetForm();
		populateFormFromAdditionalInfo();
		mapUiOverlay?.enterOverlay();
	}
});

watch(
	() => form.isVerified,
	(isVerified) => {
		if (!isVerified) {
			disposePhotoTip.value = '';
		}
	}
);

onBeforeUnmount(() => {
	revokeAllPhotos();
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
		drag-surface="panel"
		body-scroll="inner"
		peek-height="38vh"
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
					<h2 class="map-verify-form-sheet__title">{{ sheetTitle }}</h2>
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
			<div class="map-verify-form-sheet__scroll" data-bottom-sheet-scroll>
			<section class="map-verify-form-sheet__verify-card">
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

				<div class="map-verify-form-sheet__form" :class="{ 'is-readonly': isCheckReadonly }">
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
							:disabled="isCheckReadonly"
							@click="form.includeInLedger = !form.includeInLedger"
						>
							<span class="map-verify-form-sheet__switch-thumb" />
						</button>
					</div>

					<div v-if="!isCheckReadonly" class="map-verify-form-sheet__field">
						<label class="map-verify-form-sheet__field-label">
							<span class="map-verify-form-sheet__required">*</span>
							是否处置
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
								v-if="!isCheckReadonly"
								class="map-verify-form-sheet__photo-btn"
								:class="{ 'is-disabled': verifyPhotoProcessing }"
							>
								<input
									ref="verifyPhotoInputRef"
									class="map-verify-form-sheet__photo-input"
									type="file"
									accept="image/*"
									capture="environment"
									multiple
									:disabled="verifyPhotoProcessing"
									@change="onVerifyPhotoChange"
								/>
								{{
									verifyPhotoProcessing
										? '水印处理中...'
										: verifyPhotos.length
											? '继续拍照'
											: '去拍照'
								}}
							</label>
						</div>
						<p v-if="verifyPhotoTip" class="map-verify-form-sheet__photo-tip">
							{{ verifyPhotoTip }}
						</p>
						<div v-if="verifyPhotos.length" class="map-verify-form-sheet__photo-grid">
							<div
								v-for="(photo, index) in verifyPhotos"
								:key="photo.id"
								class="map-verify-form-sheet__photo-item"
							>
								<button
									type="button"
									class="map-verify-form-sheet__photo-preview"
									:aria-label="`预览核查照片 ${index + 1}`"
									@click="openPhotoPreview('verify', index)"
								>
									<img
										class="map-verify-form-sheet__photo-preview-img"
										:src="photo.previewUrl"
										:alt="`核查照片 ${index + 1}`"
									/>
								</button>
								<button
									v-if="!isCheckReadonly"
									type="button"
									class="map-verify-form-sheet__photo-remove"
									aria-label="删除照片"
									@click.stop="removePhoto('verify', photo.id)"
								>
									×
								</button>
							</div>
						</div>
					</div>

					<div class="map-verify-form-sheet__field map-verify-form-sheet__field--input">
						<label class="map-verify-form-sheet__field-label">核查意见</label>
						<input
							v-model="form.opinion"
							class="map-verify-form-sheet__input"
							type="text"
							placeholder="请输入"
							:readonly="isCheckReadonly"
						/>
					</div>

					<div class="map-verify-form-sheet__field map-verify-form-sheet__field--input">
						<label class="map-verify-form-sheet__field-label">备注</label>
						<input
							v-model="form.remarks"
							class="map-verify-form-sheet__input"
							type="text"
							placeholder="请输入"
							:readonly="isCheckReadonly"
						/>
					</div>
				</div>
			</section>

			<div
				v-if="showDisposeSection"
				class="map-verify-form-sheet__section-title map-verify-form-sheet__section-title--accent map-verify-form-sheet__section-title--spaced"
			>
				处置信息
				<span v-if="isDisposeReadonly" class="map-verify-form-sheet__status-badge">已处置</span>
			</div>
			<section
				v-if="showDisposeSection"
				class="map-verify-form-sheet__dispose-card"
				:class="{ 'is-readonly': isDisposeReadonly }"
			>
				<!-- <div class="map-verify-form-sheet__field">
					<label class="map-verify-form-sheet__field-label">处置状态</label>
					<span class="map-verify-form-sheet__status-text">待处置</span>
				</div> -->
				<div class="map-verify-form-sheet__field">
					<label class="map-verify-form-sheet__field-label">
						<span class="map-verify-form-sheet__required">*</span>
						处置拍照
					</label>
					<label
						v-if="!isDisposeReadonly"
						class="map-verify-form-sheet__photo-btn"
						:class="{ 'is-disabled': disposePhotoProcessing }"
					>
						<input
							ref="disposePhotoInputRef"
							class="map-verify-form-sheet__photo-input"
							type="file"
							accept="image/*"
							capture="environment"
							multiple
							:disabled="disposePhotoProcessing"
							@change="onDisposePhotoChange"
						/>
						{{
							disposePhotoProcessing
								? '水印处理中...'
								: disposePhotos.length
									? '继续拍照'
									: '去拍照'
						}}
					</label>
				</div>
				<p v-if="disposePhotoTip" class="map-verify-form-sheet__photo-tip">
					{{ disposePhotoTip }}
				</p>
				<div v-if="disposePhotos.length" class="map-verify-form-sheet__photo-grid">
					<div
						v-for="(photo, index) in disposePhotos"
						:key="photo.id"
						class="map-verify-form-sheet__photo-item"
					>
						<button
							type="button"
							class="map-verify-form-sheet__photo-preview"
							:aria-label="`预览处置照片 ${index + 1}`"
							@click="openPhotoPreview('dispose', index)"
						>
							<img
								class="map-verify-form-sheet__photo-preview-img"
								:src="photo.previewUrl"
								:alt="`处置照片 ${index + 1}`"
							/>
						</button>
						<button
							v-if="!isDisposeReadonly"
							type="button"
							class="map-verify-form-sheet__photo-remove"
							aria-label="删除照片"
							@click.stop="removePhoto('dispose', photo.id)"
						>
							×
						</button>
					</div>
				</div>
			</section>
			</div>
		</div>

		<template #footer>
			<footer v-if="canSubmit" class="map-verify-form-sheet__footer">
				<p v-if="submitTip" class="map-verify-form-sheet__submit-tip">{{ submitTip }}</p>
				<div class="map-verify-form-sheet__footer-actions">
					<button
						type="button"
						class="map-verify-form-sheet__btn map-verify-form-sheet__btn--ghost"
						:disabled="submitting"
						@click="resetForm"
					>
						重置
					</button>
					<button
						type="button"
						class="map-verify-form-sheet__btn map-verify-form-sheet__btn--primary"
						:disabled="submitting"
						@click="onSubmit"
					>
						{{ submitButtonLabel }}
					</button>
				</div>
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
	gap: 10px;
	padding: 10px 14px 8px;
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
	width: 28px;
	height: 28px;
	margin-left: -4px;
	padding: 0;
	border: 0;
	background: transparent;
	color: var(--app-accent, #1cded4);
	cursor: pointer;
	-webkit-tap-highlight-color: transparent;

	svg {
		display: block;
		width: 20px;
		height: 20px;
	}

	&:active {
		opacity: 0.85;
	}
}

.map-verify-form-sheet__title {
	margin: 0;
	font-size: 14px;
	font-weight: 700;
	color: #1cded4;
	line-height: 1.3;
}

.map-verify-form-sheet__nav {
	padding: 0;
	border: 0;
	background: transparent;
	color: #1cded4;
	font-size: 14px;
	font-weight: 700;
	line-height: 1.3;
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
	flex: 1;
	min-height: 0;
	display: flex;
	flex-direction: column;
	box-sizing: border-box;
}

.map-verify-form-sheet__scroll {
	flex: 1;
	min-height: 0;
	padding: 0 14px;
	box-sizing: border-box;
	overflow-x: hidden;
	overflow-y: auto;
	-webkit-overflow-scrolling: touch;
	overscroll-behavior: contain;
	touch-action: pan-y;
}

.map-verify-form-sheet__info-card {
	margin-bottom: 4px;
	padding: 0;
	border-radius: 0;
	background: transparent;
}

.map-verify-form-sheet__dispose-card {
	margin-bottom: 4px;
	padding: 8px 12px 4px;
	border-radius: 8px;
	background: var(--app-drawer-surface, #25282c);
}

.map-verify-form-sheet__verify-card {
	margin-top: 8px;
	margin-bottom: 4px;
	padding: 8px 12px 4px;
	border-radius: 8px;
	background: var(--app-drawer-surface, #25282c);
}

.map-verify-form-sheet__info-list {
	margin: 0;
}

.map-verify-form-sheet__info-row {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 12px;
	min-width: 0;
	padding: 6px 0;

	&:not(:last-child) {
		border-bottom: 1px solid rgba(255, 255, 255, 0.05);
	}
}

.map-verify-form-sheet__info-label {
	margin: 0;
	flex-shrink: 0;
	font-size: 12px;
	color: rgba(255, 255, 255, 0.5);
	line-height: 1.3;
}

.map-verify-form-sheet__info-value {
	margin: 0;
	min-width: 0;
	text-align: right;
	font-size: 12px;
	color: rgba(255, 255, 255, 0.92);
	line-height: 1.3;
	word-break: break-all;
	overflow-wrap: anywhere;
}

.map-verify-form-sheet__form {
	padding-bottom: 4px;
}

.map-verify-form-sheet__section-title {
	padding: 9px 0 4px;
	font-size: 13px;
	font-weight: 500;
	line-height: 1.3;
	color: rgba(255, 255, 255, 0.9);
}

.map-verify-form-sheet__section-title--accent {
	color: #1cded4;
	font-weight: 700;
	font-size: 14px;
}

.map-verify-form-sheet__section-title--spaced {
	margin-top: 10px;
	margin-bottom: 2px;
	padding-left: 2px;
}

.map-verify-form-sheet__field {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
	min-width: 0;
	padding: 9px 0;
	border-bottom: 1px solid rgba(255, 255, 255, 0.05);

	&--input {
		flex-direction: column;
		align-items: stretch;
		gap: 6px;
	}

	&--photo {
		flex-direction: column;
		align-items: stretch;
		gap: 8px;
	}
}

.map-verify-form-sheet__field-label {
	display: flex;
	align-items: center;
	gap: 2px;
	min-width: 0;
	flex: 1;
	position: relative;
	padding-left: 10px;
	font-size: 13px;
	color: rgba(255, 255, 255, 0.82);
	line-height: 1.3;
}

.map-verify-form-sheet__required {
	position: absolute;
	left: 0;
	top: 0;
	color: #ff4d4f;
	font-size: 13px;
	line-height: 1;
}

.map-verify-form-sheet__switch {
	position: relative;
	flex-shrink: 0;
	width: 40px;
	height: 22px;
	padding: 0;
	border: 0;
	border-radius: 999px;
	background: rgba(255, 255, 255, 0.18);
	cursor: pointer;
	transition: background 0.2s ease;
	-webkit-tap-highlight-color: transparent;

	&:disabled {
		opacity: 0.72;
		cursor: default;
		pointer-events: none;
	}

	&.is-on {
		background: #22c55e;
	}
}

.map-verify-form-sheet__switch-thumb {
	position: absolute;
	top: 2px;
	left: 2px;
	width: 18px;
	height: 18px;
	border-radius: 50%;
	background: #fff;
	box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
	transition: transform 0.2s ease;
}

.map-verify-form-sheet__switch.is-on .map-verify-form-sheet__switch-thumb {
	transform: translateX(18px);
}

.map-verify-form-sheet__photo-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	min-width: 0;
}

.map-verify-form-sheet__photo-grid {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 8px;
}

.map-verify-form-sheet__photo-tip {
	margin: 0;
	font-size: 12px;
	line-height: 1.4;
	color: #ff7875;
}

.map-verify-form-sheet__photo-item {
	position: relative;
	min-width: 0;
}

.map-verify-form-sheet__photo-btn {
	flex-shrink: 0;
	max-width: 50%;
	padding: 4px 12px;
	border: 0;
	border-radius: 999px;
	background: var(--app-accent-gradient);
	color: #fff;
	font-size: 12px;
	font-weight: 500;
	line-height: 1.3;
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
	aspect-ratio: 1;
	padding: 0;
	border: 0;
	border-radius: 8px;
	overflow: hidden;
	background: var(--app-drawer-surface, #25282c);
	cursor: pointer;
	-webkit-tap-highlight-color: transparent;

	&:active {
		opacity: 0.92;
	}
}

.map-verify-form-sheet__status-text {
	font-size: 13px;
	color: #f59e0b;
}

.map-verify-form-sheet__photo-btn--secondary {
	background: var(--app-accent, #1cded4);
}

.map-verify-form-sheet__photo-preview-img {
	display: block;
	width: 100%;
	height: 100%;
	object-fit: cover;
}

.map-verify-form-sheet__photo-remove {
	position: absolute;
	top: 4px;
	right: 4px;
	z-index: 1;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 20px;
	height: 20px;
	padding: 0;
	border: 0;
	border-radius: 50%;
	background: rgba(0, 0, 0, 0.62);
	color: #fff;
	font-size: 14px;
	line-height: 1;
	cursor: pointer;
	-webkit-tap-highlight-color: transparent;

	&:active {
		opacity: 0.85;
	}
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
	padding: 7px 10px;
	border: 0;
	border-radius: 6px;
	background: var(--app-drawer-surface, #25282c);
	color: #fff;
	font-size: 13px;
	line-height: 1.3;
	outline: none;

	&::placeholder {
		color: rgba(255, 255, 255, 0.35);
	}

	&:read-only {
		opacity: 0.72;
		cursor: default;
	}
}

.map-verify-form-sheet__status-badge {
	margin-left: 8px;
	padding: 2px 8px;
	border-radius: 999px;
	background: rgba(34, 197, 94, 0.16);
	color: #4ade80;
	font-size: 11px;
	font-weight: 500;
	line-height: 1.3;
	vertical-align: middle;
}

.map-verify-form-sheet__form.is-readonly,
.map-verify-form-sheet__dispose-card.is-readonly {
	opacity: 0.96;
}

.map-verify-form-sheet__footer {
	display: flex;
	flex-direction: column;
	align-items: stretch;
	gap: 8px;
	width: 100%;
	box-sizing: border-box;
	padding: 8px 14px 12px;
	flex-shrink: 0;
}

.map-verify-form-sheet__footer-actions {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 12px;
	width: 100%;
}

.map-verify-form-sheet__submit-tip {
	margin: 0;
	padding: 0 4px;
	font-size: 12px;
	line-height: 1.4;
	color: #ff8f8f;
	text-align: center;
}

.map-verify-form-sheet__btn {
	flex: 1;
	min-width: 0;
	max-width: 130px;
	padding: 8px 14px;
	border-radius: 999px;
	font-size: 13px;
	font-weight: 500;
	line-height: 1.3;
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
