import { findLineTaskListPatch } from '../../../composables/useLineTaskList.js';
import { findTaskListPatch } from '../../../composables/useTaskList.js';
import { getMapSceneOptions } from '../../../map-kit/mars2d/config/mapSceneConfig.js';
import { getMapInstance } from '../../../map-kit/mapApi.js';
import { highlightMonitorPatch } from './highlightMonitorPatch.js';
import { MONITOR_LAYER_ID } from '../constants/monitorLayer.js';

function getPatchCenter(patch) {
	const coordinates = patch?.attr?.coordinates;
	if (coordinates?.lng != null && coordinates?.lat != null) {
		return {
			lng: Number(coordinates.lng),
			lat: Number(coordinates.lat)
		};
	}

	const positions = patch?.positions;
	if (!positions?.length) {
		return null;
	}

	let lng = 0;
	let lat = 0;
	for (const position of positions) {
		lng += position[0];
		lat += position[1];
	}

	return {
		lng: Number((lng / positions.length).toFixed(6)),
		lat: Number((lat / positions.length).toFixed(6))
	};
}

/**
 * 定位到监测图层中的面/线要素；图层未绘制时回退到图斑中心坐标
 * @param {string | number} patchId
 * @param {unknown} [patchHint]
 */
export async function locateMonitorPatch(patchId, patchHint = null) {
	if (!patchId) {
		return false;
	}

	const map = getMapInstance();
	if (!map) {
		return false;
	}

	const layer = map.getLayerById?.(MONITOR_LAYER_ID);
	const graphic = layer?.getGraphicById?.(patchId);
	if (graphic && typeof map.flyToGraphic === 'function') {
		await map.flyToGraphic(graphic, {
			scale: 1.2,
			maxZoom: getMapSceneOptions().maxZoom,
			duration: 0.8,
			animate: true
		});
		highlightMonitorPatch(patchId);
		return true;
	}

	const patch = patchHint || findTaskListPatch(patchId) || findLineTaskListPatch(patchId);
	const center = getPatchCenter(patch);
	if (!center) {
		return false;
	}

	const zoom = typeof map.getZoom === 'function'
		? Math.min(Math.max(map.getZoom(), 14), getMapSceneOptions().maxZoom)
		: Math.min(14, getMapSceneOptions().maxZoom);
	if (typeof map.flyTo === 'function') {
		await map.flyTo([center.lat, center.lng], zoom, { animate: true, duration: 0.8 });
		highlightMonitorPatch(patchId);
		return true;
	}

	if (typeof map.setView === 'function') {
		map.setView([center.lat, center.lng], zoom, { animate: true });
		highlightMonitorPatch(patchId);
		return true;
	}

	return false;
}
