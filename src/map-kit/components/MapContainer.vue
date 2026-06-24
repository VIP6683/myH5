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
	touch-action: none;
	background: #f5f6f7;

	&.map-host--interaction-locked {
		pointer-events: none !important;
		touch-action: none !important;

		:deep(.mars3d-container),
		:deep(.leaflet-container) {
			pointer-events: none !important;
			touch-action: none !important;
		}
	}

	:deep(.mars3d-container),
	:deep(.leaflet-container) {
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
	:deep(.clear-screen-exit-btn),
	:deep(.map-top-bar),
	:deep(.map-top-bar__shade),
	:deep(.map-data-stats-panel) {
		pointer-events: auto;
	}
}
</style>
