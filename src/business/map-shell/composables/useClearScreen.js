import { ref } from 'vue';

/**
 * 地图清屏（地图空间）模式：隐藏侧栏/顶底栏，仅保留地图与返回按钮
 * 动效时序对齐原站 clearScreen / closeClearScreen
 */
export function useClearScreen(motions = {}) {
	const isClearScreen = ref(false);
	const backButtonDelay = motions.backButtonDelay ?? 300;

	let backButtonTimer = null;

	const clearBackButtonTimer = () => {
		if (backButtonTimer) {
			clearTimeout(backButtonTimer);
			backButtonTimer = null;
		}
	};

	const enterClearScreen = () => {
		if (isClearScreen.value) return;
		isClearScreen.value = true;
		clearBackButtonTimer();

		motions.sideMenu?.playExit();
		motions.topBar?.playExit();
		motions.bottomBar?.playExit();

		backButtonTimer = setTimeout(() => {
			motions.backButton?.playEnter();
			backButtonTimer = null;
		}, backButtonDelay);
	};

	const exitClearScreen = () => {
		if (!isClearScreen.value) return;
		isClearScreen.value = false;
		clearBackButtonTimer();

		motions.sideMenu?.playEnter();
		motions.topBar?.playEnter();
		motions.bottomBar?.playEnter();
		motions.backButton?.playExit();
	};

	const dispose = () => clearBackButtonTimer();

	return {
		isClearScreen,
		enterClearScreen,
		exitClearScreen,
		dispose
	};
}
