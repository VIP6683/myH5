import { nextTick, watch } from 'vue';
import {
	createDefaultMonitorFilters,
	getMonitorTypeFromTab,
	mergeHeaderTabFilters,
	resolveDefaultMonitorFilters
} from '../utils/monitorFilters.js';

function isMonitorRouteTab(tab) {
	return tab === 'area-monitor' || tab === 'line-monitor';
}

function normalizeLineQuery(query = {}) {
	return {
		lineName: String(query?.lineName || '').trim(),
		startTower: String(query?.startTower || '').trim(),
		endTower: String(query?.endTower || '').trim()
	};
}

function hasLineQueryValues(query = {}) {
	const normalized = normalizeLineQuery(query);
	return Boolean(normalized.lineName || normalized.startTower || normalized.endTower);
}

const MONITOR_TAB_HANDLERS = {
	'line-monitor': {
		refreshCount(ctx) {
			return ctx.loadLineTaskListCount(ctx.buildMonitorQuery());
		},
		refreshList(ctx) {
			return ctx.loadLineTaskList({
				filters: ctx.buildMonitorQuery(),
				headerTab: ctx.headerTab.value
			});
		}
	},
	'area-monitor': {
		refreshCount(ctx) {
			return ctx.loadTaskListCount(ctx.buildMonitorQuery());
		},
		refreshList(ctx) {
			return ctx.loadTaskList({
				filters: ctx.appliedFilters.value,
				headerTab: ctx.headerTab.value,
				keyword: ctx.searchKeyword.value.trim()
			});
		}
	}
};

/**
 * 监测页任务列表与角标刷新（面状 / 线状共用调度）
 */
export function useMonitorRefresh(ctx) {
	const {
		activeTab,
		isMonitorTab,
		headerTab,
		searchKeyword,
		lineQuery,
		appliedFilters,
		patchListSnap,
		loadTaskListCount,
		loadLineTaskListCount,
		loadTaskList,
		loadLineTaskList
	} = ctx;

	let defaultFiltersGeneration = 0;

	function buildMonitorQuery() {
		if (activeTab.value === 'line-monitor') {
			return {
				...appliedFilters.value,
				...normalizeLineQuery(lineQuery?.value)
			};
		}

		const keyword = searchKeyword.value.trim();
		return keyword ? { ...appliedFilters.value, keyword } : appliedFilters.value;
	}

	const refreshCtx = {
		...ctx,
		buildMonitorQuery,
		loadTaskListCount,
		loadLineTaskListCount,
		loadTaskList,
		loadLineTaskList
	};

	function revealPatchList() {
		if (patchListSnap.value === 'collapsed') {
			patchListSnap.value = 'peek';
		}
	}

	function hasYearPeriodFilters() {
		return Boolean(appliedFilters.value.year && appliedFilters.value.period);
	}

	async function ensureDefaultFilters() {
		if (hasYearPeriodFilters()) {
			return true;
		}

		const generation = ++defaultFiltersGeneration;
		const monitorType = getMonitorTypeFromTab(activeTab.value);
		const defaults = await resolveDefaultMonitorFilters(monitorType, headerTab.value);

		if (generation !== defaultFiltersGeneration) {
			return false;
		}

		if (!defaults.year || !defaults.period) {
			return false;
		}

		appliedFilters.value = {
			...createDefaultMonitorFilters(headerTab.value),
			...appliedFilters.value,
			taskStatus: defaults.taskStatus,
			year: defaults.year,
			period: defaults.period
		};
		return true;
	}

	async function refreshTaskListCount() {
		if (!isMonitorTab.value) {
			return;
		}

		const handler = MONITOR_TAB_HANDLERS[activeTab.value];
		if (!handler) {
			return;
		}

		try {
			await handler.refreshCount(refreshCtx);
		} catch {
			// 角标加载失败时保持默认值
		}
	}

	async function refreshTaskList() {
		if (!isMonitorTab.value) {
			return;
		}

		const handler = MONITOR_TAB_HANDLERS[activeTab.value];
		if (!handler) {
			return;
		}

		try {
			await handler.refreshList(refreshCtx);
		} catch {
			// 图斑加载失败时保持当前图层
		}
	}

	async function refreshMonitorData() {
		if (!isMonitorTab.value) {
			return;
		}

		const ready = await ensureDefaultFilters();
		if (!ready) {
			return;
		}

		await Promise.allSettled([refreshTaskListCount(), refreshTaskList()]);
	}

	function resolveHeaderTabByTaskStatus(taskStatus) {
		const status = String(taskStatus ?? '');
		if (status === '2') {
			return 'pending-dispose';
		}
		if (status === '0') {
			return 'pending-verify';
		}
		return null;
	}

	function handleFilterChange(filters) {
		if (!isMonitorTab.value) {
			return;
		}
		appliedFilters.value = filters;

		const nextHeaderTab = resolveHeaderTabByTaskStatus(filters?.taskStatus);
		if (nextHeaderTab && headerTab.value !== nextHeaderTab) {
			// 先切 tab，再等筛选面板收起后展开列表，避免与关面板竞态把列表压回折叠
			headerTab.value = nextHeaderTab;
			nextTick(() => {
				revealPatchList();
			});
			return;
		}

		refreshMonitorData();
		nextTick(() => {
			revealPatchList();
		});
	}

	function syncHeaderTabFilters() {
		appliedFilters.value = mergeHeaderTabFilters(
			appliedFilters.value,
			headerTab.value
		);
	}

	watch(
		[activeTab, headerTab, searchKeyword, lineQuery],
		([tab, htab, , query], prev = []) => {
			const [prevTab, prevHtab, prevKeyword, prevQuery] = prev;
			const enteringMonitor = isMonitorTab.value && !isMonitorRouteTab(prevTab);
			const monitorTypeChanged =
				isMonitorRouteTab(tab) &&
				isMonitorRouteTab(prevTab) &&
				getMonitorTypeFromTab(tab) !== getMonitorTypeFromTab(prevTab);
			const headerTabChanged =
				isMonitorTab.value && prevHtab !== undefined && htab !== prevHtab;

			if (!isMonitorTab.value) {
				return;
			}

			if (enteringMonitor || monitorTypeChanged || headerTabChanged) {
				syncHeaderTabFilters();
			}

			// 面状 / 线状距离区间枚举不同，切换时清空避免串值
			if (monitorTypeChanged) {
				appliedFilters.value = {
					...appliedFilters.value,
					distanceSubstationRange: []
				};
			}

			const lineQueryChanged =
				tab === 'line-monitor' &&
				prevQuery !== undefined &&
				JSON.stringify(normalizeLineQuery(query)) !==
					JSON.stringify(normalizeLineQuery(prevQuery));
			const keywordChanged =
				tab === 'area-monitor' &&
				prevKeyword !== undefined &&
				String(prevKeyword || '').trim() !== String(searchKeyword.value || '').trim();

			// 顶部查询条件变化后展开列表，与筛选「确定」行为一致
			if (lineQueryChanged || keywordChanged) {
				if (lineQueryChanged) {
					if (hasLineQueryValues(query) || hasLineQueryValues(prevQuery)) {
						revealPatchList();
					}
				} else if (String(searchKeyword.value || '').trim()) {
					revealPatchList();
				}
			}

			refreshMonitorData();
		},
		{ immediate: true, deep: true }
	);

	return {
		refreshMonitorData,
		refreshTaskList,
		refreshTaskListCount,
		handleFilterChange
	};
}
