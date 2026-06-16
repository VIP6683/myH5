import { computed, ref } from 'vue';
import { lockMapSurface, resetMapSurfaceLock, unlockMapSurface } from './mapSurfaceLock.js';

export const MAP_UI_OVERLAY_KEY = Symbol('mapUiOverlay');

/**
 * 弹框打开时隐藏地图浮层控件（对齐原站 showWin → clearScreen）
 * 关闭弹框后恢复；支持多层弹框引用计数；清屏模式下关闭弹框不自动恢复控件
 */
export function useMapUiOverlay(motions = {}, options = {}) {
	const depth = ref(0);
	const isOverlay = computed(() => depth.value > 0);
	const isClearScreen = options.isClearScreen;

	const hideControls = () => {
		motions.sideMenu?.playExit();
		motions.topBar?.playExit();
		motions.bottomBar?.playExit();
	};

	const showControls = () => {
		if (isClearScreen?.value) return;
		motions.sideMenu?.playEnter();
		motions.topBar?.playEnter();
		motions.bottomBar?.playEnter();
	};

	const enterOverlay = () => {
		if (depth.value === 0) {
			hideControls();
			lockMapSurface();
		}
		depth.value += 1;
	};

	const exitOverlay = () => {
		if (depth.value <= 0) return;
		depth.value -= 1;
		if (depth.value === 0) {
			unlockMapSurface();
			showControls();
		}
	};

	const dispose = () => {
		while (depth.value > 0) {
			exitOverlay();
		}
		resetMapSurfaceLock();
	};

	return {
		depth,
		isOverlay,
		enterOverlay,
		exitOverlay,
		dispose
	};
}
