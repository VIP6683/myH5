<script setup>
import exitIcon from '../../../assets/images/profile/exit.svg';

defineProps({
	motionClass: {
		type: String,
		default: ''
	},
	visible: {
		type: Boolean,
		default: false
	}
});

const emit = defineEmits(['click']);
</script>

<template>
	<button
		v-show="visible"
		type="button"
		class="clear-screen-exit-btn"
		:class="motionClass"
		aria-label="退出地图空间"
		@click="emit('click')"
	>
		<img :src="exitIcon" alt="" class="clear-screen-exit-btn__icon" aria-hidden="true" />
		<span class="clear-screen-exit-btn__label">退出</span>
	</button>
</template>

<style scoped lang="scss">
.clear-screen-exit-btn {
	position: fixed;
	left: 16px;
	bottom: 16px;
	z-index: 999;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 2px;
	min-width: 48px;
	padding: 8px 10px;
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 11px;
	background: rgba(20, 22, 26, 0.88);
	box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
	backdrop-filter: blur(8px);
	-webkit-backdrop-filter: blur(8px);
	color: #fff;
	cursor: pointer;
	pointer-events: auto;
	/* 显隐由 v-show 控制；勿设离屏 transform，否则入场动画 class 清除后会立刻缩回屏外 */
	transform: translate3d(0, 0, 0);
	-webkit-tap-highlight-color: transparent;
}

.clear-screen-exit-btn__icon {
	display: block;
	width: 22px;
	height: 22px;
	object-fit: contain;
}

.clear-screen-exit-btn__label {
	font-size: 11px;
	line-height: 1.2;
	white-space: nowrap;
}
</style>
