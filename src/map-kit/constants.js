/** Vue provide/inject 键，与 MapContainer、Mars2dMap、业务页共享地图实例 */
export const MAP_CONTEXT_KEY = 'mapInstance';

/** MapContainer 内固定的 Cesium 挂载点（禁止 appendChild 搬运） */
export const MAP_HOST_KEY = 'mapHostElement';

/** 地图浮层锚点（要素设置等 Teleport 目标，由 MainLayout provide） */
export const MAP_FEATURE_ANCHOR_KEY = 'mapFeatureAnchor';

/** 业务定位标记图层 ID（接入自定义图层时请保持唯一） */
export const LOCATION_MARKER_LAYER_ID = '__screen_template_location_marker_layer__';

/** 「我的位置」标记 ID（侧栏定位按钮复用同一标记） */
export const MY_POSITION_MARKER_ID = '__my_position__';

/** 雷达影像 ImageLayer id 前缀 */
export const RADAR_IMAGE_LAYER_ID_PREFIX = '__screen_template_radar_image_layer__';

/** 湖南省边界 GeoJsonLayer id（遮罩关闭时仍为省界描边图层） */
export const PROVINCE_MASK_LAYER_ID = '__screen_template_province_mask_layer__';

/** 内网 getLayersData 注记 WMTS 图层 id（对齐原 Map.vue noteLayer） */
export const BACKEND_NOTE_LAYER_ID = '__backend_note_layer__';

/** 业务镶嵌图 WMTS 图层 id（对齐 kjydd Map.vue id: dt） */
export const MOSAIC_WMTS_LAYER_ID = '__mosaic_wmts_layer__';

/** 湖南省边界 GeoJSON（国家统计局区划） */
export const HUNAN_BOUNDARY_GEOJSON_URL = '/430000.json';

/** 湖南省范围（来自 public/430000.json 边界包络） */
export const HUNAN_BBOX = {
	minLng: 108.792209,
	maxLng: 114.260116,
	minLat: 24.636548,
	maxLat: 30.125989
};

/** 省域中心（边界包络中心），用作模拟数据基准点 */
export const HUNAN_CENTER = {
	lng: (HUNAN_BBOX.minLng + HUNAN_BBOX.maxLng) / 2,
	lat: (HUNAN_BBOX.minLat + HUNAN_BBOX.maxLat) / 2
};

/** 将经纬度限制在湖南省包络内 */
export function clampLngLat(lng, lat) {
	return {
		lng: Math.min(HUNAN_BBOX.maxLng, Math.max(HUNAN_BBOX.minLng, lng)),
		lat: Math.min(HUNAN_BBOX.maxLat, Math.max(HUNAN_BBOX.minLat, lat))
	};
}

/**
 * 在省域中心附近生成随机点（默认散布约 0.4°×0.5°，覆盖大部分省内区域）
 * @param {number} [spreadLng=0.4]
 * @param {number} [spreadLat=0.5]
 * @param {{ lng: number, lat: number }} [center=HUNAN_CENTER]
 */
export function randomLngLatInHunan(spreadLng = 0.4, spreadLat = 0.5, center = HUNAN_CENTER) {
	const lng = center.lng + (Math.random() - 0.5) * spreadLng;
	const lat = center.lat + (Math.random() - 0.5) * spreadLat;
	return clampLngLat(lng, lat);
}

/** 格式化为弹窗展示的「纬度, 经度」字符串 */
export function formatLatLng(lat, lng) {
	return `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`;
}

/** 在基准点附近生成随机坐标字符串（已钳制在省内） */
export function randomCoordString(baseLng, baseLat, spread = 0.02) {
	const lng = baseLng + (Math.random() - 0.5) * spread;
	const lat = baseLat + (Math.random() - 0.5) * spread;
	const clamped = clampLngLat(lng, lat);
	return formatLatLng(clamped.lat, clamped.lng);
}
