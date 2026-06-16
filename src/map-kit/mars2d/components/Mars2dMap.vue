<template>
	<div class="mars2dMapWrapper">
		<MapLoadingOverlay :visible="isLoading && showLoading" :text="loadingText" />
	</div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, inject, watch } from 'vue';
import { MAP_CONTEXT_KEY, MAP_HOST_KEY } from '../../constants.js';
import MapLoadingOverlay from '../../components/MapLoadingOverlay.vue';
import {
	canReuseMapInstance,
	destroyMapInstance,
	getDefaultMapOptions,
	getMapInstance,
	mergeMapOptions,
	resetMapViewportCache,
	scheduleMapViewportRefresh
} from '../core/engine.js';
import { waitProvinceMaskReady } from '../core/provinceMaskLayer.js';

const props = defineProps({
	mapOptions: { type: Object, default: () => ({}) },
	useGlobalMap: { type: Boolean, default: true },
	showLoading: { type: Boolean, default: true },
	loadingText: { type: String, default: '地图加载中...' }
});

const emit = defineEmits(['map-ready', 'map-loaded']);

const isLoading = ref(true);
let mapInstance = null;
let isMapCreated = false;
let isInitializing = false;
let loadWaitToken = 0;
let resizeObserver = null;
let unbindPageLifecycle = null;

const parentMapContext = inject(MAP_CONTEXT_KEY, null);
const mapHostRef = inject(MAP_HOST_KEY, null);
const resolveMapHost = () => mapHostRef?.value || parentMapContext?.getMapHost?.() || null;

const checkContainerReady = (el) => {
	if (!el) return false;
	const rect = el.getBoundingClientRect();
	return rect.width > 2 && rect.height > 2;
};

const bindMapHostResize = (map) => {
	const host = resolveMapHost();
	if (!host || !map) return;
	resizeObserver?.disconnect();
	resizeObserver = new ResizeObserver(() => scheduleMapViewportRefresh(map));
	resizeObserver.observe(host);
};

const finishMapLoading = (map) => {
	isLoading.value = false;
	nextTick(() => scheduleMapViewportRefresh(map, 0));
	emit('map-loaded', map);
};

const bindPageLifecycleRefresh = (map) => {
	unbindPageLifecycle?.();
	if (!map) return;

	const refreshMapViewport = () => {
		if (!mapInstance || document.hidden) return;
		scheduleMapViewportRefresh(map, 0);
	};

	const onVisibilityChange = () => {
		if (!document.hidden) refreshMapViewport();
	};
	window.addEventListener('focus', refreshMapViewport);
	window.addEventListener('pageshow', refreshMapViewport);
	document.addEventListener('visibilitychange', onVisibilityChange);

	unbindPageLifecycle = () => {
		document.removeEventListener('visibilitychange', onVisibilityChange);
		window.removeEventListener('focus', refreshMapViewport);
		window.removeEventListener('pageshow', refreshMapViewport);
		unbindPageLifecycle = null;
	};
};

const waitMapLoaded = (map) => {
	const token = ++loadWaitToken;
	Promise.all([map?.readyPromise || Promise.resolve(map), waitProvinceMaskReady()])
		.then(() => {
			if (token === loadWaitToken) finishMapLoading(map);
		})
		.catch(() => {
			if (token === loadWaitToken) finishMapLoading(map);
		});
};

const attachMapInstance = (map) => {
	mapInstance = map;
	isMapCreated = true;
	bindMapHostResize(mapInstance);
	bindPageLifecycleRefresh(mapInstance);
	scheduleMapViewportRefresh(mapInstance, 0);
	emit('map-ready', mapInstance);
	waitMapLoaded(mapInstance);
};

const resolveReusableMap = (host) => {
	if (!props.useGlobalMap) return null;
	const contextMap = parentMapContext?.getMap?.() || null;
	if (canReuseMapInstance(contextMap, host)) return contextMap;
	const moduleMap = getMapInstance();
	if (canReuseMapInstance(moduleMap, host)) {
		parentMapContext?.setMap?.(moduleMap);
		return moduleMap;
	}
	return null;
};

const disposeOrphanedMaps = (host) => {
	const contextMap = parentMapContext?.getMap?.() || null;
	if (contextMap && !canReuseMapInstance(contextMap, host)) {
		destroyMapInstance(contextMap);
		parentMapContext?.setMap?.(null);
	}
	const moduleMap = getMapInstance();
	if (moduleMap && !canReuseMapInstance(moduleMap, host)) {
		destroyMapInstance(moduleMap);
	}
};

const initMap = () => {
	if (isMapCreated || isInitializing) return;

	const mars2d = globalThis.mars2d;
	if (!mars2d) {
		throw new Error('mars2d global not found. Check installMars2d() in main.js.');
	}

	const host = resolveMapHost();
	if (!host) throw new Error('Map host element is not ready.');

	const reusableMap = resolveReusableMap(host);
	if (reusableMap) {
		attachMapInstance(reusableMap);
		return;
	}

	isInitializing = true;
	try {
		disposeOrphanedMaps(host);
		mars2d.Log.hasInfo(false);
		mapInstance = new mars2d.Map(host, mergeMapOptions(getDefaultMapOptions(), props.mapOptions));
		isMapCreated = true;
		if (props.useGlobalMap) parentMapContext?.setMap?.(mapInstance);
		bindMapHostResize(mapInstance);
		bindPageLifecycleRefresh(mapInstance);
		scheduleMapViewportRefresh(mapInstance, 0);
		emit('map-ready', mapInstance);
		waitMapLoaded(mapInstance);
	} finally {
		isInitializing = false;
	}
};

onMounted(() => {
	const tryInitMap = () => {
		if (isMapCreated) return;
		const host = resolveMapHost();
		if (checkContainerReady(host)) {
			initMap();
			return;
		}
		if (!host) {
			setTimeout(tryInitMap, 100);
			return;
		}
		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				if (entry.contentRect.width > 2 && entry.contentRect.height > 2) {
					observer.disconnect();
					initMap();
					break;
				}
			}
		});
		observer.observe(host);
		setTimeout(() => {
			observer.disconnect();
			if (!isMapCreated) initMap();
		}, 5000);
	};
	setTimeout(tryInitMap, 50);
});

watch(isLoading, (loading) => {
	if (!loading && mapInstance) {
		nextTick(() => scheduleMapViewportRefresh(mapInstance, 0));
	}
});

onBeforeUnmount(() => {
	loadWaitToken += 1;
	resizeObserver?.disconnect();
	resizeObserver = null;
	unbindPageLifecycle?.();
	if (mapInstance && !props.useGlobalMap) {
		destroyMapInstance(mapInstance);
		mapInstance = null;
		isMapCreated = false;
	}
});

defineExpose({
	getMap: () => mapInstance,
	isMapLoading: () => isLoading.value
});
</script>

<style scoped lang="scss">
.mars2dMapWrapper {
	position: absolute;
	inset: 0;
	pointer-events: none;
}
</style>
