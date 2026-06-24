import { watch } from 'vue';
import {
	createEmptyFilters,
	getMonitorTypeFromTab,
	resolveDefaultMonitorFilters
} from '../utils/monitorFilters.js';

function isMonitorRouteTab(tab) {
	return tab === 'area-monitor' || tab === 'line-monitor';
}

const MONITOR_TAB_HANDLERS = {
	'line-monitor': {
		refreshCount(ctx) {
			return ctx.loadLineTaskListCount(ctx.buildMonitorQuery());
		},
		refreshList(ctx) {
			return ctx.loadLineTaskList({
				filters: ctx.appliedFilters.value,
				headerTab: ctx.headerTab.value,
				keyword: ctx.searchKeyword.value.trim()
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
		appliedFilters,
		patchListSnap,
		loadTaskListCount,
		loadLineTaskListCount,
		loadTaskList,
		loadLineTaskList
	} = ctx;

	let defaultFiltersGeneration = 0;

	function buildMonitorQuery() {
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

	function hasYearPeriodFilters() {
		return Boolean(appliedFilters.value.year && appliedFilters.value.period);
	}

	async function ensureDefaultFilters() {
		if (hasYearPeriodFilters()) {
			return true;
		}

		const generation = ++defaultFiltersGeneration;
		const monitorType = getMonitorTypeFromTab(activeTab.value);
		const defaults = await resolveDefaultMonitorFilters(monitorType);

		if (generation !== defaultFiltersGeneration) {
			return false;
		}

		if (!defaults.year || !defaults.period) {
			return false;
		}

		appliedFilters.value = {
			...appliedFilters.value,
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

	function handleFilterChange(filters) {
		if (!isMonitorTab.value) {
			return;
		}
		appliedFilters.value = filters;
		patchListSnap.value = 'peek';
		refreshMonitorData();
	}

	function resetAppliedFiltersToDefaults() {
		defaultFiltersGeneration += 1;
		appliedFilters.value = createEmptyFilters();
	}

	watch(
		[activeTab, headerTab, searchKeyword],
		([tab, htab], [prevTab, prevHtab]) => {
			const leavingMonitor = !isMonitorTab.value && isMonitorRouteTab(prevTab);
			const enteringMonitor = isMonitorTab.value && !isMonitorRouteTab(prevTab);
			const monitorTypeChanged =
				isMonitorRouteTab(tab) &&
				isMonitorRouteTab(prevTab) &&
				getMonitorTypeFromTab(tab) !== getMonitorTypeFromTab(prevTab);
			const headerTabChanged =
				isMonitorTab.value && prevHtab !== undefined && htab !== prevHtab;

			if (leavingMonitor) {
				resetAppliedFiltersToDefaults();
				return;
			}

			if (!isMonitorTab.value) {
				return;
			}

			if (enteringMonitor || monitorTypeChanged || headerTabChanged) {
				resetAppliedFiltersToDefaults();
			}

			refreshMonitorData();
		},
		{ immediate: true }
	);

	return {
		refreshMonitorData,
		refreshTaskList,
		refreshTaskListCount,
		handleFilterChange
	};
}
