const VERIFY_STATUS_LABELS = {
	verified: '已核查',
	unverified: '未核查'
};

const DISPOSE_STATUS_LABELS = {
	disposed: '已处置',
	undisposed: '未处置',
	'no-need': '无需处置'
};

export function getVerifyStatusLabel(status) {
	return VERIFY_STATUS_LABELS[status] || status || '-';
}

export function getDisposeStatusLabel(status) {
	return DISPOSE_STATUS_LABELS[status] || status || '-';
}

function matchesTab(attr, headerTab) {
	if (headerTab === 'pending-verify') {
		return attr.verifyStatus === 'unverified';
	}
	if (headerTab === 'pending-dispose') {
		return attr.disposeStatus === 'undisposed';
	}
	return true;
}

function matchesFilters(attr, filters = {}) {
	if (filters.year && attr.year !== filters.year) {
		return false;
	}

	if (filters.objectType?.length && !filters.objectType.includes(attr.objectType)) {
		return false;
	}

	if (filters.verifyStatus && attr.verifyStatus !== filters.verifyStatus) {
		return false;
	}

	if (filters.disposeStatus && attr.disposeStatus !== filters.disposeStatus) {
		return false;
	}

	return true;
}

/**
 * 按顶部 Tab 与筛选条件过滤图斑/线段列表
 */
export function filterMonitorPatches(patches, { filters = {}, headerTab = '' } = {}) {
	return patches.filter((patch) => {
		const attr = patch.attr || {};
		return matchesTab(attr, headerTab) && matchesFilters(attr, filters);
	});
}

/**
 * 将原始 patch 转为列表行数据
 */
export function toPatchListRow(patch) {
	const attr = patch.attr || {};
	return {
		id: patch.id,
		year: attr.year ? `${attr.year}年` : '-',
		objectTypeLabel: attr.objectTypeLabel || '-',
		verifyStatusLabel: getVerifyStatusLabel(attr.verifyStatus),
		disposeStatusLabel: getDisposeStatusLabel(attr.disposeStatus),
		attr
	};
}
