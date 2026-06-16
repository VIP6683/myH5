<script setup>
import { ref, provide } from 'vue';
import { MAP_CONTEXT_KEY, MAP_HOST_KEY } from '../constants.js';

const mapHostRef = ref(null);

let mapInstance = null;

const mapContext = {
	getMap: () => mapInstance,
	setMap: (map) => {
		mapInstance = map;
	},
	hasMap: () => !!mapInstance,
	getMapHost: () => mapHostRef.value
};

provide(MAP_CONTEXT_KEY, mapContext);
provide(MAP_HOST_KEY, mapHostRef);

defineExpose({
	getMap: () => mapInstance,
	setMap: (map) => {
		mapInstance = map;
	},
	hasMap: () => !!mapInstance,
	getMapHost: () => mapHostRef.value
});
</script>

<template>
	<div class="mapContainer">
		<div ref="mapHostRef" class="mapHost"></div>
		<div class="mapOverlayLayer">
			<slot />
		</div>
	</div>
</template>

<style scoped lang="scss">
.mapContainer {
	width: 100%;
	height: 100%;
	position: absolute;
	top: 0;
	left: 0;
	outline: none;

	&:focus,
	&:focus-within {
		outline: none;
	}
}

.mapHost {
	position: absolute;
	inset: 0;
	z-index: 0;
	overflow: hidden;
	/* 阻止浏览器默认双指缩放/滚动，交给 Cesium 处理 */
	touch-action: none;
	/* 底图未加载前的占位色，与 map-scene.js backgroundColor 一致 */
	background: #f5f6f7;

	&.map-host--interaction-locked {
		pointer-events: none !important;
		touch-action: none !important;

		:deep(.mars3d-container),
		:deep(.cesium-viewer),
		:deep(.cesium-widget),
		:deep(.cesium-widget canvas) {
			pointer-events: none !important;
			touch-action: none !important;
		}
	}

	/* Cesium canvas 获焦时浏览器默认轮廓，会在顶栏下方出现横线 */
	:deep(.mars3d-container),
	:deep(.cesium-viewer),
	:deep(.cesium-widget),
	:deep(.cesium-widget canvas) {
		outline: none !important;
	}

	:deep(.cesium-widget canvas:focus),
	:deep(.cesium-widget canvas:focus-visible) {
		outline: none !important;
	}
}

.mapOverlayLayer {
	position: absolute;
	inset: 0;
	z-index: 2;
	pointer-events: none;

	:deep(.mapLoadingOverlay),
	:deep(.mapLoadingOverlay--blocking),
	:deep(.feature-panel),
	:deep(.map-legend),
	:deep(.map-side-menu),
	:deep(.map-control-panel),
	:deep(.clear-screen-back-btn),
	:deep(.map-top-bar),
	:deep(.map-top-bar__shade),
	:deep(.map-floating-tab-bar-wrap),
	:deep(.map-data-stats-panel) {
		pointer-events: auto;
	}
}
</style>
