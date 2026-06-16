import { getMapInstance } from '../../../map-kit/core/mars3d.js';
import { MONITOR_LAYER_ID } from './monitorMockStore.js';

/**
 * 定位到监测图层中的面/线要素
 */
export async function locateMonitorPatch(patchId) {
	if (!patchId) {
		return false;
	}

	const map = getMapInstance();
	if (!map) {
		return false;
	}

	const layer = map.getLayerById?.(MONITOR_LAYER_ID);
	const graphic = layer?.getGraphicById?.(patchId);
	if (!graphic) {
		return false;
	}

	await map.flyToGraphic(graphic, {
		radius: 2500,
		duration: 0.8
	});
	return true;
}
