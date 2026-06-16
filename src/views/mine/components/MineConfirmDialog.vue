<script setup>
import MapConfirmModal from '../../../business/map-shell/components/MapConfirmModal.vue';

const visible = defineModel('visible', { type: Boolean, default: false });

defineProps({
	title: {
		type: String,
		default: '提示'
	},
	message: {
		type: String,
		default: ''
	},
	confirmText: {
		type: String,
		default: '确认'
	},
	cancelText: {
		type: String,
		default: '取消'
	}
});

const emit = defineEmits(['confirm', 'cancel', 'close']);

const onConfirm = () => {
	emit('confirm');
};

const onCancel = () => {
	emit('cancel');
};

const onClose = () => {
	emit('close');
};
</script>

<template>
	<MapConfirmModal
		v-model:visible="visible"
		:title="title"
		:message="message"
		:confirm-text="confirmText"
		:cancel-text="cancelText"
		:hide-map-ui="false"
		:z-index="2100"
		@confirm="onConfirm"
		@cancel="onCancel"
		@close="onClose"
	/>
</template>
