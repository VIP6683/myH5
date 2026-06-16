/** 按图层 id 列表过滤服务端返回的树 */
export function filterLayerTreeByIds(tree, ids = []) {
	if (!ids?.length || !Array.isArray(tree)) {
		return tree;
	}

	const idSet = new Set(ids.map((id) => Number(id)));
	return tree.filter((node) => idSet.has(Number(node.id)));
}

/** 在树中按 id 查找节点 */
export function findLayerNodeById(tree, id) {
	if (!Array.isArray(tree)) return null;
	const target = Number(id);

	for (const node of tree) {
		if (Number(node.id) === target) return node;
		const child = findLayerNodeById(node.children, id);
		if (child) return child;
	}
	return null;
}

/**
 * 勾选父节点时要加载的 WMS 节点（父节点有 layerUrl 时包含自身 + 子节点）
 */
export function collectWmsNodesForCheck(node) {
	if (!node) return [];
	const list = [];
	if (node.layerUrl) list.push(node);
	if (Array.isArray(node.children) && node.children.length) {
		for (const child of node.children) {
			list.push(...collectWmsNodesForCheck(child));
		}
	}
	return list;
}

/** 根据默认勾选 id 列表收集节点 */
export function resolveDefaultCheckedNodes(tree, ids = []) {
	const nodes = [];
	for (const id of ids) {
		const node = findLayerNodeById(tree, id);
		if (node) nodes.push(...collectWmsNodesForCheck(node));
	}
	const seen = new Set();
	return nodes.filter((n) => {
		if (seen.has(n.id)) return false;
		seen.add(n.id);
		return Boolean(n.layerUrl);
	});
}

/**
 * 注记配置（对齐原 Map.vue layersInfo[0]：优先 wmts / 名称含注记，否则取第一项）
 */
export function findAnnotationLayerConfig(configList = []) {
	if (!Array.isArray(configList) || !configList.length) {
		return null;
	}

	const byType = configList.find(
		(item) => String(item?.urlType || '').toLowerCase() === 'wmts' && item?.url && item?.layer
	);
	if (byType) return byType;

	const byName = configList.find(
		(item) => item?.name?.includes('注记') && item?.url && item?.layer
	);
	if (byName) return byName;

	const first = configList[0];
	if (first?.url && first?.layer) return first;

	return null;
}

/** 底图下拉：仅保留名称含「卫星影像」的 WMS 项 */
export function parseBasemapWmsOptions(configList = []) {
	if (!Array.isArray(configList)) {
		return [];
	}

	return configList.filter((item) => item?.name?.includes('卫星影像'));
}

/** 从 layersData 中取 DEM 地形服务地址 */
export function findDemTerrainUrl(configList = []) {
	if (!Array.isArray(configList)) {
		return '';
	}
	const dem = configList.find((item) => item?.urlType === 'dem');
	return dem?.url || '';
}

/** 进入地图后默认勾选 layerUrl 含 region 的节点（对齐原 Map.vue createMap） */
export function resolveRegionDefaultNodes(tree) {
	const nodes = [];

	const walk = (list) => {
		for (const node of list || []) {
			if (node?.layerUrl && String(node.layerUrl).includes('region')) {
				nodes.push(...collectWmsNodesForCheck(node));
			}
			if (node?.children?.length) {
				walk(node.children);
			}
		}
	};

	walk(tree);

	const seen = new Set();
	return nodes.filter((n) => {
		if (seen.has(n.id)) return false;
		seen.add(n.id);
		return Boolean(n.layerUrl);
	});
}
