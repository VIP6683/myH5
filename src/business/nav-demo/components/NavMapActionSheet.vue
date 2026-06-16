<script setup>
import { onBeforeUnmount, ref, watch } from 'vue';
import { usePopupLayer } from '../../../composables/usePopupLayer.js';
import { openMapApp } from '../utils/openMapApp.js';
import iconBaidu from '../../../assets/baidu-map.png';
import iconGaode from '../../../assets/gaode-map.png';
import iconTencent from '../../../assets/tencent-map.png';

const visible = defineModel('visible', { type: Boolean, default: false });

const props = defineProps({
	poi: {
		type: Object,
		default: null
	}
});

const MAP_OPTIONS = [
	{
		id: 'tencent',
		name: '腾讯地图',
		icon: iconTencent
	},
	{
		id: 'gaode',
		name: '高德地图',
		icon: iconGaode
	},
	{
		id: 'baidu',
		name: '百度地图',
		icon: iconBaidu
	}
];

const rendered = ref(false);
const animClass = ref('');

let leaveTimer = null;

const popupLayer = usePopupLayer();

const clearLeaveTimer = () => {
	if (leaveTimer) {
		clearTimeout(leaveTimer);
		leaveTimer = null;
	}
};

const playEnter = () => {
	clearLeaveTimer();
	rendered.value = true;
	popupLayer.acquire();
	animClass.value = '';
	requestAnimationFrame(() => {
		animClass.value = 'nav-action-sheet--enter';
	});
};

const playLeave = (onDone) => {
	clearLeaveTimer();
	animClass.value = 'nav-action-sheet--leave';
	leaveTimer = setTimeout(() => {
		rendered.value = false;
		animClass.value = '';
		popupLayer.release();
		leaveTimer = null;
		onDone?.();
	}, 280);
};

const close = () => {
	visible.value = false;
};

const onSelect = (option) => {
	if (!props.poi) return;
	openMapApp(option.id, props.poi);
	close();
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
			class="nav-action-sheet"
			:class="animClass"
			role="dialog"
			aria-modal="true"
			aria-label="选择要打开的方式"
		>
			<div class="nav-action-sheet__shade" @click="close" />

			<div class="nav-action-sheet__panel">
				<div class="nav-action-sheet__handle-wrap" aria-hidden="true">
					<span class="nav-action-sheet__handle" />
				</div>

				<div class="nav-action-sheet__header">
					<button type="button" class="nav-action-sheet__collapse" aria-label="收起" @click="close">
						<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
							<path
								d="M7 10l5 5 5-5"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
					</button>
					<div class="nav-action-sheet__title">选择要打开的方式</div>
					<div class="nav-action-sheet__header-spacer" />
				</div>

				<ul class="nav-action-sheet__list">
					<li
						v-for="(option, index) in MAP_OPTIONS"
						:key="option.id"
						class="nav-action-sheet__row"
					>
						<button type="button" class="nav-action-sheet__item" @click="onSelect(option)">
							<img class="nav-action-sheet__icon" :src="option.icon" :alt="option.name" />
							<span class="nav-action-sheet__label">{{ option.name }}</span>
						</button>
						<div
							v-if="index < MAP_OPTIONS.length - 1"
							class="nav-action-sheet__divider"
							aria-hidden="true"
						/>
					</li>
				</ul>
			</div>
		</div>
	</Teleport>
</template>

<style scoped lang="scss">
.nav-action-sheet {
	position: fixed;
	inset: 0;
	z-index: 3000;
	display: flex;
	flex-direction: column;
	justify-content: flex-end;
	pointer-events: none;
	backface-visibility: hidden;
	overscroll-behavior: contain;
}

.nav-action-sheet__shade {
	position: absolute;
	inset: 0;
	background: rgba(0, 0, 0, 0.4);
	pointer-events: auto;
	opacity: 0;
	transition: opacity 0.28s ease;
	will-change: opacity;
}

.nav-action-sheet__panel {
	position: relative;
	pointer-events: auto;
	background: #fff;
	border-radius: 16px 16px 0 0;
	padding-bottom: env(safe-area-inset-bottom, 0px);
	box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.08);
	transform: translate3d(0, 100%, 0);
	transition: transform 0.28s cubic-bezier(0.32, 0.72, 0, 1);
	will-change: transform;
	backface-visibility: hidden;
}

.nav-action-sheet__handle-wrap {
	display: flex;
	justify-content: center;
	padding: 10px 0 2px;
}

.nav-action-sheet__handle {
	width: 36px;
	height: 4px;
	border-radius: 2px;
	background: #e0e0e0;
}

.nav-action-sheet--enter .nav-action-sheet__shade {
	opacity: 1;
}

.nav-action-sheet--enter .nav-action-sheet__panel {
	transform: translate3d(0, 0, 0);
}

.nav-action-sheet--leave .nav-action-sheet__shade {
	opacity: 0;
}

.nav-action-sheet--leave .nav-action-sheet__panel {
	transform: translate3d(0, 100%, 0);
}

.nav-action-sheet__header {
	display: flex;
	align-items: center;
	padding: 8px 16px 14px;
	border-bottom: 1px solid #ebebeb;
}

.nav-action-sheet__collapse {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 32px;
	height: 32px;
	padding: 0;
	border: 0;
	background: transparent;
	color: #b0b0b0;
	cursor: pointer;
	-webkit-tap-highlight-color: transparent;
}

.nav-action-sheet__title {
	flex: 1;
	text-align: center;
	font-size: 15px;
	font-weight: 500;
	color: #1a1a1a;
}

.nav-action-sheet__header-spacer {
	width: 32px;
	flex-shrink: 0;
}

.nav-action-sheet__list {
	margin: 0;
	padding: 4px 0 8px;
	list-style: none;
}

.nav-action-sheet__row {
	position: relative;
}

.nav-action-sheet__item {
	display: flex;
	align-items: center;
	gap: 14px;
	width: 100%;
	min-height: 56px;
	padding: 12px 20px;
	border: 0;
	background: #fff;
	cursor: pointer;
	-webkit-tap-highlight-color: transparent;
	transition: background 0.15s;

	&:active {
		background: #f7f7f7;
	}
}

.nav-action-sheet__divider {
	height: 1px;
	margin-left: 66px;
	margin-right: 0;
	background: #ebebeb;
	transform: scaleY(0.5);
	transform-origin: center top;
}

.nav-action-sheet__icon {
	flex-shrink: 0;
	width: 32px;
	height: 32px;
	border-radius: 8px;
	object-fit: contain;
}

.nav-action-sheet__label {
	font-size: 16px;
	font-weight: 400;
	color: #1a1a1a;
	line-height: 1.4;
}
</style>
