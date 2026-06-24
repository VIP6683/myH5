import { ref } from 'vue';

const toast = ref({ visible: false, text: '', type: 'info' });
let hideTimer = null;

export function useAppToast() {
	function showToast(text, type = 'info', duration = 2000) {
		if (hideTimer) {
			clearTimeout(hideTimer);
			hideTimer = null;
		}

		toast.value = { visible: true, text, type };
		hideTimer = setTimeout(() => {
			toast.value = { ...toast.value, visible: false };
			hideTimer = null;
		}, duration);
	}

	return {
		toast,
		showToast
	};
}
