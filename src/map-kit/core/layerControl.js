/**
 * 地图业务图层显隐控制（图层管理面板、各业务页复用）
 */
import { BACKEND_NOTE_LAYER_ID } from '../constants.js';
import { getAppMapConfig, usesBackendLayers } from '../config/runtimeConfig.js';

/** 图层管理面板 / 业务代码统一使用的图层键 */
export const MAP_LAYER_KEYS = {
	ANNOTATION: 'annotation',
	DEFORM: 'deform',
	RISK: 'risk'
};

const LAYER_RESOLVERS = {
	[MAP_LAYER_KEYS.ANNOTATION]: (map) => {
		if (usesBackendLayers()) {
			return map?.getLayerById?.(BACKEND_NOTE_LAYER_ID) || null;
		}

		const config = getAppMapConfig().annotation;
		if (!config || config.enabled === false) {
			return null;
		}

		const name = config.name || '地名注记';
		return map?.getLayerByAttr?.(name, 'name') || null;
	},
	[MAP_LAYER_KEYS.DEFORM]: (map) => map?.getLayerById?.('__screen_template_deform_layer__') || null,
	[MAP_LAYER_KEYS.RISK]: (map) => map?.getLayerById?.('__screen_template_risk_layer__') || null
};

/** 根据图层键解析 Mars3D 图层实例 */
export function resolveManagedLayer(layerKey, map) {
	const resolver = LAYER_RESOLVERS[layerKey];
	if (!resolver || !map) {
		return null;
	}

	return resolver(map);
}

/** 图层是否可在图层面板树中勾选控制（内网注记走地图工具栏按钮，不进树） */
export function isLayerControllable(layerKey) {
	if (layerKey === MAP_LAYER_KEYS.ANNOTATION) {
		if (usesBackendLayers()) {
			return false;
		}
		const config = getAppMapConfig().annotation;
		return !!(config && config.enabled !== false);
	}

	return Object.prototype.hasOwnProperty.call(LAYER_RESOLVERS, layerKey);
}

/** 是否在地图右侧工具栏展示注记开关（对齐原 Map.vue） */
export function isAnnotationToolbarAvailable() {
	if (usesBackendLayers()) {
		return true;
	}
	return isLayerControllable(MAP_LAYER_KEYS.ANNOTATION);
}

/** 设置图层显隐，成功返回 true */
export function setLayerVisible(layerKey, visible, map) {
	const layer = resolveManagedLayer(layerKey, map);
	if (!layer) {
		return false;
	}

	layer.show = !!visible;
	map?.viewer?.scene?.requestRender?.();
	return true;
}

/** 读取图层显隐，图层不存在时返回 null */
export function getLayerVisible(layerKey, map) {
	const layer = resolveManagedLayer(layerKey, map);
	if (!layer) {
		return null;
	}

	return layer.show !== false;
}

/** 切换图层显隐，返回切换后的状态 */
export function toggleLayerVisible(layerKey, map) {
	const current = getLayerVisible(layerKey, map);
	if (current === null) {
		return null;
	}

	const next = !current;
	setLayerVisible(layerKey, next, map);
	return next;
}

/** 注记图层默认是否显示（内网默认关闭，对齐原 Map.vue noteLayerShow） */
export function getAnnotationDefaultVisible() {
	if (usesBackendLayers()) {
		return false;
	}

	const config = getAppMapConfig().annotation;
	if (!config || config.enabled === false) {
		return false;
	}

	return config.show !== false;
}

/** 设置地名注记图层显隐 */
export function setAnnotationVisible(visible, map) {
	return setLayerVisible(MAP_LAYER_KEYS.ANNOTATION, visible, map);
}

/** 读取地名注记图层显隐 */
export function getAnnotationVisible(map) {
	return getLayerVisible(MAP_LAYER_KEYS.ANNOTATION, map);
}
