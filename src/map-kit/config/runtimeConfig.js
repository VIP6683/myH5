/**
 * 仅读取 public/config.js → window.APP_MAP_CONFIG
 * 场景参数来自 public/map-scene.js（见 mapSceneConfig.js）
 */

import { getMap3DSceneOptions, isPlainObject, mergePlain } from './mapSceneConfig.js';

const CONFIG_SOURCE = 'public/config.js (window.APP_MAP_CONFIG)';

function requireAppMapConfig() {
	const runtime = globalThis.APP_MAP_CONFIG;
	if (!isPlainObject(runtime)) {
		throw new Error(`地图运行时配置未加载，请确保 index.html 已引入 ${CONFIG_SOURCE}`);
	}
	return runtime;
}

/** 读取 public/config.js 中的 APP_MAP_CONFIG */
export function getAppMapConfig() {
	return requireAppMapConfig();
}

/** 内网模式：底图/注记仅来自 getLayersData，初始化时不加载在线天地图 */
export function usesBackendLayers() {
	const config = getAppMapConfig();
	return config.layerSource === 'backend';
}

function resolveTokenList(configKeys) {
	if (Array.isArray(configKeys) && configKeys.length) {
		return configKeys.filter(Boolean);
	}

	if (typeof configKeys === 'string' && configKeys.trim()) {
		return [configKeys.trim()];
	}

	return undefined;
}

/** 解析天地图、高德 Token（仅来自 public/config.js） */
export function getMapTokens() {
	const config = getAppMapConfig();
	const tokens = config.tokens || {};

	return {
		tianditu: resolveTokenList(tokens.tianditu),
		gaode: resolveTokenList(tokens.gaode)
	};
}

function pickLayerFields(source = {}) {
	const fields = [
		'name',
		'type',
		'layer',
		'url',
		'key',
		'show',
		'zIndex',
		'opacity',
		'alpha',
		'maximumLevel',
		'minimumLevel',
		'subdomains',
		'chinaCRS',
		'crs',
		'srs',
		'rectangle',
		'proxy',
		'queryParameters',
		// WMS/WMTS 常用参数（用于对齐 htzy-web-dz 的底图入参）
		'parameters',
		'format',
		'styles',
		'version',
		'tileMatrixSetID',
		'tileMatrixLabels',
		'width',
		'height',
		'request'
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
		// 兼容在线底图：给了 url 时，tdt/gaode 走 xyz 模板；其他类型（wms/wmts/xyz）保持原 type
		layer.type = layer.type === 'gaode' || layer.type === 'tdt' ? 'xyz' : layer.type || 'xyz';
		// WMS 用 layers 字段（Mars3D WmsLayer 选项），其余类型保持 layer 语义即可
		if (layer.type === 'wms' && layer.layer) {
			layer.layers = layer.layer;
			delete layer.layer;
		} else if (layer.type === 'xyz' && layer.layer) {
			// xyz 自定义 url 时无需 layer
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

/**
 * 根据 labelMode 解析注记图层
 * 在线 tdt/gaode 的 img_z 均含道路线+地名，无「仅地名」开关；仅 custom url 可做到纯文字注记
 */
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
		throw new Error(
			`APP_MAP_CONFIG.annotation.labelMode 无效，请在 ${CONFIG_SOURCE} 中设置为 tdt | gaode | custom`
		);
	}

	delete layer.labelMode;
	delete layer.enabled;
	return buildOnlineOrXyzLayer(layer);
}

/** 构建 Mars3D 所需的 basemaps、layers、scene 配置 */
export function buildMapLayerOptions() {
	const config = getAppMapConfig();
	const basemaps = [];
	const layers = [];
	const backendOnly = usesBackendLayers();

	if (!backendOnly && config.basemap && config.basemap.enabled !== false) {
		const basemapLayer = buildOnlineOrXyzLayer(config.basemap);
		// Mars3D 的 WMS 更适合作为普通图层加入（而不是 basemap 配置项）
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

	const sceneFromMapScene = getMap3DSceneOptions();
	const scene =
		isPlainObject(config.scene) && Object.keys(config.scene).length > 0
			? mergePlain({ ...sceneFromMapScene }, config.scene)
			: sceneFromMapScene;

	return { basemaps, layers, scene };
}
