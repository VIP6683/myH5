import { ref } from 'vue';
import { fetchSurfaceTree } from '../api/statistics.js';

const tree = ref(null);
const loading = ref(false);
const error = ref(null);
let loadPromise = null;

/** 进入系统后加载面状异物期数树（幂等，并发复用同一请求） */
export function useSurfaceTree() {
	async function loadSurfaceTree() {
		if (tree.value) {
			return tree.value;
		}

		if (loadPromise) {
			return loadPromise;
		}

		loading.value = true;
		error.value = null;

		loadPromise = fetchSurfaceTree()
			.then((data) => {
				tree.value = data;
				return data;
			})
			.catch((err) => {
				error.value = err;
				throw err;
			})
			.finally(() => {
				loading.value = false;
				loadPromise = null;
			});

		return loadPromise;
	}

	function resetSurfaceTree() {
		tree.value = null;
		error.value = null;
		loadPromise = null;
	}

	return {
		tree,
		loading,
		error,
		loadSurfaceTree,
		resetSurfaceTree
	};
}
