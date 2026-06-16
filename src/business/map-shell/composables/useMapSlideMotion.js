import { ref } from 'vue';

/** 出场/离场方向与动画 class 映射 */
export const MAP_SLIDE_MOTION = {
	right: {
		enter: 'map-slide--in-right',
		exit: 'map-slide--out-right',
		// 首次入场不做横向位移动画，避免控件被 translate 推出视口
		initial: ''
	},
	top: {
		enter: 'map-slide--in-top',
		exit: 'map-slide--out-top',
		// 顶栏首次入场：从视口上方滑入（inTop），勿用 fadeInTop（从下往上）
		initial: 'map-slide--in-top'
	},
	bottom: {
		enter: 'map-slide--in-bottom',
		exit: 'map-slide--out-bottom',
		// 底栏首次入场：从视口下方滑入（inBottom），对齐原站 buttomBut.fadeInTop 方向
		initial: 'map-slide--in-bottom'
	},
	left: {
		enter: 'map-slide--in-left',
		exit: 'map-slide--out-left',
		initial: 'map-slide--fade-in-left'
	}
};

/**
 * 管理单个浮层的进出场动画状态（Vue 版，替代 jQuery addClass）
 */
const MOTION_ENTER_DURATIONS = {
	'map-slide--fade-in-right': 500,
	'map-slide--fade-in-top': 500,
	'map-slide--fade-in-bottom': 500,
	'map-slide--fade-in-left': 500,
	'map-slide--in-right': 200,
	'map-slide--in-top': 200,
	'map-slide--in-bottom': 200,
	'map-slide--in-left': 200
};

export function useMapSlideMotion(direction = 'right', options = {}) {
	const exitDuration = options.exitDuration ?? 300;
	const visible = ref(false);
	const motionClass = ref('');

	const config = MAP_SLIDE_MOTION[direction] || MAP_SLIDE_MOTION.right;
	let exitTimer = null;
	let enterTimer = null;

	const clearExitTimer = () => {
		if (exitTimer) {
			clearTimeout(exitTimer);
			exitTimer = null;
		}
	};

	const clearEnterTimer = () => {
		if (enterTimer) {
			clearTimeout(enterTimer);
			enterTimer = null;
		}
	};

	const scheduleEnterReset = (className) => {
		clearEnterTimer();
		const duration = MOTION_ENTER_DURATIONS[className] ?? 500;
		enterTimer = setTimeout(() => {
			if (motionClass.value === className) {
				motionClass.value = '';
			}
			enterTimer = null;
		}, duration);
	};

	/** 首次入场（页面加载后） */
	const playInitialEnter = () => {
		clearExitTimer();
		visible.value = true;
		if (config.initial) {
			motionClass.value = config.initial;
			scheduleEnterReset(config.initial);
		} else {
			motionClass.value = '';
		}
	};

	/** 再次入场（清屏恢复） */
	const playEnter = () => {
		clearExitTimer();
		visible.value = true;
		motionClass.value = config.enter;
		scheduleEnterReset(config.enter);
	};

	/** 离场 */
	const playExit = () => {
		clearExitTimer();
		motionClass.value = config.exit;
		exitTimer = setTimeout(() => {
			visible.value = false;
			motionClass.value = '';
			exitTimer = null;
		}, exitDuration);
	};

	/** 离场但保持挂载（用于清屏返回按钮等常驻节点） */
	const playExitVisible = () => {
		clearExitTimer();
		motionClass.value = config.exit;
	};

	const dispose = () => {
		clearExitTimer();
		clearEnterTimer();
	};

	return {
		visible,
		motionClass,
		playInitialEnter,
		playEnter,
		playExit,
		playExitVisible,
		dispose
	};
}
