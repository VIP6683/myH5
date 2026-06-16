/** 长沙市行政范围包络（GCJ02，约） */
export const CHANGSHA_BBOX = {
	minLng: 111.88,
	maxLng: 114.25,
	minLat: 27.85,
	maxLat: 28.65
};

/** 长沙市中心（五一广场附近） */
export const CHANGSHA_CENTER = {
	lng: 112.9792,
	lat: 28.2001
};

/** 将经纬度限制在长沙包络内 */
export function clampLngLatInChangsha(lng, lat) {
	return {
		lng: Math.min(CHANGSHA_BBOX.maxLng, Math.max(CHANGSHA_BBOX.minLng, lng)),
		lat: Math.min(CHANGSHA_BBOX.maxLat, Math.max(CHANGSHA_BBOX.minLat, lat))
	};
}

/**
 * 在长沙范围内生成随机点
 * @param {number} [spreadLng=0.35]
 * @param {number} [spreadLat=0.35]
 * @param {{ lng: number, lat: number }} [center=CHANGSHA_CENTER]
 */
export function randomLngLatInChangsha(
	spreadLng = 0.35,
	spreadLat = 0.35,
	center = CHANGSHA_CENTER
) {
	const lng = center.lng + (Math.random() - 0.5) * spreadLng;
	const lat = center.lat + (Math.random() - 0.5) * spreadLat;
	return clampLngLatInChangsha(lng, lat);
}

/** 在长沙行政包络内均匀生成随机点 */
export function randomLngLatInChangshaBBox() {
	const lng =
		CHANGSHA_BBOX.minLng + Math.random() * (CHANGSHA_BBOX.maxLng - CHANGSHA_BBOX.minLng);
	const lat =
		CHANGSHA_BBOX.minLat + Math.random() * (CHANGSHA_BBOX.maxLat - CHANGSHA_BBOX.minLat);
	return { lng, lat };
}
