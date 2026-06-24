import {
	fetchAllPeriod,
	fetchAllYear,
	normalizeLabelValueOptions
} from '../../../api/statistics.js';
import {
	fetchLineAllPeriod,
	fetchLineAllYear
} from '../../../api/lineMonitor.js';

export function createEmptyFilters() {
	return {
		year: '',
		period: '',
		objectType: '',
		verifyStatus: '',
		disposeStatus: ''
	};
}

/**
 * 按筛选面板同款接口解析默认年/期：第一年的第一个期度
 * @param {'area' | 'line'} monitorType
 */
export async function resolveDefaultMonitorFilters(monitorType) {
	const empty = createEmptyFilters();

	try {
		const yearPayload =
			monitorType === 'line' ? await fetchLineAllYear() : await fetchAllYear();
		const yearOptions = normalizeLabelValueOptions(yearPayload);
		const firstYear = yearOptions[0]?.value ?? '';
		if (!firstYear) {
			return empty;
		}

		const periodPayload =
			monitorType === 'line'
				? await fetchLineAllPeriod(firstYear)
				: await fetchAllPeriod(firstYear);
		const periodOptions = normalizeLabelValueOptions(periodPayload);
		const firstPeriod = periodOptions[0]?.value ?? '';

		return {
			...empty,
			year: firstYear,
			period: firstPeriod
		};
	} catch {
		return empty;
	}
}

export function getMonitorTypeFromTab(tab) {
	return tab === 'line-monitor' ? 'line' : 'area';
}
