import { nextTick, ref } from 'vue';

const PANEL_ENTER = 'map-modal__panel--enter';
const PANEL_LEAVE = 'map-modal__panel--leave';
const ENTER_MS = 300;
const LEAVE_MS = 200;

/** 地图弹框通用进出场动画状态 */
export function useMapModalAnim() {
	const rendered = ref(false);
	const panelAnimClass = ref('');
	let leaveTimer = null;

	const clearLeaveTimer = () => {
		if (leaveTimer) {
			clearTimeout(leaveTimer);
			leaveTimer = null;
		}
	};

	const playEnter = async () => {
		clearLeaveTimer();
		rendered.value = true;
		panelAnimClass.value = '';
		await nextTick();
		panelAnimClass.value = PANEL_ENTER;
		leaveTimer = setTimeout(() => {
			if (rendered.value) {
				panelAnimClass.value = '';
			}
			leaveTimer = null;
		}, ENTER_MS);
	};

	const playLeave = (onDone) => {
		clearLeaveTimer();
		panelAnimClass.value = PANEL_LEAVE;
		leaveTimer = setTimeout(() => {
			rendered.value = false;
			panelAnimClass.value = '';
			leaveTimer = null;
			onDone?.();
		}, LEAVE_MS);
	};

	const dispose = () => {
		clearLeaveTimer();
		rendered.value = false;
		panelAnimClass.value = '';
	};

	return {
		rendered,
		panelAnimClass,
		playEnter,
		playLeave,
		dispose
	};
}
