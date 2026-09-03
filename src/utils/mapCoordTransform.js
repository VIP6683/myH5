/**
 * 业务数据（CGCS2000 / WGS84）与地图国内坐标系对齐
 * @see http://mars2d.cn/dev/guide/map/crs.html
 */

function getPointTrans() {
	return globalThis.mars2d?.PointTrans;
}

function getMapChinaCRS(map) {
	const fromMap = map?.chinaCRS || map?.options?.chinaCRS;
	if (fromMap) {
		return fromMap;
	}

	const config = globalThis.APP_MAP_CONFIG || {};
	return config.basemap?.chinaCRS || config.annotation?.chinaCRS || 'WGS84';
}

/**
 * 将无偏坐标转为当前地图使用的国内坐标系
 * @param {number} lng
 * @param {number} lat
 * @param {import('mars2d').Map | null | undefined} [map]
 * @returns {[number, number]}
 */
export function transformLngLatForMap(lng, lat, map) {
	const targetCrs = getMapChinaCRS(map);
	if (targetCrs === 'WGS84') {
		return [lng, lat];
	}

	const pointTrans = getPointTrans();
	if (!pointTrans?.wgs2gcj) {
		return [lng, lat];
	}

	if (targetCrs === 'GCJ02') {
		const converted = pointTrans.wgs2gcj([lng, lat]);
		return [converted[0], converted[1]];
	}

	return [lng, lat];
}

/**
 * 将定位结果转为当前地图坐标系（如微信 GCJ02 → 天地图 WGS84）
 * @param {number} lng
 * @param {number} lat
 * @param {import('mars2d').Map | null | undefined} [map]
 * @param {'wgs84' | 'gcj02'} [coordinateType]
 * @returns {[number, number]}
 */
export function transformLngLatFromLocation(lng, lat, map, coordinateType = 'wgs84') {
	const targetCrs = getMapChinaCRS(map);
	const pointTrans = getPointTrans();

	if (coordinateType === 'gcj02' && targetCrs === 'WGS84' && pointTrans?.gcj2wgs) {
		const converted = pointTrans.gcj2wgs([lng, lat]);
		return [converted[0], converted[1]];
	}

	if (coordinateType === 'wgs84' && targetCrs === 'GCJ02' && pointTrans?.wgs2gcj) {
		const converted = pointTrans.wgs2gcj([lng, lat]);
		return [converted[0], converted[1]];
	}

	return [lng, lat];
}

/**
 * @param {[number, number][]} positions
 * @param {import('mars2d').Map | null | undefined} [map]
 * @returns {[number, number][]}
 */
export function transformPositionsForMap(positions = [], map) {
	return positions.map(([lng, lat]) => transformLngLatForMap(lng, lat, map));
}
