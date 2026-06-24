<script setup>
import { useAppToast } from '../composables/useAppToast.js';

const { toast } = useAppToast();
</script>

<template>
	<Transition name="app-toast-fade">
		<div
			v-if="toast.visible"
			class="app-toast"
			:class="`app-toast--${toast.type}`"
			role="status"
			aria-live="polite"
		>
			{{ toast.text }}
		</div>
	</Transition>
</template>

<style scoped lang="scss">
.app-toast {
	position: fixed;
	left: 50%;
	top: 50%;
	transform: translate(-50%, -50%);
	z-index: 4000;
	padding: 10px 18px;
	border-radius: 8px;
	background: rgba(25, 35, 53, 0.92);
	color: rgba(255, 255, 255, 0.94);
	font-size: 14px;
	line-height: 1.4;
	white-space: nowrap;
	box-shadow: 0 4px 18px rgba(0, 0, 0, 0.32);
	pointer-events: none;
}

.app-toast--success {
	background: rgba(16, 21, 29, 0.96);
	color: rgba(255, 255, 255, 0.94);
}

.app-toast-fade-enter-active,
.app-toast-fade-leave-active {
	transition: opacity 0.2s ease;
}

.app-toast-fade-enter-from,
.app-toast-fade-leave-to {
	opacity: 0;
}
</style>
