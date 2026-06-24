import request from './request.js';
import { geojsonToPositions } from '../utils/geojsonToPositions.js';
import { OBJECT_TYPE_API_MAP } from './statistics.js';

export const LINE_OBJECT_TYPE_API_MAP = {
	...OBJECT_TYPE_API_MAP,
	water: 5
};

const ABNORMAL_TYPE_LABELS = {
	0: { value: 'color-steel', label: '彩钢瓦' },
	1: { value: 'mulch', label: '地膜' },
	2: { value: 'dust-net', label: '防尘网' },
	3: { value: 'construction', label: '施工工地' },
	4: { value: 'greenhouse', label: '塑料大棚' },
	5: { value: 'water', label: '水体' }
};

const CHECK_STATUS_MAP = {
	0: 'unverified',
	1: 'verified'
};

const DISPOSAL_STATUS_MAP = {
	0: 'undisposed',
	1: 'disposed'
};

const VERIFY_STATUS_API_MAP = {
	unverified: 0,
	verified: 1
};

const DISPOSE_STATUS_API_MAP = {
	undisposed: 0,
	disposed: 1
};

function appendQueryParam(params, key, value) {
	if (value === undefined || value === null || value === '') {
		return;
	}
	params[key] = String(value);
}

function pickDefaultYearPeriod(filters = {}) {
	if (filters.year) {
		return {
			year: Number(filters.year),
			period: Number(filters.period) || 1
		};
	}

	const currentYear = new Date().getFullYear();
	return { year: currentYear, period: 1 };
}

function appendTaskListFilters(params, query = {}, options = {}) {
	const { year, period } = pickDefaultYearPeriod(query);

	appendQueryParam(params, 'year', year);
	appendQueryParam(params, 'period', query.period ?? period);

	const abnormalCode =
		options.abnormalCode?.trim?.() ||
		options.abnormalCode ||
		query.abnormalCode?.trim?.() ||
		query.abnormalCode;
	appendQueryParam(params, 'abnormalCode', abnormalCode);

	const keyword =
		options.keyword?.trim?.() || options.keyword || query.keyword?.trim?.() || query.keyword;
	appendQueryParam(params, 'keyword', keyword);

	const objectType = Array.isArray(query.objectType) ? query.objectType[0] : query.objectType;
	if (objectType && LINE_OBJECT_TYPE_API_MAP[objectType] !== undefined) {
		appendQueryParam(params, 'abnormalType', LINE_OBJECT_TYPE_API_MAP[objectType]);
	}

	if (query.verifyStatus && VERIFY_STATUS_API_MAP[query.verifyStatus] !== undefined) {
		appendQueryParam(params, 'checkStatus', VERIFY_STATUS_API_MAP[query.verifyStatus]);
	} else if (options.headerTab === 'pending-verify') {
		appendQueryParam(params, 'checkStatus', 0);
	}

	if (query.disposeStatus && DISPOSE_STATUS_API_MAP[query.disposeStatus] !== undefined) {
		appendQueryParam(params, 'disposalStatus', DISPOSE_STATUS_API_MAP[query.disposeStatus]);
	} else if (options.headerTab === 'pending-dispose') {
		appendQueryParam(params, 'disposalStatus', 0);
	}
}

function buildLineTaskListCountParams(query = {}) {
	const params = {};
	appendTaskListFilters(params, query);
	return params;
}

function buildLineTaskListParams(query = {}, options = {}) {
	const params = {};
	appendTaskListFilters(params, query, options);
	appendQueryParam(params, 'pageNum', options.pageNum ?? 1);
	appendQueryParam(params, 'pageSize', options.pageSize ?? 20);
	return params;
}

/** 年份选项 */
export function fetchLineAllYear() {
	return request({
		url: '/result/abnormalMonitor/getAllYear',
		method: 'get'
	});
}

/** 期度选项（依赖年份） */
export function fetchLineAllPeriod(year) {
	return request({
		url: '/result/abnormalMonitor/getAllPeriod',
		method: 'get',
		params: { year: String(year) }
	});
}

/** 个人任务统计（按年份） */
export function fetchLinePersonalTaskStats(year) {
	return request({
		url: '/result/abnormalMonitor/personalTaskStats',
		method: 'get',
		params: { year: String(year) }
	});
}

/** 任务列表角标统计 */
export function fetchLineTaskListCount(query = {}) {
	return request({
		url: '/result/abnormalMonitor/taskList/count',
		method: 'get',
		params: buildLineTaskListCountParams(query)
	});
}

/** 任务列表 */
export function fetchLineTaskList(query = {}, options = {}) {
	return request({
		url: '/result/abnormalMonitor/taskList',
		method: 'get',
		params: buildLineTaskListParams(query, options)
	});
}

/** 线状异物监测详细信息 */
export function fetchAbnormalMonitorDetail(id) {
	return request({
		url: `/result/abnormalMonitor/${encodeURIComponent(String(id))}`,
		method: 'get'
	});
}

/** 将线状异物详情转为展示结构 */
export function normalizeAbnormalMonitorDetail(row) {
	const id = row?.id;
	if (id === undefined || id === null || id === '') {
		return null;
	}

	const abnormalType = ABNORMAL_TYPE_LABELS[Number(row?.abnormalType)] || {
		value: '',
		label: '-'
	};
	const period = Number(row?.period) || 0;
	const lng = row?.lng;
	const lat = row?.lat;
	const hasCoordinates =
		lng !== undefined &&
		lng !== null &&
		lng !== '' &&
		lat !== undefined &&
		lat !== null &&
		lat !== '';
	const coordinates = hasCoordinates ? { lng: Number(lng), lat: Number(lat) } : undefined;
	const additionalInfo = row?.additionalInfo;
	const additionalInfoId = additionalInfo?.id;

	return {
		kind: 'line',
		id,
		additionalInfoId:
			additionalInfoId !== undefined && additionalInfoId !== null && additionalInfoId !== ''
				? additionalInfoId
				: undefined,
		additionalInfo:
			additionalInfo && typeof additionalInfo === 'object' ? additionalInfo : undefined,
		year: row?.year != null ? String(row.year) : '',
		period,
		phase: period ? `第${period}期` : '',
		objectType: abnormalType.value,
		objectTypeLabel: abnormalType.label,
		objectNo: row?.abnormalCode != null ? String(row.abnormalCode) : '',
		substationNo:
			row?.substationCode != null
				? String(row.substationCode)
				: row?.substationNo != null
					? String(row.substationNo)
					: '',
		substationName: row?.substationName || '',
		poleSection: row?.poleSection || '',
		lineName: row?.lineName || '',
		patchArea: row?.areaSqMeter ?? row?.lineLength ?? row?.lengthMeter,
		lineLength: row?.lineLength ?? row?.lengthMeter,
		distanceMeter: row?.distanceMeter,
		objectDistance: row?.distanceSubstation ?? row?.distance,
		imageTime: row?.imageTime || '',
		city: row?.city || '',
		district: row?.district || '',
		coordinates,
		lng: coordinates?.lng,
		lat: coordinates?.lat
	};
}

/** 将 taskList 单条记录转为地图线段 */
export function normalizeLineTaskListRow(row) {
	const id = row?.id;
	if (id === undefined || id === null || id === '') {
		return null;
	}

	const positions = geojsonToPositions(row?.geojson);
	if (!positions.length) {
		return null;
	}

	const abnormalType = ABNORMAL_TYPE_LABELS[Number(row?.abnormalType)] || {
		value: '',
		label: '-'
	};
	const period = Number(row?.period) || 0;

	return {
		id: String(id),
		positions,
		attr: {
			kind: 'line',
			id,
			year: row?.year != null ? String(row.year) : '',
			period,
			phase: period ? `第${period}期` : '',
			objectType: abnormalType.value,
			objectTypeLabel: abnormalType.label,
			verifyStatus: CHECK_STATUS_MAP[Number(row?.checkStatus)] ?? 'unverified',
			disposeStatus: DISPOSAL_STATUS_MAP[Number(row?.disposalStatus)] ?? 'undisposed',
			objectNo: row?.abnormalCode != null ? String(row.abnormalCode) : '',
			substationNo:
				row?.substationCode != null
					? String(row.substationCode)
					: row?.substationNo != null
						? String(row.substationNo)
						: '',
			substationName: row?.substationName || '',
			poleSection: row?.poleSection || '',
			lineName: row?.lineName || '',
			patchArea: row?.areaSqMeter ?? row?.lineLength ?? row?.lengthMeter,
			lineLength: row?.lineLength ?? row?.lengthMeter,
			distanceMeter: row?.distanceMeter,
			objectDistance: row?.distanceSubstation ?? row?.distance,
			name: abnormalType.label !== '-' ? abnormalType.label : `线段-${id}`
		}
	};
}

/** 将线状任务列表转为地图线段集合 */
export function normalizeLineTaskList(payload) {
	const rows = Array.isArray(payload?.rows) ? payload.rows : [];
	const patches = rows.map(normalizeLineTaskListRow).filter(Boolean);

	return {
		total: Number(payload?.total) || patches.length,
		patches
	};
}
