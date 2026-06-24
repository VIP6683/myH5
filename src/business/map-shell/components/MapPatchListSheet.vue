<script setup>
import { computed, ref, watch } from 'vue';
import DraggableBottomSheet from '../../../components/DraggableBottomSheet.vue';
import { useLineTaskList } from '../../../composables/useLineTaskList.js';
import { useTaskList } from '../../../composables/useTaskList.js';
import { toPatchListRow } from '../utils/filterMonitorPatches.js';
import { clearMonitorPatchHighlight } from '../utils/highlightMonitorPatch.js';
import { locateMonitorPatch } from '../utils/locateMonitorPatch.js';

const {
	visiblePatches,
	total: taskListTotal,
	listHasMore: taskListListHasMore,
	loading: taskListLoading,
	loadingMore: taskListLoadingMore,
	revealMoreListRows
} = useTaskList();

const {
	visiblePatches: lineVisiblePatches,
	total: lineTaskListTotal,
	listHasMore: lineTaskListListHasMore,
	loading: lineTaskListLoading,
	loadingMore: lineTaskListLoadingMore,
	revealMoreLineListRows
} = useLineTaskList();

const visible = defineModel('visible', { type: Boolean, default: false });
const snap = defineModel('snap', {
	type: String,
	default: 'collapsed',
	validator: (value) => ['collapsed', 'peek', 'expanded'].includes(value)
});

const PATCH_LIST_SHEET_Z_INDEX = 1050;

const props = defineProps({
	activeTab: {
		type: String,
		default: 'area-monitor'
	},
	headerTab: {
		type: String,
		default: 'pending-verify'
	},
	filters: {
		type: Object,
		default: () => ({
			year: '',
			objectType: '',
			verifyStatus: '',
			disposeStatus: ''
		})
	}
});

const locatingId = ref('');
const tableWrapRef = ref(null);

const shadeOpacity = computed(() => (snap.value === 'expanded' ? 0.35 : 0));
const closeOnShade = computed(() => snap.value === 'expanded');

const patchKind = computed(() => (props.activeTab === 'line-monitor' ? 'line' : 'area'));
const isAreaList = computed(() => patchKind.value === 'area');
const isLineList = computed(() => patchKind.value === 'line');

const listRows = computed(() => {
	if (isAreaList.value) {
		return visiblePatches.value.map(toPatchListRow);
	}

	if (isLineList.value) {
		return lineVisiblePatches.value.map(toPatchListRow);
	}

	return [];
});

const listLoading = computed(() =>
	isLineList.value ? lineTaskListLoading.value : taskListLoading.value
);

const listLoadingMore = computed(() =>
	isLineList.value ? lineTaskListLoadingMore.value : taskListLoadingMore.value
);

const listTotal = computed(() => (isLineList.value ? lineTaskListTotal.value : taskListTotal.value));

const listHasMore = computed(() =>
	isLineList.value ? lineTaskListListHasMore.value : taskListListHasMore.value
);

const listFooterText = computed(() => {
	if (!isAreaList.value && !isLineList.value) {
		return '';
	}
	if (listLoading.value) {
		return '加载中...';
	}
	if (listLoadingMore.value) {
		return '加载更多...';
	}
	if (!listRows.value.length) {
		return '';
	}
	if (listHasMore.value) {
		return `已显示 ${listRows.value.length} / ${listTotal.value}，上滑加载更多`;
	}
	return `已显示全部 ${listRows.value.length} 条`;
});

const tryLoadMore = async () => {
	if (!listHasMore.value || listLoading.value || listLoadingMore.value) {
		return;
	}

	try {
		if (isLineList.value) {
			await revealMoreLineListRows();
			return;
		}
		await revealMoreListRows();
	} catch {
		// 分页失败时保留已加载数据
	}
};

const onTableScroll = (event) => {
	const target = event.target;
	if (!target) {
		return;
	}

	const threshold = 48;
	if (target.scrollTop + target.clientHeight >= target.scrollHeight - threshold) {
		void tryLoadMore();
	}
};

const onLocate = async (row) => {
	if (!row?.id || locatingId.value) {
		return;
	}

	locatingId.value = row.id;
	try {
		await locateMonitorPatch(row.id, row.patch);
	} finally {
		locatingId.value = '';
	}
};

watch(snap, (value) => {
	if (value === 'expanded') {
		requestAnimationFrame(() => {
			onTableScroll({ target: tableWrapRef.value });
		});
	}
});

watch(visible, (value) => {
	if (!value) {
		clearMonitorPatchHighlight();
	}
});
</script>

<template>
	<DraggableBottomSheet
		v-model:visible="visible"
		v-model:snap="snap"
		aria-label="图斑列表"
		theme="dark"
		:z-index="PATCH_LIST_SHEET_Z_INDEX"
		panel-class="map-patch-list-sheet__panel"
		body-scroll="inner"
		peek-height="38vh"
		collapsed-height="20"
		persistent
		:allow-drag="true"
		:close-on-shade="closeOnShade"
		:shade-opacity="shadeOpacity"
	>
		<template #header>
			<header class="map-patch-list-sheet__header">
				<h2 class="map-patch-list-sheet__title">图斑列表</h2>
			</header>
		</template>

		<div class="map-patch-list-sheet__body">
			<div
				ref="tableWrapRef"
				class="map-patch-list-sheet__table-wrap"
				:class="{ 'is-expanded': snap === 'expanded' }"
				data-bottom-sheet-scroll
				@scroll.passive="onTableScroll"
			>
				<table class="map-patch-list-sheet__table">
					<thead>
						<tr>
							<th>年份</th>
							<th>异物类型</th>
							<th>核查状态</th>
							<th>处置状态</th>
							<th>操作</th>
						</tr>
					</thead>
					<tbody>
						<tr v-if="!listRows.length && !listLoading">
							<td class="map-patch-list-sheet__empty" colspan="5">暂无数据</td>
						</tr>
						<tr v-for="row in listRows" :key="row.id">
							<td>{{ row.year }}</td>
							<td>{{ row.objectTypeLabel }}</td>
							<td>{{ row.verifyStatusLabel }}</td>
							<td>{{ row.disposeStatusLabel }}</td>
							<td>
								<button
									type="button"
									class="map-patch-list-sheet__locate"
									:disabled="locatingId === row.id"
									@click="onLocate(row)"
								>
									定位
								</button>
							</td>
						</tr>
					</tbody>
				</table>
				<p v-if="listFooterText" class="map-patch-list-sheet__footer">{{ listFooterText }}</p>
			</div>
		</div>
	</DraggableBottomSheet>
</template>

<style scoped lang="scss">
.map-patch-list-sheet__header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
	padding: 10px 14px 8px;
	flex-shrink: 0;
}

.map-patch-list-sheet__title {
	margin: 0;
	font-size: 14px;
	font-weight: 700;
	color: #1cded4;
	line-height: 1.25;
}

.map-patch-list-sheet__body {
	padding: 0 12px 12px;
	box-sizing: border-box;
	min-height: 0;
	flex: 1;
	display: flex;
	flex-direction: column;
	height: 100%;
}

.map-patch-list-sheet__table-wrap {
	flex: 1;
	min-height: 0;
	border-radius: 8px;
	overflow-x: hidden;
	overflow-y: auto;
	background: var(--app-drawer-surface, #25282c);
	max-height: min(52vh, 420px);
	-webkit-overflow-scrolling: touch;
	overscroll-behavior: contain;
	touch-action: pan-y;

	&.is-expanded {
		max-height: none;
	}
}

.map-patch-list-sheet__table {
	width: 100%;
	border-collapse: collapse;
	table-layout: fixed;
}

.map-patch-list-sheet__table thead {
	position: sticky;
	top: 0;
	z-index: 1;
	background: var(--app-drawer-surface, #25282c);
}

.map-patch-list-sheet__table th,
.map-patch-list-sheet__table td {
	padding: 12px 4px;
	text-align: center;
	font-size: 12px;
	line-height: 1.35;
	border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.map-patch-list-sheet__table th {
	color: rgba(255, 255, 255, 0.72);
	font-weight: 500;
	font-size: 12px;
}

.map-patch-list-sheet__table td {
	color: rgba(255, 255, 255, 0.9);
	font-variant-numeric: tabular-nums;
}

.map-patch-list-sheet__table tbody tr:last-child td {
	border-bottom: 0;
}

.map-patch-list-sheet__table th:first-child,
.map-patch-list-sheet__table td:first-child {
	width: 16%;
}

.map-patch-list-sheet__table th:nth-child(2),
.map-patch-list-sheet__table td:nth-child(2) {
	width: 22%;
}

.map-patch-list-sheet__table th:nth-child(3),
.map-patch-list-sheet__table td:nth-child(3),
.map-patch-list-sheet__table th:nth-child(4),
.map-patch-list-sheet__table td:nth-child(4) {
	width: 18%;
}

.map-patch-list-sheet__table th:last-child,
.map-patch-list-sheet__table td:last-child {
	width: 14%;
}

.map-patch-list-sheet__empty {
	padding: 28px 12px !important;
	color: rgba(255, 255, 255, 0.45) !important;
	text-align: center !important;
}

.map-patch-list-sheet__footer {
	margin: 0;
	padding: 10px 12px 12px;
	font-size: 12px;
	line-height: 1.4;
	color: rgba(255, 255, 255, 0.45);
	text-align: center;
}

.map-patch-list-sheet__locate {
	padding: 0;
	border: 0;
	background: transparent;
	color: var(--app-accent, #1cded4);
	font-size: 12px;
	font-weight: 500;
	line-height: 1.4;
	cursor: pointer;
	-webkit-tap-highlight-color: transparent;

	&:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	&:active:not(:disabled) {
		opacity: 0.85;
	}
}
</style>
