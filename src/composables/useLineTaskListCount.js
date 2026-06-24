import { ref } from 'vue';
import { fetchLineTaskListCount } from '../api/lineMonitor.js';
import { normalizeTaskListCount } from '../api/statistics.js';

const counts = ref(normalizeTaskListCount(null));
const loading = ref(false);
let loadPromise = null;
let latestQueryKey = '';

function buildQueryKey(query = {}) {
	return JSON.stringify({ query });
}

/** 线状异物任务角标统计（顶部 Tab + 底部菜单复用） */
export function useLineTaskListCount() {
	async function loadLineTaskListCount(query = {}) {
		const queryKey = buildQueryKey(query);
		if (loadPromise && queryKey === latestQueryKey) {
			return loadPromise;
		}

		latestQueryKey = queryKey;
		loading.value = true;

		loadPromise = fetchLineTaskListCount(query)
			.then((data) => {
				if (queryKey === latestQueryKey) {
					counts.value = normalizeTaskListCount(data);
				}
				return counts.value;
			})
			.catch((error) => {
				if (queryKey === latestQueryKey) {
					counts.value = normalizeTaskListCount(null);
				}
				throw error;
			})
			.finally(() => {
				loading.value = false;
				loadPromise = null;
			});

		return loadPromise;
	}

	function resetLineTaskListCount() {
		counts.value = normalizeTaskListCount(null);
		latestQueryKey = '';
		loadPromise = null;
	}

	return {
		counts,
		loading,
		loadLineTaskListCount,
		resetLineTaskListCount
	};
}
