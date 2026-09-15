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

/** 任务状态：0 未核查，1 已核查，2 待处置，3 已处置 */
const HEADER_TAB_TASK_STATUS = {
	'pending-verify': 0,
	'pending-dispose': 2
};

function appendQueryParam(params, key, value) {
	if (value === undefined || value === null || value === '') {
		return;
	}
	params[key] = String(value);
}

/**
 * 多选距离区间 → distanceRanges（英文逗号分隔，如 0,2,3）
 * @param {Record<string, string>} params
 * @param {string | number | Array<string | number>} [value]
 */
function appendDistanceRangesParam(params, value) {
	const ranges = Array.isArray(value)
		? value.filter((item) => item !== undefined && item !== null && item !== '')
		: value !== undefined && value !== null && value !== ''
			? [value]
			: [];

	if (!ranges.length) {
		return;
	}

	params.distanceRanges = ranges.map(String).join(',');
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

function appendTaskListCommonFilters(params, query = {}, options = {}) {
	const { year, period } = pickDefaultYearPeriod(query);

	appendQueryParam(params, 'year', year);
	appendQueryParam(params, 'period', query.period ?? period);

	const abnormalCode =
		options.abnormalCode?.trim?.() ||
		options.abnormalCode ||
		query.abnormalCode?.trim?.() ||
		query.abnormalCode;
	appendQueryParam(params, 'abnormalCode', abnormalCode);

	const lineName =
		options.lineName?.trim?.() ||
		options.lineName ||
		query.lineName?.trim?.() ||
		query.lineName;
	appendQueryParam(params, 'lineName', lineName);

	const startTower =
		options.startTower?.trim?.() ||
		options.startTower ||
		query.startTower?.trim?.() ||
		query.startTower;
	appendQueryParam(params, 'startTower', startTower);

	const endTower =
		options.endTower?.trim?.() ||
		options.endTower ||
		query.endTower?.trim?.() ||
		query.endTower;
	appendQueryParam(params, 'endTower', endTower);

	const objectType = Array.isArray(query.objectType) ? query.objectType[0] : query.objectType;
	if (objectType && LINE_OBJECT_TYPE_API_MAP[objectType] !== undefined) {
		appendQueryParam(params, 'abnormalType', LINE_OBJECT_TYPE_API_MAP[objectType]);
	}

	appendDistanceRangesParam(params, query.distanceSubstationRange);
}

function appendTaskListFilters(params, query = {}, options = {}) {
	appendTaskListCommonFilters(params, query, options);

	if (query.taskStatus !== undefined && query.taskStatus !== null && query.taskStatus !== '') {
		appendQueryParam(params, 'taskStatus', query.taskStatus);
	} else if (HEADER_TAB_TASK_STATUS[options.headerTab] !== undefined) {
		appendQueryParam(params, 'taskStatus', HEADER_TAB_TASK_STATUS[options.headerTab]);
	}
}

function buildLineTaskListCountParams(query = {}, options = {}) {
	const params = {};
	appendTaskListCommonFilters(params, query, options);
	return params;
}

function buildLineTaskListParams(query = {}, options = {}) {
	const params = {};
	appendTaskListFilters(params, query, options);
	appendQueryParam(params, 'pageNum', options.pageNum ?? 1);
	appendQueryParam(params, 'pageSize', options.pageSize ?? 20);
	return params;
}

/**
 * 规范化线路名称下拉选项
 * @param {unknown} payload
 * @returns {{ label: string, value: string }[]}
 */
export function normalizeLineNameOptions(payload) {
	const list = Array.isArray(payload) ? payload : [];
	return list
		.map((item) => {
			if (typeof item === 'string' || typeof item === 'number') {
				const value = String(item).trim();
				return { label: value, value };
			}
			const value = item?.value ?? item?.lineName ?? item?.label ?? '';
			const label = item?.label ?? item?.lineName ?? value;
			return {
				label: String(label).trim(),
				value: String(value).trim()
			};
		})
		.filter((item) => item.value);
}

/** 年份选项 */
export function fetchLineAllYear() {
	return request({
		url: '/result/abnormalMonitor/getAllYear',
		method: 'get'
	});
}

/** 线路名称选项 GET /result/abnormalMonitor/taskList/lineNames */
export function fetchLineAllLineName(params = {}) {
	return request({
		url: '/result/abnormalMonitor/taskList/lineNames',
		method: 'get',
		params
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
export function fetchLineTaskListCount(query = {}, options = {}) {
	return request({
		url: '/result/abnormalMonitor/taskList/count',
		method: 'get',
		params: buildLineTaskListCountParams(query, options)
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

/** 线状异物监测详细信息 GET /result/abnormalTask/{id} */
export function fetchAbnormalMonitorDetail(id) {
	return request({
		url: `/result/abnormalTask/${encodeURIComponent(String(id))}`,
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
	const additionalInfoId = additionalInfo?.taskId;

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
			taskStatus: row?.taskStatus != null && row?.taskStatus !== '' ? String(row.taskStatus) : '',
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
			abnormalMoveType:
				row?.abnormalMoveType != null && row?.abnormalMoveType !== ''
					? Number(row.abnormalMoveType)
					: null,
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
