/**
 * Mars2D 场景配置（供 src/map-kit/mars2d/config/mapSceneConfig.js 读取）
 */
window.MAP_SCENE_2D_CONFIG = {
	center: {
		lng: 111.526034,
		lat: 27.381146,
		alt: 800000
	},
	zoom: 8,
	minZoom: 6,
	maxZoom: 18,
	interaction: {
		inertia: false,
		zoomSnap: 0.25,
		zoomDelta: 0.5,
		wheelPxPerZoomLevel: 60,
		wheelDebounceTime: 20,
		touchZoom: true,
		bounceAtZoomLimits: false,
		doubleClickZoom: false,
		preferCanvas: true
	},
	scene: {
		backgroundColor: '#f5f6f7'
	}
};
