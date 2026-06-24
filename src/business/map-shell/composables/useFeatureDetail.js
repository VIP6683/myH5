import { ref } from 'vue';
import {
	fetchAbnormalMonitorDetail,
	normalizeAbnormalMonitorDetail
} from '../../../api/lineMonitor.js';
import {
	fetchAbnormalSurfaceDetail,
	normalizeAbnormalSurfaceDetail
} from '../../../api/statistics.js';

const DETAIL_LOADERS = {
	area: {
		fetch: fetchAbnormalSurfaceDetail,
		normalize: normalizeAbnormalSurfaceDetail
	},
	line: {
		fetch: fetchAbnormalMonitorDetail,
		normalize: normalizeAbnormalMonitorDetail
	}
};

/**
 * 图斑详情弹层：点击要素后加载并展示 area / line 异常详情
 */
export function useFeatureDetail({ onBeforeOpen } = {}) {
	const visible = ref(false);
	const detail = ref(null);
	const loading = ref(false);
	let requestId = 0;

	async function loadFeatureDetail(kind, payload) {
		const loader = DETAIL_LOADERS[kind];
		if (!loader) {
			loading.value = false;
			detail.value = payload?.attr || null;
			return;
		}

		const id = payload?.attr?.id ?? payload?.graphic?.id;
		const currentRequestId = ++requestId;
		detail.value = payload.attr ? { ...payload.attr, kind } : null;
		loading.value = Boolean(id);

		if (!id) {
			return;
		}

		try {
			const data = await loader.fetch(id);
			if (currentRequestId !== requestId) {
				return;
			}
			const normalized = loader.normalize(data);
			if (normalized) {
				const previous = detail.value;
				detail.value = {
					...previous,
					...normalized,
					coordinates: normalized.coordinates ?? previous?.coordinates,
					substationNo: normalized.substationNo || previous?.substationNo,
					substationName: normalized.substationName || previous?.substationName,
					poleSection: normalized.poleSection || previous?.poleSection,
					lineName: normalized.lineName || previous?.lineName,
					patchArea: normalized.patchArea ?? previous?.patchArea ?? previous?.lineLength,
					distanceMeter: normalized.distanceMeter ?? previous?.distanceMeter,
					objectDistance: normalized.objectDistance ?? previous?.objectDistance,
					objectNo: normalized.objectNo || previous?.objectNo,
					phase: normalized.phase || previous?.phase,
					objectTypeLabel: normalized.objectTypeLabel || previous?.objectTypeLabel
				};
			}
		} catch {
			// 接口失败时保留地图要素上的基础信息
		} finally {
			if (currentRequestId === requestId) {
				loading.value = false;
			}
		}
	}

	function handleFeatureClick(payload) {
		const kind = payload?.kind || payload?.attr?.kind;
		if (kind !== 'area' && kind !== 'line') {
			return;
		}

		onBeforeOpen?.();
		visible.value = true;
		return loadFeatureDetail(kind, payload);
	}

	return {
		visible,
		detail,
		loading,
		handleFeatureClick
	};
}
