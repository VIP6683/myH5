/**
 * 仅读取 public/map-scene-2d.js → window.MAP_SCENE_2D_CONFIG
 */

import { altToZoom } from '../mars2d/utils/cameraView.js';

const CONFIG_SOURCE = 'public/map-scene-2d.js (window.MAP_SCENE_2D_CONFIG)';

export function isPlainObject(value) {
	return Object.prototype.toString.call(value) === '[object Object]';
}

export function mergePlain(target, source) {
	if (!isPlainObject(source)) {
		return target;
	}

	Object.keys(source).forEach((key) => {
		const sourceValue = source[key];
		const targetValue = target[key];

		if (isPlainObject(targetValue) && isPlainObject(sourceValue)) {
			target[key] = mergePlain({ ...targetValue }, sourceValue);
			return;
		}

		if (sourceValue !== undefined) {
			target[key] = sourceValue;
		}
	});

	return target;
}

function requireMapSceneConfig() {
	const raw = globalThis.MAP_SCENE_2D_CONFIG;
	if (!isPlainObject(raw)) {
		throw new Error(`地图场景配置未加载，请确保 index.html 已引入 ${CONFIG_SOURCE}`);
	}
	return raw;
}

function resolveCenter(raw) {
	const center = raw.center;
	if (!center || center.lng == null || center.lat == null) {
		throw new Error(`MAP_SCENE_2D_CONFIG.center 缺少 lng/lat，请检查 ${CONFIG_SOURCE}`);
	}
	return { ...center };
}

function resolveInteraction(raw) {
	const interaction = raw.interaction || {};
	return {
		inertia: interaction.inertia ?? false,
		zoomSnap: interaction.zoomSnap ?? 0.25,
		zoomDelta: interaction.zoomDelta ?? 0.5,
		wheelPxPerZoomLevel: interaction.wheelPxPerZoomLevel ?? 60,
		wheelDebounceTime: interaction.wheelDebounceTime ?? 20,
		touchZoom: interaction.touchZoom ?? true,
		bounceAtZoomLimits: interaction.bounceAtZoomLimits ?? false,
		doubleClickZoom: interaction.doubleClickZoom ?? false,
		preferCanvas: interaction.preferCanvas ?? true
	};
}

function resolveSceneOptions(raw) {
	return isPlainObject(raw.scene) ? { ...raw.scene } : {};
}

/** 启动时校验 map-scene-2d.js 已加载 */
export function loadMapSceneConfig() {
	return requireMapSceneConfig();
}

export function getMapSceneCenter() {
	return resolveCenter(requireMapSceneConfig());
}

/** 2D 引擎初始化 options（Leaflet/Mars2D） */
export function getMapSceneOptions() {
	const raw = requireMapSceneConfig();
	const center = getMapSceneCenter();
	const interaction = resolveInteraction(raw);
	const scene = resolveSceneOptions(raw);

	return {
		...scene,
		...interaction,
		center,
		zoom: raw.zoom ?? altToZoom(center.alt ?? 800000, center.lat),
		minZoom: raw.minZoom ?? 5,
		maxZoom: raw.maxZoom ?? 18
	};
}
