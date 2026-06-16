/**
 * 仅读取 public/map-scene.js → window.MAP_SCENE_CONFIG
 */

const CONFIG_SOURCE = 'public/map-scene.js (window.MAP_SCENE_CONFIG)';

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
	const raw = globalThis.MAP_SCENE_CONFIG;
	if (!isPlainObject(raw)) {
		throw new Error(`地图场景配置未加载，请确保 index.html 已引入 ${CONFIG_SOURCE}`);
	}
	return raw;
}

function resolveCenter(raw) {
	const center = raw.center || raw.scene?.center;
	if (!center || center.lng == null || center.lat == null) {
		throw new Error(`MAP_SCENE_CONFIG.center 缺少 lng/lat，请检查 ${CONFIG_SOURCE}`);
	}
	return { ...center };
}

/** Cesium ScreenSpaceCameraController 可在运行时覆盖的扩展字段（Mars3D scene 未透传） */
const CAMERA_CONTROLLER_RUNTIME_KEYS = [
	'inertiaTranslate',
	'inertiaSpin',
	'inertiaZoom',
	'maximumMovementRatio',
	'bounceAnimationTime',
	'minimumZoomDistance',
	'maximumZoomDistance',
	'zoomFactor'
];

function resolveCameraController(raw) {
	const ctrl = raw.cameraController || raw.scene?.cameraController;
	if (!ctrl || typeof ctrl !== 'object') {
		throw new Error(`MAP_SCENE_CONFIG.cameraController 未配置，请检查 ${CONFIG_SOURCE}`);
	}

	// 忽略历史误写字段 minminimumZoomDistance（曾误配为 150000，会阻断聚合下钻）
	const { mobile: _mobile, minminimumZoomDistance: _legacyMinZoom, ...resolved } = ctrl;
	return resolved;
}

function resolveSceneOptions(raw) {
	if (!isPlainObject(raw.scene)) {
		throw new Error(`MAP_SCENE_CONFIG.scene 未配置，请检查 ${CONFIG_SOURCE}`);
	}
	return { ...raw.scene };
}

function resolveGlobeOptions(sceneOptions) {
	if (!isPlainObject(sceneOptions.globe)) {
		throw new Error(`MAP_SCENE_CONFIG.scene.globe 未配置，请检查 ${CONFIG_SOURCE}`);
	}
	return { ...sceneOptions.globe };
}

function resolveInteractionPerformance(sceneOptions) {
	const globe = resolveGlobeOptions(sceneOptions);
	return {
		idleSSE: Number(globe.maximumScreenSpaceError),
		interactionSSE: Number(globe.interactionMaximumScreenSpaceError),
		debounceMs: Number(sceneOptions.interactionDebounceMs)
	};
}

/** 启动时校验 map-scene.js 已加载 */
export function loadMapSceneConfig() {
	return requireMapSceneConfig();
}

export function getMapSceneCenter() {
	return resolveCenter(requireMapSceneConfig());
}

export function getMapCameraController() {
	return resolveCameraController(requireMapSceneConfig());
}

/** 合并进 Map options.scene */
export function getMap3DSceneOptions() {
	const raw = requireMapSceneConfig();
	const sceneOptions = resolveSceneOptions(raw);
	const globe = resolveGlobeOptions(sceneOptions);
	const { interactionMaximumScreenSpaceError, ...globeForInit } = globe;

	const options = {
		...sceneOptions,
		globe: globeForInit,
		center: getMapSceneCenter(),
		cameraController: getMapCameraController()
	};

	if (raw.sceneMode != null) {
		options.sceneMode = raw.sceneMode;
	}
	if (raw.sceneModeMorphDuration != null) {
		options.sceneModeMorphDuration = raw.sceneModeMorphDuration;
	}

	return options;
}

let interactionPerfCleanup = null;
let interactionEndTimer = null;
let isCameraInteracting = false;
let activeMapTouches = 0;
let savedMaximumRenderTimeChange = null;

function clearInteractionTimer() {
	clearTimeout(interactionEndTimer);
	interactionEndTimer = null;
}

function restoreInteractionRenderMode(scene) {
	if (!scene || savedMaximumRenderTimeChange === null) {
		return;
	}

	scene.maximumRenderTimeChange = savedMaximumRenderTimeChange;
	savedMaximumRenderTimeChange = null;
}

/** 滚轮/拖动结束后延迟恢复清晰瓦片，避免滚轮间隙误触发 cameraMoveEnd 导致卡顿 */
function scheduleInteractionIdle(map, globe, idleSSE, debounceMs) {
	clearInteractionTimer();

	if (activeMapTouches > 0) {
		return;
	}

	interactionEndTimer = setTimeout(() => {
		if (activeMapTouches > 0) {
			interactionEndTimer = null;
			return;
		}

		isCameraInteracting = false;
		globe.maximumScreenSpaceError = idleSSE;
		restoreInteractionRenderMode(map?.viewer?.scene);
		map.viewer?.scene?.requestRender?.();
		interactionEndTimer = null;
	}, debounceMs);
}

function enterInteractionMode(globe, interactionSSE, scene) {
	clearInteractionTimer();

	if (!isCameraInteracting) {
		isCameraInteracting = true;
		globe.maximumScreenSpaceError = interactionSSE;
	}

	if (scene?.requestRenderMode && savedMaximumRenderTimeChange === null) {
		savedMaximumRenderTimeChange = scene.maximumRenderTimeChange;
		scene.maximumRenderTimeChange = 0;
	}
}

/**
 * 将 map-scene.js 中的 cameraController 同步到 Cesium ScreenSpaceCameraController
 * Mars3D 初始化时仅合并部分字段；惯性、maximumMovementRatio 等需运行时写入
 * @param {import('mars3d').Map} map
 */
export function applyMapCameraControllerRuntime(map) {
	const controller = map?.viewer?.scene?.screenSpaceCameraController;
	if (!controller) {
		return;
	}

	const ctrl = resolveCameraController(requireMapSceneConfig());

	for (const key of CAMERA_CONTROLLER_RUNTIME_KEYS) {
		const value = ctrl[key];
		if (value === undefined || value === null) {
			continue;
		}

		if (typeof value === 'number' && !Number.isFinite(value)) {
			continue;
		}

		controller[key] = value;
	}

	// Mars3D 内部双指缩放灵敏度与 _zoomFactor 绑定
	if (Number.isFinite(ctrl.zoomFactor)) {
		controller._zoomFactor = ctrl.zoomFactor;
	}
}

/**
 * 地图就绪后同步 scene / globe / viewer 渲染参数
 * @param {import('mars3d').Map} map
 */
export function applyMapSceneRuntime(map) {
	const viewer = map?.viewer;
	const scene = viewer?.scene;
	if (!scene) {
		return;
	}

	const sceneOptions = resolveSceneOptions(requireMapSceneConfig());
	const globeOptions = resolveGlobeOptions(sceneOptions);
	const globe = scene.globe;
	const { idleSSE } = resolveInteractionPerformance(sceneOptions);

	if (typeof sceneOptions.resolutionScale === 'number' && viewer) {
		viewer.resolutionScale = sceneOptions.resolutionScale;
	}

	if (typeof sceneOptions.fxaa === 'boolean' && scene.postProcessStages?.fxaa) {
		scene.postProcessStages.fxaa.enabled = sceneOptions.fxaa;
	}

	if (typeof sceneOptions.msaaSamples === 'number' && viewer?.msaaSamples !== undefined) {
		viewer.msaaSamples = sceneOptions.msaaSamples;
	}

	if (typeof sceneOptions.backgroundColor === 'string' && scene.backgroundColor) {
		const cesiumColor = globalThis.Cesium?.Color?.fromCssColorString?.(sceneOptions.backgroundColor);
		if (cesiumColor) {
			scene.backgroundColor = cesiumColor;
		}
	}

	if (globe) {
		if (globeOptions.baseColor) {
			const base = globalThis.Cesium?.Color?.fromCssColorString?.(globeOptions.baseColor);
			if (base) {
				globe.baseColor = base;
			}
		}
		if (globeOptions.showGroundAtmosphere === false) {
			globe.showGroundAtmosphere = false;
		}
		if (globeOptions.enableLighting === false) {
			globe.enableLighting = false;
		}
		if (globeOptions.depthTestAgainstTerrain === false) {
			globe.depthTestAgainstTerrain = false;
		}
		if (Number.isFinite(idleSSE)) {
			globe.maximumScreenSpaceError = idleSSE;
		}
	}

	if (sceneOptions.fog === false && scene.fog) {
		scene.fog.enabled = false;
	}
	if (sceneOptions.showSkyAtmosphere === false && scene.skyAtmosphere) {
		scene.skyAtmosphere.show = false;
	}
	if (sceneOptions.showSun === false && scene.sun) {
		scene.sun.show = false;
	}
	if (sceneOptions.showMoon === false && scene.moon) {
		scene.moon.show = false;
	}

	if (typeof sceneOptions.requestRenderMode === 'boolean') {
		scene.requestRenderMode = sceneOptions.requestRenderMode;
	}

	if (typeof sceneOptions.maximumRenderTimeChange === 'number') {
		scene.maximumRenderTimeChange = sceneOptions.maximumRenderTimeChange;
	}

	if (viewer && typeof sceneOptions.targetFrameRate === 'number') {
		viewer.targetFrameRate = sceneOptions.targetFrameRate;
	}

	applyMapCameraControllerRuntime(map);
	scene.requestRender?.();
}

/**
 * 拖动/缩放时临时提高 SSE，松手后恢复清晰瓦片（不降低 resolutionScale，图标保持锐利）
 * @param {import('mars3d').Map} map
 */
export function bindMapInteractionPerformance(map) {
	unbindMapInteractionPerformance();

	const mars3d = globalThis.mars3d;
	const globe = map?.viewer?.scene?.globe;
	if (!map || !mars3d || !globe) {
		return;
	}

	const sceneOptions = resolveSceneOptions(requireMapSceneConfig());
	const { idleSSE, interactionSSE, debounceMs } = resolveInteractionPerformance(sceneOptions);

	if (
		!Number.isFinite(idleSSE) ||
		!Number.isFinite(interactionSSE) ||
		!Number.isFinite(debounceMs) ||
		interactionSSE <= idleSSE
	) {
		return;
	}

	const scene = map.viewer?.scene;

	const onMoveStart = () => enterInteractionMode(globe, interactionSSE, scene);

	const onMoveEnd = () => scheduleInteractionIdle(map, globe, idleSSE, debounceMs);

	/** 滚轮缩放时 cameraMoveEnd 可能在两次滚动之间误触发，用 wheel 续期更稳 */
	const onWheel = () => {
		enterInteractionMode(globe, interactionSSE, scene);
		scheduleInteractionIdle(map, globe, idleSSE, debounceMs);
	};

	const touchTarget = map.viewer?.canvas || map.viewer?.container;
	const onTouchStart = () => {
		activeMapTouches += 1;
		enterInteractionMode(globe, interactionSSE, scene);
	};
	const onTouchEnd = () => {
		activeMapTouches = Math.max(0, activeMapTouches - 1);
		scheduleInteractionIdle(map, globe, idleSSE, debounceMs);
	};

	map.on(mars3d.EventType.cameraMoveStart, onMoveStart);
	map.on(mars3d.EventType.cameraMoveEnd, onMoveEnd);
	map.on(mars3d.EventType.wheel, onWheel);

	if (touchTarget) {
		touchTarget.addEventListener('touchstart', onTouchStart, { passive: true });
		touchTarget.addEventListener('touchend', onTouchEnd, { passive: true });
		touchTarget.addEventListener('touchcancel', onTouchEnd, { passive: true });
	}

	interactionPerfCleanup = () => {
		clearInteractionTimer();
		isCameraInteracting = false;
		activeMapTouches = 0;
		map.off?.(mars3d.EventType.cameraMoveStart, onMoveStart);
		map.off?.(mars3d.EventType.cameraMoveEnd, onMoveEnd);
		map.off?.(mars3d.EventType.wheel, onWheel);
		if (touchTarget) {
			touchTarget.removeEventListener('touchstart', onTouchStart);
			touchTarget.removeEventListener('touchend', onTouchEnd);
			touchTarget.removeEventListener('touchcancel', onTouchEnd);
		}
		globe.maximumScreenSpaceError = idleSSE;
		restoreInteractionRenderMode(scene);
		interactionPerfCleanup = null;
	};
}

export function unbindMapInteractionPerformance() {
	if (interactionPerfCleanup) {
		interactionPerfCleanup();
		return;
	}

	clearInteractionTimer();
	isCameraInteracting = false;
	activeMapTouches = 0;
	savedMaximumRenderTimeChange = null;
}
