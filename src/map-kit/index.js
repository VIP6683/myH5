/**
 * 地图核心模块（当前项目使用 Mars2D，可拷贝到其他项目）
 *
 * 职责：地图实例、配置读取、图层显隐、测距/复位/2D3D、标记打点、统一事件
 * 不包含：业务侧栏、底栏、教程、系统弹框等（见 src/business/）
 *
 * 迁移清单：
 * - 拷贝 src/map-kit/
 * - 拷贝 public/config.js、public/map-scene-2d.js
 * - 在 index.html 中加载运行时配置脚本
 */

export {
	MAP_CONTEXT_KEY,
	MAP_HOST_KEY,
	MAP_FEATURE_ANCHOR_KEY,
	LOCATION_MARKER_LAYER_ID,
	MY_POSITION_MARKER_ID,
	RADAR_IMAGE_LAYER_ID_PREFIX,
	PROVINCE_MASK_LAYER_ID,
	BACKEND_NOTE_LAYER_ID,
	HUNAN_BOUNDARY_GEOJSON_URL,
	HUNAN_BBOX,
	HUNAN_CENTER,
	clampLngLat,
	randomLngLatInHunan,
	formatLatLng,
	randomCoordString
} from './constants.js';

export {
	loadMapSceneConfig,
	getMapSceneCenter,
	getMapSceneOptions
} from './config/mapSceneConfig.js';
export { getAppMapConfig, getMapTokens, buildMapLayerOptions, usesBackendLayers } from './config/runtimeConfig.js';

export {
	filterLayerTreeByIds,
	parseBasemapWmsOptions,
	findAnnotationLayerConfig,
	findDemTerrainUrl,
	resolveRegionDefaultNodes,
	collectWmsNodesForCheck
} from './utils/layerTree.js';

export {
	MapEventType,
	onMapEvent,
	offMapEvent,
	emitMapEvent,
	clearMapEventListeners
} from './core/mapEvents.js';

export {
	initMars3dTokens,
	mergeMapOptions,
	getDefaultMapOptions,
	setMapInstance,
	setCompassParentContainer,
	getMapInstance,
	isMapRenderPaused,
	pauseMapRender,
	resumeMapRender,
	setActiveRoute,
	getActiveInitialView,
	disableMapContextMenu,
	stopMeasureDrawing,
	endMeasureDrawing,
	stopMeasureEditing,
	confirmMeasureDrawing,
	clearMeasure,
	getMeasureClearable,
	getMeasureState,
	onMeasureToolbarStateChange,
	startDistanceMeasure,
	startHeightMeasure,
	startAreaMeasure,
	startAngleMeasure,
	startPointMeasure,
	startSectionMeasure,
	getLocationMarkerLayer,
	clearLocationMarkers,
	removeLocationMarker,
	addLocationMarkers,
	setLocationMarkerClickHandler,
	locateMarker,
	locateMyPosition,
	getGeolocationErrorMessage,
	queryGeolocationPermission,
	GEOLOCATION_PERMISSION_TIP,
	resetMapView,
	zoomMapIn,
	zoomMapOut,
	applyRouteCamera,
	destroyMapTools,
	destroyMapInstance,
	canReuseMapInstance,
	to2d,
	to3d,
	showCompass,
	hideCompass,
	scheduleMapViewportRefresh,
	resetMapViewportCache,
	requestMapRender
} from './mars2d/core/engine.js';

export {
	MAP_LAYER_KEYS,
	resolveManagedLayer,
	isLayerControllable,
	setLayerVisible,
	getLayerVisible,
	toggleLayerVisible,
	getAnnotationDefaultVisible,
	setAnnotationVisible,
	getAnnotationVisible,
	isAnnotationToolbarAvailable
} from './core/layerControl.js';

export { createMapContext, provideMapContext, useMapContext } from './composables/useMapContext.js';
export { useMapEvent } from './composables/useMapEvent.js';

export {
	addProvinceMaskLayer,
	clearProvinceMaskLayer,
	waitProvinceMaskReady
} from './mars2d/core/provinceMaskLayer.js';

export { default as Mars2dMap } from './mars2d/components/Mars2dMap.vue';
// 兼容旧名称：业务侧若仍 import { MarsMap } 也能工作（实际为 2D 引擎）
export { default as MarsMap } from './mars2d/components/Mars2dMap.vue';
export { default as MapContainer } from './components/MapContainer.vue';
export { default as MapLoadingOverlay } from './components/MapLoadingOverlay.vue';
