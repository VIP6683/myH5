<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import {
	fetchLineAllPeriod,
	fetchLineAllYear
} from '../../../api/lineMonitor.js';
import {
	fetchAllPeriod,
	fetchAllYear,
	normalizeLabelValueOptions
} from '../../../api/statistics.js';
import { createEmptyFilters } from '../utils/monitorFilters.js';

const AREA_OBJECT_TYPE_OPTIONS = [
	{ value: 'color-steel', label: '彩钢瓦' },
	{ value: 'mulch', label: '地膜' },
	{ value: 'dust-net', label: '防尘网' },
	{ value: 'construction', label: '施工工地' },
	{ value: 'greenhouse', label: '塑料大棚' }
];

const LINE_OBJECT_TYPE_OPTIONS = [
	...AREA_OBJECT_TYPE_OPTIONS,
	{ value: 'water', label: '水体' }
];

const STATIC_FILTER_GROUPS = [
	{
		key: 'objectType',
		label: '异物类型',
		multiple: false,
		options: AREA_OBJECT_TYPE_OPTIONS
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
			{ value: 'undisposed', label: '未处置' }
			// { value: 'no-need', label: '无需处置' }
		]
	}
];

const props = defineProps({
	modelValue: {
		type: Object,
		default: () => createEmptyFilters()
	},
	monitorType: {
		type: String,
		default: 'area'
	}
});

const emit = defineEmits(['update:modelValue', 'confirm', 'reset']);

const draft = reactive(createEmptyFilters());
const yearOptions = ref([]);
const periodOptions = ref([]);
const yearLoading = ref(false);
const periodLoading = ref(false);

const filterGroups = computed(() =>
	STATIC_FILTER_GROUPS.map((group) => {
		if (group.key !== 'objectType') {
			return group;
		}

		return {
			...group,
			options: props.monitorType === 'line' ? LINE_OBJECT_TYPE_OPTIONS : AREA_OBJECT_TYPE_OPTIONS
		};
	})
);

const normalizeObjectType = (value) => {
	if (Array.isArray(value)) {
		return value[0] ?? '';
	}
	return value ?? '';
};

const cloneFilters = (value) => ({
	year: value?.year ?? '',
	period: value?.period ?? '',
	objectType: normalizeObjectType(value?.objectType),
	verifyStatus: value?.verifyStatus ?? '',
	disposeStatus: value?.disposeStatus ?? ''
});

const syncDraftFromModel = () => {
	const next = cloneFilters(props.modelValue);
	const yearChanged = draft.year !== next.year;
	draft.year = next.year;
	draft.period = next.period;
	draft.objectType = next.objectType;
	draft.verifyStatus = next.verifyStatus;
	draft.disposeStatus = next.disposeStatus;

	if (yearChanged) {
		loadPeriodOptions(next.year);
	}
};

watch(
	() => props.modelValue,
	() => syncDraftFromModel(),
	{ immediate: true, deep: true }
);

async function loadYearOptions() {
	yearLoading.value = true;
	try {
		const data =
			props.monitorType === 'line' ? await fetchLineAllYear() : await fetchAllYear();
		const normalize =
			normalizeLabelValueOptions;
		yearOptions.value = normalize(data);
	} catch {
		yearOptions.value = [];
	} finally {
		yearLoading.value = false;
	}
}

async function loadPeriodOptions(year) {
	if (!year) {
		periodOptions.value = [];
		return;
	}

	periodLoading.value = true;
	try {
		const data =
			props.monitorType === 'line'
				? await fetchLineAllPeriod(year)
				: await fetchAllPeriod(year);
		const normalize =
			normalizeLabelValueOptions;
		periodOptions.value = normalize(data);
	} catch {
		periodOptions.value = [];
	} finally {
		periodLoading.value = false;
	}
}

watch(
	() => props.monitorType,
	() => {
		loadYearOptions();
		if (draft.year) {
			loadPeriodOptions(draft.year);
		}
	}
);

onMounted(() => {
	loadYearOptions();
	if (draft.year) {
		loadPeriodOptions(draft.year);
	}
});

const isSelected = (group, option) => {
	if (group.multiple) {
		return draft[group.key].includes(option.value);
	}
	return draft[group.key] === option.value;
};

const toggleSingle = (key, option) => {
	const nextValue = draft[key] === option.value ? '' : option.value;

	if (key === 'year' && nextValue !== draft.year) {
		draft.period = '';
		loadPeriodOptions(nextValue);
	}

	draft[key] = nextValue;
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
	draft.period = empty.period;
	draft.objectType = empty.objectType;
	draft.verifyStatus = empty.verifyStatus;
	draft.disposeStatus = empty.disposeStatus;
	periodOptions.value = [];
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
			<section class="map-filter-panel__section">
				<h3 class="map-filter-panel__title">年份</h3>
				<p v-if="yearLoading" class="map-filter-panel__hint">加载中...</p>
				<div v-else class="map-filter-panel__options">
					<button
						v-for="option in yearOptions"
						:key="option.value"
						type="button"
						class="map-filter-panel__option"
						:class="{ 'is-active': draft.year === option.value }"
						@click="toggleSingle('year', option)"
					>
						{{ option.label }}
					</button>
				</div>
			</section>

			<section class="map-filter-panel__section">
				<h3 class="map-filter-panel__title">期度</h3>
				<p v-if="!draft.year" class="map-filter-panel__hint">请先选择年份</p>
				<p v-else-if="periodLoading" class="map-filter-panel__hint">加载中...</p>
				<p v-else-if="!periodOptions.length" class="map-filter-panel__hint">暂无期度</p>
				<div v-else class="map-filter-panel__options">
					<button
						v-for="option in periodOptions"
						:key="option.value"
						type="button"
						class="map-filter-panel__option"
						:class="{ 'is-active': draft.period === option.value }"
						@click="toggleSingle('period', option)"
					>
						{{ option.label }}
					</button>
				</div>
			</section>

			<section
				v-for="group in filterGroups"
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
	background: var(--app-filter-panel-bg, #101820);
	border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.map-filter-panel__body {
	max-height: min(52vh, 420px);
	overflow-y: auto;
	padding: 10px 12px 4px;
	-webkit-overflow-scrolling: touch;
	overscroll-behavior: contain;
}

.map-filter-panel__section {
	& + & {
		margin-top: 10px;
		padding-top: 10px;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
	}
}

.map-filter-panel__title {
	margin: 0 0 8px;
	font-size: 13px;
	font-weight: 500;
	color: rgba(255, 255, 255, 0.92);
	line-height: 1.2;
}

.map-filter-panel__hint {
	margin: 0;
	padding: 2px 0;
	font-size: 12px;
	color: rgba(255, 255, 255, 0.38);
	line-height: 1.3;
}

.map-filter-panel__options {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
}

.map-filter-panel__option {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	min-height: 30px;
	padding: 6px 14px;
	border: 0;
	border-radius: var(--app-filter-chip-radius, 999px);
	background: var(--app-filter-chip-bg, rgba(58, 58, 60, 0.85));
	color: var(--app-filter-chip-color, rgba(255, 255, 255, 0.88));
	font-size: 13px;
	font-weight: 400;
	line-height: 1.2;
	cursor: pointer;
	-webkit-tap-highlight-color: transparent;
	transition:
		background 0.18s ease,
		color 0.18s ease,
		opacity 0.15s ease;

	&:active {
		opacity: 0.88;
	}

	&.is-active {
		background: var(--app-filter-chip-active-bg, #12b6d6);
		color: var(--app-filter-chip-active-color, #fff);
		font-weight: 500;
	}
}

.map-filter-panel__footer {
	display: flex;
	gap: 10px;
	padding: 10px 12px calc(10px + env(safe-area-inset-bottom, 0px));
	border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.map-filter-panel__btn {
	flex: 1;
	height: 38px;
	border-radius: 999px;
	font-size: 14px;
	font-weight: 500;
	cursor: pointer;
	-webkit-tap-highlight-color: transparent;
	transition:
		background 0.2s ease,
		border-color 0.2s ease,
		box-shadow 0.2s ease,
		transform 0.15s ease,
		opacity 0.15s ease;

	&:active {
		transform: scale(0.98);
		opacity: 0.92;
	}
}

.map-filter-panel__btn--reset {
	border: 0;
	background: var(--app-filter-chip-bg, rgba(58, 58, 60, 0.85));
	color: rgba(255, 255, 255, 0.88);
}

.map-filter-panel__btn--confirm {
	border: 0;
	background: var(--app-filter-chip-active-bg, #12b6d6);
	color: #fff;
	font-weight: 600;
}
</style>
