<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterView, useRoute } from 'vue-router';
import LoginPage from './views/login/index.vue';
import MapFloatingTabBar from './business/map-shell/components/MapFloatingTabBar.vue';
import { useGlobalTabBar } from './business/map-shell/composables/useGlobalTabBar.js';
import { installVisualViewportCssVars } from './composables/useVisualViewportCssVars.js';
import { lockScroll, resetScrollLock, unlockScroll } from './composables/useScrollLock.js';
import { useMonitorAccess } from './composables/useMonitorAccess.js';
import { loggedIn, useAuthSession } from './composables/useAuthSession.js';
import { useLineTaskListCount } from './composables/useLineTaskListCount.js';
import { useTaskListCount } from './composables/useTaskListCount.js';
import { resolveDefaultMonitorFilters } from './business/map-shell/utils/monitorFilters.js';
import AppToast from './components/AppToast.vue';
import MobileDebugButton from './components/debug/MobileDebugButton.vue';

const { markLoggedIn } = useAuthSession();
const { hasAreaMonitor, hasLineMonitor } = useMonitorAccess();
const { counts, loadTaskListCount, resetTaskListCount } = useTaskListCount();
const { counts: lineCounts, loadLineTaskListCount, resetLineTaskListCount } =
	useLineTaskListCount();
const route = useRoute();
const globalTabBar = useGlobalTabBar();
let disposeVisualViewport = null;
let mapScrollLockHeld = false;

const isMapRoute = computed(() => route.matched.some((record) => record.meta.layout === 'map'));

const tabBarVisible = computed(() => (isMapRoute.value ? globalTabBar.visible.value : true));
const tabBarMotionClass = computed(() => (isMapRoute.value ? globalTabBar.motionClass.value : ''));

const tabBarTabs = computed(() => {
	const areaPending = counts.value.totalPendingCount;
	const linePending = lineCounts.value.totalPendingCount;
	const tabs = [{ id: 'stats', label: '数据统计', icon: 'stats' }];

	if (hasAreaMonitor.value) {
		tabs.push({
			id: 'area-monitor',
			label: '面状监测',
			icon: 'area',
			badge: areaPending > 0 ? areaPending : undefined
		});
	}

	if (hasLineMonitor.value) {
		tabs.push({
			id: 'line-monitor',
			label: '线状监测',
			icon: 'line',
			badge: linePending > 0 ? linePending : undefined
		});
	}

	tabs.push({ id: 'mine', label: '我的', icon: 'mine' });
	return tabs;
});

async function refreshTaskListCount() {
	const tasks = [];

	if (hasAreaMonitor.value) {
		tasks.push(
			resolveDefaultMonitorFilters('area').then((filters) => loadTaskListCount(filters))
		);
	}

	if (hasLineMonitor.value) {
		tasks.push(
			resolveDefaultMonitorFilters('line').then((filters) => loadLineTaskListCount(filters))
		);
	}

	if (!tasks.length) {
		return;
	}

	try {
		await Promise.allSettled(tasks);
	} catch {
		// 角标加载失败时保持默认值
	}
}

function syncViewMode(isMapView) {
	document.body.classList.toggle('is-map-view', isMapView);
	document.body.classList.toggle('is-login-view', !loggedIn.value);
}

function syncMapScrollLock(mapView, authed) {
	const shouldLock = authed && mapView;

	if (shouldLock && !mapScrollLockHeld) {
		lockScroll();
		mapScrollLockHeld = true;
		return;
	}

	if (!shouldLock && mapScrollLockHeld) {
		unlockScroll();
		mapScrollLockHeld = false;
	}
}

watch(
	[loggedIn, isMapRoute],
	([authed, mapView]) => {
		if (!authed) {
			resetTaskListCount();
			resetLineTaskListCount();
			document.body.classList.remove('is-map-view');
			document.body.classList.add('is-login-view');
			syncMapScrollLock(false, false);
			return;
		}
		if (!hasAreaMonitor.value) {
			resetTaskListCount();
		}
		if (!hasLineMonitor.value) {
			resetLineTaskListCount();
		}
		refreshTaskListCount().catch(() => {});
		syncViewMode(mapView);
		syncMapScrollLock(mapView, authed);
	},
	{ immediate: true }
);

function handleLoginSuccess() {
	markLoggedIn();
}

onMounted(() => {
	disposeVisualViewport = installVisualViewportCssVars();
});

onBeforeUnmount(() => {
	disposeVisualViewport?.();
	mapScrollLockHeld = false;
	resetScrollLock();
	document.body.classList.remove('is-map-view', 'is-login-view');
});
</script>

<template>
	<LoginPage v-if="!loggedIn" @success="handleLoginSuccess" />
	<div v-else class="app-shell">
		<div id="app-content" class="app-content">
			<RouterView v-slot="{ Component }">
				<KeepAlive :include="['MapLayout']">
					<component :is="Component" />
				</KeepAlive>
			</RouterView>
		</div>
		<MapFloatingTabBar
			v-show="tabBarVisible"
			:tabs="tabBarTabs"
			:visible="tabBarVisible"
			:motion-class="tabBarMotionClass"
		/>
	</div>
	<AppToast />
	<MobileDebugButton />
</template>

<style>
#app {
	width: 100%;
	height: var(--app-vv-height, 100dvh);
	max-height: var(--app-vv-height, 100dvh);
	overflow: hidden;
}

.app-shell {
	display: flex;
	flex-direction: column;
	width: 100%;
	height: var(--app-vv-height, 100dvh);
	max-height: var(--app-vv-height, 100dvh);
	overflow: hidden;
	background: var(--tabbar-bg, #000);
}

.app-content {
	position: relative;
	flex: 1;
	min-height: 0;
	width: 100%;
	overflow: hidden;
}
</style>
