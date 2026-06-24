import { computed, ref } from 'vue';
import { fetchTaskList, normalizeTaskList } from '../api/statistics.js';

export const TASK_LIST_PAGE_SIZE = 1500;

const patches = ref([]);
const total = ref(0);
const pageNum = ref(0);
const visibleListCount = ref(0);
const loading = ref(false);
const loadingMore = ref(false);
const hasMore = computed(() => patches.value.length < total.value);
const listHasMore = computed(() => visibleListCount.value < total.value);
const visiblePatches = computed(() => patches.value.slice(0, visibleListCount.value));

let loadPromise = null;
const latestQueryKey = ref('');
let latestQueryParams = null;
const queryKey = computed(() => latestQueryKey.value);

function resetPatchesState() {
	patches.value = [];
	total.value = 0;
	pageNum.value = 0;
	visibleListCount.value = 0;
}

function buildQueryKey({ filters = {}, headerTab = '', keyword = '' } = {}) {
	return JSON.stringify({ filters, headerTab, keyword });
}

function appendPatches(incoming) {
	if (!incoming.length) {
		return 0;
	}

	const existingIds = new Set(patches.value.map((patch) => patch.id));
	const nextPatches = incoming.filter((patch) => !existingIds.has(patch.id));
	if (nextPatches.length) {
		patches.value = [...patches.value, ...nextPatches];
	}
	return nextPatches.length;
}

function syncVisibleListCount({ replace = false, revealNew = 0 } = {}) {
	if (replace) {
		visibleListCount.value = Math.min(TASK_LIST_PAGE_SIZE, patches.value.length);
		return;
	}

	if (revealNew > 0) {
		visibleListCount.value = Math.min(visibleListCount.value + revealNew, patches.value.length);
	}
}

async function fetchTaskListPage(page) {
	if (!latestQueryParams) {
		return { total: 0, patches: [] };
	}

	const { filters, headerTab, keyword } = latestQueryParams;
	const data = await fetchTaskList(filters, {
		headerTab,
		keyword,
		pageNum: page,
		pageSize: TASK_LIST_PAGE_SIZE
	});
	return normalizeTaskList(data);
}

function applyPageResult(normalized, page, replace, { revealInList = 0 } = {}) {
	if (replace) {
		patches.value = normalized.patches;
		syncVisibleListCount({ replace: true });
	} else {
		appendPatches(normalized.patches);
		syncVisibleListCount({ revealNew: revealInList });
	}

	total.value = normalized.total;
	pageNum.value = page;
	return normalized;
}

export function findTaskListPatch(patchId) {
	if (patchId === undefined || patchId === null || patchId === '') {
		return null;
	}
	return patches.value.find((patch) => String(patch.id) === String(patchId)) || null;
}

/** 面状异物任务列表（地图图斑 + 底部列表复用） */
export function useTaskList() {
	async function loadTaskList({ filters = {}, headerTab = '', keyword = '' } = {}) {
		const queryParams = { filters, headerTab, keyword };
		const nextQueryKey = buildQueryKey(queryParams);

		if (loadPromise && nextQueryKey === latestQueryKey.value) {
			return loadPromise;
		}

		resetPatchesState();
		latestQueryKey.value = nextQueryKey;
		latestQueryParams = queryParams;
		loading.value = true;

		loadPromise = fetchTaskListPage(1)
			.then((normalized) => {
				if (nextQueryKey !== latestQueryKey.value) {
					return normalized;
				}
				return applyPageResult(normalized, 1, true);
			})
			.catch((error) => {
				if (nextQueryKey === latestQueryKey.value) {
					resetPatchesState();
				}
				throw error;
			})
			.finally(() => {
				loading.value = false;
				loadPromise = null;
			});

		return loadPromise;
	}

	async function loadMoreTaskList({ revealInList = 0 } = {}) {
		if (loading.value || loadingMore.value || !hasMore.value || !latestQueryParams) {
			return null;
		}

		const requestQueryKey = latestQueryKey.value;
		const nextPage = pageNum.value + 1;
		loadingMore.value = true;

		try {
			const normalized = await fetchTaskListPage(nextPage);
			if (requestQueryKey !== latestQueryKey.value) {
				return normalized;
			}
			return applyPageResult(normalized, nextPage, false, { revealInList });
		} finally {
			loadingMore.value = false;
		}
	}

	/** 列表上滑：优先展示已预取数据，不足时再请求下一页 */
	async function revealMoreListRows() {
		if (!listHasMore.value) {
			return null;
		}

		const hiddenCount = patches.value.length - visibleListCount.value;
		if (hiddenCount > 0) {
			syncVisibleListCount({
				revealNew: Math.min(TASK_LIST_PAGE_SIZE, hiddenCount)
			});
			return null;
		}

		return loadMoreTaskList({ revealInList: TASK_LIST_PAGE_SIZE });
	}

	function resetTaskList() {
		resetPatchesState();
		latestQueryKey.value = '';
		latestQueryParams = null;
		loadPromise = null;
	}

	return {
		patches,
		visiblePatches,
		visibleListCount,
		total,
		pageNum,
		queryKey,
		hasMore,
		listHasMore,
		loading,
		loadingMore,
		loadTaskList,
		loadMoreTaskList,
		revealMoreListRows,
		findTaskListPatch,
		resetTaskList
	};
}
