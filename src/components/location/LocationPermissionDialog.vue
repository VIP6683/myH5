<script setup>
import { computed } from 'vue';
import MapConfirmModal from '../../business/map-shell/components/MapConfirmModal.vue';

const visible = defineModel('visible', { type: Boolean, default: false });

const props = defineProps({
	mode: {
		type: String,
		default: 'request',
		validator: (value) => ['request', 'denied', 'error', 'orientationDenied'].includes(value)
	},
	errorMessage: {
		type: String,
		default: ''
	}
});

const emit = defineEmits(['confirm', 'cancel', 'close']);

const dialogCopy = computed(() => {
	if (props.mode === 'denied') {
		return {
			title: '定位权限已关闭',
			desc: '请前往浏览器设置开启位置权限，否则无法获取当前位置。',
			showCancel: false,
			confirmText: '知道了'
		};
	}

	if (props.mode === 'error') {
		return {
			title: '定位失败',
			desc: props.errorMessage || '当前位置获取失败，请稍后重试',
			showCancel: false,
			confirmText: '知道了'
		};
	}

	if (props.mode === 'orientationDenied') {
		return {
			title: '指南针权限未开启',
			desc: '请在系统或浏览器设置中开启“运动与方向访问”，否则定位方向可能不准确。',
			showCancel: false,
			confirmText: '知道了'
		};
	}

	return {
		title: '获取当前位置',
		desc: [
			'为了快速定位您的位置、提供导航及地图相关功能，',
			'需要获取您的当前位置信息。',
			'我们仅在您主动使用定位功能时获取位置，',
			'不会持续追踪您的位置。'
		].join('\n'),
		showCancel: true,
		confirmText: '立即授权'
	};
});
</script>

<template>
	<MapConfirmModal
		v-model:visible="visible"
		:title="dialogCopy.title"
		:message="dialogCopy.desc"
		:show-cancel="dialogCopy.showCancel"
		:confirm-text="dialogCopy.confirmText"
		:close-on-shade="false"
		:z-index="3200"
		@confirm="emit('confirm')"
		@cancel="emit('cancel')"
		@close="emit('close')"
	/>
</template>
