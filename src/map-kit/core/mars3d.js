/**
 * Mars3D 业务封装层（本项目自定义代码，不是 Mars3D SDK 源码）
 *
 * ## 为什么文档里搜不到这些函数名？
 *
 * 本文件导出的 `mergeMapOptions`、`locateMarker`、`startDistanceMeasure` 等，
 * 都是本项目对 Mars3D 的二次封装，名字是我们自己起的。
 * 真正来自 Mars3D / Cesium 的 API 在函数体内部，例如：
 *
 * | 本文件中的调用 | 官方类 / 方法 | 文档 |
 * |---|---|---|
 * | `new mars3d.Map(...)` | Map 构造函数 | http://mars3d.cn/api/Map.html |
 * | `map.addLayer(layer)` | Map#addLayer | http://mars3d.cn/api/Map.html#addLayer |
 * | `map.addThing(thing)` | Map#addThing | http://mars3d.cn/api/Map.html#addThing |
 * | `map.setCameraView(...)` | Map#setCameraView | http://mars3d.cn/api/Map.html#setCameraView |
 * | `map.flyToGraphic(...)` | Map#flyToGraphic | http://mars3d.cn/api/Map.html#flyToGraphic |
 * | `map.flyToPoint(...)` | Map#flyToPoint | http://mars3d.cn/api/Map.html#flyToPoint |
 * | `new mars3d.thing.Measure(...)` | thing.Measure | http://mars3d.cn/api/Measure.html |
 * | `measure.distanceSurface(...)` | Measure#distanceSurface | http://mars3d.cn/api/Measure.html#distanceSurface |
 * | `new mars3d.layer.GraphicLayer(...)` | layer.GraphicLayer | http://mars3d.cn/api/GraphicLayer.html |
 * | `new mars3d.graphic.BillboardEntity(...)` | graphic.BillboardEntity | http://mars3d.cn/api/BillboardEntity.html |
 * | `new mars3d.control.Compass(...)` | control.Compass | http://mars3d.cn/api/Compass.html |
 * | `mars3d.Token.updateTianditu(...)` | Token#updateTianditu | http://mars3d.cn/api/Token.html |
 * | `graphic.bindPopup(...)` | BaseGraphic#bindPopup | http://mars3d.cn/api/BaseGraphic.html#bindPopup |
 * | `map.scene.morphTo2D(...)` | Cesium.Scene#morphTo2D | https://cesium.com/learn/cesiumjs/ref-doc/Scene.html |
 * | `viewer.useDefaultRenderLoop` | Cesium.Viewer 属性 | https://cesium.com/learn/cesiumjs/ref-doc/Viewer.html |
 *
 * SDK 版本：public/lib/mars3d（当前 v3.10.0，见该目录 package.json）
 * 全局对象：`index.html` 通过 `<script>` 注入 `globalThis.mars3d` 与 `globalThis.Cesium`
 * 地图实例创建：见 `components/MarsMap.vue` 中的 `new mars3d.Map(container, options)`
 *
 * 专题说明（注释较细）：
 * - 测距：搜索「量算：mars3d.thing.Measure」→ startDistanceMeasure
 * - 打点/弹框：搜索「定位标记」→ locateMarker、setLocationMarkerClickHandler
 */

import baseMarkerIcon from '../assets/images/lace-blue.png';
import warningMarkerIcon from '../assets/images/lace-red.png';
import {
	LOCATION_MARKER_LAYER_ID,
	MY_POSITION_MARKER_ID
} from '../constants.js';
import {
	removeMyPositionMarker,
	stopMyPositionMarker,
	upsertMyPositionMarker
} from './myPositionMarker.js';
import { addProvinceMaskLayer, clearProvinceMaskLayer } from './provinceMaskLayer.js';
import { MapEventType, emitMapEvent } from './mapEvents.js';
import {
	applyMapSceneRuntime,
	bindMapInteractionPerformance,
	getMapSceneCenter,
	unbindMapInteractionPerformance
} from '../config/mapSceneConfig.js';
import { buildMapLayerOptions, getAppMapConfig, getMapTokens } from '../config/runtimeConfig.js';

// ---------------------------------------------------------------------------
// 默认配置常量（传给 Mars3D 构造参数 / 方法 options，非 Mars3D 自有 API）
// ---------------------------------------------------------------------------

/** 组装 Map 构造函数的默认 options（basemaps / layers / scene） */
function createDefaultMapOptions() {
	const { basemaps, layers, scene } = buildMapLayerOptions();

	return { basemaps, layers, scene };
}

/** Measure#distanceSurface 的默认 label 样式（本项目自定义，见 Measure 文档 options.label） */
const DEFAULT_DISTANCE_MEASURE_OPTIONS = {
	showAddText: true,
	exact: true,
	label: {
		color: '#FFD700',
		font_size: 18,
		outline: true,
		outlineColor: '#000000',
		background: true,
		backgroundColor: 'rgba(2, 8, 16, 1)'
	}
};

const DEFAULT_AREA_MEASURE_OPTIONS = {
	exact: true,
	label: cloneValue(DEFAULT_DISTANCE_MEASURE_OPTIONS.label)
};

const DEFAULT_ANGLE_MEASURE_OPTIONS = {
	angleDecimal: 1,
	label: cloneValue(DEFAULT_DISTANCE_MEASURE_OPTIONS.label)
};

const DEFAULT_LOCATION_MARKER_TYPE = 'default';
const LOCATION_MARKER_ICON_MAP = {
	default: baseMarkerIcon,
	base: baseMarkerIcon,
	warning: warningMarkerIcon,
	risk: warningMarkerIcon
};

/** BillboardEntity.StyleOptions 的默认片段 */
const DEFAULT_LOCATION_MARKER_STYLE = {
	scale: 1,
	clampToGround: true
};

/** Map#flyToGraphic 的默认飞行参数（radius、duration 等为 Mars3D 飞行 options） */
const DEFAULT_LOCATION_FLY_TO_OPTIONS = {
	radius: 2000,
	duration: 1.2
};

/** 防止 GraphicLayer 重复绑定 click 事件的标记 key（本项目私有） */
const LOCATION_MARKER_LAYER_EVENT_BOUND_KEY = '__screenTemplateLayerEventBound__';
/** 防止 Measure 重复绑定工具栏状态事件（本项目私有） */
const MEASURE_TOOLBAR_STATE_BOUND_KEY = '__screenTemplateMeasureToolbarStateBound_v2__';
/** 防止 Map 重复绑定量算落点追踪（本项目私有） */
const MEASURE_MAP_DRAW_TRACKED_KEY = '__screenTemplateMeasureMapDrawTracked__';

/** 聚合下钻：与 map-scene.js minimumZoomDistance(500) 对齐，避免点击后无法继续放大 */
const CLUSTER_DRILL_MIN_RADIUS = 120;
const CLUSTER_DRILL_MIN_MAXIMUM_HEIGHT = 280;
/** 相机已足够近仍显示聚合时，临时关闭聚合以展开重叠点 */
const CLUSTER_UNPACK_CAMERA_HEIGHT = 2200;

const measureToolbarStateListeners = new Set();
const COMPASS_CONTROL_ID = 'screen-map-compass';

/** mars3d.control.Compass 构造参数，见 http://mars3d.cn/api/Compass.html */
const DEFAULT_COMPASS_OPTIONS = {
	id: COMPASS_CONTROL_ID,
	rotation: true,
	clickToNorth: true,
	style: {
		bottom: '320px',
		right: '24px'
	}
};

// ---------------------------------------------------------------------------
// 模块级单例状态（本项目维护，非 Mars3D API）
// ---------------------------------------------------------------------------

let mapInstance = null;
let compassControl = null;
/** 指南针挂载容器；默认 map.container 会被业务浮层（z-index 30+）盖住 */
let compassParentContainer = null;
let measureInstance = null;
let sectionMeasureInstance = null;
/** 用户是否已在地图上落点（控件选中不算，须 map 点击或 drawAddPoint） */
let measureHasUserDrawn = false;
/** 量算刚启动的同一事件循环内忽略落点事件，避免 SDK 初始化误触发 */
let measureIgnoreDrawEvents = false;
/** 合并同帧多次量算重绘请求（drawMouseMove 高频） */
let measureRenderRafId = null;
let locationMarkerLayer = null;
let locationMarkerClickHandler = null;
let currentRouteName = '';
let currentInitialView = cloneValue(getMapSceneCenter());
let mapRenderPaused = false;

// ---------------------------------------------------------------------------
// 工具函数（纯 JS，与 Mars3D 无关）
// ---------------------------------------------------------------------------

function isPlainObject(value) {
	return Object.prototype.toString.call(value) === '[object Object]';
}

function cloneValue(value) {
	if (Array.isArray(value)) {
		return value.map((item) => cloneValue(item));
	}

	if (isPlainObject(value)) {
		return Object.keys(value).reduce((result, key) => {
			result[key] = cloneValue(value[key]);
			return result;
		}, {});
	}

	return value;
}

/**
 * 深度合并地图配置对象（数组整体替换，对象递归合并）
 *
 * 用于合并 `getDefaultMapOptions()` 与路由覆盖项，最终作为 `new mars3d.Map(container, options)` 的 options。
 * 这是本项目工具函数，Mars3D 文档中无此名称。
 */
export function mergeMapOptions(baseOptions = {}, extraOptions = {}) {
	const result = cloneValue(baseOptions);

	if (!isPlainObject(extraOptions)) {
		return result;
	}

	Object.keys(extraOptions).forEach((key) => {
		const baseValue = result[key];
		const extraValue = extraOptions[key];

		if (Array.isArray(extraValue)) {
			result[key] = cloneValue(extraValue);
			return;
		}

		if (isPlainObject(baseValue) && isPlainObject(extraValue)) {
			result[key] = mergeMapOptions(baseValue, extraValue);
			return;
		}

		if (isPlainObject(extraValue)) {
			result[key] = mergeMapOptions({}, extraValue);
			return;
		}

		result[key] = extraValue;
	});

	return result;
}

/**
 * 获取全局 mars3d 命名空间（由 index.html 的 script 标签挂载）
 * @returns {typeof globalThis.mars3d}
 * @see http://mars3d.cn/api/
 */
function getMars3d() {
	const mars3d = globalThis.mars3d;
	if (!mars3d) {
		throw new Error('mars3d global not found. Check public/lib script loading in index.html.');
	}

	return mars3d;
}

/**
 * 获取全局 Cesium 命名空间（mars3d 依赖 cesium，与 map.viewer 底层相同）
 * @see https://cesium.com/learn/cesiumjs/ref-doc/
 */
function getCesium() {
	return globalThis.Cesium || null;
}

function formatNumber(value, digits = 6) {
	const num = Number(value);
	if (!Number.isFinite(num)) return '--';
	return num.toFixed(digits);
}

function getDegreeMinuteSecondData(lngLat) {
	const mars3d = getMars3d();
	const jdDms = mars3d.PointTrans?.degree2dms?.(lngLat.lng) || {};
	const wdDms = mars3d.PointTrans?.degree2dms?.(lngLat.lat) || {};
	return { jdDms, wdDms };
}

function getZoonData(lngLat) {
	const mars3d = getMars3d();
	const pointTrans = mars3d.PointTrans;
	if (!pointTrans?.getCGCS2000EPSGByLng || !pointTrans?.proj4Trans) {
		return { gk6X: '--', gk6Y: '--' };
	}

	try {
		// 官方示例中的 GK6 坐标：按经度自动取 6 度分带 EPSG 后转换
		const epsg = pointTrans.getCGCS2000EPSGByLng(lngLat.lng, true, false);
		if (!epsg) {
			return { gk6X: '--', gk6Y: '--' };
		}
		const [x, y] = pointTrans.proj4Trans([lngLat.lng, lngLat.lat], 'EPSG:4326', epsg);
		return {
			gk6X: formatNumber(x, 3),
			gk6Y: formatNumber(y, 3)
		};
	} catch (error) {
		console.warn('GK6 坐标转换失败', error);
		return { gk6X: '--', gk6Y: '--' };
	}
}

function buildMeasurePointPopup(point) {
	const lng = Number(point?.lng);
	const lat = Number(point?.lat);
	const altRaw = Number(point?.alt);
	const alt = Number.isFinite(altRaw) ? altRaw : 0;
	const normalized = {
		lng: Number.isFinite(lng) ? lng : 0,
		lat: Number.isFinite(lat) ? lat : 0
	};

	const { jdDms, wdDms } = getDegreeMinuteSecondData(normalized);
	const { gk6X, gk6Y } = getZoonData(normalized);

	return `<div class="mars3d-template-title">位置信息</div>
      <div class="mars3d-template-content">
          <div><label>经度</label>${formatNumber(normalized.lng)} &nbsp ${jdDms.degree ?? '--'}° ${
				jdDms.minute ?? '--'
			}′ ${jdDms.second ?? '--'}″</div>
          <div><label>纬度</label>${formatNumber(normalized.lat)} &nbsp ${wdDms.degree ?? '--'}° ${
				wdDms.minute ?? '--'
			}′ ${wdDms.second ?? '--'}″</div>
          <div><label>横坐标</label>${gk6X}</div>
          <div><label>纵坐标</label>${gk6Y}</div>
          <div><label>海拔</label>${formatNumber(alt, 2)}米</div>
      </div>`;
}

/** 按业务 type 解析标记图标 URL（本项目逻辑） */
function getMarkerTypeIcon(type) {
	if (!type) {
		return LOCATION_MARKER_ICON_MAP[DEFAULT_LOCATION_MARKER_TYPE];
	}

	return LOCATION_MARKER_ICON_MAP[type] || LOCATION_MARKER_ICON_MAP[DEFAULT_LOCATION_MARKER_TYPE];
}

function isLegendIconPath(image) {
	if (!image || typeof image !== 'string') return false;
	const normalized = image.replace(/\\/g, '/').toLowerCase();
	return normalized.includes('/legend/');
}

/**
 * 将业务参数转为 BillboardEntity 的 position 数组 [lng, lat, alt?]
 * @see http://mars3d.cn/api/BillboardEntity.html 构造参数 position
 */
function getMarkerPosition(options = {}) {
	if (Array.isArray(options.position)) {
		return options.position;
	}

	if (typeof options.lng !== 'number' || typeof options.lat !== 'number') {
		throw new Error('locateMarker requires numeric lng and lat.');
	}

	const position = [options.lng, options.lat];
	if (typeof options.alt === 'number') {
		position.push(options.alt);
	}

	return position;
}

/**
 * 组装 BillboardEntity.StyleOptions
 * horizontalOrigin / verticalOrigin 使用 Cesium 枚举，控制图标锚点
 * @see http://mars3d.cn/api/BillboardEntity.html
 * @see https://cesium.com/learn/cesiumjs/ref-doc/HorizontalOrigin.html
 */
function getMarkerStyle(options = {}) {
	const cesium = getCesium();
	const image = options.icon || getMarkerTypeIcon(options.type);
	const defaultStyle = {
		...DEFAULT_LOCATION_MARKER_STYLE,
		image,
		horizontalOrigin: cesium?.HorizontalOrigin?.CENTER,
		verticalOrigin: cesium?.VerticalOrigin?.BOTTOM
	};

	const mergedStyle = mergeMapOptions(defaultStyle, options.style || {});
	const hasCustomSize =
		mergedStyle.scale != null || mergedStyle.width != null || mergedStyle.height != null;

	// 定位图标来自 public/legend 时，默认放大一些，避免地图上过小难辨识。
	if (isLegendIconPath(image) && !hasCustomSize) {
		mergedStyle.scale = 1.45;
	}

	return mergedStyle;
}

/**
 * 【弹窗方式 A】为单个标记绑定 Mars3D 内置 Popup（地图上的 HTML 气泡）
 *
 * 在 locateMarker / addLocationMarkers 的 marker 项里传入：
 * - popup: string | function  → 传给 graphic.bindPopup 的内容（支持 HTML 字符串或回调）
 * - popupRenderer: function    → 与 popup 二选一，自定义渲染
 * - popupOptions: object       → 气泡样式，见 BaseGraphic#bindPopup 第二个参数
 * - popup: false               → 显式关闭（风险预警页用此方式，改走方式 B）
 *
 * 创建后也可手动：graphic.openPopup()（locateMarker 的 openPopup: true 即调用此 API）
 *
 * @see http://mars3d.cn/api/BaseGraphic.html#bindPopup
 * @see http://mars3d.cn/api/BaseGraphic.html#openPopup
 *
 * @example
 * await locateMarker({
 *   lng: 111.53, lat: 27.38,
 *   popup: '<div>杆塔 #301</div>',
 *   openPopup: true
 * });
 */
function bindGraphicPopup(graphic, options = {}) {
	if (!graphic || options.popup === false) {
		return;
	}

	if (options.popup || options.popupRenderer) {
		graphic.bindPopup(options.popup || options.popupRenderer, options.popupOptions || {});
	}
}

/**
 * 禁用矢量对象右键菜单
 * @see http://mars3d.cn/api/BaseGraphic.html#unbindContextMenu
 */
function disableGraphicContextMenu(graphic) {
	if (graphic?.unbindContextMenu) {
		graphic.unbindContextMenu();
	}
}

// ---------------------------------------------------------------------------
// Token / 地图初始化配置
// ---------------------------------------------------------------------------

/**
 * 将环境变量中的 Token 写入 Mars3D 静态 Token 管理器
 * 须在创建 Map 之前调用，否则天地图/高德底图可能鉴权失败
 * @see http://mars3d.cn/api/Token.html#updateTianditu
 * @see http://mars3d.cn/api/Token.html#updateGaode
 */
export function initMars3dTokens() {
	const mars3d = globalThis.mars3d;
	if (!mars3d?.Token) {
		return;
	}

	const { tianditu, gaode } = getMapTokens();

	if (tianditu?.length) {
		mars3d.Token.updateTianditu(tianditu.length === 1 ? tianditu[0] : tianditu);
	}

	if (gaode?.length) {
		mars3d.Token.updateGaode(gaode.length === 1 ? gaode[0] : gaode);
	}
}

/**
 * 获取默认 Map 构造 options（底图、业务图层、初始 scene）
 * 供 MarsMap.vue：`new mars3d.Map(el, mergeMapOptions(getDefaultMapOptions(), props.mapOptions))`
 * @see http://mars3d.cn/api/Map.html
 */
export function getDefaultMapOptions() {
	initMars3dTokens();
	return cloneValue(createDefaultMapOptions());
}

/**
 * 禁用地图实例右键菜单
 * @see http://mars3d.cn/api/Map.html#unbindContextMenu
 */
export function disableMapContextMenu(map = mapInstance) {
	if (map?.unbindContextMenu) {
		map.unbindContextMenu();
	}
}

// ---------------------------------------------------------------------------
// 全局 Map 实例生命周期
// ---------------------------------------------------------------------------

/**
 * 注册全局 Map 单例（布局 onMapReady / useMapContext 时调用）
 * @param {import('mars3d').Map | null} map mars3d.Map 实例
 * @see http://mars3d.cn/api/Map.html
 */
export function setMapInstance(map) {
	const previousMap = mapInstance;

	if (previousMap && map !== previousMap) {
		destroyMapInstance(previousMap);
	}

	mapInstance = map || null;
	locationMarkerLayer = null;

	if (!mapInstance) {
		unbindMapInteractionPerformance();
		compassControl = null;
	}

	if (mapInstance) {
		disableMapContextMenu(mapInstance);
		addProvinceMaskLayer(mapInstance);
		applyMapSceneRuntime(mapInstance);
		bindMapInteractionPerformance(mapInstance);
	}
}

/** @returns {import('mars3d').Map | null} 当前全局 Map 实例 */
export function getMapInstance() {
	return mapInstance;
}

let mapCameraLockDepth = 0;
/** @type {Record<string, boolean> | null} */
let savedCameraControllerState = null;

function getCameraController(map = mapInstance) {
	return map?.viewer?.scene?.screenSpaceCameraController ?? null;
}

const CAMERA_CONTROLLER_KEYS = [
	'enableInputs',
	'enableTranslate',
	'enableZoom',
	'enableRotate',
	'enableTilt',
	'enableLook'
];

/** 弹层打开时禁用地图拖拽/缩放，避免滚动穿透到底图 */
export function lockMapCameraInteraction(map = mapInstance) {
	const controller = getCameraController(map);
	if (!controller) {
		return;
	}

	if (mapCameraLockDepth === 0) {
		savedCameraControllerState = {};
		for (const key of CAMERA_CONTROLLER_KEYS) {
			savedCameraControllerState[key] = controller[key];
			controller[key] = false;
		}

		const viewerContainer = map?.viewer?.container;
		if (viewerContainer) {
			viewerContainer.style.pointerEvents = 'none';
			viewerContainer.style.touchAction = 'none';
		}
	}

	mapCameraLockDepth += 1;
}

/** 与 lockMapCameraInteraction 配对；引用计数归零后恢复地图交互 */
export function unlockMapCameraInteraction(map = mapInstance) {
	const controller = getCameraController(map);
	if (!controller || mapCameraLockDepth <= 0) {
		return;
	}

	mapCameraLockDepth -= 1;

	if (mapCameraLockDepth === 0 && savedCameraControllerState) {
		for (const key of CAMERA_CONTROLLER_KEYS) {
			controller[key] = savedCameraControllerState[key];
		}

		const viewerContainer = map?.viewer?.container;
		if (viewerContainer) {
			viewerContainer.style.pointerEvents = '';
			viewerContainer.style.touchAction = '';
		}

		savedCameraControllerState = null;
	}
}

/** 地图渲染是否被 pauseMapRender 暂停（本项目状态位） */
export function isMapRenderPaused() {
	return mapRenderPaused;
}

/**
 * 暂停 Cesium 渲染循环并隐藏 DOM，用于切到无地图页面时降低 GPU 占用
 * - map.viewer：Map 只读属性，底层 Cesium.Viewer
 * - viewer.useDefaultRenderLoop：Cesium 是否自动 requestAnimationFrame 渲染
 * @see http://mars3d.cn/api/Map.html#viewer
 * @see https://cesium.com/learn/cesiumjs/ref-doc/Viewer.html#useDefaultRenderLoop
 */
export function pauseMapRender(map = mapInstance) {
	if (!map || mapRenderPaused) {
		return false;
	}

	const viewer = map.viewer;
	if (viewer) {
		viewer.useDefaultRenderLoop = false;
	}

	if (map.container) {
		map.container.style.pointerEvents = 'none';
		map.container.style.visibility = 'hidden';
	}

	mapRenderPaused = true;
	return true;
}

/**
 * 恢复渲染并在容器重新可见后触发一次 resize + requestRender
 * @see https://cesium.com/learn/cesiumjs/ref-doc/Viewer.html#resize
 * @see https://cesium.com/learn/cesiumjs/ref-doc/Scene.html#requestRender
 */
export function resumeMapRender(map = mapInstance) {
	if (!map) {
		return false;
	}

	const viewer = map.viewer;

	if (map.container) {
		map.container.style.pointerEvents = '';
		map.container.style.visibility = '';
	}

	if (viewer) {
		viewer.useDefaultRenderLoop = true;
		resetMapViewportCache();
		applyMapSceneRuntime(map);
		bindMapInteractionPerformance(map);
		scheduleMapViewportRefresh(map, 0);
	}

	const wasPaused = mapRenderPaused;
	mapRenderPaused = false;
	return wasPaused;
}

/**
 * 记录当前路由名，并缓存复位视角
 * @param {string} routeName
 * @param {{ lng: number, lat: number, alt?: number } | null} [initialView] 宿主传入；缺省用 map-scene.js center
 */
export function setActiveRoute(routeName, initialView) {
	currentRouteName = routeName || '';
	currentInitialView = initialView ? cloneValue(initialView) : cloneValue(getMapSceneCenter());
	return cloneValue(currentInitialView);
}

/** 获取当前路由下用于复位的 cameraView 对象 */
export function getActiveInitialView() {
	return cloneValue(currentInitialView);
}

// ---------------------------------------------------------------------------
// 量算：mars3d.thing.Measure（贴地测距）
// ---------------------------------------------------------------------------
//
// ## 完整调用链（工具栏「测距」）
//
//   MapToolbar @measure
//     → ScreenLayout.vue handleMeasure()
//         → startDistanceMeasure()     // 本文件
//             → measure.distanceSurface(options)  // Mars3D 官方 API
//
// ## 用户操作与 SDK 状态
//
//   1. 第一次点击测距：ensureMeasure 创建 mars3d.thing.Measure 并通过 map.addThing 挂上地图
//   2. startDistanceMeasure 内部 measure.clear() 清掉上次线段，再调用 distanceSurface
//   3. 用户在地图上依次点击多个点，双击或右键结束（由 Measure 默认 drawEndEventType 决定）
//   4. distanceSurface 返回 Promise，resolve 后表示本次量算结束；ScreenLayout 将 isMeasureDrawing 置 false
//   5. 再次点测距按钮：若 isMeasureDrawing，则 stopMeasureDrawing() 取消当前绘制
//   6. 路由切换 applyRouteCamera({ clearMeasure: true }) 或点「复位」会 clear / stop 量算
//
// ## 可改参数
//
//   - DEFAULT_DISTANCE_MEASURE_OPTIONS：label 颜色、exact 贴地精度等，会 merge 进 distanceSurface(options)
//   - startDistanceMeasure({ distanceOptions: { ... } })：覆盖默认，字段见 Measure#distanceSurface 文档
//   - startDistanceMeasure({ clear: false })：新测距前不清除已有线段
//
// @see http://mars3d.cn/api/Measure.html
// @see http://mars3d.cn/api/Measure.html#distanceSurface
// @see src/layouts/ScreenLayout.vue handleMeasure

/**
 * 懒创建 Measure 量算对象并挂到 Map（Thing 体系，全局单例 measureInstance）
 * @returns {InstanceType<typeof import('mars3d').thing.Measure>}
 * @see http://mars3d.cn/api/Measure.html
 * @see http://mars3d.cn/api/Map.html#addThing
 */
function ensureMeasure(map = mapInstance) {
	if (!map) {
		throw new Error('Map instance is not ready.');
	}

	if (!measureInstance) {
		const mars3d = getMars3d();
		// new mars3d.thing.Measure(options) — 量算分析 Thing，内部自带 GraphicLayer
		measureInstance = new mars3d.thing.Measure({
			label: cloneValue(DEFAULT_DISTANCE_MEASURE_OPTIONS.label),
			// 绘制完成后直接进入编辑（满足“绘制完成后可直接编辑”诉求）
			isAutoEditing: true,
			isContinued: false
		});
		map.addThing(measureInstance);
		bindMeasureToolbarStateEvents(measureInstance);
	}

	bindMeasureMapDrawTracking(map);
	return measureInstance;
}

/**
 * 剖面分析使用独立 Measure 实例（对齐迁移前 profileCurvature 用法）
 */
function ensureSectionMeasure(map = mapInstance) {
	if (!map) {
		throw new Error('Map instance is not ready.');
	}

	if (!sectionMeasureInstance) {
		const mars3d = getMars3d();
		sectionMeasureInstance = new mars3d.thing.Measure({
			label: cloneValue(DEFAULT_DISTANCE_MEASURE_OPTIONS.label),
			isAutoEditing: true,
			isContinued: false
		});
		map.addThing(sectionMeasureInstance);
		bindMeasureToolbarStateEvents(sectionMeasureInstance);
	}

	return sectionMeasureInstance;
}

function resetMeasureUserDrawn() {
	measureHasUserDrawn = false;
}

function beginMeasureDrawingSession() {
	resetMeasureUserDrawn();
	measureIgnoreDrawEvents = true;
	queueMicrotask(() => {
		measureIgnoreDrawEvents = false;
	});
}

function markMeasureUserDrawn() {
	if (measureIgnoreDrawEvents) {
		return;
	}
	if (!measureHasUserDrawn) {
		measureHasUserDrawn = true;
		notifyMeasureToolbarState();
	}
}

function isMeasureInstanceClearable(measure) {
	if (!measure || measure.isDrawing) {
		return false;
	}
	return !!(measure.hasMeasure || measure.isEditing);
}

function shouldShowMeasureActions(measure) {
	if (!measure) {
		return false;
	}
	if (measure.isEditing) {
		return true;
	}
	if (measure.isDrawing) {
		return measureHasUserDrawn;
	}
	return !!(measure.hasMeasure && measureHasUserDrawn);
}

/**
 * 是否应显示「清除量算」按钮：距离/面积/剖面等任一量算完成后（绘制中不显示）
 */
export function getMeasureClearable() {
	return (
		isMeasureInstanceClearable(measureInstance) ||
		isMeasureInstanceClearable(sectionMeasureInstance)
	);
}

/**
 * 当前主量算实例状态（测距/测面/测点等）
 */
export function getMeasureState() {
	const measure = measureInstance;
	if (!measure) {
		return {
			isDrawing: false,
			isEditing: false,
			hasMeasure: false,
			clearable: false,
			showActions: false
		};
	}

	return {
		isDrawing: !!measure.isDrawing,
		isEditing: !!measure.isEditing,
		hasMeasure: !!measure.hasMeasure,
		clearable: isMeasureInstanceClearable(measure),
		showActions: shouldShowMeasureActions(measure)
	};
}

function notifyMeasureToolbarState() {
	const clearable = getMeasureClearable();
	const state = getMeasureState();
	measureToolbarStateListeners.forEach((listener) => {
		listener(clearable, state);
	});
}

/** requestRenderMode 下量算绘制/清除后需显式请求重绘，否则需缩放地图才刷新 */
function scheduleMeasureMapRender(map = mapInstance) {
	const scene = map?.viewer?.scene;
	if (!scene?.requestRender) {
		return;
	}

	if (measureRenderRafId) {
		return;
	}

	measureRenderRafId = requestAnimationFrame(() => {
		measureRenderRafId = null;
		scene.requestRender();
	});
}

function bindMeasureMapDrawTracking(map) {
	if (!map || map[MEASURE_MAP_DRAW_TRACKED_KEY]) {
		return;
	}

	map[MEASURE_MAP_DRAW_TRACKED_KEY] = true;
	const mars3d = getMars3d();

	map.on(mars3d.EventType.click, () => {
		if (measureInstance?.isDrawing) {
			markMeasureUserDrawn();
			scheduleMeasureMapRender(map);
		}
	});
}

function bindMeasureToolbarStateEvents(measure) {
	if (!measure || measure[MEASURE_TOOLBAR_STATE_BOUND_KEY]) {
		return;
	}

	measure[MEASURE_TOOLBAR_STATE_BOUND_KEY] = true;
	const mars3d = getMars3d();

	measure.on(mars3d.EventType.drawStart, () => {
		if (measure === measureInstance) {
			resetMeasureUserDrawn();
		}
		notifyMeasureToolbarState();
	});

	measure.on(mars3d.EventType.drawAddPoint, () => {
		if (measure === measureInstance && measure.isDrawing) {
			markMeasureUserDrawn();
		}
	});

	measure.on(mars3d.EventType.drawRemovePoint, () => {
		if (measure !== measureInstance || !measure.isDrawing) {
			return;
		}
		// 撤销全部落点后隐藏按钮（Mars3D 绘制中通常至少保留 1 个点）
		if (!measure.graphics?.length) {
			resetMeasureUserDrawn();
			notifyMeasureToolbarState();
		}
	});

	measure.on(mars3d.EventType.drawCreated, () => {
		if (measure === measureInstance) {
			markMeasureUserDrawn();
		}
	});

	const eventTypes = [
		mars3d.EventType.drawCreated,
		mars3d.EventType.addGraphic,
		mars3d.EventType.removeGraphic,
		mars3d.EventType.editStart,
		mars3d.EventType.editStop,
		mars3d.EventType.click,
		mars3d.EventType.end
	];

	eventTypes.forEach((eventType) => {
		measure.on(eventType, notifyMeasureToolbarState);
	});

	const renderEventTypes = [
		mars3d.EventType.drawStart,
		mars3d.EventType.drawMouseMove,
		mars3d.EventType.drawAddPoint,
		mars3d.EventType.drawRemovePoint,
		...eventTypes
	];

	renderEventTypes.forEach((eventType) => {
		measure.on(eventType, () => scheduleMeasureMapRender(mapInstance));
	});
}

/**
 * 订阅测距清除按钮显隐（返回取消订阅函数）
 * @param {(clearable: boolean) => void} listener
 */
export function onMeasureToolbarStateChange(listener) {
	if (typeof listener !== 'function') {
		return () => {};
	}

	measureToolbarStateListeners.add(listener);
	listener(getMeasureClearable());

	return () => {
		measureToolbarStateListeners.delete(listener);
	};
}

// ---------------------------------------------------------------------------
// 定位标记：GraphicLayer + BillboardEntity + 点击弹窗
// ---------------------------------------------------------------------------
//
// ## 两种「点击图标打开弹框」的实现方式
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ 方式 A：Mars3D 内置 Popup（地图 DOM 气泡，适合简单 HTML）                  │
// │   marker 项传 popup / popupRenderer + 可选 openPopup: true              │
// │   实现：createLocationMarkerGraphic → bindGraphicPopup → bindPopup      │
// │   文档：http://mars3d.cn/api/BaseGraphic.html#bindPopup                 │
// └─────────────────────────────────────────────────────────────────────────┘
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ 方式 B：Vue 自定义弹框（Element 对话框等，本项目风险预警页采用）           │
// │   1. 打点时不绑 Popup：popup: false（或不传 popup）                      │
// │   2. 业务页 onMounted：setLocationMarkerClickHandler(handleMarkerClick) │
// │   3. 用户点击图标 → GraphicLayer EventType.click → 本文件回调            │
// │   4. handleMarkerClick({ attr, graphic }) 里打开 RiskDetailDialog 等    │
// │   5. onBeforeUnmount：setLocationMarkerClickHandler(null) 防止泄漏       │
// │   参考：src/views/risk-warning/index.vue                                │
// └─────────────────────────────────────────────────────────────────────────┘
//
// ## locateMarker / addLocationMarkers 执行步骤
//
//   ensureLocationMarkerLayer(map)   // 固定 id 图层，带 cluster 聚合
//     → layer.clear?                 // options.clear !== false 时清空
//     → createLocationMarkerGraphic  // new BillboardEntity + bindGraphicPopup
//     → layer.addGraphic
//     → map.flyToGraphic?            // flyTo !== false（单点默认会飞）
//     → graphic.openPopup?           // openPopup: true 且已 bindPopup 时
//
// ## marker 单项常用字段
//
//   必填：lng + lat，或 position: [lng, lat, alt?]
//   id          唯一标识，locateMarker 同 id 会先 remove 再 add
//   type        'default' | 'warning' | 'risk' → 决定图标 PNG
//   attr        任意业务数据，点击时原样回传（方式 B 用 attr.id 打开详情）
//   style       合并进 BillboardEntity.StyleOptions
//   flyTo       false 可禁止飞向该点；批量默认 false，单点默认 true
//   clear       false 批量追加时不先清空图层
//   popup       见方式 A；false 表示不绑 Mars3D 气泡（方式 B 必设或省略）
//
// @see http://mars3d.cn/api/GraphicLayer.html
// @see http://mars3d.cn/api/BillboardEntity.html

/**
 * 图层统一 click 监听（只绑定一次）
 *
 * 点击逻辑分支：
 *   - graphic.cluster === false 且已注册 locationMarkerClickHandler
 *       → 调用 handler({ graphic, event, attr })，由 Vue 页打开自定义弹框
 *   - graphic.cluster === true 且相机高度 > 90000m
 *       → map.flyToPoint 拉近，便于散开聚合点（近景不自动飞，避免干扰点选）
 *
 * @param {import('mars3d').layer.GraphicLayer} graphicLayer
 * @see http://mars3d.cn/api/GraphicLayer.html#on
 * @see http://mars3d.cn/api/EventType.html
 */
function buildClusterDrillFlyOptions(map) {
	const cameraHeight = map?.camera?.positionCartographic?.height;
	const safeCameraHeight = typeof cameraHeight === 'number' ? cameraHeight : 120000;
	const radius = Math.max(CLUSTER_DRILL_MIN_RADIUS, Math.min(25000, safeCameraHeight * 0.38));
	const maximumHeight = Math.max(
		CLUSTER_DRILL_MIN_MAXIMUM_HEIGHT,
		Math.min(45000, safeCameraHeight * 0.5)
	);

	return {
		radius,
		maximumHeight,
		duration: 0.5
	};
}

function tryUnpackClusterAtLowAltitude(graphicLayer, map, cameraHeight) {
	const safeCameraHeight = typeof cameraHeight === 'number' ? cameraHeight : Number.POSITIVE_INFINITY;
	if (safeCameraHeight > CLUSTER_UNPACK_CAMERA_HEIGHT || !graphicLayer?.clusterEnabled) {
		return false;
	}

	graphicLayer.clusterEnabled = false;
	requestMapRender(map);

	globalThis.setTimeout(() => {
		if (!graphicLayer || graphicLayer.isDestroy) {
			return;
		}

		graphicLayer.clusterEnabled = true;
		requestMapRender(map);
	}, 8000);

	return true;
}

function bindLocationMarkerLayerEvent(graphicLayer, map = mapInstance) {
	if (!graphicLayer || graphicLayer[LOCATION_MARKER_LAYER_EVENT_BOUND_KEY]) {
		return;
	}

	const mars3d = getMars3d();

	// graphicLayer.on(eventType, callback) — BaseClass 事件，与 Map.on 相同机制
	graphicLayer.on(mars3d.EventType.click, function (event) {
		const graphic = event?.graphic;

		if (!graphic) {
			return;
		}

		if (!graphic.cluster) {
			const attr = graphic.attr || {};
			const payload = { kind: 'marker', graphic, event, attr };

			emitMapEvent(MapEventType.FEATURE_CLICK, payload);
			locationMarkerClickHandler?.(payload);
		}

		// 聚合点点击：动态下钻；近景仍聚合时临时关闭聚合展开重叠点
		if (!graphic.cluster) {
			return;
		}

		const position = graphic.positionShow || graphic.position || event.cartesian;

		if (!position || !map?.flyToPoint) {
			return;
		}

		const cameraHeight = map?.camera?.positionCartographic?.height;
		const flyOptions = buildClusterDrillFlyOptions(map);

		map.flyToPoint(position, flyOptions).then?.(() => {
			const heightAfter = map?.camera?.positionCartographic?.height ?? cameraHeight;
			if (
				heightAfter <= CLUSTER_UNPACK_CAMERA_HEIGHT ||
				(typeof cameraHeight === 'number' && cameraHeight <= CLUSTER_UNPACK_CAMERA_HEIGHT)
			) {
				tryUnpackClusterAtLowAltitude(graphicLayer, map, heightAfter);
			}
		});
	});

	graphicLayer[LOCATION_MARKER_LAYER_EVENT_BOUND_KEY] = true;
}

/**
 * 获取或创建业务定位图层（固定 id，开启 cluster 聚合）
 * @returns {Promise<import('mars3d').layer.GraphicLayer>}
 * @see http://mars3d.cn/api/GraphicLayer.html
 * @see http://mars3d.cn/api/Map.html#getLayerById
 * @see http://mars3d.cn/api/Map.html#addLayer
 */
async function ensureLocationMarkerLayer(map = mapInstance) {
	if (!map) {
		throw new Error('Map instance is not ready.');
	}

	const existingLayer = map.getLayerById?.(LOCATION_MARKER_LAYER_ID);
	if (existingLayer) {
		locationMarkerLayer = existingLayer;
		disableMapContextMenu(map);
		locationMarkerLayer.unbindContextMenu?.();
		bindLocationMarkerLayerEvent(locationMarkerLayer, map);
		return locationMarkerLayer;
	}

	if (locationMarkerLayer) {
		bindLocationMarkerLayerEvent(locationMarkerLayer, map);
		return locationMarkerLayer;
	}

	const mars3d = getMars3d();
	// GraphicLayer 构造参数 cluster.* 见 GraphicLayer 文档「聚合」一节
	locationMarkerLayer = new mars3d.layer.GraphicLayer({
		id: LOCATION_MARKER_LAYER_ID,
		name: 'Location Marker Layer',
		cluster: {
			enabled: true,
			pixelRange: 60,
			minimumClusterSize: 2,
			image: {
				color: '#ff0000',
				opacity: 0.86,
				borderColor: 'rgba(255, 255, 255, 0.65)',
				borderWidth: 5,
				borderOpacity: 0.72,
				fontColor: '#ffffff',
				radius: 26
			}
		}
	});
	locationMarkerLayer.unbindContextMenu?.();
	bindLocationMarkerLayerEvent(locationMarkerLayer, map);
	await map.addLayer(locationMarkerLayer);
	disableMapContextMenu(map);

	return locationMarkerLayer;
}

/** @see ensureLocationMarkerLayer */
export async function getLocationMarkerLayer(map = mapInstance) {
	return ensureLocationMarkerLayer(map);
}

/**
 * 【弹窗方式 B 的核心】注册全局「标记点击」回调
 *
 * 与 bindGraphicPopup 互斥使用：风险预警页传 popup: false，避免地图上再浮一层 Mars3D 气泡。
 *
 * @param {function|null} handler
 *   @param {object} payload
 *   @param {import('mars3d').graphic.BaseGraphic} payload.graphic 被点的 BillboardEntity
 *   @param {object} payload.event  Mars3D 原始 click 事件
 *   @param {object} payload.attr   创建 marker 时传入的 attr 副本（业务字段放这里）
 *
 * @example
 * // risk-warning/index.vue
 * const handleMarkerClick = ({ attr, graphic }) => {
 *   currentRiskId.value = attr.id;
 *   detailVisible.value = true;  // 打开 Vue 组件 RiskDetailDialog
 * };
 * onMounted(() => setLocationMarkerClickHandler(handleMarkerClick));
 * onBeforeUnmount(() => setLocationMarkerClickHandler(null));
 */
export function setLocationMarkerClickHandler(handler) {
	locationMarkerClickHandler = typeof handler === 'function' ? handler : null;
}

/**
 * 停止当前量算绘制（用户再次点击测距按钮、切换 2D/3D、复位前调用）
 * @returns {boolean} 是否成功执行了 stopDraw
 * @see http://mars3d.cn/api/Measure.html#stopDraw
 * @see http://mars3d.cn/api/Measure.html#isDrawing
 */
export function stopMeasureDrawing() {
	if (!measureInstance || !measureInstance.isDrawing) {
		return false;
	}

	const stopped = measureInstance.stopDraw();
	notifyMeasureToolbarState();
	return stopped;
}

/**
 * 完成量算绘制（移动端替代双击结束）
 * @see http://mars3d.cn/api/Measure.html#endDraw
 */
export function endMeasureDrawing() {
	if (!measureInstance?.isDrawing) {
		return false;
	}

	const ended = measureInstance.endDraw();
	notifyMeasureToolbarState();
	return ended;
}

/**
 * 结束量算结果编辑态
 */
export function stopMeasureEditing() {
	if (!measureInstance?.isEditing || !measureInstance.graphicLayer?.stopEditing) {
		return false;
	}

	measureInstance.graphicLayer.stopEditing();
	notifyMeasureToolbarState();
	return true;
}

/**
 * 确认量算：绘制中则结束绘制，编辑中则退出编辑
 */
export function confirmMeasureDrawing() {
	if (!measureInstance) {
		return false;
	}

	if (measureInstance.isDrawing) {
		return endMeasureDrawing();
	}

	if (measureInstance.isEditing) {
		return stopMeasureEditing();
	}

	return false;
}

/**
 * 清空量算结果
 * @see http://mars3d.cn/api/Measure.html#clear
 */
export function clearMeasure() {
	if (measureInstance) {
		if (measureInstance.isDrawing) {
			measureInstance.stopDraw();
		}
		measureInstance.clear();
	}

	if (sectionMeasureInstance) {
		if (sectionMeasureInstance.isDrawing) {
			sectionMeasureInstance.stopDraw();
		}
		sectionMeasureInstance.clear();
	}

	resetMeasureUserDrawn();
	notifyMeasureToolbarState();
	scheduleMeasureMapRender();
}

/**
 * 开始「贴地距离」量算（封装 Measure#distanceSurface）
 *
 * @param {object} [options]
 * @param {import('mars3d').Map} [options.map] 默认 mapInstance
 * @param {boolean} [options.clear=true]  true：测量前清空已有量算线
 * @param {object} [options.distanceOptions] 合并进 DEFAULT_DISTANCE_MEASURE_OPTIONS 后传给 distanceSurface
 * @returns {Promise<*>} Mars3D 返回的量算结果对象（如 DistanceSurfaceMeasure），绘制结束后 resolve
 *
 * @example
 * // 布局工具栏（最常见）
 * await startDistanceMeasure();
 *
 * @example
 * // 自定义标签样式、测量完保留上一条线
 * await startDistanceMeasure({
 *   clear: false,
 *   distanceOptions: { label: { color: '#00ff00' } }
 * });
 *
 * @see http://mars3d.cn/api/Measure.html#distanceSurface
 */
export async function startDistanceMeasure(options = {}) {
	const map = options.map || mapInstance;
	const measure = ensureMeasure(map);

	if (options.clear !== false) {
		measure.clear();
		notifyMeasureToolbarState();
	}

	if (measure.isDrawing) {
		measure.stopDraw();
	}

	const distanceOptions = mergeMapOptions(
		DEFAULT_DISTANCE_MEASURE_OPTIONS,
		options.distanceOptions || {}
	);

	beginMeasureDrawingSession();

	try {
		const resultPromise = measure.distanceSurface(distanceOptions);
		notifyMeasureToolbarState();
		return await resultPromise;
	} finally {
		notifyMeasureToolbarState();
	}
}

/**
 * 开始「高度差」量算（封装 Measure#height）
 * @see http://mars3d.cn/api/Measure.html#height
 */
export async function startHeightMeasure(options = {}) {
	const map = options.map || mapInstance;
	const measure = ensureMeasure(map);

	if (options.clear !== false) {
		measure.clear();
		notifyMeasureToolbarState();
	}

	if (measure.isDrawing) {
		measure.stopDraw();
	}

	const heightOptions = options.heightOptions || {};

	try {
		// 官方示例：measure.height()
		return Object.keys(heightOptions).length > 0
			? await measure.height(heightOptions)
			: await measure.height();
	} finally {
		notifyMeasureToolbarState();
	}
}

/**
 * 开始「剖面分析」（封装 Measure#section）
 * 迁移前实现：profileCurvature.section({ splitNum, exact, label... })，不依赖后端接口。
 * @see http://mars3d.cn/api/Measure.html#section
 */
export async function startSectionMeasure(options = {}) {
	const map = options.map || mapInstance;
	const measure = ensureSectionMeasure(map);

	if (options.clear !== false) {
		measure.clear();
		notifyMeasureToolbarState();
	}

	if (measure.isDrawing) {
		measure.stopDraw();
	}

	const sectionOptions = mergeMapOptions(
		{
			splitNum: 300,
			exact: false,
			showAddText: false,
			style: { color: '#ffff00' },
			label: cloneValue(DEFAULT_DISTANCE_MEASURE_OPTIONS.label)
		},
		options.sectionOptions || {}
	);

	const mars3d = getMars3d();
	const endWaitMs = Number(options.endWaitMs) > 0 ? Number(options.endWaitMs) : 30000;

	return await new Promise(async (resolve, reject) => {
		let settled = false;
		let timer = null;

		const finish = (payload, isError = false) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			measure.off?.(mars3d.EventType.end, handleEnd);
			notifyMeasureToolbarState();
			if (isError) reject(payload);
			else resolve(payload);
		};

		const handleEnd = (event) => {
			const value = event?.value;
			if (value?.arrPoint?.length && value?.arrHB?.length && value?.arrLen?.length) {
				// 对齐官方/迁移前：最终数据从 end 事件 value 获取
				finish(value);
				return;
			}
			// 事件到了但无有效剖面数据，返回原事件供上层兜底处理
			finish(event || null);
		};

		measure.on?.(mars3d.EventType.end, handleEnd);
		timer = setTimeout(() => finish(null), endWaitMs);

		try {
			// 官方方式：仅发起 section 绘制，结果由 end 事件返回
			await measure.section(sectionOptions);
		} catch (error) {
			finish(error, true);
		}
	});
}

/**
 * 开始「贴地面积」量算（封装 Measure#areaSurface）
 * @see http://mars3d.cn/api/Measure.html#areaSurface
 */
export async function startAreaMeasure(options = {}) {
	const map = options.map || mapInstance;
	const measure = ensureMeasure(map);

	if (options.clear !== false) {
		measure.clear();
		notifyMeasureToolbarState();
	}

	if (measure.isDrawing) {
		measure.stopDraw();
	}

	const areaOptions = mergeMapOptions(DEFAULT_AREA_MEASURE_OPTIONS, options.areaOptions || {});

	beginMeasureDrawingSession();

	try {
		const resultPromise = measure.areaSurface(areaOptions);
		notifyMeasureToolbarState();
		return await resultPromise;
	} finally {
		notifyMeasureToolbarState();
	}
}

/**
 * 开始「角度/方位角」量算（封装 Measure#angle）
 * @see http://mars3d.cn/api/Measure.html#angle
 */
export async function startAngleMeasure(options = {}) {
	const map = options.map || mapInstance;
	const measure = ensureMeasure(map);

	if (options.clear !== false) {
		measure.clear();
		notifyMeasureToolbarState();
	}

	if (measure.isDrawing) {
		measure.stopDraw();
	}

	const angleOptions = options.angleOptions
		? mergeMapOptions(DEFAULT_ANGLE_MEASURE_OPTIONS, options.angleOptions)
		: undefined;

	try {
		// 官方示例：measure.angle()
		return angleOptions ? await measure.angle(angleOptions) : await measure.angle();
	} finally {
		notifyMeasureToolbarState();
	}
}

/**
 * 开始「坐标测量」：点选显示经纬度（封装 Measure#point）
 * @see http://mars3d.cn/api/Measure.html#point
 */
export async function startPointMeasure(options = {}) {
	const map = options.map || mapInstance;
	const measure = ensureMeasure(map);

	if (options.clear !== false) {
		measure.clear();
		notifyMeasureToolbarState();
	}

	if (measure.isDrawing) {
		measure.stopDraw();
	}

	const pointOptions = mergeMapOptions(
		{
			popupOptions: {
				closeButton: true,
				closeOnClick: false,
				pointerEvents: true
			},
			popup: function (point) {
				return buildMeasurePointPopup(point);
			}
		},
		options.pointOptions || {}
	);

	try {
		return await measure.point(pointOptions);
	} finally {
		notifyMeasureToolbarState();
	}
}

/**
 * 清空定位图层上所有矢量
 * @see http://mars3d.cn/api/GraphicLayer.html#clear
 */
export async function clearLocationMarkers(options = {}) {
	const map = options.map || mapInstance;
	if (!map) {
		return;
	}

	const layer = await ensureLocationMarkerLayer(map);
	layer.clear(options.hasDestroy);
	stopMyPositionMarker();
	requestMapRender(map);
}

/**
 * 按 id 删除单个标记
 * @see http://mars3d.cn/api/GraphicLayer.html#getGraphicById
 * @see http://mars3d.cn/api/GraphicLayer.html#removeGraphic
 */
export async function removeLocationMarker(id, options = {}) {
	if (!id) {
		return false;
	}

	const map = options.map || mapInstance;
	if (!map) {
		return false;
	}

	const layer = await ensureLocationMarkerLayer(map);
	const graphic = layer.getGraphicById(id);
	if (!graphic) {
		return false;
	}

	if (id === MY_POSITION_MARKER_ID) {
		stopMyPositionMarker();
	}

	layer.removeGraphic(graphic, options.hasDestroy);
	return true;
}

/**
 * 根据业务 options 创建 mars3d.graphic.BillboardEntity 实例（不加入图层，由调用方 addGraphic）
 *
 * 内部顺序：BillboardEntity 构造 → unbindContextMenu → bindGraphicPopup（若配置了 popup）
 * @see http://mars3d.cn/api/BillboardEntity.html
 */
function createLocationMarkerGraphic(options = {}) {
	const mars3d = getMars3d();
	const graphic = new mars3d.graphic.BillboardEntity({
		id: options.id,
		name: options.name,
		position: getMarkerPosition(options),
		attr: cloneValue(options.attr || {}),
		style: getMarkerStyle(options)
	});

	disableGraphicContextMenu(graphic);
	bindGraphicPopup(graphic, options);
	return graphic;
}

/**
 * 批量添加定位标记（风险预警等列表打点场景）
 *
 * @param {object} options
 * @param {import('mars3d').Map} [options.map]
 * @param {Array<object>} options.markers  每项字段同 locateMarker（见上文「marker 单项常用字段」）
 * @param {boolean} [options.clear=true]   添加前清空图层
 * @param {boolean} [options.flyToFirst]     true 时飞向第一个标记
 * @param {import('mars3d').graphic.BaseGraphic} [options.flyToGraphic] 指定飞向某一个 graphic
 * @param {object} [options.flyToOptions]    合并进 DEFAULT_LOCATION_FLY_TO_OPTIONS
 * @returns {Promise<Array>} 创建的 graphic 数组
 *
 * @example
 * // 配合方式 B：popup: false + setLocationMarkerClickHandler
 * await addLocationMarkers({
 *   map,
 *   markers: list.map(row => ({
 *     id: `risk_${row.id}`,
 *     lng: row.lng, lat: row.lat,
 *     type: 'warning',
 *     popup: false,
 *     attr: { id: row.id, towerNo: row.towerNo, lng: row.lng, lat: row.lat },
 *     flyTo: false,
 *     clear: false
 *   })),
 *   clear: true
 * });
 *
 * @see http://mars3d.cn/api/GraphicLayer.html#addGraphic
 * @see http://mars3d.cn/api/Map.html#flyToGraphic
 */
export async function addLocationMarkers(options = {}) {
	const map = options.map || mapInstance;
	if (!map) {
		throw new Error('Map instance is not ready.');
	}

	const markerList = options.markers || [];
	const layer = await ensureLocationMarkerLayer(map);

	if (options.clear !== false) {
		layer.clear(true);
	}

	if (!markerList.length) {
		return [];
	}

	const graphics = markerList.map((item) => createLocationMarkerGraphic(item));
	layer.addGraphic(graphics);
	requestMapRender(map);

	const flyTarget = options.flyToGraphic || (options.flyToFirst ? graphics[0] : null);
	if (flyTarget) {
		await map.flyToGraphic(
			flyTarget,
			mergeMapOptions(DEFAULT_LOCATION_FLY_TO_OPTIONS, options.flyToOptions || {})
		);
	}

	return graphics;
}

/**
 * 添加或更新「单个」定位标记（搜索定位、高亮某一杆塔等）
 *
 * 与 addLocationMarkers 区别：默认 flyTo: true（会飞向该点），且支持同 id 覆盖更新。
 *
 * @param {object} options
 * @param {import('mars3d').Map} [options.map]
 * @param {number} options.lng  经度（与 lat 成对，或用 position 数组）
 * @param {number} options.lat  纬度
 * @param {number} [options.alt]  高度，可选
 * @param {Array<number>} [options.position]  [lng, lat] 或 [lng, lat, alt]，优先于 lng/lat
 * @param {string} [options.id]   有 id 时先 removeGraphic 再添加，实现「同一 id 只保留一个点」
 * @param {string} [options.name]
 * @param {string} [options.type] 'default' | 'base' | 'warning' | 'risk'
 * @param {string} [options.icon] 自定义图片 URL，覆盖 type 默认图标
 * @param {object} [options.attr]  业务数据；方式 B 点击时通过 payload.attr 取回
 * @param {object} [options.style] BillboardEntity 样式片段
 * @param {boolean} [options.clear=true]  添加前是否 layer.clear(true)
 * @param {boolean} [options.flyTo=true]  false 则不调用 map.flyToGraphic
 * @param {object} [options.flyToOptions]  radius、duration 等
 * @param {boolean} [options.openPopup]   true 且已 bindPopup 时调用 graphic.openPopup()
 * @param {false|string|function} [options.popup]  方式 A 内容；false 关闭（配合方式 B）
 * @param {function} [options.popupRenderer]
 * @param {object} [options.popupOptions]
 * @returns {Promise<import('mars3d').graphic.BillboardEntity>}
 *
 * @example
 * // 方式 A：Mars3D 地图内气泡
 * await locateMarker({
 *   lng: 111.53, lat: 27.38,
 *   popup: (e) => `<b>${e.graphic.attr.towerNo}</b>`,
 *   openPopup: true
 * });
 *
 * @example
 * // 方式 B：只打点，弹框由 Vue 处理（须先 setLocationMarkerClickHandler）
 * await locateMarker({
 *   id: 'tower_301',
 *   lng: 111.53, lat: 27.38,
 *   type: 'warning',
 *   popup: false,
 *   attr: { id: 301, towerNo: '#301' }
 * });
 *
 * @see http://mars3d.cn/api/BillboardEntity.html
 * @see http://mars3d.cn/api/BaseGraphic.html#openPopup
 * @see src/views/risk-warning/index.vue
 */
export async function locateMarker(options = {}) {
	const map = options.map || mapInstance;
	if (!map) {
		throw new Error('Map instance is not ready.');
	}

	const layer = await ensureLocationMarkerLayer(map);

	if (options.clear !== false) {
		layer.clear(true);
	}

	if (options.id) {
		const existingGraphic = layer.getGraphicById(options.id);
		if (existingGraphic) {
			layer.removeGraphic(existingGraphic, true);
		}
	}

	const graphic = createLocationMarkerGraphic(options);
	layer.addGraphic(graphic);

	if (options.flyTo !== false) {
		await map.flyToGraphic(
			graphic,
			mergeMapOptions(DEFAULT_LOCATION_FLY_TO_OPTIONS, options.flyToOptions || {})
		);
	}

	if (options.openPopup) {
		graphic.openPopup();
	}

	return graphic;
}

function getGeolocationErrorMessage(error) {
	if (!error) {
		return '定位失败，请稍后重试';
	}

	switch (error.code) {
		case 1:
			return '定位失败，可能是您禁止了定位功能<br/>请重新打开，并允许定位请求';
		case 2:
			return '定位失败，位置信息不可用';
		case 3:
			return '定位超时，请稍后重试';
		default:
			return error.message || '定位失败，请稍后重试';
	}
}

/** 定位权限预提示文案（对齐原站 layero.confirm） */
export const GEOLOCATION_PERMISSION_TIP = '系统需要使用手机定位<br/>请在接下来的弹窗选择“允许”。';

/**
 * 查询浏览器定位权限状态
 * @returns {Promise<'granted' | 'prompt' | 'denied' | 'unknown'>}
 */
export async function queryGeolocationPermission() {
	if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
		return 'unknown';
	}

	try {
		const result = await navigator.permissions.query({ name: 'geolocation' });
		return result.state;
	} catch {
		return 'unknown';
	}
}

/**
 * 获取当前设备位置并飞向该点，同时在地图上标记「我的位置」
 * @param {object} [options]
 * @param {import('mars3d').Map} [options.map]
 * @param {object} [options.flyToOptions] 合并进默认 flyTo 参数
 * @returns {Promise<import('mars3d').graphic.DivGraphic>}
 */
export async function locateMyPosition(options = {}) {
	const map = options.map || mapInstance;
	if (!map) {
		throw new Error('Map instance is not ready.');
	}

	let lng = options.lng;
	let lat = options.lat;
	let alt = options.alt;

	if (lng == null || lat == null) {
		if (typeof navigator === 'undefined' || !navigator.geolocation) {
			throw new Error('当前浏览器不支持定位');
		}

		const position = await new Promise((resolve, reject) => {
			navigator.geolocation.getCurrentPosition(resolve, reject, {
				enableHighAccuracy: true,
				timeout: 15000,
				maximumAge: 0
			});
		});

		lng = position.coords.longitude;
		lat = position.coords.latitude;
		alt = typeof position.coords.altitude === 'number' ? position.coords.altitude : undefined;
	}

	const layer = await ensureLocationMarkerLayer(map);
	const graphic = await upsertMyPositionMarker({
		layer,
		map,
		lng,
		lat,
		alt: typeof alt === 'number' ? alt : undefined
	});

	if (options.flyTo !== false) {
		await map.flyToGraphic(
			graphic,
			mergeMapOptions(
				DEFAULT_LOCATION_FLY_TO_OPTIONS,
				{ radius: 800 },
				options.flyToOptions || {}
			)
		);
	}

	return graphic;
}

export { getGeolocationErrorMessage };

/**
 * 相机飞回 map-scene.js 配置的初始视角（工具栏「复位」）
 * @see http://mars3d.cn/api/Map.html#setCameraView
 */
export async function resetMapView(options = {}) {
	const map = options.map || mapInstance;
	if (!map) {
		return false;
	}

	stopMeasureDrawing();
	return map.setCameraView(getActiveInitialView(), {
		duration: options.duration ?? 1.2
	});
}

/** 侧栏放大（Map#zoomIn） */
export function zoomMapIn(options = {}) {
	const map = options.map || mapInstance;
	return map?.zoomIn?.(options.relativeAmount, options.mandatory) ?? false;
}

/** 侧栏缩小（Map#zoomOut） */
export function zoomMapOut(options = {}) {
	const map = options.map || mapInstance;
	return map?.zoomOut?.(options.relativeAmount, options.mandatory) ?? false;
}

/**
 * 路由切换：更新复位视角、清理量算/标记、切回初始相机
 * @see http://mars3d.cn/api/Map.html#setCameraView
 */
export async function applyRouteCamera(routeName, options = {}) {
	const map = options.map || mapInstance;

	setActiveRoute(routeName, options.initialView);

	if (!map) {
		return false;
	}

	if (options.clearMeasure) {
		clearMeasure();
	} else {
		stopMeasureDrawing();
	}

	if (options.clearMarkers !== false) {
		await clearLocationMarkers({ map });
	}

	const result = await map.setCameraView(getActiveInitialView(), {
		duration: options.duration ?? 0
	});

	scheduleMapViewportRefresh(map, options.duration ? 200 : 0);

	return result;
}

function cleanupMapAttachments(map) {
	if (!map) {
		return;
	}

	if (map === mapInstance) {
		unbindMapInteractionPerformance();
	}

	clearMeasure();
	clearProvinceMaskLayer(map);

	if (measureInstance) {
		measureInstance.destroy();
		measureInstance = null;
	}

	if (sectionMeasureInstance) {
		sectionMeasureInstance.destroy();
		sectionMeasureInstance = null;
	}

	notifyMeasureToolbarState();

	if (map === mapInstance && locationMarkerLayer) {
		map.removeLayer(locationMarkerLayer, true);
	} else if (locationMarkerLayer?.destroy) {
		locationMarkerLayer.destroy();
	}

	locationMarkerLayer = null;
	locationMarkerClickHandler = null;
	stopMyPositionMarker();
	destroyCompassControl(map);
}

function resetMapModuleState() {
	mapInstance = null;
	mapCameraLockDepth = 0;
	savedCameraControllerState = null;
	compassControl = null;
	mapRenderPaused = false;
	currentRouteName = '';
	currentInitialView = cloneValue(getMapSceneCenter());
	resetMapViewportCache();
}

/**
 * 销毁 Mars3D Map 实例并释放 WebGL 上下文（布局卸载 / 实例替换时调用）
 * @param {import('mars3d').Map | null} [map] 默认当前模块单例
 * @see http://mars3d.cn/api/Map.html#destroy
 */
export function destroyMapInstance(map = mapInstance) {
	if (!map) {
		return;
	}

	const isModuleSingleton = map === mapInstance;

	if (map.isDestroy) {
		if (isModuleSingleton) {
			resetMapModuleState();
		}
		return;
	}

	cleanupMapAttachments(map);

	try {
		map.destroy();
	} catch (error) {
		console.warn('Failed to destroy mars3d map instance.', error);
	}

	if (isModuleSingleton) {
		resetMapModuleState();
	}
}

/**
 * 销毁量算 Thing、定位图层、指南针，并清空模块单例（布局卸载时调用）
 * @see http://mars3d.cn/api/Measure.html#destroy
 * @see http://mars3d.cn/api/Map.html#removeLayer
 * @see http://mars3d.cn/api/Map.html#removeControl
 */
export function destroyMapTools() {
	destroyMapInstance();
}

/**
 * 判断已有 Map 是否仍挂载在当前 host 上，可用于跨组件复用
 * @param {import('mars3d').Map | null | undefined} map
 * @param {HTMLElement | null | undefined} host
 */
export function canReuseMapInstance(map, host) {
	if (!map || map.isDestroy || !host) {
		return false;
	}

	const container = map.container;
	return container === host || host.contains(container);
}

// ---------------------------------------------------------------------------
// 导航球：mars3d.control.Compass
// ---------------------------------------------------------------------------

/**
 * 指定指南针 DOM 父容器（须在 map.container 之上的浮层，如 ScreenLayout.mapControlHost）
 * @param {HTMLElement | null} container
 */
export function setCompassParentContainer(container) {
	const next = container || null;
	if (compassParentContainer === next) {
		return;
	}

	compassParentContainer = next;
	if (compassControl && mapInstance) {
		destroyCompassControl(mapInstance);
	}
}

function buildCompassOptions() {
	const options = cloneValue(DEFAULT_COMPASS_OPTIONS);
	if (compassParentContainer) {
		options.parentContainer = compassParentContainer;
	}
	return options;
}

/**
 * 从 Map 上解析已添加的 Compass 控件
 * @see http://mars3d.cn/api/Map.html#getControl
 * @see http://mars3d.cn/api/Map.html#hasControl
 */
function resolveCompassControl(map = mapInstance) {
	if (!map) {
		return null;
	}

	if (compassControl && map.hasControl?.(compassControl)) {
		return compassControl;
	}

	const existing = map.getControl?.(COMPASS_CONTROL_ID, 'id');
	if (existing) {
		compassControl = existing;
		return compassControl;
	}

	return null;
}

/**
 * 在 Map 就绪后挂载/显示指南针（map-ready 时 scene 可能尚未稳定）
 * @see http://mars3d.cn/api/Compass.html
 * @see http://mars3d.cn/api/Map.html#addControl
 */
function applyCompassVisible(map) {
	const mars3d = getMars3d();
	let control = resolveCompassControl(map);

	if (!control) {
		control = new mars3d.control.Compass(buildCompassOptions());
		map.addControl(control);
		compassControl = control;
	}

	control.show = true;
	control.enabled = true;
}

/**
 * 显示三维导航球（若 Map 仍在 loading，会等 readyPromise 后再挂载）
 * @see http://mars3d.cn/api/Map.html#readyPromise
 */
export function showCompass(map = mapInstance) {
	if (!map) {
		return;
	}

	const reveal = () => applyCompassVisible(map);

	if (map.readyPromise?.then) {
		map.readyPromise.then(reveal).catch(reveal);
		return;
	}

	reveal();
}

/** 隐藏导航球（不 remove，仅 show/enabled=false） */
export function hideCompass(map = mapInstance) {
	if (!map) {
		return;
	}

	const control = resolveCompassControl(map);
	if (!control) {
		return;
	}

	control.show = false;
	control.enabled = false;
}

/**
 * 从 Map 移除 Compass 控件
 * @see http://mars3d.cn/api/Map.html#removeControl
 */
function destroyCompassControl(map = mapInstance) {
	const control = resolveCompassControl(map);
	if (!control) {
		compassControl = null;
		return;
	}

	map?.removeControl?.(control, true);
	compassControl = null;
}

/**
 * 切换二维场景（隐藏指南针 + 场景 morph）
 * map.scene 为 Cesium.Scene，morphTo2D 为 Cesium 原生 API
 * @see https://cesium.com/learn/cesiumjs/ref-doc/Scene.html#morphTo2D
 */
export function to2d(map = mapInstance) {
	if (!map?.scene) {
		console.warn('Map instance or scene not ready');
		return;
	}

	hideCompass(map);
	map.scene.morphTo2D(0);
}

/**
 * 切换三维场景并显示指南针
 * @see https://cesium.com/learn/cesiumjs/ref-doc/Scene.html#morphTo3D
 */
export function to3d(map = mapInstance) {
	if (!map?.scene) {
		console.warn('Map instance or scene not ready');
		return;
	}

	const cesium = getCesium();
	const scene = map.scene;
	const mars3d = getMars3d();
	const isMorphing = cesium && scene.mode === cesium.SceneMode.MORPHING;
	const is3D =
		!cesium ||
		scene.mode === cesium.SceneMode.SCENE3D ||
		scene.mode === cesium.SceneMode.COLUMBUS_VIEW;

	// 默认已是三维时 morphTo3D 无效果，但仍需单独 showCompass
	if (is3D && !isMorphing) {
		showCompass(map);
		return;
	}

	const onMorphComplete = () => {
		map.off?.(mars3d.EventType.morphComplete, onMorphComplete);
		showCompass(map);
	};

	map.on(mars3d.EventType.morphComplete, onMorphComplete);
	scene.morphTo3D(0);
}

// ---------------------------------------------------------------------------
// 按需渲染 & 视口 resize
// ---------------------------------------------------------------------------

/** 在 requestRenderMode 下显式请求一帧，无 map 时静默跳过 */
export function requestMapRender(map = mapInstance) {
	map?.viewer?.scene?.requestRender?.();
}

let resizeTimer = null;
let lastSizeKey = '';

/** 防抖刷新 Cesium 视口尺寸 */
export function scheduleMapViewportRefresh(map, delay = 120) {
	if (!map?.viewer) {
		return;
	}

	clearTimeout(resizeTimer);
	resizeTimer = setTimeout(() => {
		const container = map.container || map.viewer?.container;
		const width = Math.round(container?.clientWidth || 0);
		const height = Math.round(container?.clientHeight || 0);

		if (width < 2 || height < 2) {
			return;
		}

		const sizeKey = `${width}x${height}`;
		if (sizeKey === lastSizeKey) {
			map.viewer.scene?.requestRender?.();
			return;
		}

		lastSizeKey = sizeKey;
		map.viewer.resize();
		map.viewer.scene?.requestRender?.();
	}, delay);
}

export function resetMapViewportCache() {
	lastSizeKey = '';
	clearTimeout(resizeTimer);
	resizeTimer = null;
}
