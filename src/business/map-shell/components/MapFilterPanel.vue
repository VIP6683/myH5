<script setup>
import { reactive, watch } from 'vue';

const createEmptyFilters = () => ({
	year: '',
	objectType: [],
	verifyStatus: '',
	disposeStatus: ''
});

const FILTER_GROUPS = [
	{
		key: 'year',
		label: '年份',
		multiple: false,
		options: [
			{ value: '2026', label: '2026年' },
			{ value: '2025', label: '2025年' },
			{ value: '2024', label: '2024年' },
			{ value: '2023', label: '2023年' }
		]
	},
	{
		key: 'objectType',
		label: '异物类型',
		multiple: true,
		options: [
			{ value: 'color-steel', label: '彩钢瓦' },
			{ value: 'mulch', label: '地膜' },
			{ value: 'dust-net', label: '防尘网' },
			{ value: 'construction', label: '施工工地' },
			{ value: 'greenhouse', label: '塑料大棚' }
		]
	},
	{
		key: 'verifyStatus',
		label: '核查状态',
		multiple: false,
		options: [
			{ value: 'verified', label: '已核查' },
			{ value: 'unverified', label: '未核查' }
		]
	},
	{
		key: 'disposeStatus',
		label: '处置状态',
		multiple: false,
		options: [
			{ value: 'disposed', label: '已处置' },
			{ value: 'undisposed', label: '未处置' },
			{ value: 'no-need', label: '无需处置' }
		]
	}
];

const props = defineProps({
	modelValue: {
		type: Object,
		default: () => ({
			year: '',
			objectType: [],
			verifyStatus: '',
			disposeStatus: ''
		})
	}
});

const emit = defineEmits(['update:modelValue', 'confirm', 'reset']);

const draft = reactive(createEmptyFilters());

const cloneFilters = (value) => ({
	year: value?.year ?? '',
	objectType: Array.isArray(value?.objectType) ? [...value.objectType] : [],
	verifyStatus: value?.verifyStatus ?? '',
	disposeStatus: value?.disposeStatus ?? ''
});

const syncDraftFromModel = () => {
	const next = cloneFilters(props.modelValue);
	draft.year = next.year;
	draft.objectType = next.objectType;
	draft.verifyStatus = next.verifyStatus;
	draft.disposeStatus = next.disposeStatus;
};

watch(
	() => props.modelValue,
	() => syncDraftFromModel(),
	{ immediate: true, deep: true }
);

const isSelected = (group, option) => {
	if (group.multiple) {
		return draft[group.key].includes(option.value);
	}
	return draft[group.key] === option.value;
};

const toggleOption = (group, option) => {
	if (group.multiple) {
		const list = draft[group.key];
		const index = list.indexOf(option.value);
		if (index >= 0) {
			list.splice(index, 1);
		} else {
			list.push(option.value);
		}
		return;
	}

	draft[group.key] = draft[group.key] === option.value ? '' : option.value;
};

const handleReset = () => {
	const empty = createEmptyFilters();
	draft.year = empty.year;
	draft.objectType = empty.objectType;
	draft.verifyStatus = empty.verifyStatus;
	draft.disposeStatus = empty.disposeStatus;
	emit('reset', cloneFilters(draft));
};

const handleConfirm = () => {
	const next = cloneFilters(draft);
	emit('update:modelValue', next);
	emit('confirm', next);
};

defineExpose({
	syncDraftFromModel,
	resetDraft: handleReset
});
</script>

<template>
	<div class="map-filter-panel">
		<div class="map-filter-panel__body">
			<section
				v-for="group in FILTER_GROUPS"
				:key="group.key"
				class="map-filter-panel__section"
			>
				<h3 class="map-filter-panel__title">{{ group.label }}</h3>
				<div class="map-filter-panel__options">
					<button
						v-for="option in group.options"
						:key="option.value"
						type="button"
						class="map-filter-panel__option"
						:class="{ 'is-active': isSelected(group, option) }"
						@click="toggleOption(group, option)"
					>
						{{ option.label }}
					</button>
				</div>
			</section>
		</div>

		<div class="map-filter-panel__footer">
			<button
				type="button"
				class="map-filter-panel__btn map-filter-panel__btn--reset"
				@click="handleReset"
			>
				重置
			</button>
			<button
				type="button"
				class="map-filter-panel__btn map-filter-panel__btn--confirm"
				@click="handleConfirm"
			>
				确定
			</button>
		</div>
	</div>
</template>

<style scoped lang="scss">
.map-filter-panel {
	background: rgba(20, 22, 26, 0.96);
	border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	backdrop-filter: blur(10px);
	-webkit-backdrop-filter: blur(10px);
}

.map-filter-panel__body {
	max-height: min(52vh, 420px);
	overflow-y: auto;
	padding: 12px 12px 4px;
	-webkit-overflow-scrolling: touch;
	overscroll-behavior: contain;
}

.map-filter-panel__section {
	& + & {
		margin-top: 14px;
	}
}

.map-filter-panel__title {
	margin: 0 0 10px;
	font-size: 14px;
	font-weight: 500;
	color: rgba(255, 255, 255, 0.92);
	line-height: 1.3;
}

.map-filter-panel__options {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
}

.map-filter-panel__option {
	padding: 7px 14px;
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 999px;
	background: rgba(255, 255, 255, 0.06);
	color: rgba(255, 255, 255, 0.82);
	font-size: 13px;
	line-height: 1.2;
	cursor: pointer;
	-webkit-tap-highlight-color: transparent;
	transition:
		background 0.15s ease,
		border-color 0.15s ease,
		color 0.15s ease;

	&:active {
		opacity: 0.85;
	}

	&.is-active {
		background: rgba(45, 212, 191, 0.16);
		border-color: rgba(45, 212, 191, 0.55);
		color: var(--app-accent, #1cded4);
	}
}

.map-filter-panel__footer {
	display: flex;
	gap: 10px;
	padding: 12px;
	border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.map-filter-panel__btn {
	flex: 1;
	height: 40px;
	border: 0;
	border-radius: 999px;
	font-size: 15px;
	font-weight: 500;
	cursor: pointer;
	-webkit-tap-highlight-color: transparent;
	transition: opacity 0.15s ease;

	&:active {
		opacity: 0.88;
	}
}

.map-filter-panel__btn--reset {
	background: rgba(255, 255, 255, 0.08);
	color: rgba(255, 255, 255, 0.88);
}

.map-filter-panel__btn--confirm {
	background: linear-gradient(90deg, #047fe8 0%, #1cded4 100%);
	color: #fff;
	box-shadow: 0 4px 12px rgba(4, 127, 232, 0.25);
}
</style>
