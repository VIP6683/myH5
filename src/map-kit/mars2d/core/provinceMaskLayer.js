import { HUNAN_BOUNDARY_GEOJSON_URL, PROVINCE_MASK_LAYER_ID } from '../../constants.js';
import { getMapInstance } from './engine.js';

const HUNAN_OUTLINE_COLOR = '#13dbac';
export const ENABLE_PROVINCE_MASK = false;
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
				outlineWidth: 3
			}
		};
	}

	return {
		styleOptions: {
			fill: false,
			outline: true,
			outlineColor: HUNAN_OUTLINE_COLOR,
			outlineWidth: 3,
			outlineOpacity: 1
		}
	};
}

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

	const mars2d = globalThis.mars2d;
	resetMaskReadyPromise();

	provinceMaskLayer = new mars2d.layer.GeoJsonLayer({
		id: PROVINCE_MASK_LAYER_ID,
		name: ENABLE_PROVINCE_MASK ? '湖南省边界遮罩' : '湖南省边界',
		url: HUNAN_BOUNDARY_GEOJSON_URL,
		mask: ENABLE_PROVINCE_MASK,
		flyTo: false,
		symbol: buildProvinceBoundarySymbol()
	});

	const onMaskReady = () => {
		provinceMaskLayer?.off?.(mars2d.EventType.load, onMaskReady);
		resolveMaskReady(provinceMaskLayer);
	};

	const onMaskError = (error) => {
		console.warn('Province boundary layer load failed.', error);
		provinceMaskLayer?.off?.(mars2d.EventType.load, onMaskReady);
		resolveMaskReady(null);
	};

	provinceMaskLayer.on(mars2d.EventType.load, onMaskReady);
	provinceMaskLayer.on('error', onMaskError);
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
