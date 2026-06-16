<script setup>
import { computed, onBeforeUnmount, provide, ref, watch } from 'vue';
import { useGlobalTabBar } from '../business/map-shell/composables/useGlobalTabBar.js';
import { RouterView, useRoute } from 'vue-router';
import MapContainer from '../map-kit/components/MapContainer.vue';
import Mars2dMap from '../map-kit/mars2d/components/Mars2dMap.vue';
import { getDefaultMapOptions, setMapInstance } from '../map-kit/mapApi.js';
import MapControlPanel from '../business/map-shell/components/MapControlPanel.vue';
import ClearScreenExitButton from '../business/map-shell/components/ClearScreenExitButton.vue';
import MapTopBar from '../business/map-shell/components/MapTopBar.vue';
import { useClearScreen } from '../business/map-shell/composables/useClearScreen.js';
import {
	MAP_UI_OVERLAY_KEY,
	useMapUiOverlay
} from '../business/map-shell/composables/useMapUiOverlay.js';
import { useMapSlideMotion } from '../business/map-shell/composables/useMapSlideMotion.js';
import MapFeatureDetailSheet from '../business/map-shell/components/MapFeatureDetailSheet.vue';
import MapPatchListSheet from '../business/map-shell/components/MapPatchListSheet.vue';
import MapVerifyFormSheet from '../business/map-shell/components/MapVerifyFormSheet.vue';
import MonitorMockGraphics from '../business/map-shell/components/MonitorMockGraphics.vue';
import { useMapEvent } from '../map-kit/composables/useMapEvent.js';
import { MapEventType } from '../map-kit/core/mapEvents.js';
import '../business/map-shell/styles/map-slide-animations.scss';

defineOptions({
	name: 'MapLayout'
});

const route = useRoute();
const mapOptions = getDefaultMapOptions();
const activeTab = computed(() => route.meta.tab || 'area-monitor');
const headerTab = ref('pending-verify');
const searchKeyword = ref('');
const mapLoaded = ref(false);
const featureDetailVisible = ref(false);
const featureDetail = ref(null);
const verifyFormVisible = ref(false);
const verifyDetail = ref(null);
const patchListVisible = ref(false);
const appliedFilters = ref({
	year: '',
	objectType: [],
	verifyStatus: '',
	disposeStatus: ''
});

const isMonitorTab = computed(
	() => activeTab.value === 'area-monitor' || activeTab.value === 'line-monitor'
);

const sideMenuMotion = useMapSlideMotion('right');
const topBarMotion = useMapSlideMotion('top');
const bottomBarMotion = useMapSlideMotion('bottom');
const backButtonMotion = useMapSlideMotion('bottom');

const {
	visible: sideMenuVisible,
	motionClass: sideMenuMotionClass,
	playInitialEnter: playSideMenuEnter,
	dispose: disposeSideMenuMotion
} = sideMenuMotion;

const {
	visible: topBarVisible,
	motionClass: topBarMotionClass,
	playInitialEnter: playTopBarEnter,
	dispose: disposeTopBarMotion
} = topBarMotion;

const {
	visible: bottomBarVisible,
	motionClass: bottomBarMotionClass,
	playInitialEnter: playBottomBarEnter,
	dispose: disposeBottomBarMotion
} = bottomBarMotion;

const {
	visible: backButtonVisible,
	motionClass: backButtonMotionClass,
	dispose: disposeBackButtonMotion
} = backButtonMotion;

const { isClearScreen, enterClearScreen, exitClearScreen, dispose } = useClearScreen({
	sideMenu: sideMenuMotion,
	topBar: topBarMotion,
	bottomBar: bottomBarMotion,
	backButton: backButtonMotion
});

const mapUiOverlay = useMapUiOverlay(
	{
		sideMenu: sideMenuMotion,
		topBar: topBarMotion,
		bottomBar: bottomBarMotion
	},
	{ isClearScreen }
);
provide(MAP_UI_OVERLAY_KEY, mapUiOverlay);

const globalTabBar = useGlobalTabBar();

watch(
	() => bottomBarVisible.value,
	(value) => {
		globalTabBar.visible.value = value;
	},
	{ immediate: true }
);

watch(
	() => bottomBarMotionClass.value,
	(value) => {
		globalTabBar.motionClass.value = value;
	},
	{ immediate: true }
);

function handleMapReady(map) {
	setMapInstance(map);
}

function handleMapLoaded() {
	playSideMenuEnter();
	playTopBarEnter();
	playBottomBarEnter();
	mapLoaded.value = true;

}

function handleFeatureClick(payload) {
	const kind = payload?.kind || payload?.attr?.kind;
	if (kind !== 'area' && kind !== 'line') {
		return;
	}

	patchListVisible.value = false;
	featureDetail.value = payload.attr || null;
	featureDetailVisible.value = true;
}

function handleStartVerify(detail) {
	verifyDetail.value = detail;
	verifyFormVisible.value = true;
	featureDetailVisible.value = false;
}

function handleVerifyBack() {
	featureDetailVisible.value = true;
}

function handleFilterChange(filters) {
	if (!isMonitorTab.value) {
		return;
	}
	appliedFilters.value = filters;
	patchListVisible.value = true;
}

watch(activeTab, () => {
	if (!isMonitorTab.value) {
		patchListVisible.value = false;
	}
});

useMapEvent(MapEventType.FEATURE_CLICK, handleFeatureClick);

onBeforeUnmount(() => {
	dispose();
	mapUiOverlay.dispose();
	disposeSideMenuMotion();
	disposeTopBarMotion();
	disposeBottomBarMotion();
	disposeBackButtonMotion();
});
</script>

<template>
	<main class="map-page" :class="{ 'map-page--clear-screen': isClearScreen }">
		<MapContainer>
			<MonitorMockGraphics v-if="mapLoaded" :active-tab="activeTab" />

			<Mars2dMap
				:map-options="mapOptions"
				:use-global-map="true"
				loading-text="数界一张图加载中..."
				@map-ready="handleMapReady"
				@map-loaded="handleMapLoaded"
			/>

			<RouterView />

			<MapTopBar
				v-model="headerTab"
				v-model:search-text="searchKeyword"
				:visible="topBarVisible"
				:motion-class="topBarMotionClass"
				@filter-change="handleFilterChange"
			/>

			<MapControlPanel
				:visible="sideMenuVisible"
				:motion-class="sideMenuMotionClass"
				@clear-screen="enterClearScreen"
			/>

			<MapFeatureDetailSheet
				v-model:visible="featureDetailVisible"
				:detail="featureDetail"
				@start-verify="handleStartVerify"
			/>

			<MapVerifyFormSheet
				v-model:visible="verifyFormVisible"
				:detail="verifyDetail"
				@back="handleVerifyBack"
			/>

			<MapPatchListSheet
				v-model:visible="patchListVisible"
				:active-tab="activeTab"
				:header-tab="headerTab"
				:filters="appliedFilters"
			/>

			<ClearScreenExitButton
				:visible="backButtonVisible"
				:motion-class="backButtonMotionClass"
				@click="exitClearScreen"
			/>
		</MapContainer>
	</main>
</template>

<style scoped lang="scss">
.map-page {
	position: relative;
	width: 100%;
	max-width: 100%;
	margin: 0 auto;
	height: var(--app-vv-height, 100dvh);
	max-height: var(--app-vv-height, 100dvh);
	overflow: hidden;
	--map-top-bar-height: calc(96px + env(safe-area-inset-top, 0px));
}
</style>
