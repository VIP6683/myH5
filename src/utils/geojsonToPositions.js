/**
 * 将 taskList 返回的 geojson 字符串解析为面/线坐标（[lng, lat]）
 * @param {unknown} raw
 * @returns {[number, number][]}
 */
export function geojsonToPositions(raw) {
	if (!raw) {
		return [];
	}

	let geojson = raw;
	if (typeof raw === 'string') {
		try {
			geojson = JSON.parse(raw);
		} catch {
			return [];
		}
	}

	const { type, coordinates } = geojson || {};
	if (!type || !coordinates) {
		return [];
	}

	const toRing = (ring) =>
		Array.isArray(ring)
			? ring
					.filter((point) => Array.isArray(point) && point.length >= 2)
					.map(([lng, lat]) => [Number(lng), Number(lat)])
			: [];

	if (type === 'Polygon') {
		return toRing(coordinates[0]);
	}

	if (type === 'MultiPolygon') {
		return toRing(coordinates[0]?.[0]);
	}

	if (type === 'LineString') {
		return toRing(coordinates);
	}

	if (type === 'MultiLineString') {
		return toRing(coordinates[0]);
	}

	return [];
}
