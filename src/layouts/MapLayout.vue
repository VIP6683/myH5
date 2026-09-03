<script setup>
import { computed, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue';
import { useGlobalTabBar } from '../business/map-shell/composables/useGlobalTabBar.js';
import { useLineTaskList } from '../composables/useLineTaskList.js';
import { useLineTaskListCount } from '../composables/useLineTaskListCount.js';
import { useTaskList } from '../composables/useTaskList.js';
import { useTaskListCount } from '../composables/useTaskListCount.js';
import {
	createEmptyFilters,
	createEmptyLineQuery
} from '../business/map-shell/utils/monitorFilters.js';
import { useRoute } from 'vue-router';
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
import { createMapShellMotions } from '../business/map-shell/composables/useMapSlideMotion.js';
import { useFeatureDetail } from '../business/map-shell/composables/useFeatureDetail.js';
import { useMonitorRefresh } from '../business/map-shell/composables/useMonitorRefresh.js';
import { useAppToast } from '../composables/useAppToast.js';
import { useVerifyFlow } from '../business/map-shell/composables/useVerifyFlow.js';
import MapFeatureDetailSheet from '../business/map-shell/components/MapFeatureDetailSheet.vue';
import MapPatchListSheet from '../business/map-shell/components/MapPatchListSheet.vue';
import MapVerifyFormSheet from '../business/map-shell/components/MapVerifyFormSheet.vue';
import MonitorMockGraphics from '../business/map-shell/components/MonitorMockGraphics.vue';
import { preloadWatermarkFont } from '../business/map-shell/utils/addPhotoWatermark.js';
import { useMapEvent } from '../map-kit/composables/useMapEvent.js';
import { MapEventType } from '../map-kit/core/mapEvents.js';
import {
	fetchAbnormalMonitorDetail,
	normalizeAbnormalMonitorDetail
} from '../api/lineMonitor.js';
import {
	fetchAbnormalSurfaceDetail,
	normalizeAbnormalSurfaceDetail
} from '../api/statistics.js';
import '../business/map-shell/styles/map-slide-animations.scss';

defineOptions({
	name: 'MapLayout'
});

const route = useRoute();
const mapOptions = getDefaultMapOptions();
const activeTab = computed(() => route.meta.tab || 'area-monitor');
const headerTab = ref('pending-verify');
const searchKeyword = ref('');
const lineQuery = ref(createEmptyLineQuery());
const mapLoaded = ref(false);
const patchListSnap = ref('collapsed');
const patchListSnapBeforeDetail = ref('collapsed');
const mapTopBarRef = ref(null);
const filterPanelOpen = ref(false);
const featureDetailTransitionVisible = ref(false);
const appliedFilters = ref(createEmptyFilters());

const isMonitorTab = computed(
	() => activeTab.value === 'area-monitor' || activeTab.value === 'line-monitor'
);

const {
	sideMenu: sideMenuMotion,
	topBar: topBarMotion,
	bottomBar: bottomBarMotion,
	backButton: backButtonMotion,
	playInitialEnter: playMapShellInitialEnter,
	disposeAll: disposeMapShellMotions
} = createMapShellMotions();

const sideMenuVisible = sideMenuMotion.visible;
const sideMenuMotionClass = sideMenuMotion.motionClass;
const topBarVisible = topBarMotion.visible;
const topBarMotionClass = topBarMotion.motionClass;
const bottomBarVisible = bottomBarMotion.visible;
const bottomBarMotionClass = bottomBarMotion.motionClass;
const backButtonVisible = backButtonMotion.visible;
const backButtonMotionClass = backButtonMotion.motionClass;

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
const { counts, loadTaskListCount } = useTaskListCount();
const { counts: lineCounts, loadLineTaskListCount } = useLineTaskListCount();
const { loadTaskList } = useTaskList();
const { loadLineTaskList } = useLineTaskList();

const monitorType = computed(() => (activeTab.value === 'line-monitor' ? 'line' : 'area'));

const topBarTabs = computed(() => {
	const source = monitorType.value === 'line' ? lineCounts.value : counts.value;
	return [
		{ id: 'pending-verify', label: '待核查', count: source.pendingCheckCount },
		{ id: 'pending-dispose', label: '待处置', count: source.pendingDisposalCount }
	];
});

const {
	visible: featureDetailVisible,
	detail: featureDetail,
	loading: featureDetailLoading,
	handleFeatureClick
} = useFeatureDetail({
	onBeforeOpen: () => {
		featureDetailTransitionVisible.value = true;
		patchListSnapBeforeDetail.value = patchListSnap.value;
		patchListSnap.value = 'collapsed';
	}
});

const { refreshMonitorData, handleFilterChange } = useMonitorRefresh({
	activeTab,
	isMonitorTab,
	headerTab,
	searchKeyword,
	lineQuery,
	appliedFilters,
	patchListSnap,
	loadTaskListCount,
	loadLineTaskListCount,
	loadTaskList,
	loadLineTaskList
});

const { showToast } = useAppToast();

const {
	visible: verifyFormVisible,
	detail: verifyDetail,
	handleStartVerify,
	handleVerifyBack,
	handleVerifySuccess
} = useVerifyFlow({ featureDetailVisible, refreshMonitorData });

const patchListDockVisible = computed(
	() =>
		isMonitorTab.value &&
		!isClearScreen.value &&
		!verifyFormVisible.value &&
		!featureDetailTransitionVisible.value
);

function onVerifySuccess(payload) {
	showToast(payload?.successMessage || '提交成功', 'success');
	handleVerifySuccess();
}

async function refreshVerifyDetailAfterCorrect(payload) {
	const kind = payload?.kind || verifyDetail.value?.kind;
	const id = payload?.detailId ?? verifyDetail.value?.id;
	if (!id || (kind !== 'area' && kind !== 'line')) {
		return;
	}

	try {
		const data =
			kind === 'line'
				? await fetchAbnormalMonitorDetail(id)
				: await fetchAbnormalSurfaceDetail(id);
		const normalized =
			kind === 'line'
				? normalizeAbnormalMonitorDetail(data)
				: normalizeAbnormalSurfaceDetail(data);
		if (!normalized) {
			return;
		}
		if (verifyDetail.value) {
			verifyDetail.value = {
				...verifyDetail.value,
				...normalized
			};
		}
		if (featureDetail.value?.id != null && String(featureDetail.value.id) === String(id)) {
			featureDetail.value = {
				...featureDetail.value,
				...normalized
			};
		}
	} catch (error) {
		console.warn('[MapLayout] refresh verify detail after correct failed', error);
	}
}

function onCorrectSuccess(payload) {
	showToast(payload?.successMessage || '改正成功', 'success');
	refreshMonitorData();
	refreshVerifyDetailAfterCorrect(payload);
}

watch(
	() => bottomBarVisible.value,
	(barVisible) => {
		globalTabBar.visible.value = barVisible;
	},
	{ immediate: true }
);

function handleFilterOpen(open) {
	filterPanelOpen.value = open;
	if (open && patchListSnap.value !== 'collapsed') {
		patchListSnap.value = 'collapsed';
	}
}

watch(patchListSnap, (snap) => {
	// 列表展开时若筛选仍开着，只关筛选，不要反向把列表压回去
	if ((snap === 'peek' || snap === 'expanded') && filterPanelOpen.value) {
		filterPanelOpen.value = false;
		mapTopBarRef.value?.closeFilter();
	}
});

function handleFeatureDetailClose() {
	featureDetailTransitionVisible.value = false;

	if (!isMonitorTab.value || isClearScreen.value || verifyFormVisible.value) {
		return;
	}

	const nextSnap =
		patchListSnapBeforeDetail.value === 'expanded' ? 'peek' : patchListSnapBeforeDetail.value;
	patchListSnap.value = nextSnap;
}

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
	playMapShellInitialEnter();
	mapLoaded.value = true;
}

onMounted(() => {
	preloadWatermarkFont();
});

useMapEvent(MapEventType.FEATURE_CLICK, handleFeatureClick);

onBeforeUnmount(() => {
	dispose();
	mapUiOverlay.dispose();
	disposeMapShellMotions();
});
</script>

<template>
	<main
		class="map-page"
		:class="{
			'map-page--clear-screen': isClearScreen,
			'map-page--line-query': monitorType === 'line'
		}"
	>
		<MapContainer>
			<MonitorMockGraphics v-if="mapLoaded" :active-tab="activeTab" />

			<Mars2dMap
				:map-options="mapOptions"
				:use-global-map="true"
				loading-text="数界一张图加载中..."
				@map-ready="handleMapReady"
				@map-loaded="handleMapLoaded"
			/>

			<MapTopBar
				ref="mapTopBarRef"
				v-model="headerTab"
				v-model:search-text="searchKeyword"
				v-model:line-query="lineQuery"
				:filters="appliedFilters"
				:tabs="topBarTabs"
				:monitor-type="monitorType"
				:visible="topBarVisible"
				:motion-class="topBarMotionClass"
				@filter-change="handleFilterChange"
				@filter-open="handleFilterOpen"
			/>

			<MapControlPanel
				:visible="sideMenuVisible"
				:motion-class="sideMenuMotionClass"
				@clear-screen="enterClearScreen"
			/>

			<MapFeatureDetailSheet
				v-model:visible="featureDetailVisible"
				:detail="featureDetail"
				:loading="featureDetailLoading"
				@close="handleFeatureDetailClose"
				@start-verify="handleStartVerify"
			/>

			<MapVerifyFormSheet
				v-model:visible="verifyFormVisible"
				:detail="verifyDetail"
				@back="handleVerifyBack"
				@success="onVerifySuccess"
				@correct-success="onCorrectSuccess"
			/>

			<MapPatchListSheet
				v-model:visible="patchListDockVisible"
				v-model:snap="patchListSnap"
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
	height: 100%;
	overflow: hidden;
	--map-top-bar-height: calc(96px + env(safe-area-inset-top, 0px));

	&.map-page--line-query {
		--map-top-bar-height: calc(132px + env(safe-area-inset-top, 0px));
	}
}
</style>
