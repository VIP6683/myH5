<script setup>
import { onMounted, ref } from 'vue';
import {
	isMobileDebugEnabled,
	isMobileDebugPanelVisible,
	openMobileDebugConsole,
	toggleMobileDebugConsole
} from '../../utils/mobileDebugConsole.js';

const visible = ref(false);
const panelOpen = ref(false);

const syncPanelState = () => {
	panelOpen.value = isMobileDebugPanelVisible();
};

const onToggle = async () => {
	const opened = await toggleMobileDebugConsole();
	panelOpen.value = opened;
};

onMounted(() => {
	visible.value = isMobileDebugEnabled();
	syncPanelState();
});
</script>

<template>
	<button
		v-if="visible"
		type="button"
		class="mobile-debug-btn"
		:class="{ 'is-active': panelOpen }"
		aria-label="打开调试控制台"
		@click="onToggle"
		@dblclick.prevent="openMobileDebugConsole().then(syncPanelState)"
	>
		DBG
	</button>
</template>

<style scoped lang="scss">
.mobile-debug-btn {
	position: fixed;
	left: 10px;
	bottom: calc(72px + env(safe-area-inset-bottom, 0px));
	z-index: 10001;
	display: flex;
	align-items: center;
	justify-content: center;
	min-width: 40px;
	height: 28px;
	padding: 0 10px;
	border: 1px solid rgba(255, 255, 255, 0.16);
	border-radius: 999px;
	background: rgba(20, 22, 26, 0.9);
	backdrop-filter: blur(8px);
	-webkit-backdrop-filter: blur(8px);
	color: rgba(255, 255, 255, 0.82);
	font-size: 11px;
	font-weight: 700;
	letter-spacing: 0.06em;
	line-height: 1;
	cursor: pointer;
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
	-webkit-tap-highlight-color: transparent;
	transition:
		background 0.15s ease,
		color 0.15s ease,
		border-color 0.15s ease,
		transform 0.1s ease;

	&:active {
		transform: scale(0.96);
	}

	&.is-active {
		background: rgba(45, 212, 191, 0.18);
		border-color: rgba(45, 212, 191, 0.45);
		color: var(--app-accent, #1cded4);
	}
}
</style>
