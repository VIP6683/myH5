/**
 * Mars2D 业务封装（供 mapApi 统一引用）
 */

import baseMarkerIcon from '../../assets/images/lace-blue.png';
import warningMarkerIcon from '../../assets/images/lace-red.png';
import { LOCATION_MARKER_LAYER_ID, MY_POSITION_MARKER_ID } from '../../constants.js';
import { installMars2d } from '../bootstrap/install.js';
import { createDefaultMapOptions as buildDefaultMapOptions } from '../config/buildMapOptions.js';
import {
	applyMapSceneRuntime,
	bindMapInteractionPerformance,
	getMapSceneOptions,
	unbindMapInteractionPerformance
} from '../config/mapSceneConfig.js';
import { MapEventType, emitMapEvent } from '../../core/mapEvents.js';
import { getMapTokens } from '../../config/runtimeConfig.js';
import { stopMyPositionMarker, upsertMyPositionMarker } from './myPositionMarker.js';
import { addProvinceMaskLayer, clearProvinceMaskLayer } from './provinceMaskLayer.js';
import { clearMosaicWmtsLayer, ensureMosaicWmtsLayer } from './mosaicWmtsLayer.js';

installMars2d();

const DEFAULT_DISTANCE_MEASURE_OPTIONS = {
	// 移动端没有右键，改为通过工具栏“确定”结束绘制，不展示右击提示文案
	showAddText: false,
	unit: 'auto',
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
	// 面积量算同样隐藏“右击/双击结束”提示，统一使用按钮完成
	showAddText: false,
	unit: 'auto'
};
const DEFAULT_LOCATION_MARKER_TYPE = 'default';
const LOCATION_MARKER_ICON_MAP = {
	default: baseMarkerIcon,
	base: baseMarkerIcon,
	warning: warningMarkerIcon,
	risk: warningMarkerIcon
};
const DEFAULT_LOCATION_FLY_TO_OPTIONS = { scale: 1.2, duration: 1.2, animate: true };
const LOCATION_MARKER_LAYER_EVENT_BOUND_KEY = '__mars2dLocationLayerBound__';
const MEASURE_TOOLBAR_STATE_BOUND_KEY = '__mars2dMeasureToolbarBound__';
const MEASURE_MAP_DRAW_TRACKED_KEY = '__mars2dMeasureDrawTracked__';
const POINT_MEASURE_MARKER_ID = '__mars2d_point_measure_marker__';

const measureToolbarStateListeners = new Set();

let mapInstance = null;
let measureInstance = null;
let measureHasUserDrawn = false;
let measureIgnoreDrawEvents = false;
let lastMeasureGraphic = null;
let pointMeasureClickUnbind = null;
let pointMeasureResolve = null;
let pointMeasureGraphic = null;
let pointMeasurePopupCloseUnbind = null;
let pointMeasureModeActive = false;
let locationMarkerLayer = null;
let locationMarkerClickHandler = null;
let mapRenderPaused = false;
let mapCameraLockDepth = 0;
let savedMapInteractionState = null;

function getMars2d() {
	return globalThis.mars2d;
}

function isPlainObject(value) {
	return Object.prototype.toString.call(value) === '[object Object]';
}

function cloneValue(value) {
	if (Array.isArray(value)) return value.map(cloneValue);
	if (isPlainObject(value)) {
		return Object.keys(value).reduce((result, key) => {
			result[key] = cloneValue(value[key]);
			return result;
		}, {});
	}
	return value;
}

function withFlyToZoomLimit(options = {}) {
	return mergeMapOptions({ maxZoom: getMapSceneOptions().maxZoom }, options);
}

export function mergeMapOptions(baseOptions = {}, extraOptions = {}) {
	const result = cloneValue(baseOptions);
	if (!isPlainObject(extraOptions)) return result;

	Object.keys(extraOptions).forEach((key) => {
		const baseValue = result[key];
		const extraValue = extraOptions[key];
		if (Array.isArray(extraValue)) {
			result[key] = cloneValue(extraValue);
		} else if (isPlainObject(baseValue) && isPlainObject(extraValue)) {
			result[key] = mergeMapOptions(baseValue, extraValue);
		} else if (isPlainObject(extraValue)) {
			result[key] = mergeMapOptions({}, extraValue);
		} else {
			result[key] = extraValue;
		}
	});
	return result;
}

function getMapContainer(map) {
	return map?.getContainer?.() || map?.container || null;
}

function enhanceMapInstance(map) {
	if (!map || map.__mars2dEnhanced__) return map;

	if (!map.readyPromise) {
		map.readyPromise = Promise.resolve(map);
	}

	if (map.isDestroy === undefined) {
		map.isDestroy = false;
	}

	map.__mars2dEnhanced__ = true;
	return map;
}

function formatNumber(value, digits = 6) {
	const num = Number(value);
	return Number.isFinite(num) ? num.toFixed(digits) : '--';
}

function buildMeasurePointPopup(point) {
	const lng = Number(point?.lng);
	const lat = Number(point?.lat);
	const normalized = {
		lng: Number.isFinite(lng) ? lng : 0,
		lat: Number.isFinite(lat) ? lat : 0
	};

	return `<div class="measure-point-popup-card">
      <div class="measure-point-popup-card__title">位置信息</div>
      <div class="measure-point-popup-card__line">经度：${formatNumber(normalized.lng)}</div>
      <div class="measure-point-popup-card__line">纬度：${formatNumber(normalized.lat)}</div>
    </div>`;
}

function getMarkerTypeIcon(type) {
	return LOCATION_MARKER_ICON_MAP[type] || LOCATION_MARKER_ICON_MAP[DEFAULT_LOCATION_MARKER_TYPE];
}

function getMarkerPosition(options = {}) {
	if (Array.isArray(options.position)) return options.position;
	if (typeof options.lng !== 'number' || typeof options.lat !== 'number') {
		throw new Error('locateMarker requires numeric lng and lat.');
	}
	return [options.lng, options.lat];
}

function getMarkerStyle(options = {}) {
	const image = options.icon || getMarkerTypeIcon(options.type);
	return mergeMapOptions({ image, width: 32, height: 32 }, options.style || {});
}

function bindGraphicPopup(graphic, options = {}) {
	if (!graphic || options.popup === false) return;
	if (options.popup || options.popupRenderer) {
		graphic.bindPopup(options.popup || options.popupRenderer, options.popupOptions || {});
	}
}

/** Mars2D 自带聚合图层，使用 SDK 默认样式与下钻交互 */
function createLocationClusterLayer() {
	const mars2d = getMars2d();
	return new mars2d.layer.ClusterLayer({
		id: LOCATION_MARKER_LAYER_ID,
		name: 'Location Marker Layer',
		zoomToBoundsOnClick: true,
		spiderfyOnMaxZoom: true,
		showCoverageOnHover: false
	});
}

function bindLocationMarkerLayerEvent(layer, map = mapInstance) {
	if (!layer || layer[LOCATION_MARKER_LAYER_EVENT_BOUND_KEY]) return;

	const mars2d = getMars2d();
	layer.on(mars2d.EventType.click, (event) => {
		const graphic = event?.graphic;
		if (!graphic || graphic.cluster) return;

		const attr = graphic.attr || {};
		const payload = { kind: 'marker', graphic, event, attr };
		emitMapEvent(MapEventType.FEATURE_CLICK, payload);
		locationMarkerClickHandler?.(payload);
	});

	layer[LOCATION_MARKER_LAYER_EVENT_BOUND_KEY] = true;
}

async function ensureLocationMarkerLayer(map = mapInstance) {
	if (!map) throw new Error('Map instance is not ready.');

	const existingLayer = map.getLayerById?.(LOCATION_MARKER_LAYER_ID);
	if (existingLayer) {
		locationMarkerLayer = existingLayer;
		bindLocationMarkerLayerEvent(locationMarkerLayer, map);
		return locationMarkerLayer;
	}

	if (locationMarkerLayer) {
		bindLocationMarkerLayerEvent(locationMarkerLayer, map);
		return locationMarkerLayer;
	}

	locationMarkerLayer = createLocationClusterLayer();
	bindLocationMarkerLayerEvent(locationMarkerLayer, map);
	await map.addLayer(locationMarkerLayer);
	return locationMarkerLayer;
}

function createLocationMarkerGraphic(options = {}) {
	const mars2d = getMars2d();
	const graphic = new mars2d.graphic.Marker({
		id: options.id,
		name: options.name,
		latlng: getMarkerPosition(options),
		attr: cloneValue(options.attr || {}),
		style: getMarkerStyle(options)
	});
	graphic.unbindContextMenu?.();
	bindGraphicPopup(graphic, options);
	return graphic;
}

function ensureMeasure(map = mapInstance) {
	if (!map) throw new Error('Map instance is not ready.');
	if (!measureInstance) {
		const mars2d = getMars2d();
		measureInstance = new mars2d.thing.Measure({
			label: cloneValue(DEFAULT_DISTANCE_MEASURE_OPTIONS.label),
			isAutoEditing: true,
			isContinued: false
		});
		map.addThing(measureInstance);
		bindMeasureToolbarStateEvents(measureInstance);
	}
	bindMeasureMapDrawTracking(map);
	return measureInstance;
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
	if (measureIgnoreDrawEvents) return;
	if (!measureHasUserDrawn) {
		measureHasUserDrawn = true;
		notifyMeasureToolbarState();
	}
}

function resolveLastMeasureGraphic() {
	const layer = measureInstance?.graphicLayer;
	const layerGraphic =
		layer?.getGraphics?.()?.at?.(-1) || layer?.graphics?.at?.(-1) || layer?._graphics?.at?.(-1) || null;
	return lastMeasureGraphic || layerGraphic;
}

function forceStartMeasureEditing() {
	if (!measureInstance) return false;
	if (measureInstance.isEditing) return true;
	const layer = measureInstance.graphicLayer;
	const graphic = resolveLastMeasureGraphic();
	if (!graphic) return false;

	const runners = [
		() => layer?.startEditing?.(graphic),
		() => graphic?.startEditing?.(),
		() => measureInstance?.startEditing?.(graphic)
	];
	for (const runner of runners) {
		try {
			runner();
		} catch (error) {
			console.warn('[map] start measure editing failed', error);
		}
		if (measureInstance.isEditing || graphic.isEditing) {
			notifyMeasureToolbarState();
			return true;
		}
	}
	return false;
}

function stopPointMeasurePicking(result = null) {
	if (pointMeasureClickUnbind) {
		pointMeasureClickUnbind();
		pointMeasureClickUnbind = null;
	}
	if (result == null && !pointMeasureGraphic) {
		pointMeasureModeActive = false;
	}
	if (pointMeasureResolve) {
		const resolve = pointMeasureResolve;
		pointMeasureResolve = null;
		resolve(result);
	}
}

function removePointMeasureGraphic() {
	if (pointMeasurePopupCloseUnbind) {
		pointMeasurePopupCloseUnbind();
		pointMeasurePopupCloseUnbind = null;
	}
	if (!pointMeasureGraphic) {
		return;
	}
	pointMeasureGraphic.remove?.();
	pointMeasureGraphic.removeFrom?.(mapInstance);
	pointMeasureGraphic = null;
	pointMeasureModeActive = false;
}

function upsertPointMeasureGraphic(map, lngLat) {
	removePointMeasureGraphic();
	const leaflet = globalThis.L;
	if (leaflet?.circleMarker) {
		const marker = leaflet.circleMarker([lngLat.lat, lngLat.lng], {
			radius: 6,
			color: '#ff2d2d',
			weight: 2,
			opacity: 1,
			fillColor: '#ff2d2d',
			fillOpacity: 0.95
		});
		marker.addTo(map);
		pointMeasureGraphic = marker;
		return marker;
	}

	const mars2d = getMars2d();
	const marker = new mars2d.graphic.Marker({
		id: POINT_MEASURE_MARKER_ID,
		latlng: { lat: lngLat.lat, lng: lngLat.lng },
		style: getMarkerStyle({ type: 'default' })
	});
	marker.addTo?.(map);
	pointMeasureGraphic = marker;
	return marker;
}

function getClickEventLngLat(event) {
	const point = event?.latlng || event?.lnglat || event?.latLng || event?.point || event;
	const lng = Number(
		point?.lng ??
			point?.lon ??
			point?.longitude ??
			(Array.isArray(point) ? point[0] : Number.NaN)
	);
	const lat = Number(point?.lat ?? point?.latitude ?? (Array.isArray(point) ? point[1] : Number.NaN));
	if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
		return null;
	}
	return { lng, lat };
}

function isMeasureInstanceClearable(measure) {
	if (!measure || measure.isDrawing) return false;
	return !!(measure.hasMeasure || measure.isEditing);
}

function shouldShowMeasureActions(measure) {
	if (!measure) return false;
	if (measure.isEditing) return true;
	if (measure.isDrawing) return measureHasUserDrawn;
	return !!(measure.hasMeasure && measureHasUserDrawn);
}

function notifyMeasureToolbarState() {
	const clearable = getMeasureClearable();
	const state = getMeasureState();
	measureToolbarStateListeners.forEach((listener) => listener(clearable, state));
}

function bindMeasureMapDrawTracking(map) {
	if (!map || map[MEASURE_MAP_DRAW_TRACKED_KEY]) return;
	map[MEASURE_MAP_DRAW_TRACKED_KEY] = true;
	const mars2d = getMars2d();
	map.on(mars2d.EventType.click, () => {
		if (measureInstance?.isDrawing) markMeasureUserDrawn();
	});
}

function bindMeasureToolbarStateEvents(measure) {
	if (!measure || measure[MEASURE_TOOLBAR_STATE_BOUND_KEY]) return;
	measure[MEASURE_TOOLBAR_STATE_BOUND_KEY] = true;
	const mars2d = getMars2d();
	const eventTypes = [
		mars2d.EventType.drawStart,
		mars2d.EventType.drawAddPoint,
		mars2d.EventType.drawCreated,
		mars2d.EventType.editStart,
		mars2d.EventType.editStop
	];
	eventTypes.forEach((eventType) => measure.on(eventType, notifyMeasureToolbarState));
	measure.on(mars2d.EventType.drawCreated, (event) => {
		lastMeasureGraphic = event?.graphic || event?.target || lastMeasureGraphic;
	});
}

const MAP_INTERACTION_KEYS = ['dragging', 'touchZoom', 'doubleClickZoom', 'scrollWheelZoom', 'boxZoom', 'keyboard'];

function saveMapInteractionState(map) {
	const state = {};
	for (const key of MAP_INTERACTION_KEYS) {
		const handler = map?.[key];
		if (handler?.enabled) state[key] = handler.enabled();
	}
	return state;
}

function applyMapInteractionState(map, state, enabled) {
	for (const key of MAP_INTERACTION_KEYS) {
		const handler = map[key];
		if (!handler) continue;
		handler[enabled ? 'enable' : 'disable']?.();
	}
}

export function initMapTokens() {
	const mars2d = getMars2d();
	if (!mars2d?.Token) return;
	const { tianditu, gaode } = getMapTokens();
	if (tianditu?.length) mars2d.Token.updateTianditu(tianditu.length === 1 ? tianditu[0] : tianditu);
	if (gaode?.length) mars2d.Token.updateGaode(gaode.length === 1 ? gaode[0] : gaode);
}

export function getDefaultMapOptions() {
	initMapTokens();
	return cloneValue(buildDefaultMapOptions());
}

export function disableMapContextMenu(map = mapInstance) {
	map?.unbindContextMenu?.();
}

export function setMapInstance(map) {
	if (mapInstance && map !== mapInstance) destroyMapInstance(mapInstance);
	mapInstance = map ? enhanceMapInstance(map) : null;
	locationMarkerLayer = null;
	if (!mapInstance) {
		unbindMapInteractionPerformance();
		return;
	}
	disableMapContextMenu(mapInstance);
	addProvinceMaskLayer(mapInstance);
	ensureMosaicWmtsLayer(mapInstance);
	applyMapSceneRuntime(mapInstance);
	bindMapInteractionPerformance(mapInstance);
}

export function getMapInstance() {
	return mapInstance;
}

export function lockMapCameraInteraction(map = mapInstance) {
	if (!map) return;
	if (mapCameraLockDepth === 0) {
		savedMapInteractionState = saveMapInteractionState(map);
		applyMapInteractionState(map, savedMapInteractionState, false);
		const container = getMapContainer(map);
		if (container) {
			container.style.pointerEvents = 'none';
			container.style.touchAction = 'none';
		}
	}
	mapCameraLockDepth += 1;
}

export function unlockMapCameraInteraction(map = mapInstance) {
	if (!map || mapCameraLockDepth <= 0) return;
	mapCameraLockDepth -= 1;
	if (mapCameraLockDepth === 0 && savedMapInteractionState) {
		applyMapInteractionState(map, savedMapInteractionState, true);
		const container = getMapContainer(map);
		if (container) {
			container.style.pointerEvents = '';
			container.style.touchAction = '';
		}
		savedMapInteractionState = null;
	}
}

export function isMapRenderPaused() {
	return mapRenderPaused;
}

export function pauseMapRender(map = mapInstance) {
	if (!map || mapRenderPaused) return false;
	const container = getMapContainer(map);
	if (container) {
		container.style.pointerEvents = 'none';
		container.style.visibility = 'hidden';
	}
	mapRenderPaused = true;
	return true;
}

export function resumeMapRender(map = mapInstance) {
	if (!map) return false;
	const container = getMapContainer(map);
	if (container) {
		container.style.pointerEvents = '';
		container.style.visibility = '';
	}
	resetMapViewportCache();
	applyMapSceneRuntime(map);
	scheduleMapViewportRefresh(map, 0);
	const wasPaused = mapRenderPaused;
	mapRenderPaused = false;
	return wasPaused;
}

export function getMeasureClearable() {
	return isMeasureInstanceClearable(measureInstance);
}

export function getMeasureState() {
	const measure = measureInstance;
	if (!measure) {
		const isPointPicking = !!pointMeasureClickUnbind;
		const hasPointMeasure = !!pointMeasureGraphic;
		return {
			isDrawing: isPointPicking || hasPointMeasure || pointMeasureModeActive,
			isEditing: false,
			hasMeasure: hasPointMeasure || pointMeasureModeActive,
			hasPointMeasure,
			clearable: hasPointMeasure,
			showActions: isPointPicking
		};
	}
	const hasPointMeasure = !!pointMeasureGraphic;
	return {
		isDrawing: !!measure.isDrawing || !!pointMeasureClickUnbind || hasPointMeasure || pointMeasureModeActive,
		isEditing: !!measure.isEditing,
		hasMeasure: !!measure.hasMeasure || hasPointMeasure || pointMeasureModeActive,
		hasPointMeasure,
		clearable: isMeasureInstanceClearable(measure),
		showActions: shouldShowMeasureActions(measure)
	};
}

export function onMeasureToolbarStateChange(listener) {
	if (typeof listener !== 'function') return () => {};
	measureToolbarStateListeners.add(listener);
	listener(getMeasureClearable());
	return () => measureToolbarStateListeners.delete(listener);
}

export function stopMeasureDrawing() {
	const hadPointPicking = !!pointMeasureClickUnbind;
	stopPointMeasurePicking(null);
	if (!measureInstance?.isDrawing) {
		if (hadPointPicking) notifyMeasureToolbarState();
		return hadPointPicking;
	}
	const stopped = measureInstance.stopDraw();
	notifyMeasureToolbarState();
	return stopped;
}

export function endMeasureDrawing() {
	if (!measureInstance?.isDrawing) return false;
	const ended = measureInstance.endDraw();
	notifyMeasureToolbarState();
	return ended;
}

export function stopMeasureEditing() {
	if (!measureInstance?.isEditing || !measureInstance.graphicLayer?.stopEditing) return false;
	measureInstance.graphicLayer.stopEditing();
	notifyMeasureToolbarState();
	return true;
}

export function confirmMeasureDrawing() {
	if (!measureInstance) return false;
	if (measureInstance.isDrawing) {
		const ended = endMeasureDrawing();
		// 结束绘制后主动进入编辑态，确保“确定”后可拖动调整线/面。
		return forceStartMeasureEditing() || ended;
	}
	// "确定" 语义应为完成绘制并保持可编辑，不应在编辑态时反向退出编辑。
	if (measureInstance.isEditing) return true;
	return forceStartMeasureEditing() || !!measureInstance.hasMeasure;
}

export function clearMeasure() {
	stopPointMeasurePicking(null);
	removePointMeasureGraphic();
	if (measureInstance) {
		if (measureInstance.isDrawing) measureInstance.stopDraw();
		measureInstance.clear();
	}
	lastMeasureGraphic = null;
	resetMeasureUserDrawn();
	notifyMeasureToolbarState();
}

export async function startDistanceMeasure(options = {}) {
	const measure = ensureMeasure(options.map || mapInstance);
	if (options.clear !== false) measure.clear();
	if (measure.isDrawing) measure.stopDraw();
	beginMeasureDrawingSession();
	try {
		return await measure.distance(mergeMapOptions(DEFAULT_DISTANCE_MEASURE_OPTIONS, options.distanceOptions || {}));
	} finally {
		notifyMeasureToolbarState();
	}
}

export async function startAreaMeasure(options = {}) {
	const measure = ensureMeasure(options.map || mapInstance);
	if (options.clear !== false) measure.clear();
	if (measure.isDrawing) measure.stopDraw();
	beginMeasureDrawingSession();
	try {
		return await measure.area(mergeMapOptions(DEFAULT_AREA_MEASURE_OPTIONS, options.areaOptions || {}));
	} finally {
		notifyMeasureToolbarState();
	}
}

export async function startPointMeasure(options = {}) {
	const map = options.map || mapInstance;
	if (!map) throw new Error('Map instance is not ready.');
	if (options.clear !== false) {
		measureInstance?.clear?.();
		removePointMeasureGraphic();
	}
	if (measureInstance?.isDrawing) measureInstance.stopDraw();
	stopPointMeasurePicking(null);
	pointMeasureModeActive = true;
	beginMeasureDrawingSession();
	notifyMeasureToolbarState();

	const mars2d = getMars2d();
	return await new Promise((resolve) => {
		pointMeasureResolve = resolve;
		const handleClick = async (event) => {
			const lngLat = getClickEventLngLat(event);
			if (!lngLat) return;
			markMeasureUserDrawn();
			try {
				const popupHtml = buildMeasurePointPopup(lngLat);
				const graphic = upsertPointMeasureGraphic(map, lngLat);
				graphic.bindPopup?.(popupHtml, {
					className: 'measure-point-popup',
					closeOnClick: false,
					autoClose: false
				});
				if (graphic.openPopup) {
					graphic.openPopup();
				} else {
					map.openPopup?.(popupHtml, { lat: lngLat.lat, lng: lngLat.lng }, {
						closeOnClick: false,
						autoClose: false
					});
				}
				const onPopupClose = () => {
					removePointMeasureGraphic();
					resetMeasureUserDrawn();
					notifyMeasureToolbarState();
				};
				graphic.on?.('popupclose', onPopupClose);
				pointMeasurePopupCloseUnbind = () => {
					graphic.off?.('popupclose', onPopupClose);
				};
				stopPointMeasurePicking(graphic);
			} catch (error) {
				console.error('[mars2d] point measure failed', error);
				stopPointMeasurePicking(null);
			} finally {
				notifyMeasureToolbarState();
			}
		};
		const eventName = mars2d?.EventType?.click || 'click';
		map.on(eventName, handleClick);
		pointMeasureClickUnbind = () => {
			map.off(eventName, handleClick);
		};
	});
}

export async function getLocationMarkerLayer(map = mapInstance) {
	return ensureLocationMarkerLayer(map);
}

export function setLocationMarkerClickHandler(handler) {
	locationMarkerClickHandler = typeof handler === 'function' ? handler : null;
}

export async function clearLocationMarkers(options = {}) {
	const map = options.map || mapInstance;
	if (!map) return;
	const layer = await ensureLocationMarkerLayer(map);
	layer.clear(options.hasDestroy);
	stopMyPositionMarker();
}

export async function removeLocationMarker(id, options = {}) {
	if (!id) return false;
	const map = options.map || mapInstance;
	if (!map) return false;
	const layer = await ensureLocationMarkerLayer(map);
	const graphic = layer.getGraphicById?.(id);
	if (!graphic) return false;
	if (id === MY_POSITION_MARKER_ID) stopMyPositionMarker();
	layer.removeGraphic(graphic, options.hasDestroy);
	return true;
}

export async function addLocationMarkers(options = {}) {
	const map = options.map || mapInstance;
	if (!map) throw new Error('Map instance is not ready.');
	const layer = await ensureLocationMarkerLayer(map);
	if (options.clear !== false) layer.clear(true);
	const graphics = (options.markers || []).map((item) => createLocationMarkerGraphic(item));
	if (graphics.length) layer.addGraphic(graphics);
	const flyTarget = options.flyToGraphic || (options.flyToFirst ? graphics[0] : null);
	if (flyTarget) {
		await map.flyToGraphic(
			flyTarget,
			withFlyToZoomLimit(mergeMapOptions(DEFAULT_LOCATION_FLY_TO_OPTIONS, options.flyToOptions || {}))
		);
	}
	return graphics;
}

export async function locateMarker(options = {}) {
	const map = options.map || mapInstance;
	if (!map) throw new Error('Map instance is not ready.');
	const layer = await ensureLocationMarkerLayer(map);
	if (options.clear !== false) layer.clear(true);
	if (options.id) {
		const existingGraphic = layer.getGraphicById?.(options.id);
		if (existingGraphic) layer.removeGraphic(existingGraphic, true);
	}
	const graphic = createLocationMarkerGraphic(options);
	layer.addGraphic(graphic);
	if (options.flyTo !== false) {
		await map.flyToGraphic(
			graphic,
			withFlyToZoomLimit(mergeMapOptions(DEFAULT_LOCATION_FLY_TO_OPTIONS, options.flyToOptions || {}))
		);
	}
	if (options.openPopup) graphic.openPopup();
	return graphic;
}

export const GEOLOCATION_PERMISSION_TIP =
	'系统需要使用手机定位<br/>请在接下来的弹窗选择“允许”。';

export async function queryGeolocationPermission() {
	if (!navigator?.permissions?.query) return 'unknown';
	try {
		const result = await navigator.permissions.query({ name: 'geolocation' });
		return result.state;
	} catch {
		return 'unknown';
	}
}

function getGeolocationErrorMessage(error) {
	if (!error) return '定位失败，请稍后重试';
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

export { getGeolocationErrorMessage };

export async function locateMyPosition(options = {}) {
	const map = options.map || mapInstance;
	if (!map) throw new Error('Map instance is not ready.');

	let { lng, lat, alt } = options;
	if (lng == null || lat == null) {
		if (!navigator?.geolocation) throw new Error('当前浏览器不支持定位');
		const position = await new Promise((resolve, reject) => {
			navigator.geolocation.getCurrentPosition(resolve, reject, {
				enableHighAccuracy: true,
				timeout: 15000,
				maximumAge: 0
			});
		});
		lng = position.coords.longitude;
		lat = position.coords.latitude;
		alt = position.coords.altitude;
	}

	const layer = await ensureLocationMarkerLayer(map);
	const graphic = await upsertMyPositionMarker({ layer, map, lng, lat, alt });
	if (options.flyTo !== false) {
		await map.flyToGraphic(
			graphic,
			withFlyToZoomLimit(
				mergeMapOptions(DEFAULT_LOCATION_FLY_TO_OPTIONS, { scale: 1.4 }, options.flyToOptions || {})
			)
		);
	}
	return graphic;
}

function cleanupMapAttachments(map) {
	if (!map) return;
	unbindMapInteractionPerformance();
	clearMeasure();
	removePointMeasureGraphic();
	clearProvinceMaskLayer(map);
	clearMosaicWmtsLayer(map);
	if (measureInstance) {
		measureInstance.destroy();
		measureInstance = null;
	}
	if (map === mapInstance && locationMarkerLayer) map.removeLayer(locationMarkerLayer, true);
	else locationMarkerLayer?.destroy?.();
	locationMarkerLayer = null;
	locationMarkerClickHandler = null;
	stopMyPositionMarker();
	notifyMeasureToolbarState();
}

export function destroyMapInstance(map = mapInstance) {
	if (!map) return;
	const isSingleton = map === mapInstance;
	if (map.isDestroy) {
		if (isSingleton) resetMapModuleState();
		return;
	}
	cleanupMapAttachments(map);
	try {
		map.destroy?.();
	} catch (error) {
		console.warn('Failed to destroy mars2d map instance.', error);
	}
	if (isSingleton) resetMapModuleState();
}

function resetMapModuleState() {
	mapInstance = null;
	mapCameraLockDepth = 0;
	savedMapInteractionState = null;
	mapRenderPaused = false;
	resetMapViewportCache();
}

export function destroyMapTools() {
	destroyMapInstance();
}

export function canReuseMapInstance(map, host) {
	if (!map || map.isDestroy || !host) return false;
	const container = getMapContainer(map);
	return container === host || host.contains(container);
}

export function requestMapRender(map = mapInstance) {
	map?.invalidateSize?.();
}

let resizeTimer = null;
let lastSizeKey = '';

export function scheduleMapViewportRefresh(map, delay = 120) {
	if (!map) return;
	clearTimeout(resizeTimer);
	resizeTimer = setTimeout(() => {
		const container = getMapContainer(map);
		const width = Math.round(container?.clientWidth || 0);
		const height = Math.round(container?.clientHeight || 0);
		if (width < 2 || height < 2) return;
		const sizeKey = `${width}x${height}`;
		if (sizeKey === lastSizeKey) return;
		lastSizeKey = sizeKey;
		map.invalidateSize?.();
	}, delay);
}

export function resetMapViewportCache() {
	lastSizeKey = '';
	clearTimeout(resizeTimer);
	resizeTimer = null;
}
