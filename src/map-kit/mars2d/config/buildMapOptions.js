import { getAppMapConfig, getMapTokens, usesBackendLayers } from '../../config/runtimeConfig.js';
import { isPlainObject, mergePlain } from '../../config/mapSceneConfig.js';
import { getMapSceneOptions } from './mapSceneConfig.js';
import { resolveCameraView } from '../utils/cameraView.js';

function pickLayerFields(source = {}) {
	const fields = [
		'name', 'type', 'layer', 'url', 'key', 'show', 'zIndex', 'opacity', 'alpha',
		'maximumLevel', 'minimumLevel', 'subdomains', 'chinaCRS', 'crs', 'srs',
		'rectangle', 'proxy', 'queryParameters', 'parameters', 'format', 'styles',
		'version', 'tileMatrixSetID', 'tileMatrixLabels', 'width', 'height', 'request'
	];

	return fields.reduce((result, key) => {
		if (source[key] !== undefined && source[key] !== '') {
			result[key] = source[key];
		}
		return result;
	}, {});
}

function buildOnlineOrXyzLayer(layerConfig) {
	const layer = pickLayerFields(layerConfig);

	if (layer.url) {
		layer.type = layer.type === 'gaode' || layer.type === 'tdt' ? 'xyz' : layer.type || 'xyz';
		if (layer.type === 'wms' && layer.layer) {
			layer.layers = layer.layer;
			delete layer.layer;
		} else if (layer.type === 'xyz' && layer.layer) {
			delete layer.layer;
		}
	}

	if (layer.type === 'tdt' && !layer.key) {
		const { tianditu } = getMapTokens();
		if (tianditu) {
			layer.key = tianditu;
		}
	}

	return layer;
}

function buildAnnotationLayer(annotation = {}) {
	if (annotation.enabled === false) {
		return null;
	}

	const mode = annotation.labelMode;
	const layer = { ...annotation };

	if (mode === 'custom' && annotation.url) {
		layer.type = annotation.type || 'xyz';
		delete layer.layer;
		delete layer.labelMode;
		return buildOnlineOrXyzLayer(layer);
	}

	if (mode === 'gaode') {
		layer.type = 'gaode';
	} else if (mode === 'tdt') {
		layer.type = 'tdt';
	} else {
		throw new Error('APP_MAP_CONFIG.annotation.labelMode 无效');
	}

	delete layer.labelMode;
	delete layer.enabled;
	return buildOnlineOrXyzLayer(layer);
}

export function buildMapLayerOptions() {
	const config = getAppMapConfig();
	const basemaps = [];
	const layers = [];
	const backendOnly = usesBackendLayers();

	if (!backendOnly && config.basemap?.enabled !== false) {
		const basemapLayer = buildOnlineOrXyzLayer(config.basemap);
		if (basemapLayer?.type === 'wms') {
			layers.push({ ...basemapLayer, zIndex: basemapLayer.zIndex ?? 1, show: basemapLayer.show ?? true });
		} else {
			basemaps.push(basemapLayer);
		}
	}

	if (!backendOnly) {
		const annotationLayer = buildAnnotationLayer(config.annotation);
		if (annotationLayer) {
			layers.push(annotationLayer);
		}
	}

	const sceneFromConfig = getMapSceneOptions();
	const scene =
		isPlainObject(config.scene) && Object.keys(config.scene).length > 0
			? mergePlain({ ...sceneFromConfig }, config.scene)
			: sceneFromConfig;

	return { basemaps, layers, scene };
}

export function createDefaultMapOptions() {
	const { basemaps, layers, scene } = buildMapLayerOptions();
	const centerView = resolveCameraView(scene.center);

	return {
		basemaps,
		operationallayers: layers,
		zoom: centerView.zoom,
		minZoom: scene.minZoom,
		maxZoom: scene.maxZoom,
		center: { lng: centerView.lng, lat: centerView.lat },
		...scene
	};
}
