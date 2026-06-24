/**
 * Mars2D 场景配置（供 src/map-kit/mars2d/config/mapSceneConfig.js 读取）
 */
window.MAP_SCENE_2D_CONFIG = {
	center: {
		lng: 111.526034,
		lat: 27.381146
	},
	zoom: 8,
	minZoom: 6,
	/** 与天地图影像 maximumLevel 对齐，避免放大过头露出空白底 */
	maxZoom: 17,
	interaction: {
		inertia: false,
		zoomSnap: 0.25,
		zoomDelta: 0.5,
		wheelPxPerZoomLevel: 60,
		wheelDebounceTime: 20,
		touchZoom: true,
		bounceAtZoomLimits: true,
		doubleClickZoom: false,
		preferCanvas: true
	},
	scene: {
		/** 与卫星影像色调接近，瓦片未覆盖时不露白底 */
		backgroundColor: '#1a1a1a'
	}
};
