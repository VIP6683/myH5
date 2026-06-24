import { altToZoom } from '../utils/cameraView.js';

const CONFIG_SOURCE = 'public/map-scene-2d.js (window.MAP_SCENE_2D_CONFIG)';

function isPlainObject(value) {
	return Object.prototype.toString.call(value) === '[object Object]';
}

function requireMapSceneConfig() {
	const raw = globalThis.MAP_SCENE_2D_CONFIG;
	if (!isPlainObject(raw)) {
		throw new Error(`Mars2D 场景配置未加载，请确保 index.html 已引入 ${CONFIG_SOURCE}`);
	}
	return raw;
}

function resolveCenter(raw) {
	const center = raw.center;
	if (!center || center.lng == null || center.lat == null) {
		throw new Error(`MAP_SCENE_2D_CONFIG.center 缺少 lng/lat`);
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

export function getMapSceneCenter() {
	return resolveCenter(requireMapSceneConfig());
}

export function getMapSceneOptions() {
	const raw = requireMapSceneConfig();
	const center = getMapSceneCenter();
	const interaction = resolveInteraction(raw);
	const scene = isPlainObject(raw.scene) ? { ...raw.scene } : {};

	return {
		...scene,
		...interaction,
		center,
		zoom: raw.zoom ?? altToZoom(center.alt ?? 800000, center.lat),
		minZoom: raw.minZoom ?? 5,
		maxZoom: raw.maxZoom ?? 18
	};
}

export function applyMapSceneRuntime(map) {
	if (!map?.setOptions) {
		return;
	}

	const options = getMapSceneOptions();
	map.setOptions({
		inertia: options.inertia,
		zoomSnap: options.zoomSnap,
		zoomDelta: options.zoomDelta,
		wheelPxPerZoomLevel: options.wheelPxPerZoomLevel,
		wheelDebounceTime: options.wheelDebounceTime,
		touchZoom: options.touchZoom,
		bounceAtZoomLimits: options.bounceAtZoomLimits,
		doubleClickZoom: options.doubleClickZoom,
		preferCanvas: options.preferCanvas,
		minZoom: options.minZoom,
		maxZoom: options.maxZoom
	});
}

export function bindMapInteractionPerformance(map) {
	bindZoomLimitGuard(map);
}

function bindZoomLimitGuard(map) {
	const mars2d = globalThis.mars2d;
	if (!map || !mars2d || map.__zoomLimitGuardBound__) {
		return;
	}

	const { minZoom, maxZoom } = getMapSceneOptions();
	const clampZoom = () => {
		const zoom = map.getZoom?.();
		if (!Number.isFinite(zoom)) {
			return;
		}
		if (zoom > maxZoom) {
			map.setZoom(maxZoom);
		} else if (zoom < minZoom) {
			map.setZoom(minZoom);
		}
	};

	map.on(mars2d.EventType.zoomend, clampZoom);
	map.__zoomLimitGuardBound__ = true;
}

export function unbindMapInteractionPerformance() {}
