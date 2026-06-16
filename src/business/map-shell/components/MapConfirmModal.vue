<script setup>
import MapModalShell from './MapModalShell.vue';

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
	},
	showCancel: {
		type: Boolean,
		default: true
	},
	closeOnShade: {
		type: Boolean,
		default: true
	},
	hideMapUi: {
		type: Boolean,
		default: true
	},
	zIndex: {
		type: Number,
		default: 2000
	}
});

const emit = defineEmits(['confirm', 'cancel', 'close']);

const handleClose = () => {
	visible.value = false;
};

const onCancel = () => {
	visible.value = false;
	emit('cancel');
};

const onConfirm = () => {
	visible.value = false;
	emit('confirm');
};
</script>

<template>
	<MapModalShell
		v-model:visible="visible"
		:aria-label="title"
		:close-on-shade="closeOnShade"
		:hide-map-ui="hideMapUi"
		:z-index="zIndex"
		@close="emit('close')"
	>
		<div class="map-modal-card">
			<button type="button" class="map-modal-card__close" aria-label="关闭" @click="handleClose">
				<span>×</span>
			</button>

			<h3 class="map-modal-card__title">{{ title }}</h3>

			<div class="map-modal-card__content">{{ message }}</div>

			<div class="map-modal-card__actions map-modal-card__actions--split">
				<button
					v-if="showCancel"
					type="button"
					class="map-modal-card__btn map-modal-card__btn--secondary"
					@click="onCancel"
				>
					{{ cancelText }}
				</button>
				<button
					type="button"
					class="map-modal-card__btn map-modal-card__btn--primary"
					:class="{ 'map-modal-card__btn--full': !showCancel }"
					@click="onConfirm"
				>
					{{ confirmText }}
				</button>
			</div>
		</div>
	</MapModalShell>
</template>
