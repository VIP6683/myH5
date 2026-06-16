<script setup>
import { onBeforeUnmount, ref, watch } from 'vue';
import { usePopupLayer } from '../../../composables/usePopupLayer.js';

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

const rendered = ref(false);
const animClass = ref('');
const popupLayer = usePopupLayer();

let leaveTimer = null;

const clearLeaveTimer = () => {
	if (leaveTimer) {
		clearTimeout(leaveTimer);
		leaveTimer = null;
	}
};

const playEnter = () => {
	clearLeaveTimer();
	rendered.value = true;
	animClass.value = '';
	popupLayer.acquire();
	requestAnimationFrame(() => {
		animClass.value = 'mine-confirm-dialog--enter';
	});
};

const playLeave = (onDone) => {
	clearLeaveTimer();
	animClass.value = 'mine-confirm-dialog--leave';
	leaveTimer = setTimeout(() => {
		rendered.value = false;
		animClass.value = '';
		popupLayer.release();
		leaveTimer = null;
		emit('close');
		onDone?.();
	}, 220);
};

const onConfirm = () => {
	visible.value = false;
	emit('confirm');
};

const onCancel = () => {
	visible.value = false;
	emit('cancel');
};

watch(visible, (open) => {
	if (open) {
		playEnter();
		return;
	}
	if (rendered.value) {
		playLeave();
	}
});

onBeforeUnmount(() => {
	clearLeaveTimer();
	popupLayer.release();
});
</script>

<template>
	<Teleport to="body">
		<div
			v-if="rendered"
			class="mine-confirm-dialog"
			:class="animClass"
			role="dialog"
			aria-modal="true"
			:aria-label="title"
		>
			<div class="mine-confirm-dialog__shade" @click="onCancel" />

			<div class="mine-confirm-dialog__panel">
				<h3 class="mine-confirm-dialog__title">{{ title }}</h3>
				<p class="mine-confirm-dialog__message">{{ message }}</p>

				<div class="mine-confirm-dialog__actions">
					<button
						type="button"
						class="mine-confirm-dialog__btn is-muted"
						@click="onCancel"
					>
						{{ cancelText }}
					</button>
					<button
						type="button"
						class="mine-confirm-dialog__btn is-primary"
						@click="onConfirm"
					>
						{{ confirmText }}
					</button>
				</div>
			</div>
		</div>
	</Teleport>
</template>

<style scoped lang="scss">
.mine-confirm-dialog {
	position: fixed;
	inset: 0;
	z-index: 2100;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 24px;
}

.mine-confirm-dialog__shade {
	position: absolute;
	inset: 0;
	background: rgba(0, 0, 0, 0.55);
	opacity: 0;
	transition: opacity 0.22s ease;
}

.mine-confirm-dialog__panel {
	position: relative;
	z-index: 1;
	box-sizing: border-box;
	width: min(300px, 86vw);
	padding: 20px 18px 16px;
	border-radius: 12px;
	background: #1c1c1e;
	box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
	opacity: 0;
	transform: scale(0.94);
	transition:
		opacity 0.22s ease,
		transform 0.22s ease;
}

.mine-confirm-dialog--enter .mine-confirm-dialog__shade {
	opacity: 1;
}

.mine-confirm-dialog--enter .mine-confirm-dialog__panel {
	opacity: 1;
	transform: scale(1);
}

.mine-confirm-dialog--leave .mine-confirm-dialog__shade {
	opacity: 0;
}

.mine-confirm-dialog--leave .mine-confirm-dialog__panel {
	opacity: 0;
	transform: scale(0.94);
}

.mine-confirm-dialog__title {
	margin: 0 0 10px;
	font-size: 17px;
	font-weight: 600;
	line-height: 1.35;
	color: #fff;
	text-align: center;
}

.mine-confirm-dialog__message {
	margin: 0 0 18px;
	font-size: 14px;
	line-height: 1.6;
	color: rgba(255, 255, 255, 0.65);
	text-align: center;
}

.mine-confirm-dialog__actions {
	display: flex;
	gap: 10px;
}

.mine-confirm-dialog__btn {
	flex: 1;
	height: 40px;
	border: 0;
	border-radius: 8px;
	font-size: 15px;
	font-weight: 500;
	line-height: 1;
	cursor: pointer;
}

.mine-confirm-dialog__btn.is-muted {
	background: rgba(255, 255, 255, 0.1);
	color: rgba(255, 255, 255, 0.85);
}

.mine-confirm-dialog__btn.is-primary {
	background: #1cded4;
	color: #0a0a0a;
}
</style>
