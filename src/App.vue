<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterView, useRoute } from 'vue-router';
import LoginPage from './pages/LoginPage.vue';
import MapFloatingTabBar from './business/map-shell/components/MapFloatingTabBar.vue';
import { useGlobalTabBar } from './business/map-shell/composables/useGlobalTabBar.js';
import { installVisualViewportCssVars } from './composables/useVisualViewportCssVars.js';
import { resetScrollLock } from './composables/useScrollLock.js';
import { useAuthSession } from './composables/useAuthSession.js';
import MobileDebugButton from './components/debug/MobileDebugButton.vue';

const { loggedIn, markLoggedIn } = useAuthSession();
const route = useRoute();
const globalTabBar = useGlobalTabBar();
let disposeVisualViewport = null;

const isMapRoute = computed(() => route.matched.some((record) => record.meta.layout === 'map'));

const tabBarVisible = computed(() => (isMapRoute.value ? globalTabBar.visible.value : true));
const tabBarMotionClass = computed(() => (isMapRoute.value ? globalTabBar.motionClass.value : ''));

function syncViewMode(isMapView) {
	document.body.classList.toggle('is-map-view', isMapView);
	document.body.classList.toggle('is-login-view', !loggedIn.value);
}

watch(
	[loggedIn, isMapRoute],
	([authed, mapView]) => {
		if (!authed) {
			document.body.classList.remove('is-map-view');
			document.body.classList.add('is-login-view');
			return;
		}
		syncViewMode(mapView);
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
	resetScrollLock();
	document.body.classList.remove('is-map-view', 'is-login-view');
});
</script>

<template>
	<LoginPage v-if="!loggedIn" @success="handleLoginSuccess" />
	<div v-else class="app-shell">
		<RouterView v-slot="{ Component }">
			<KeepAlive :include="['MapLayout']">
				<component :is="Component" />
			</KeepAlive>
		</RouterView>
		<MapFloatingTabBar
			:visible="tabBarVisible"
			:motion-class="tabBarMotionClass"
		/>
	</div>
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
	position: relative;
	width: 100%;
	height: var(--app-vv-height, 100dvh);
	max-height: var(--app-vv-height, 100dvh);
	overflow: hidden;
}
</style>
