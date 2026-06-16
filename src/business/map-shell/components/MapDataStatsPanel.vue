<script setup>
import { computed, ref } from 'vue';
import YearPickerSheet from '../../../components/YearPickerSheet.vue';

defineProps({
	visible: {
		type: Boolean,
		default: false
	}
});

const YEAR_OPTIONS = ['2026', '2025', '2024', '2023'];

const PHASE_LABELS = [
	'第一期',
	'第二期',
	'第三期',
	'第四期',
	'第五期',
	'第六期',
	'第七期',
	'第八期',
	'第九期',
	'第十期',
	'第十一期',
	'第十二期'
];

const selectedYear = ref('');
const yearPickerVisible = ref(false);

const yearButtonLabel = computed(() => (selectedYear.value ? `${selectedYear.value}年` : '年份'));
const hasSelectedYear = computed(() => Boolean(selectedYear.value));

const tableRows = computed(() =>
	PHASE_LABELS.map((phase) => ({
		phase,
		total: 20,
		unverified: 5,
		pending: 3,
		completed: 12
	}))
);

const openYearPicker = () => {
	yearPickerVisible.value = true;
};

const onYearConfirm = (year) => {
	selectedYear.value = year;
};
</script>

<template>
	<div v-show="visible" class="map-data-stats-panel" aria-label="数据统计">
		<header class="map-data-stats-panel__header">
			<div class="map-data-stats-panel__header-inner">
				<button
					type="button"
					class="map-data-stats-panel__year-btn"
					:class="{ 'is-active': hasSelectedYear }"
					aria-label="选择年份"
					@click="openYearPicker"
				>
					<span class="map-data-stats-panel__year-label">{{ yearButtonLabel }}</span>
					<svg
						class="map-data-stats-panel__year-arrow"
						viewBox="0 0 24 24"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
						aria-hidden="true"
					>
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
			</div>
		</header>

		<div class="map-data-stats-panel__table-wrap">
			<table class="map-data-stats-panel__table">
				<thead>
					<tr>
						<th>期数</th>
						<th>总任务数</th>
						<th>未核查数</th>
						<th>待处置数</th>
						<th>已完成数</th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="row in tableRows" :key="row.phase">
						<td class="is-phase">{{ row.phase }}</td>
						<td>{{ row.total }}</td>
						<td class="is-warn">{{ row.unverified }}</td>
						<td class="is-pending">{{ row.pending }}</td>
						<td class="is-done">{{ row.completed }}</td>
					</tr>
				</tbody>
			</table>
		</div>

		<YearPickerSheet
			v-model:visible="yearPickerVisible"
			v-model="selectedYear"
			:years="YEAR_OPTIONS"
			@confirm="onYearConfirm"
		/>
	</div>
</template>

<style scoped lang="scss">
.map-data-stats-panel {
	position: absolute;
	inset: 0;
	z-index: 900;
	display: flex;
	flex-direction: column;
	background: #0a0a0a;
	color: #fff;
	overflow: hidden;
}

.map-data-stats-panel__header {
	flex-shrink: 0;
	padding: calc(10px + env(safe-area-inset-top, 0px)) 12px 10px;
	background: rgb(16 24 31 / 88%);
	border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	backdrop-filter: blur(12px);
	-webkit-backdrop-filter: blur(12px);
}

.map-data-stats-panel__header-inner {
	display: flex;
	align-items: center;
	justify-content: flex-end;
	min-height: 32px;
}

.map-data-stats-panel__year-btn {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	height: 32px;
	padding: 0 12px;
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 999px;
	background: rgba(255, 255, 255, 0.06);
	color: rgba(255, 255, 255, 0.82);
	font-size: 14px;
	line-height: 1;
	cursor: pointer;
	-webkit-tap-highlight-color: transparent;
	transition:
		background 0.15s ease,
		border-color 0.15s ease,
		color 0.15s ease,
		box-shadow 0.15s ease;

	&.is-active {
		background: rgba(45, 212, 191, 0.1);
		border-color: rgba(45, 212, 191, 0.35);
		color: var(--app-accent, #1cded4);
		box-shadow: 0 0 0 1px rgba(45, 212, 191, 0.08);
	}

	&:active {
		transform: scale(0.98);
	}
}

.map-data-stats-panel__year-label {
	font-weight: 500;
	letter-spacing: 0.02em;
}

.map-data-stats-panel__year-arrow {
	width: 14px;
	height: 14px;
	opacity: 0.7;
	transition: transform 0.2s ease;
}

.map-data-stats-panel__year-btn.is-active .map-data-stats-panel__year-arrow {
	opacity: 1;
}

.map-data-stats-panel__table-wrap {
	flex: 1;
	min-height: 0;
	overflow-y: auto;
	-webkit-overflow-scrolling: touch;
	overscroll-behavior: contain;
}

.map-data-stats-panel__table {
	width: 100%;
	border-collapse: collapse;
	table-layout: fixed;
}

.map-data-stats-panel__table thead {
	position: sticky;
	top: 0;
	z-index: 1;
	background: rgb(16 24 31 / 95%);
	border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.map-data-stats-panel__table th,
.map-data-stats-panel__table td {
	padding: 15px 6px;
	text-align: center;
	line-height: 1.3;
	font-weight: 400;
	border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.map-data-stats-panel__table th {
	padding-top: 12px;
	padding-bottom: 12px;
	color: rgba(255, 255, 255, 0.75);
	font-size: 14px;
	font-weight: 600;
	letter-spacing: 0.04em;
}

.map-data-stats-panel__table td {
	font-size: 13px;
	color: rgba(255, 255, 255, 0.9);
	font-variant-numeric: tabular-nums;
}

.map-data-stats-panel__table td.is-phase {
	color: rgba(255, 255, 255, 0.95);
	font-weight: 500;
}

.map-data-stats-panel__table td.is-warn {
	color: rgba(255, 255, 255, 0.72);
}

.map-data-stats-panel__table td.is-pending {
	color: rgba(255, 200, 120, 0.92);
}

.map-data-stats-panel__table td.is-done {
	color: var(--app-accent, #1cded4);
}

.map-data-stats-panel__table th:first-child,
.map-data-stats-panel__table td:first-child {
	width: 22%;
	text-align: left;
	padding-left: 16px;
}

.map-data-stats-panel__table th:not(:first-child),
.map-data-stats-panel__table td:not(:first-child) {
	width: 19.5%;
}
</style>
