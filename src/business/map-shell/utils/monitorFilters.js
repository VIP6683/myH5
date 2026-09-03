import {
	fetchAllPeriod,
	fetchAllYear,
	normalizeLabelValueOptions
} from '../../../api/statistics.js';
import {
	fetchLineAllPeriod,
	fetchLineAllYear
} from '../../../api/lineMonitor.js';

/** 任务状态：0 未核查，1 已核查，2 待处置，3 已处置 */
export const TASK_STATUS_OPTIONS = [
	{ value: '0', label: '未核查' },
	{ value: '1', label: '已核查' },
	{ value: '2', label: '待处置' },
	{ value: '3', label: '已处置' }
];

/** 面状监测：异物距离（变电站距离）区间，入参 distanceSubstationRange */
export const DISTANCE_SUBSTATION_RANGE_OPTIONS = [
	{ value: '0', label: '0-50米' },
	{ value: '1', label: '51-100米' },
	{ value: '2', label: '101-150米' },
	{ value: '3', label: '151-300米' },
	{ value: '4', label: '301-500米' },
	{ value: '5', label: '501-1000米' }
];

/** 线状监测：异物距离区间，入参 distanceSubstationRange */
export const LINE_DISTANCE_SUBSTATION_RANGE_OPTIONS = [
	{ value: '0', label: '0-100米' },
	{ value: '1', label: '100-300米' },
	{ value: '2', label: '300-500米' },
	{ value: '3', label: '大于500米' }
];

export const TASK_STATUS_LABELS = Object.fromEntries(
	TASK_STATUS_OPTIONS.map((item) => [item.value, item.label])
);

export function getTaskStatusLabel(status) {
	if (status === undefined || status === null || status === '') {
		return '-';
	}
	return TASK_STATUS_LABELS[String(status)] || '-';
}

export function createEmptyFilters() {
	return {
		year: '',
		period: '',
		objectType: '',
		taskStatus: '',
		distanceSubstationRange: ''
	};
}

/** 线状监测顶部查询：线路名称 + 杆塔起止 */
export function createEmptyLineQuery() {
	return {
		lineName: '',
		startTower: '',
		endTower: ''
	};
}

/**
 * 监测页默认筛选：待核查 → 未核查；待处置 → 待处置
 * @param {'pending-verify' | 'pending-dispose'} headerTab
 */
export function createDefaultMonitorFilters(headerTab = 'pending-verify') {
	if (headerTab === 'pending-dispose') {
		return {
			...createEmptyFilters(),
			taskStatus: '2'
		};
	}

	return {
		...createEmptyFilters(),
		taskStatus: '0'
	};
}

/**
 * 切换顶部任务 tab 时仅同步任务状态，保留年份、期度、异物类型、距离区间
 * @param {ReturnType<typeof createEmptyFilters>} current
 * @param {'pending-verify' | 'pending-dispose'} headerTab
 */
export function mergeHeaderTabFilters(current = createEmptyFilters(), headerTab = 'pending-verify') {
	const tabDefaults = createDefaultMonitorFilters(headerTab);
	return {
		...current,
		taskStatus: tabDefaults.taskStatus
	};
}

/**
 * 按筛选面板同款接口解析默认年/期：第一年的第一个期度
 * @param {'area' | 'line'} monitorType
 * @param {'pending-verify' | 'pending-dispose'} headerTab
 */
export async function resolveDefaultMonitorFilters(monitorType, headerTab = 'pending-verify') {
	const defaults = createDefaultMonitorFilters(headerTab);

	try {
		const yearPayload =
			monitorType === 'line' ? await fetchLineAllYear() : await fetchAllYear();
		const yearOptions = normalizeLabelValueOptions(yearPayload);
		const firstYear = yearOptions[0]?.value ?? '';
		if (!firstYear) {
			return defaults;
		}

		const periodPayload =
			monitorType === 'line'
				? await fetchLineAllPeriod(firstYear)
				: await fetchAllPeriod(firstYear);
		const periodOptions = normalizeLabelValueOptions(periodPayload);
		const firstPeriod = periodOptions[0]?.value ?? '';

		return {
			...defaults,
			year: firstYear,
			period: firstPeriod
		};
	} catch {
		return defaults;
	}
}

export function getMonitorTypeFromTab(tab) {
	return tab === 'line-monitor' ? 'line' : 'area';
}
