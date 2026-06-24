import { ref } from 'vue';

/**
 * 核查 / 处置表单流程与详情弹层联动
 */
export function useVerifyFlow({ featureDetailVisible, refreshMonitorData }) {
	const visible = ref(false);
	const detail = ref(null);

	function handleStartVerify(featureDetail) {
		detail.value = featureDetail;
		visible.value = true;
		featureDetailVisible.value = false;
	}

	function handleVerifyBack() {
		featureDetailVisible.value = true;
	}

	function handleVerifySuccess() {
		visible.value = false;
		featureDetailVisible.value = false;
		detail.value = null;
		refreshMonitorData();
	}

	return {
		visible,
		detail,
		handleStartVerify,
		handleVerifyBack,
		handleVerifySuccess
	};
}
