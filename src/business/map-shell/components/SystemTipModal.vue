<script setup>
import MapModalShell from './MapModalShell.vue';

const visible = defineModel('visible', { type: Boolean, default: false });

defineProps({
	title: {
		type: String,
		default: '系统提示'
	},
	message: {
		type: String,
		default: ''
	},
	confirmText: {
		type: String,
		default: '好的'
	}
});

const emit = defineEmits(['confirm', 'close']);

const handleClose = () => {
	visible.value = false;
	emit('close');
};

const handleConfirm = () => {
	emit('confirm');
	visible.value = false;
};
</script>

<template>
	<MapModalShell
		v-model:visible="visible"
		aria-label="系统提示"
		panel-class="system-tip-modal"
		:shade-opacity="0.45"
		:close-on-shade="false"
		@close="emit('close')"
	>
		<div class="map-modal-card map-modal-card--decorated">
			<button type="button" class="map-modal-card__close" aria-label="关闭" @click="handleClose">
				<span>×</span>
			</button>

			<h3 class="map-modal-card__title">{{ title }}</h3>

			<div class="map-modal-card__content" v-html="message" />

			<div class="map-modal-card__actions">
				<button type="button" class="map-modal-card__btn" @click="handleConfirm">
					{{ confirmText }}
				</button>
			</div>
		</div>
	</MapModalShell>
</template>
