<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { usePopupLayer } from '../composables/usePopupLayer.js';

const visible = defineModel('visible', { type: Boolean, default: false });

const props = defineProps({
	title: {
		type: String,
		default: '请选择'
	},
	options: {
		type: Array,
		default: () => []
	},
	modelValue: {
		type: [String, Number],
		default: ''
	},
	/** 已选时显示「清除」，可清空选择 */
	clearable: {
		type: Boolean,
		default: false
	}
});

const emit = defineEmits(['update:modelValue', 'select', 'clear', 'close']);

const rendered = ref(false);
const animClass = ref('');
const showClear = computed(
	() => props.clearable && String(props.modelValue ?? '').trim() !== ''
);

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
		animClass.value = 'option-picker-sheet--enter';
	});
};

const playLeave = (onDone) => {
	clearLeaveTimer();
	animClass.value = 'option-picker-sheet--leave';
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
	const value = option?.value != null ? String(option.value) : '';
	emit('update:modelValue', value);
	emit('select', option);
	close();
};

const onClear = () => {
	emit('update:modelValue', '');
	emit('clear');
	close();
};

watch(visible, (open) => {
	if (open) {
		playEnter();
		return;
	}
	if (rendered.value) {
		playLeave(() => emit('close'));
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
			class="option-picker-sheet"
			:class="animClass"
			role="dialog"
			aria-modal="true"
			:aria-label="title"
		>
			<div class="option-picker-sheet__shade" @click="close" />

			<div class="option-picker-sheet__panel">
				<div class="option-picker-sheet__handle-wrap" aria-hidden="true">
					<span class="option-picker-sheet__handle" />
				</div>

				<header class="option-picker-sheet__header">
					<button
						type="button"
						class="option-picker-sheet__cancel"
						@click="close"
					>
						取消
					</button>
					<div class="option-picker-sheet__title">{{ title }}</div>
					<button
						v-if="showClear"
						type="button"
						class="option-picker-sheet__clear"
						@click="onClear"
					>
						清除
					</button>
					<span v-else class="option-picker-sheet__header-spacer" />
				</header>

				<ul class="option-picker-sheet__list">
					<li
						v-for="option in options"
						:key="String(option.value)"
						class="option-picker-sheet__row"
					>
						<button
							type="button"
							class="option-picker-sheet__item"
							:class="{
								'is-active': String(modelValue) === String(option.value)
							}"
							@click="onSelect(option)"
						>
							{{ option.label }}
						</button>
					</li>
				</ul>
			</div>
		</div>
	</Teleport>
</template>

<style scoped lang="scss">
.option-picker-sheet {
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

.option-picker-sheet__shade {
	position: absolute;
	inset: 0;
	background: rgba(0, 0, 0, 0.45);
	pointer-events: auto;
	opacity: 0;
	transition: opacity 0.28s ease;
	will-change: opacity;
}

.option-picker-sheet__panel {
	position: relative;
	pointer-events: auto;
	max-height: min(62vh, 420px);
	display: flex;
	flex-direction: column;
	background: #1e2124;
	border-radius: 16px 16px 0 0;
	padding-bottom: env(safe-area-inset-bottom, 0px);
	box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.24);
	transform: translate3d(0, 100%, 0);
	transition: transform 0.28s cubic-bezier(0.32, 0.72, 0, 1);
	will-change: transform;
	backface-visibility: hidden;
}

.option-picker-sheet__handle-wrap {
	display: flex;
	justify-content: center;
	padding: 10px 0 2px;
	flex-shrink: 0;
}

.option-picker-sheet__handle {
	width: 36px;
	height: 4px;
	border-radius: 2px;
	background: rgba(255, 255, 255, 0.22);
}

.option-picker-sheet--enter .option-picker-sheet__shade {
	opacity: 1;
}

.option-picker-sheet--enter .option-picker-sheet__panel {
	transform: translate3d(0, 0, 0);
}

.option-picker-sheet--leave .option-picker-sheet__shade {
	opacity: 0;
}

.option-picker-sheet--leave .option-picker-sheet__panel {
	transform: translate3d(0, 100%, 0);
}

.option-picker-sheet__header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	padding: 4px 14px 10px;
	flex-shrink: 0;
}

.option-picker-sheet__cancel {
	padding: 0;
	border: 0;
	background: transparent;
	color: rgba(255, 255, 255, 0.55);
	font-size: 14px;
	line-height: 1.3;
	cursor: pointer;
	-webkit-tap-highlight-color: transparent;
	min-width: 28px;
	text-align: left;
}

.option-picker-sheet__clear {
	padding: 0;
	border: 0;
	background: transparent;
	color: #1cded4;
	font-size: 14px;
	line-height: 1.3;
	cursor: pointer;
	-webkit-tap-highlight-color: transparent;
	min-width: 28px;
	text-align: right;
	flex-shrink: 0;
}

.option-picker-sheet__title {
	flex: 1;
	text-align: center;
	font-size: 15px;
	font-weight: 600;
	color: rgba(255, 255, 255, 0.92);
	line-height: 1.3;
}

.option-picker-sheet__header-spacer {
	width: 28px;
	flex-shrink: 0;
}

.option-picker-sheet__list {
	margin: 0;
	padding: 0 8px 12px;
	list-style: none;
	overflow-y: auto;
	-webkit-overflow-scrolling: touch;
}

.option-picker-sheet__row {
	margin: 0;
}

.option-picker-sheet__item {
	display: block;
	width: 100%;
	padding: 14px 12px;
	border: 0;
	border-radius: 10px;
	background: transparent;
	color: rgba(255, 255, 255, 0.88);
	font-size: 15px;
	line-height: 1.3;
	text-align: center;
	cursor: pointer;
	-webkit-tap-highlight-color: transparent;

	&:active {
		background: rgba(255, 255, 255, 0.06);
	}

	&.is-active {
		color: #1cded4;
		font-weight: 600;
	}
}
</style>
