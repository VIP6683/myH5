<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { fetchLineAllYear, fetchLinePersonalTaskStats } from '../../../api/lineMonitor.js';
import {
	fetchAllYear,
	fetchPersonalTaskStats,
	normalizeLabelValueOptions,
	normalizePersonalTaskStats
} from '../../../api/statistics.js';
import { useMonitorAccess } from '../../../composables/useMonitorAccess.js';
import YearPickerSheet from '../../../components/YearPickerSheet.vue';

defineProps({
	visible: {
		type: Boolean,
		default: false
	}
});

const { hasLineMonitor } = useMonitorAccess();

const selectedYear = ref('');
const yearPickerVisible = ref(false);
const statsRows = ref([]);
const yearOptions = ref([]);
const yearLoading = ref(false);
const statsLoading = ref(false);

const yearButtonLabel = computed(() => (selectedYear.value ? `${selectedYear.value}年` : '年份'));
const hasSelectedYear = computed(() => Boolean(selectedYear.value));
const yearPickerOptions = computed(() => {
	const list = yearOptions.value
		.map((item) => String(item.value || item.label || ''))
		.filter(Boolean);
	return list.length ? list : [String(new Date().getFullYear())];
});

const tableRows = computed(() => [...statsRows.value].sort((a, b) => a.phase - b.phase));

async function loadYearOptions() {
	yearLoading.value = true;
	try {
		const fetchYear = hasLineMonitor.value ? fetchLineAllYear : fetchAllYear;
		const data = await fetchYear();
		yearOptions.value = normalizeLabelValueOptions(data);
	} catch (error) {
		console.error('加载年份列表失败:', error);
		yearOptions.value = [];
	} finally {
		yearLoading.value = false;
	}

	if (!selectedYear.value) {
		const fallbackYear = yearPickerOptions.value[0] || String(new Date().getFullYear());
		selectedYear.value = fallbackYear;
	}
}

const loadPersonalTaskStats = async () => {
	if (!selectedYear.value) {
		statsRows.value = [];
		return;
	}

	statsLoading.value = true;
	try {
		const fetchStats = hasLineMonitor.value ? fetchLinePersonalTaskStats : fetchPersonalTaskStats;
		const data = await fetchStats(selectedYear.value);
		statsRows.value = normalizePersonalTaskStats(data);
	} catch (error) {
		console.error('加载个人任务统计失败:', error);
		statsRows.value = [];
	} finally {
		statsLoading.value = false;
	}
};

watch(selectedYear, loadPersonalTaskStats);

onMounted(async () => {
	await loadYearOptions();
	await loadPersonalTaskStats();
});

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
				<h2 class="map-data-stats-panel__title">数据统计</h2>
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

		<section class="map-data-stats-panel__content">
			<div v-if="statsLoading" class="map-data-stats-panel__loading" aria-live="polite" aria-busy="true">
				<div class="map-data-stats-panel__spinner" aria-hidden="true" />
				<span class="map-data-stats-panel__loading-text">加载中...</span>
			</div>

			<div class="map-data-stats-panel__table-card">
				<div class="map-data-stats-panel__table-wrap" role="region" aria-label="统计表格">
					<table class="map-data-stats-panel__table">
						<thead>
							<tr>
								<th class="is-left">期数</th>
								<th>总任务</th>
								<th class="is-unverified">未核查</th>
								<th class="is-verified">已核查</th>
								<th class="is-pending">待处置</th>
								<th class="is-disposed">已处置</th>
							</tr>
						</thead>
						<tbody>
							<tr v-if="!tableRows.length">
								<td class="is-empty" colspan="6">暂无数据</td>
							</tr>
							<tr v-for="row in tableRows" :key="row.phase">
								<td class="is-left">
									<span class="map-data-stats-panel__phase-box" :title="row.periodName || undefined">
										{{ row.phase }}
									</span>
								</td>
								<td>
									<span class="map-data-stats-panel__num">{{ row.total }}</span>
								</td>
								<td>
									<span class="map-data-stats-panel__num is-unverified">{{ row.unverified }}</span>
								</td>
								<td>
									<span class="map-data-stats-panel__num is-verified">{{ row.verified }}</span>
								</td>
								<td>
									<span class="map-data-stats-panel__num is-pending">{{ row.pending }}</span>
								</td>
								<td>
									<span class="map-data-stats-panel__num is-disposed">{{ row.disposed }}</span>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		</section>

		<YearPickerSheet
			v-model:visible="yearPickerVisible"
			v-model="selectedYear"
			:years="yearPickerOptions"
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
	background: #141414;
	color: #fff;
	overflow: hidden;
}

.map-data-stats-panel__header {
	flex-shrink: 0;
	padding: calc(10px + env(safe-area-inset-top, 0px)) 12px 10px;
	background: #141414;
	border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.map-data-stats-panel__header-inner {
	display: grid;
	grid-template-columns: 1fr auto 1fr;
	align-items: center;
	min-height: 32px;
}

.map-data-stats-panel__title {
	grid-column: 2;
	margin: 0;
	font-size: 14px;
	font-weight: 600;
	letter-spacing: 0.02em;
	color: rgba(255, 255, 255, 0.92);
	line-height: 1.3;
}

.map-data-stats-panel__year-btn {
	grid-column: 3;
	justify-self: end;
	display: inline-flex;
	align-items: center;
	gap: 2px;
	height: 24px;
	padding: 0 8px;
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 6px;
	background: rgba(255, 255, 255, 0.06);
	color: rgba(255, 255, 255, 0.82);
	font-size: 12px;
	line-height: 1;
	cursor: pointer;
	-webkit-tap-highlight-color: transparent;
	transition:
		background 0.15s ease,
		border-color 0.15s ease,
		color 0.15s ease;

	&.is-active {
		background: rgba(28, 222, 212, 0.1);
		border-color: rgba(28, 222, 212, 0.35);
		color: var(--app-accent, #1cded4);
	}

	&:active {
		transform: scale(0.98);
	}
}

.map-data-stats-panel__year-label {
	font-weight: 500;
	letter-spacing: 0.01em;
}

.map-data-stats-panel__year-arrow {
	width: 12px;
	height: 12px;
	opacity: 0.7;
	transition: transform 0.2s ease;
}

.map-data-stats-panel__year-btn.is-active .map-data-stats-panel__year-arrow {
	opacity: 1;
}

.map-data-stats-panel__content {
	flex: 1;
	min-height: 0;
	display: flex;
	flex-direction: column;
	padding: 0;
	box-sizing: border-box;
	overflow: hidden;
	position: relative;
}

.map-data-stats-panel__loading {
	position: absolute;
	inset: 0;
	z-index: 2;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 10px;
	background: rgba(20, 20, 20, 0.72);
	backdrop-filter: blur(2px);
	-webkit-backdrop-filter: blur(2px);
}

.map-data-stats-panel__spinner {
	width: 28px;
	height: 28px;
	border: 2px solid rgba(28, 222, 212, 0.18);
	border-top-color: var(--app-accent, #1cded4);
	border-radius: 50%;
	animation: map-data-stats-spin 0.8s linear infinite;
}

.map-data-stats-panel__loading-text {
	font-size: 13px;
	color: rgba(255, 255, 255, 0.72);
	letter-spacing: 0.04em;
}

@keyframes map-data-stats-spin {
	to {
		transform: rotate(360deg);
	}
}

.map-data-stats-panel__table-card {
	flex: 1;
	min-height: 0;
	background: #000;
	overflow: hidden;
}

.map-data-stats-panel__table-wrap {
	height: 100%;
	overflow-x: hidden;
	overflow-y: auto;
	-webkit-overflow-scrolling: touch;
	overscroll-behavior: contain;
	scrollbar-width: none;

	&::-webkit-scrollbar {
		display: none;
	}
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
	background: #1a1a1a;
	border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.map-data-stats-panel__table th,
.map-data-stats-panel__table td {
	padding: 12px 4px;
	text-align: center;
	line-height: 1.25;
	font-weight: 400;
	border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.map-data-stats-panel__table th {
	padding-top: 10px;
	padding-bottom: 10px;
	color: rgba(255, 255, 255, 0.75);
	font-size: 12px;
	font-weight: 500;
	letter-spacing: 0.01em;
	white-space: nowrap;
}

.map-data-stats-panel__table td {
	font-size: 12px;
	color: rgba(255, 255, 255, 0.92);
	font-variant-numeric: tabular-nums;
	background: #000;
}

.map-data-stats-panel__table tbody tr:active {
	background: rgba(255, 255, 255, 0.04);
}

.map-data-stats-panel__table .is-left {
	text-align: left;
	padding-left: 12px;
}

.map-data-stats-panel__table .is-empty {
	padding: 28px 12px;
	color: rgba(255, 255, 255, 0.45);
	font-size: 12px;
	text-align: center;
}

.map-data-stats-panel__phase-box {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	min-width: 24px;
	height: 24px;
	padding: 0 4px;
	border: 1px solid rgba(255, 255, 255, 0.2);
	border-radius: 4px;
	background: transparent;
	color: rgba(255, 255, 255, 0.92);
	font-size: 12px;
	font-weight: 600;
	line-height: 1;
}

.map-data-stats-panel__num {
	display: inline-flex;
	align-items: baseline;
	justify-content: center;
	min-width: 2ch;
	padding: 0 2px;
	font-weight: 500;
	color: rgba(255, 255, 255, 0.92);
}
</style>
