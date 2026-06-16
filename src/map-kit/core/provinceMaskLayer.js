/**
 * 湖南省边界图层（public/430000.json）
 *
 * 默认仅绘制省界描边（对齐老项目 MasterMap.drawBoundary：#13dbac、无填充）。
 * 反选遮罩性能开销大，可通过 ENABLE_PROVINCE_MASK 临时开启。
 * 首屏：waitProvinceMaskReady 供 MarsMap 在边界图层就绪后再结束 loading。
 */

import { HUNAN_BOUNDARY_GEOJSON_URL, PROVINCE_MASK_LAYER_ID } from '../constants.js';
import { getMapInstance } from './mars3d.js';

/** 与老项目 Leaflet 省界 polygon 一致 */
const HUNAN_OUTLINE_COLOR = '#13dbac';

/** true：省界外反选遮罩；false：仅省界边框 */
export const ENABLE_PROVINCE_MASK = false;

/** false：不绘制省界绿色描边 */
export const ENABLE_PROVINCE_BOUNDARY = false;

let provinceMaskLayer = null;
let maskLayerReady = false;
let maskReadyResolve = null;
let maskReadyPromise = null;

function resetMaskReadyPromise() {
	maskLayerReady = false;
	maskReadyPromise = new Promise((resolve) => {
		maskReadyResolve = resolve;
	});
}

resetMaskReadyPromise();

function resolveMaskReady(layer) {
	maskLayerReady = true;
	if (maskReadyResolve) {
		maskReadyResolve(layer);
		maskReadyResolve = null;
	}
}

function buildProvinceBoundarySymbol() {
	if (ENABLE_PROVINCE_MASK) {
		return {
			styleOptions: {
				fill: true,
				color: 'rgba(7, 35, 45, 1)',
				opacity: 1,
				outline: true,
				outlineColor: '#2be497',
				outlineWidth: 3,
				outlineOpacity: 1,
				global: false,
				clampToGround: true
			}
		};
	}

	return {
		styleOptions: {
			fill: false,
			outline: true,
			outlineColor: HUNAN_OUTLINE_COLOR,
			outlineWidth: 3,
			outlineOpacity: 1,
			clampToGround: true
		}
	};
}

/** 边界图层是否已加载完成（含复用全局地图场景） */
export function waitProvinceMaskReady() {
	if (maskLayerReady) {
		return Promise.resolve(provinceMaskLayer);
	}
	return maskReadyPromise;
}

export function addProvinceMaskLayer(map = getMapInstance()) {
	if (!map) {
		return null;
	}

	if (!ENABLE_PROVINCE_BOUNDARY) {
		resolveMaskReady(null);
		return null;
	}

	if (provinceMaskLayer) {
		resolveMaskReady(provinceMaskLayer);
		return provinceMaskLayer;
	}

	const mars3d = globalThis.mars3d;
	if (!mars3d) {
		throw new Error('mars3d global not found.');
	}

	resetMaskReadyPromise();

	provinceMaskLayer = new mars3d.layer.GeoJsonLayer({
		id: PROVINCE_MASK_LAYER_ID,
		name: ENABLE_PROVINCE_MASK ? '湖南省边界遮罩' : '湖南省边界',
		url: HUNAN_BOUNDARY_GEOJSON_URL,
		mask: ENABLE_PROVINCE_MASK,
		flyTo: false,
		toPrimitive: ENABLE_PROVINCE_MASK,
		symbol: buildProvinceBoundarySymbol()
	});

	const onMaskReady = () => {
		provinceMaskLayer?.off?.(mars3d.EventType.load, onMaskReady);
		provinceMaskLayer?.off?.(mars3d.EventType.error, onMaskError);
		resolveMaskReady(provinceMaskLayer);
	};

	const onMaskError = (error) => {
		console.warn('Province boundary layer load failed.', error);
		provinceMaskLayer?.off?.(mars3d.EventType.load, onMaskReady);
		provinceMaskLayer?.off?.(mars3d.EventType.error, onMaskError);
		resolveMaskReady(null);
	};

	provinceMaskLayer.on(mars3d.EventType.load, onMaskReady);
	provinceMaskLayer.on(mars3d.EventType.error, onMaskError);

	map.addLayer(provinceMaskLayer);
	return provinceMaskLayer;
}

export function clearProvinceMaskLayer(map = getMapInstance()) {
	if (!provinceMaskLayer) {
		resetMaskReadyPromise();
		return;
	}

	if (map?.removeLayer) {
		map.removeLayer(provinceMaskLayer, true);
	} else {
		provinceMaskLayer.destroy?.();
	}

	provinceMaskLayer = null;
	resetMaskReadyPromise();
}
