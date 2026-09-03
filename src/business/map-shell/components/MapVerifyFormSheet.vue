<script setup>
import { computed, inject, onBeforeUnmount, reactive, ref, watch } from 'vue';
import DraggableBottomSheet from '../../../components/DraggableBottomSheet.vue';
import LocationPermissionDialog from '../../../components/location/LocationPermissionDialog.vue';
import OptionPickerSheet from '../../../components/OptionPickerSheet.vue';
import NavMapActionSheet from '../../nav-demo/components/NavMapActionSheet.vue';
import { useLocationRequest } from '../../../composables/useLocationRequest.js';
import { MAP_UI_OVERLAY_KEY } from '../composables/useMapUiOverlay.js';
import { addPhotoWatermark } from '../utils/addPhotoWatermark.js';
import { calcDistanceMeters, formatDistanceText } from '../utils/calcGeoDistance.js';
import { reverseGeocode } from '../utils/tiandituGeocoder.js';
import {
	fetchAbnormalCorrectTypeOptions,
	fetchCorrectStatusOptions
} from '../../../api/dict.js';
import {
	correctAbnormalTask,
	parseAbnormalPhotoUrls,
	saveAbnormalMonitorAdditionalInfo,
	uploadAbnormalSurfacePhotoUrls
} from '../../../api/statistics.js';
import { getUserProfile } from '../../../utils/auth.js';
import { logMobileDebug, logMobileDebugError } from '../../../utils/mobileDebugConsole.js';

const visible = defineModel('visible', { type: Boolean, default: false });

const props = defineProps({
	detail: {
		type: Object,
		default: null
	}
});

const emit = defineEmits(['submit', 'success', 'correct-success', 'close', 'back']);

const mapUiOverlay = inject(MAP_UI_OVERLAY_KEY, null);

const {
	dialogVisible: locationDialogVisible,
	dialogMode: locationDialogMode,
	dialogErrorMessage: locationDialogMessage,
	requestLocation,
	onDialogConfirm: onLocationDialogConfirm
} = useLocationRequest();

const navSheetVisible = ref(false);
const verifyPhotoInputRef = ref(null);
const verifyPhotoProcessing = ref(false);
const verifyPhotos = ref([]);
const verifyPhotoTip = ref('');

const disposePhotoInputRef = ref(null);
const disposePhotoProcessing = ref(false);
const disposePhotos = ref([]);
const disposePhotoTip = ref('');

/** 核查/处置照片各自最多 5 张 */
const MAX_PHOTO_COUNT = 5;

const photoPreviewIndex = ref(-1);
const photoPreviewOpen = ref(false);
const photoPreviewGroup = ref('verify'); // 'verify' | 'dispose'
const submitting = ref(false);
const submitTip = ref('');

/** 改正（独立于核查/处置提交流程） */
const CORRECT_OTHER_LABEL = '其他';
const correctTypeOptions = ref([]);
const correctTypeLoading = ref(false);
const correctTypePickerVisible = ref(false);
const correcting = ref(false);
const correctTip = ref('');
const createDefaultCorrectForm = () => ({
	correctAbnormalType: '',
	correctRemark: ''
});
const correctForm = reactive(createDefaultCorrectForm());

/** 处置时的核查状态（字典 correct_staus） */
const correctStatusOptions = ref([]);
const correctStatusLoading = ref(false);
const correctStatusPickerVisible = ref(false);

const createDefaultForm = () => ({
	includeInLedger: true,
	isVerified: true,
	opinion: '',
	remarks: '',
	correctStatus: ''
});

const form = reactive(createDefaultForm());

const additionalInfo = computed(() => props.detail?.additionalInfo);

/** 有核查照片 = 已核查（核查时必传 checkPhotos） */
const hasCheckPhotos = computed(
	() => parseAbnormalPhotoUrls(additionalInfo.value?.checkPhotos).length > 0
);

/** 有处置照片 = 已处置（处置时必传 disposalPhotos） */
const hasDisposalPhotos = computed(
	() => parseAbnormalPhotoUrls(additionalInfo.value?.disposalPhotos).length > 0
);

const isCheckReadonly = computed(() => hasCheckPhotos.value);

const isDisposeReadonly = computed(() => hasDisposalPhotos.value);

const disposalStatusLabel = computed(() => (hasDisposalPhotos.value ? '已处置' : ''));

const showDisposeSection = computed(() => isCheckReadonly.value || form.isVerified);

const canSubmit = computed(() => !isCheckReadonly.value || !isDisposeReadonly.value);

const requiresDisposalPhotos = computed(
	() => isCheckReadonly.value && !hasDisposalPhotos.value
);

const sheetTitle = computed(() => '核查信息');

const selectedCorrectTypeOption = computed(() =>
	correctTypeOptions.value.find(
		(item) => String(item.value) === String(correctForm.correctAbnormalType)
	)
);

const correctTypeLabel = computed(() => selectedCorrectTypeOption.value?.label || '');

const hasCorrectType = computed(
	() => String(correctForm.correctAbnormalType ?? '').trim() !== ''
);

const isOtherCorrectType = computed(
	() => String(correctTypeLabel.value).trim() === CORRECT_OTHER_LABEL
);

const selectedCorrectStatusOption = computed(() =>
	correctStatusOptions.value.find(
		(item) => String(item.value) === String(form.correctStatus)
	)
);

const correctStatusLabel = computed(() => selectedCorrectStatusOption.value?.label || '');

/** 处置时可填核查状态：继续处置，或首次核查勾选「是否处置」 */
const showCorrectStatusField = computed(
	() => isCheckReadonly.value || form.isVerified
);

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

	// 暂隐藏经纬度展示，需要时恢复下方代码
	// const coordinates = detail.coordinates;
	// const lng = coordinates?.lng ?? detail.lng;
	// const lat = coordinates?.lat ?? detail.lat;
	// const coordinateText =
	// 	lng !== undefined &&
	// 	lng !== null &&
	// 	lng !== '' &&
	// 	lat !== undefined &&
	// 	lat !== null &&
	// 	lat !== ''
	// 		? `${lng}, ${lat}`
	// 		: '';

	return [
		{ label: '图斑编号', value: detail.patchNo || detail.objectNo },
		...(detail.kind === 'line' ? [{ label: '线路名称', value: detail.lineName }] : []),
		{ label: '所属变电站', value: detail.substationName },
		{ label: '核查人', value: inspectorName.value },
		{ label: '核查时间', value: verifyTime.value }
		// { label: '坐标', value: coordinateText }
	].filter((row) => row.value);
});

const navDestinationName = ref('目的地');

const resolveNavDestinationName = async (lng, lat) => {
	try {
		const address = await reverseGeocode(Number(lng), Number(lat));
		navDestinationName.value = address?.trim() || '目的地';
	} catch (error) {
		console.warn('[MapVerify] nav reverse geocode failed', error);
		navDestinationName.value = '目的地';
	}
};

watch(
	() => {
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

		return { lng: Number(lng), lat: Number(lat) };
	},
	(coords) => {
		if (!coords) {
			navDestinationName.value = '目的地';
			return;
		}
		resolveNavDestinationName(coords.lng, coords.lat);
	},
	{ immediate: true }
);

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
		name: navDestinationName.value
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
	form.isVerified = parseAbnormalPhotoUrls(info.disposalPhotos).length > 0 || !hasCheckPhotos.value;
	form.opinion = info.checkOpinion || '';
	form.remarks = info.checkRemark || '';
	form.correctStatus =
		info.correctStatus !== undefined && info.correctStatus !== null && info.correctStatus !== ''
			? String(info.correctStatus)
			: '';

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
		correctStatusPickerVisible.value = false;
		if (disposePhotoInputRef.value) {
			disposePhotoInputRef.value.value = '';
		}

		const info = additionalInfo.value;
		form.correctStatus =
			info?.correctStatus !== undefined &&
			info?.correctStatus !== null &&
			info?.correctStatus !== ''
				? String(info.correctStatus)
				: '';

		const disposalPhotos = parseAbnormalPhotoUrls(info?.disposalPhotos);
		disposePhotos.value = disposalPhotos.map((url, index) => ({
			...createRemotePhotoItem(url, index),
			name: `处置照片 ${index + 1}`
		}));
		return;
	}

	Object.assign(form, createDefaultForm());
	correctStatusPickerVisible.value = false;
	revokeAllPhotos();
	if (verifyPhotoInputRef.value) {
		verifyPhotoInputRef.value.value = '';
	}
	if (disposePhotoInputRef.value) {
		disposePhotoInputRef.value.value = '';
	}
};

/** 水印定位必须用用户真实位置；未授权时走与首页相同的定位弹框，绝不回退图斑坐标 */
const getWatermarkOptions = async () => {
	const patchNo = props.detail?.patchNo || props.detail?.objectNo || '未知';
	const patchCoords = props.detail?.coordinates;

	const current = await requestLocation();
	const lngNum = Number(current?.lng);
	const latNum = Number(current?.lat);
	if (!current || !Number.isFinite(lngNum) || !Number.isFinite(latNum)) {
		throw new Error('location_required');
	}

	const lng = Number(lngNum.toFixed(6));
	const lat = Number(latNum.toFixed(6));

	let distance = '未知';
	if (patchCoords?.lng != null && patchCoords?.lat != null) {
		distance = formatDistanceText(
			calcDistanceMeters(
				{ lng: lngNum, lat: latNum },
				{ lng: patchCoords.lng, lat: patchCoords.lat }
			)
		);
	}

	let address = '';
	try {
		address = await reverseGeocode(lng, lat);
	} catch (error) {
		console.warn('[MapVerify] reverse geocode failed', error);
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

	const remaining = MAX_PHOTO_COUNT - verifyPhotos.value.length;
	if (remaining <= 0) {
		verifyPhotoTip.value = `最多拍摄 ${MAX_PHOTO_COUNT} 张核查照片`;
		if (verifyPhotoInputRef.value) {
			verifyPhotoInputRef.value.value = '';
		}
		return;
	}

	const selected = files.slice(0, remaining);
	verifyPhotoProcessing.value = true;
	try {
		logMobileDebug('MapVerify.photo', {
			group: 'verify',
			count: selected.length,
			files: selected.map((f) => ({
				name: f.name,
				type: f.type,
				size: f.size,
				lastModified: f.lastModified
			}))
		});
		const watermarkOptions = await getWatermarkOptions();
		for (const file of selected) {
			const watermarkedFile = await addPhotoWatermark(file, {
				...watermarkOptions,
				shotTime: new Date()
			});
			logMobileDebug('MapVerify.photo.ok', {
				group: 'verify',
				outName: watermarkedFile.name,
				outType: watermarkedFile.type,
				outSize: watermarkedFile.size
			});
			verifyPhotos.value.push(createPhotoItem(watermarkedFile));
		}
		verifyPhotoTip.value =
			files.length > remaining ? `最多拍摄 ${MAX_PHOTO_COUNT} 张核查照片` : '';
	} catch (error) {
		logMobileDebugError('MapVerify.photo', error, { group: 'verify' });
		console.error('[MapVerify] photo watermark failed', error);
		if (error?.message === 'location_required' || error?.code === 1) {
			verifyPhotoTip.value = '请先授权定位后再拍照';
		} else {
			verifyPhotoTip.value = `拍照处理失败：${error?.message || '未知错误'}`;
		}
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

	const remaining = MAX_PHOTO_COUNT - disposePhotos.value.length;
	if (remaining <= 0) {
		disposePhotoTip.value = `最多拍摄 ${MAX_PHOTO_COUNT} 张处置照片`;
		if (disposePhotoInputRef.value) {
			disposePhotoInputRef.value.value = '';
		}
		return;
	}

	const selected = files.slice(0, remaining);
	disposePhotoProcessing.value = true;
	try {
		logMobileDebug('MapVerify.photo', {
			group: 'dispose',
			count: selected.length,
			files: selected.map((f) => ({
				name: f.name,
				type: f.type,
				size: f.size,
				lastModified: f.lastModified
			}))
		});
		const watermarkOptions = await getWatermarkOptions();
		for (const file of selected) {
			const watermarkedFile = await addPhotoWatermark(file, {
				...watermarkOptions,
				shotTime: new Date()
			});
			logMobileDebug('MapVerify.photo.ok', {
				group: 'dispose',
				outName: watermarkedFile.name,
				outType: watermarkedFile.type,
				outSize: watermarkedFile.size
			});
			disposePhotos.value.push(createPhotoItem(watermarkedFile));
		}
		disposePhotoTip.value =
			files.length > remaining ? `最多拍摄 ${MAX_PHOTO_COUNT} 张处置照片` : '';
	} catch (error) {
		logMobileDebugError('MapVerify.photo', error, { group: 'dispose' });
		console.error('[MapVerify] photo watermark failed', error);
		if (error?.message === 'location_required' || error?.code === 1) {
			disposePhotoTip.value = '请先授权定位后再拍照';
		} else {
			disposePhotoTip.value = `拍照处理失败：${error?.message || '未知错误'}`;
		}
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

const resetCorrectForm = () => {
	Object.assign(correctForm, createDefaultCorrectForm());
	correctTip.value = '';
	correctTypePickerVisible.value = false;
};

const loadCorrectTypeOptions = async () => {
	if (correctTypeLoading.value) {
		return;
	}
	correctTypeLoading.value = true;
	try {
		correctTypeOptions.value = await fetchAbnormalCorrectTypeOptions();
	} catch (error) {
		console.error('[MapVerify] load correct type options failed', error);
		correctTypeOptions.value = [];
		correctTip.value = error?.message || '改正类型加载失败';
	} finally {
		correctTypeLoading.value = false;
	}
};

const openCorrectTypePicker = () => {
	if (correcting.value || correctTypeLoading.value) {
		return;
	}
	if (!correctTypeOptions.value.length) {
		loadCorrectTypeOptions().then(() => {
			if (correctTypeOptions.value.length) {
				correctTypePickerVisible.value = true;
			}
		});
		return;
	}
	correctTypePickerVisible.value = true;
};

const onCorrectTypeSelect = (option) => {
	correctTip.value = '';
	if (String(option?.label || '').trim() !== CORRECT_OTHER_LABEL) {
		correctForm.correctRemark = '';
	}
};

const clearCorrectType = () => {
	if (correcting.value) {
		return;
	}
	correctForm.correctAbnormalType = '';
	correctForm.correctRemark = '';
	correctTip.value = '';
};

const loadCorrectStatusOptions = async () => {
	if (correctStatusLoading.value) {
		return;
	}
	correctStatusLoading.value = true;
	try {
		correctStatusOptions.value = await fetchCorrectStatusOptions();
	} catch (error) {
		console.error('[MapVerify] load correct status options failed', error);
		correctStatusOptions.value = [];
		submitTip.value = error?.message || '核查状态加载失败';
	} finally {
		correctStatusLoading.value = false;
	}
};

const openCorrectStatusPicker = () => {
	if (isDisposeReadonly.value || submitting.value || correctStatusLoading.value) {
		return;
	}
	if (!correctStatusOptions.value.length) {
		loadCorrectStatusOptions().then(() => {
			if (correctStatusOptions.value.length) {
				correctStatusPickerVisible.value = true;
			}
		});
		return;
	}
	correctStatusPickerVisible.value = true;
};

const onCorrect = async () => {
	if (correcting.value) {
		return;
	}

	correctTip.value = '';

	const taskId = props.detail?.additionalInfoId;
	if (taskId === undefined || taskId === null || taskId === '') {
		correctTip.value = '缺少任务信息，无法改正';
		return;
	}

	const correctAbnormalType = String(correctForm.correctAbnormalType || '').trim();
	const correctRemark = String(correctForm.correctRemark || '').trim();
	if (isOtherCorrectType.value && !correctRemark) {
		correctTip.value = '选择「其他」时请填写改正备注';
		return;
	}

	correcting.value = true;
	try {
		await correctAbnormalTask(taskId, {
			correctAbnormalType,
			correctRemark
		});
		resetCorrectForm();
		emit('correct-success', {
			successMessage: '改正成功',
			detailId: props.detail?.id,
			kind: props.detail?.kind,
			taskId
		});
	} catch (error) {
		console.error('[MapVerify] correct failed', error);
		correctTip.value = error?.message || '改正失败，请稍后重试';
	} finally {
		correcting.value = false;
	}
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

	if (!isCheckReadonly.value) {
		if (!verifyPhotos.value.length) {
			verifyPhotoTip.value = '请至少拍摄一张核查照片';
			return;
		}
	}

	if (isCheckReadonly.value && requiresDisposalPhotos.value) {
		const hasDisposalPhoto = disposePhotos.value.some((item) => item.file || item.url);
		if (!hasDisposalPhoto) {
			disposePhotoTip.value = '请至少拍摄一张处置照片';
			return;
		}
	}

	submitting.value = true;
	try {
		let payload;
		let checkPhotoUrls = [];
		let disposalPhotoUrls = [];
		const correctStatusRaw = String(form.correctStatus ?? '').trim();
		const correctStatusPayload =
			correctStatusRaw !== '' && !Number.isNaN(Number(correctStatusRaw))
				? { correctStatus: Number(correctStatusRaw) }
				: {};

		if (isCheckReadonly.value) {
			disposalPhotoUrls = await resolvePhotoUrls(disposePhotos.value, uploadQuery);
			if (!disposalPhotoUrls.length) {
				disposePhotoTip.value = '请至少拍摄一张处置照片';
				return;
			}
			payload = {
				id: additionalInfoId,
				isAccounted: info?.isAccounted ?? 0,
				checkStatus: 1,
				checkType: info?.checkType ?? 1,
				disposalStatus: 1,
				...correctStatusPayload,
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
				checkType: 1,
				disposalStatus: form.isVerified ? 1 : 0,
				checkOpinion: form.opinion?.trim() || '',
				checkRemark: form.remarks?.trim() || '',
				checkPhotos: JSON.stringify(checkPhotoUrls),
				disposalPhotos: JSON.stringify(disposalPhotoUrls),
				...(form.isVerified ? correctStatusPayload : {})
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
				? disposalPhotoUrls.length
					? '核查处置信息提交成功'
					: '核查信息提交成功'
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
		resetCorrectForm();
		loadCorrectTypeOptions();
		loadCorrectStatusOptions();
		mapUiOverlay?.enterOverlay();
	}
});

watch(
	() => form.isVerified,
	(isVerified) => {
		if (!isVerified) {
			disposePhotoTip.value = '';
			form.correctStatus = '';
			correctStatusPickerVisible.value = false;
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
								:class="{
									'is-disabled':
										verifyPhotoProcessing || verifyPhotos.length >= MAX_PHOTO_COUNT
								}"
							>
								<input
									ref="verifyPhotoInputRef"
									class="map-verify-form-sheet__photo-input"
									type="file"
									accept="image/*"
									capture="environment"
									multiple
									:disabled="
										verifyPhotoProcessing || verifyPhotos.length >= MAX_PHOTO_COUNT
									"
									@change="onVerifyPhotoChange"
								/>
								{{
									verifyPhotoProcessing
										? '水印处理中...'
										: verifyPhotos.length >= MAX_PHOTO_COUNT
											? `已达上限(${MAX_PHOTO_COUNT})`
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

				<section class="map-verify-form-sheet__correct">
					<div
						class="map-verify-form-sheet__section-title map-verify-form-sheet__section-title--accent"
					>
						改正
					</div>

					<div class="map-verify-form-sheet__field map-verify-form-sheet__field--input">
						<div class="map-verify-form-sheet__field-label-row">
							<label class="map-verify-form-sheet__field-label">
								改正类型
							</label>
							<button
								v-if="hasCorrectType"
								type="button"
								class="map-verify-form-sheet__field-clear"
								:disabled="correcting"
								@click.stop="clearCorrectType"
							>
								清除
							</button>
						</div>
						<button
							type="button"
							class="map-verify-form-sheet__select"
							:disabled="correcting || correctTypeLoading"
							@click="openCorrectTypePicker"
						>
							<span
								class="map-verify-form-sheet__select-text"
								:class="{ 'is-placeholder': !hasCorrectType }"
							>
								{{
									correctTypeLoading
										? '加载中...'
										: correctTypeLabel || '请选择改正类型'
								}}
							</span>
							<svg
								class="map-verify-form-sheet__select-arrow"
								viewBox="0 0 24 24"
								fill="none"
								aria-hidden="true"
							>
								<path
									d="M6 9l6 6 6-6"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
							</svg>
						</button>
					</div>

					<div
						v-if="isOtherCorrectType"
						class="map-verify-form-sheet__field map-verify-form-sheet__field--input"
					>
						<label class="map-verify-form-sheet__field-label">
							<span class="map-verify-form-sheet__required">*</span>
							改正备注
						</label>
						<input
							v-model="correctForm.correctRemark"
							class="map-verify-form-sheet__input"
							type="text"
							placeholder="请填写改正备注"
							:disabled="correcting"
						/>
					</div>

					<p v-if="correctTip" class="map-verify-form-sheet__correct-tip">
						{{ correctTip }}
					</p>

					<div class="map-verify-form-sheet__correct-actions">
						<button
							type="button"
							class="map-verify-form-sheet__btn map-verify-form-sheet__btn--primary map-verify-form-sheet__btn--correct"
							:disabled="correcting"
							@click="onCorrect"
						>
							{{ correcting ? '提交中...' : '改正' }}
						</button>
					</div>
				</section>
			</section>

			<div
				v-if="showDisposeSection"
				class="map-verify-form-sheet__section-title map-verify-form-sheet__section-title--accent map-verify-form-sheet__section-title--spaced"
			>
				处置信息
				<span v-if="isDisposeReadonly" class="map-verify-form-sheet__status-badge">{{
					disposalStatusLabel
				}}</span>
			</div>
			<section
				v-if="showDisposeSection"
				class="map-verify-form-sheet__dispose-card"
				:class="{ 'is-readonly': isDisposeReadonly }"
			>
				<div
					v-if="showCorrectStatusField"
					class="map-verify-form-sheet__field map-verify-form-sheet__field--input"
				>
					<label class="map-verify-form-sheet__field-label">
						核查状态
					</label>
					<button
						type="button"
						class="map-verify-form-sheet__select"
						:disabled="isDisposeReadonly || submitting || correctStatusLoading"
						@click="openCorrectStatusPicker"
					>
						<span
							class="map-verify-form-sheet__select-text"
							:class="{ 'is-placeholder': !correctStatusLabel }"
						>
							{{
								correctStatusLoading
									? '加载中...'
									: correctStatusLabel || '请选择核查状态'
							}}
						</span>
						<svg
							class="map-verify-form-sheet__select-arrow"
							viewBox="0 0 24 24"
							fill="none"
							aria-hidden="true"
						>
							<path
								d="M6 9l6 6 6-6"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
					</button>
				</div>
				<div class="map-verify-form-sheet__field">
					<label class="map-verify-form-sheet__field-label">
						<span v-if="requiresDisposalPhotos" class="map-verify-form-sheet__required">*</span>
						处置拍照
					</label>
					<label
						v-if="!isDisposeReadonly"
						class="map-verify-form-sheet__photo-btn"
						:class="{
							'is-disabled':
								disposePhotoProcessing || disposePhotos.length >= MAX_PHOTO_COUNT
						}"
					>
						<input
							ref="disposePhotoInputRef"
							class="map-verify-form-sheet__photo-input"
							type="file"
							accept="image/*"
							capture="environment"
							multiple
							:disabled="
								disposePhotoProcessing || disposePhotos.length >= MAX_PHOTO_COUNT
							"
							@change="onDisposePhotoChange"
						/>
						{{
							disposePhotoProcessing
								? '水印处理中...'
								: disposePhotos.length >= MAX_PHOTO_COUNT
									? `已达上限(${MAX_PHOTO_COUNT})`
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

	<OptionPickerSheet
		v-model:visible="correctTypePickerVisible"
		v-model="correctForm.correctAbnormalType"
		title="选择改正类型"
		:options="correctTypeOptions"
		clearable
		@select="onCorrectTypeSelect"
		@clear="clearCorrectType"
	/>

	<OptionPickerSheet
		v-model:visible="correctStatusPickerVisible"
		v-model="form.correctStatus"
		title="选择核查状态"
		:options="correctStatusOptions"
	/>

	<LocationPermissionDialog
		v-model:visible="locationDialogVisible"
		:mode="locationDialogMode"
		:error-message="locationDialogMessage"
		@confirm="onLocationDialogConfirm"
	/>

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

.map-verify-form-sheet__correct {
	margin-top: 4px;
	padding-top: 4px;
	border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.map-verify-form-sheet__correct-tip {
	margin: 0 0 8px;
	padding: 0 2px;
	font-size: 12px;
	line-height: 1.4;
	color: #ff7875;
}

.map-verify-form-sheet__correct-actions {
	display: flex;
	justify-content: center;
	padding: 4px 0 10px;
}

.map-verify-form-sheet__select {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	width: 100%;
	box-sizing: border-box;
	padding: 7px 10px;
	border: 0;
	border-radius: 6px;
	background: rgba(0, 0, 0, 0.22);
	color: #fff;
	font-size: 13px;
	line-height: 1.3;
	text-align: left;
	cursor: pointer;
	-webkit-tap-highlight-color: transparent;

	&:disabled {
		opacity: 0.65;
		cursor: not-allowed;
	}

	&:active:not(:disabled) {
		opacity: 0.92;
	}
}

.map-verify-form-sheet__select-text {
	min-width: 0;
	flex: 1;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;

	&.is-placeholder {
		color: rgba(255, 255, 255, 0.35);
	}
}

.map-verify-form-sheet__select-arrow {
	flex-shrink: 0;
	width: 16px;
	height: 16px;
	color: rgba(255, 255, 255, 0.45);
}

.map-verify-form-sheet__field-label-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
}

.map-verify-form-sheet__field-label-row .map-verify-form-sheet__field-label {
	margin-bottom: 0;
}

.map-verify-form-sheet__field-clear {
	flex-shrink: 0;
	padding: 0;
	border: 0;
	background: transparent;
	color: #1cded4;
	font-size: 12px;
	line-height: 1.3;
	cursor: pointer;
	-webkit-tap-highlight-color: transparent;

	&:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
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

.map-verify-form-sheet__btn--correct {
	max-width: 160px;
}

.map-verify-form-sheet__btn:disabled {
	opacity: 0.55;
	cursor: not-allowed;
}
</style>
