<script setup>
import { inject, onBeforeUnmount, watch } from 'vue';
import { useMapModalAnim } from '../composables/useMapModalAnim.js';
import { MAP_UI_OVERLAY_KEY } from '../composables/useMapUiOverlay.js';
import '../styles/map-modal-animations.scss';

const visible = defineModel('visible', { type: Boolean, default: false });

const props = defineProps({
	ariaLabel: {
		type: String,
		default: '弹框'
	},
	panelClass: {
		type: String,
		default: ''
	},
	shadeOpacity: {
		type: Number,
		default: 0.3
	},
	hideMapUi: {
		type: Boolean,
		default: true
	},
	closeOnShade: {
		type: Boolean,
		default: true
	}
});

const emit = defineEmits(['close', 'after-close']);

const mapUiOverlay = inject(MAP_UI_OVERLAY_KEY, null);
const { rendered, panelAnimClass, playEnter, playLeave, dispose } = useMapModalAnim();

const onShadeClick = () => {
	if (props.closeOnShade) {
		visible.value = false;
	}
};

watch(visible, (open) => {
	if (open) {
		if (props.hideMapUi) {
			mapUiOverlay?.enterOverlay();
		}
		playEnter();
		return;
	}
	if (!rendered.value) return;
	emit('close');
	playLeave(() => {
		if (props.hideMapUi) {
			mapUiOverlay?.exitOverlay();
		}
		emit('after-close');
	});
});

onBeforeUnmount(() => {
	dispose();
});
</script>

<template>
	<Teleport to="body">
		<div v-if="rendered" class="map-modal">
			<div
				class="map-modal__shade"
				:style="{ backgroundColor: '#000', opacity: shadeOpacity }"
				@click="onShadeClick"
			/>

			<div
				class="map-modal__panel"
				:class="[panelClass, panelAnimClass]"
				role="dialog"
				aria-modal="true"
				:aria-label="ariaLabel"
			>
				<slot />
			</div>
		</div>
	</Teleport>
</template>

<style scoped lang="scss">
.map-modal {
	position: fixed;
	inset: 0;
	z-index: 2000;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 6px;
	pointer-events: none;
	overscroll-behavior: contain;
}

.map-modal__shade {
	position: absolute;
	inset: 0;
	pointer-events: auto;
}

.map-modal__panel {
	position: relative;
	z-index: 1;
	pointer-events: auto;
	overflow: visible;
}
</style>
