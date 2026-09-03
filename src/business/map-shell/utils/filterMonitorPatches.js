import { getTaskStatusLabel } from './monitorFilters.js';

/**
 * 将原始 patch 转为列表行数据
 */
export function toPatchListRow(patch) {
	const attr = patch.attr || {};
	return {
		id: patch.id,
		year: attr.year ? `${attr.year}年` : '-',
		objectTypeLabel: attr.objectTypeLabel || '-',
		disposeStatusLabel: getTaskStatusLabel(attr.taskStatus),
		attr,
		patch
	};
}
