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
		attr,
		patch
	};
}

