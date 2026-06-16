<script setup>
import { computed, ref } from 'vue';
import DraggableBottomSheet from '../../../components/DraggableBottomSheet.vue';
import { filterMonitorPatches, toPatchListRow } from '../utils/filterMonitorPatches.js';
import { locateMonitorPatch } from '../utils/locateMonitorPatch.js';
import { getMonitorPatches } from '../utils/monitorMockStore.js';

const visible = defineModel('visible', { type: Boolean, default: false });

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
			objectType: [],
			verifyStatus: '',
			disposeStatus: ''
		})
	}
});

const locatingId = ref('');
const expanded = ref(false);

const shadeOpacity = computed(() => (expanded.value ? 0.35 : 0));
const closeOnShade = computed(() => expanded.value);

const close = () => {
	visible.value = false;
};

const patchKind = computed(() => (props.activeTab === 'line-monitor' ? 'line' : 'area'));

const listRows = computed(() => {
	const patches = getMonitorPatches(patchKind.value);
	const filtered = filterMonitorPatches(patches, {
		filters: props.filters,
		headerTab: props.headerTab
	});
	return filtered.map(toPatchListRow);
});

const onLocate = async (row) => {
	if (!row?.id || locatingId.value) {
		return;
	}

	locatingId.value = row.id;
	try {
		await locateMonitorPatch(row.id);
	} finally {
		locatingId.value = '';
	}
};
</script>

<template>
	<DraggableBottomSheet
		v-model:visible="visible"
		v-model:expanded="expanded"
		aria-label="图斑列表"
		theme="dark"
		panel-class="map-patch-list-sheet__panel"
		peek-height="38vh"
		peek-pass-through
		:close-on-shade="closeOnShade"
		:shade-opacity="shadeOpacity"
	>
		<template #header>
			<header class="map-patch-list-sheet__header">
				<h2 class="map-patch-list-sheet__title">图斑列表</h2>
				<button type="button" class="map-patch-list-sheet__close" @click="close">
					取消
				</button>
			</header>
		</template>

		<div class="map-patch-list-sheet__body">
			<div class="map-patch-list-sheet__table-wrap">
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
						<tr v-if="!listRows.length">
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
			</div>
		</div>
	</DraggableBottomSheet>
</template>

<style scoped lang="scss">
.map-patch-list-sheet__header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	padding: 4px 16px 10px;
	flex-shrink: 0;
}

.map-patch-list-sheet__title {
	margin: 0;
	font-size: 16px;
	font-weight: 500;
	color: var(--app-accent, #1cded4);
	line-height: 1.3;
}

.map-patch-list-sheet__close {
	flex-shrink: 0;
	padding: 4px 0;
	border: 0;
	background: transparent;
	color: rgba(255, 255, 255, 0.72);
	font-size: 14px;
	font-weight: 400;
	line-height: 1.4;
	cursor: pointer;
	-webkit-tap-highlight-color: transparent;

	&:active {
		opacity: 0.85;
	}
}

.map-patch-list-sheet__body {
	padding: 0 12px 12px;
	box-sizing: border-box;
	min-height: 0;
}

.map-patch-list-sheet__table-wrap {
	border-radius: 8px;
	overflow: hidden;
	background: rgba(255, 255, 255, 0.03);
}

.map-patch-list-sheet__table {
	width: 100%;
	border-collapse: collapse;
	table-layout: fixed;
}

.map-patch-list-sheet__table thead {
	background: rgba(255, 255, 255, 0.06);
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
