<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { usePopupLayer } from '../../composables/usePopupLayer.js';

const visible = defineModel('visible', { type: Boolean, default: false });

const props = defineProps({
	mode: {
		type: String,
		default: 'request',
		validator: (value) => ['request', 'denied', 'error'].includes(value)
	},
	errorMessage: {
		type: String,
		default: ''
	}
});

const emit = defineEmits(['confirm', 'cancel', 'close']);

const rendered = ref(false);
const animClass = ref('');
const popupLayer = usePopupLayer();

let leaveTimer = null;

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
		animClass.value = 'location-permission-dialog--enter';
	});
};

const playLeave = (onDone) => {
	clearLeaveTimer();
	animClass.value = 'location-permission-dialog--leave';
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
	emit('confirm');
};

const onCancel = () => {
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
			class="location-permission-dialog"
			:class="animClass"
			role="dialog"
			aria-modal="true"
			:aria-label="dialogCopy.title"
		>
			<div class="location-permission-dialog__shade" />

			<div class="location-permission-dialog__panel">
				<div class="location-permission-dialog__icon" aria-hidden="true">
					<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
						<circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.6" />
						<circle cx="12" cy="12" r="2.4" fill="currentColor" />
						<path
							d="M12 3v3M12 18v3M3 12h3M18 12h3"
							stroke="currentColor"
							stroke-width="1.6"
							stroke-linecap="round"
						/>
					</svg>
				</div>

				<h3 class="location-permission-dialog__title">{{ dialogCopy.title }}</h3>
				<p class="location-permission-dialog__desc">{{ dialogCopy.desc }}</p>

				<div class="location-permission-dialog__actions">
					<button
						v-if="dialogCopy.showCancel"
						type="button"
						class="location-permission-dialog__btn is-muted"
						@click="onCancel"
					>
						取消
					</button>
					<button
						type="button"
						class="location-permission-dialog__btn is-primary"
						:class="{ 'is-full': !dialogCopy.showCancel }"
						@click="onConfirm"
					>
						{{ dialogCopy.confirmText }}
					</button>
				</div>
			</div>
		</div>
	</Teleport>
</template>

<style scoped lang="scss">
.location-permission-dialog {
	position: fixed;
	left: var(--app-vv-offset-left, 0);
	top: var(--app-vv-offset-top, 0);
	width: var(--app-vv-width, 100%);
	height: var(--app-vv-height, 100%);
	z-index: 3200;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 24px 20px;
	box-sizing: border-box;
	pointer-events: auto;
	overscroll-behavior: contain;
}

.location-permission-dialog__shade {
	position: absolute;
	inset: 0;
	background: rgba(0, 0, 0, 0.55);
	opacity: 0;
	transition: opacity 0.22s ease;
	backdrop-filter: blur(2px);
	-webkit-backdrop-filter: blur(2px);
}

.location-permission-dialog__panel {
	position: relative;
	z-index: 1;
	width: min(100%, 320px);
	padding: 22px 20px 18px;
	border-radius: 14px;
	border: 1px solid rgba(255, 255, 255, 0.08);
	background: rgba(20, 22, 26, 0.92);
	box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
	backdrop-filter: blur(14px);
	-webkit-backdrop-filter: blur(14px);
	color: #fff;
	transform: scale(0.94);
	opacity: 0;
	transition:
		transform 0.22s cubic-bezier(0.32, 0.72, 0, 1),
		opacity 0.22s ease;
}

.location-permission-dialog--enter .location-permission-dialog__shade {
	opacity: 1;
}

.location-permission-dialog--enter .location-permission-dialog__panel {
	transform: scale(1);
	opacity: 1;
}

.location-permission-dialog--leave .location-permission-dialog__shade {
	opacity: 0;
}

.location-permission-dialog--leave .location-permission-dialog__panel {
	transform: scale(0.96);
	opacity: 0;
}

.location-permission-dialog__icon {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 48px;
	height: 48px;
	margin: 0 auto 14px;
	border-radius: 50%;
	background: rgba(45, 212, 191, 0.12);
	color: var(--app-accent, #1cded4);
}

.location-permission-dialog__icon svg {
	width: 26px;
	height: 26px;
}

.location-permission-dialog__title {
	margin: 0 0 10px;
	font-size: 17px;
	font-weight: 600;
	line-height: 1.35;
	text-align: center;
}

.location-permission-dialog__desc {
	margin: 0 0 20px;
	font-size: 14px;
	line-height: 1.65;
	color: rgba(255, 255, 255, 0.68);
	text-align: center;
	white-space: pre-line;
}

.location-permission-dialog__actions {
	display: flex;
	gap: 10px;
}

.location-permission-dialog__btn {
	flex: 1;
	height: 42px;
	border: 0;
	border-radius: 999px;
	font-size: 15px;
	font-weight: 500;
	line-height: 1;
	cursor: pointer;
	-webkit-tap-highlight-color: transparent;
	transition:
		opacity 0.15s ease,
		transform 0.1s ease;

	&:active {
		transform: scale(0.98);
	}

	&.is-muted {
		background: rgba(255, 255, 255, 0.08);
		color: rgba(255, 255, 255, 0.78);
	}

	&.is-primary {
		background: var(--app-accent, #1cded4);
		color: #0a1412;
		box-shadow: 0 4px 14px rgba(45, 212, 191, 0.28);
	}

	&.is-full {
		flex: 1;
	}
}
</style>
