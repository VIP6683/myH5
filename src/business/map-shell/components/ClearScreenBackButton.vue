<script setup>
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
		class="clear-screen-back-btn"
		:class="motionClass"
		aria-label="退出地图空间"
		@click="emit('click')"
	/>
</template>

<style scoped lang="scss">
.clear-screen-back-btn {
	position: fixed;
	left: 16px;
	bottom: 16px;
	width: 48px;
	height: 48px;
	z-index: 999;
	border: 0;
	border-radius: 11px;
	padding: 0;
	cursor: pointer;
	pointer-events: auto;
	/* 显隐由 v-show 控制；勿设离屏 transform，否则入场动画 class 清除后会立刻缩回屏外 */
	transform: translate3d(0, 0, 0);
	background: rgba(255, 255, 255, 0.8) url('/map-ui/clearScreenBack.png') no-repeat center center;
	background-size: 80% 80%;
	-webkit-tap-highlight-color: transparent;
}
</style>
