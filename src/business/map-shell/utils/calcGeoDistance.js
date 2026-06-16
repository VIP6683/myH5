/**
 * 计算两点间球面距离（米），依赖 index.html 全局 turf.js
 * @param {{ lng: number, lat: number }} from
 * @param {{ lng: number, lat: number }} to
 * @returns {number}
 */
export function calcDistanceMeters(from, to) {
	const turf = globalThis.turf;
	if (!turf?.distance) {
		throw new Error('turf.js 未加载');
	}

	return turf.distance(turf.point([from.lng, from.lat]), turf.point([to.lng, to.lat]), {
		units: 'meters'
	});
}

/**
 * @param {number|null|undefined} meters
 * @returns {string}
 */
export function formatDistanceText(meters) {
	if (meters == null || Number.isNaN(meters)) {
		return '未知';
	}

	if (meters < 1000) {
		return `${Math.round(meters)}米`;
	}

	return `${(meters / 1000).toFixed(2)}公里`;
}
