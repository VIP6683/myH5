<script setup>
import { onBeforeUnmount, onMounted, watch } from 'vue';
import { useLineTaskList } from '../../../composables/useLineTaskList.js';
import { useTaskList } from '../../../composables/useTaskList.js';
import { emitMapEvent, MapEventType } from '../../../map-kit/core/mapEvents.js';
import { getMapInstance } from '../../../map-kit/mapApi.js';
import {
	buildMonitorAreaStyle,
	getAbnormalTypeColor
} from '../constants/abnormalType.js';
import { MONITOR_LAYER_ID } from '../constants/monitorLayer.js';

const {
	patches: taskListPatches,
	pageNum: taskListPageNum,
	loading: taskListLoading
} = useTaskList();

const {
	patches: lineTaskListPatches,
	pageNum: lineTaskListPageNum,
	loading: lineTaskListLoading
} = useLineTaskList();

const GRAPHIC_CLICK_BOUND_KEY = '__monitorGraphicClickBound__';
const CLUSTER_LAYER_ID = `${MONITOR_LAYER_ID}__cluster__`;
const CLUSTER_MARKER_CLICK_BOUND_KEY = '__monitorClusterMarkerClickBound__';
const SHAPE_VISIBLE_MIN_ZOOM = 16;

const props = defineProps({
	activeTab: {
		type: String,
		default: 'area-monitor'
	}
});

let monitorLayer = null;
let clusterLayer = null;
let shapeVisibilityBound = false;
let renderRetryTimer = null;
let renderRetryAttempt = 0;
let renderGeneration = 0;
const renderedPatchIds = new Set();
const MAX_RENDER_RETRY_ATTEMPTS = 12;

function getMars2d() {
	return globalThis.mars2d;
}

function isMonitorTab(tab) {
	return tab === 'area-monitor' || tab === 'line-monitor';
}

function getPositionsCenter(positions) {
	if (!positions?.length) {
		return null;
	}

	let lng = 0;
	let lat = 0;

	for (const position of positions) {
		lng += position[0];
		lat += position[1];
	}

	return {
		lng: Number((lng / positions.length).toFixed(6)),
		lat: Number((lat / positions.length).toFixed(6))
	};
}

function toLatLngs(positions = []) {
	return positions.map(([lng, lat]) => [lat, lng]);
}

function buildClusterMarkerStyle(objectType) {
	const color = getAbnormalTypeColor(objectType);
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><circle cx="6" cy="6" r="5" fill="${color}" stroke="#fff" stroke-width="1"/></svg>`;
	return {
		image: `data:image/svg+xml,${encodeURIComponent(svg)}`,
		width: 12,
		height: 12
	};
}

function createMonitorClusterLayer(mars2d) {
	return new mars2d.layer.ClusterLayer({
		id: CLUSTER_LAYER_ID,
		name: '监测模拟聚合',
		chunkedLoading: true,
		showCoverageOnHover: false,
		disableClusteringAtZoom: SHAPE_VISIBLE_MIN_ZOOM,
		spiderfyOnMaxZoom: false
	});
}

function emitFeatureClick(graphic, event) {
	const attr = graphic?.attr || {};
	if (attr.kind !== 'area' && attr.kind !== 'line') {
		return;
	}

	emitMapEvent(MapEventType.FEATURE_CLICK, {
		kind: attr.kind,
		graphic,
		event,
		attr
	});
}

function bindGraphicClick(graphic) {
	if (!graphic || graphic[GRAPHIC_CLICK_BOUND_KEY]) {
		return;
	}

	const mars2d = getMars2d();
	graphic.on(mars2d.EventType.click, (event) => {
		emitFeatureClick(graphic, event);
	});
	graphic[GRAPHIC_CLICK_BOUND_KEY] = true;
}

function bindClusterMarkerClick(layer) {
	if (!layer || layer[CLUSTER_MARKER_CLICK_BOUND_KEY]) {
		return;
	}

	const mars2d = getMars2d();
	layer.on(mars2d.EventType.click, (event) => {
		const graphic = event?.graphic;
		if (!graphic || graphic.cluster) {
			return;
		}

		const patchId = graphic.attr?.patchId;
		const shapeGraphic = patchId ? monitorLayer?.getGraphicById?.(patchId) : null;
		if (shapeGraphic) {
			emitFeatureClick(shapeGraphic, event);
		}
	});

	layer[CLUSTER_MARKER_CLICK_BOUND_KEY] = true;
}

/** 面/线只在最大级别展示；低级别由 ClusterLayer 聚合中心点 */
function updateShapeLayerVisibility(map) {
	if (!monitorLayer || !clusterLayer) {
		return;
	}

	const showShapes = (map.getZoom?.() ?? 0) >= SHAPE_VISIBLE_MIN_ZOOM;
	monitorLayer.show = showShapes;
	clusterLayer.show = !showShapes;
}

function bindShapeLayerVisibility(map) {
	if (shapeVisibilityBound) {
		return;
	}

	const mars2d = getMars2d();
	map.on(mars2d.EventType.zoomend, () => updateShapeLayerVisibility(map));
	shapeVisibilityBound = true;
	updateShapeLayerVisibility(map);
}

async function ensureMonitorLayers(map) {
	const mars2d = getMars2d();
	const existingShapeLayer = map.getLayerById?.(MONITOR_LAYER_ID);
	const existingClusterLayer = map.getLayerById?.(CLUSTER_LAYER_ID);

	if (existingShapeLayer) {
		monitorLayer = existingShapeLayer;
		monitorLayer.hasEdit = false;
	}
	if (existingClusterLayer) {
		clusterLayer = existingClusterLayer;
	}

	if (!monitorLayer) {
		monitorLayer = new mars2d.layer.GraphicLayer({
			id: MONITOR_LAYER_ID,
			name: '监测模拟图层',
			hasEdit: false,
			isAutoEditing: false
		});
		await map.addLayer(monitorLayer);
	}

	if (!clusterLayer) {
		clusterLayer = createMonitorClusterLayer(mars2d);
		await map.addLayer(clusterLayer);
		bindClusterMarkerClick(clusterLayer);
	}

	bindShapeLayerVisibility(map);
	return { shapeLayer: monitorLayer, clusterLayer };
}

function resolvePatchStyle(patch) {
	const color = getAbnormalTypeColor(patch?.attr?.objectType);
	return buildMonitorAreaStyle(color);
}

function addPatchGraphic(layer, mars2d, patch, kind) {
	const positions = patch.positions;
	const center = getPositionsCenter(positions);
	const attr = {
		...patch.attr,
		kind,
		coordinates: center
	};
	const style = resolvePatchStyle(patch);

	const graphic = new mars2d.graphic.Polygon({
		id: patch.id,
		latlngs: toLatLngs(positions),
		style,
		attr,
		hasEdit: false,
		hasMoveEdit: false,
		isAutoEditing: false
	});

	layer.addGraphic(graphic);
	bindGraphicClick(graphic);
}

function addClusterMarker(layer, mars2d, patch, kind, center) {
	if (!center) {
		return;
	}

	layer.addGraphic(
		new mars2d.graphic.Marker({
			id: `${patch.id}__cluster`,
			latlng: [center.lat, center.lng],
			style: buildClusterMarkerStyle(patch?.attr?.objectType),
			attr: {
				...patch.attr,
				kind,
				patchId: patch.id,
				coordinates: center
			}
		})
	);
}

async function renderGraphics({ reset = false, generation = renderGeneration } = {}) {
	const map = getMapInstance();
	if (!map) {
		if (renderRetryAttempt < MAX_RENDER_RETRY_ATTEMPTS) {
			if (renderRetryTimer == null) {
				renderRetryTimer = setTimeout(() => {
					renderRetryTimer = null;
					renderRetryAttempt += 1;
					void renderGraphics({ reset, generation });
				}, 120);
			}
		}
		return;
	}

	if (!isMonitorTab(props.activeTab)) {
		return;
	}

	if (generation !== renderGeneration) {
		return;
	}

	renderRetryAttempt = 0;
	renderRetryTimer && clearTimeout(renderRetryTimer);
	renderRetryTimer = null;

	const { shapeLayer, clusterLayer: nextClusterLayer } = await ensureMonitorLayers(map);

	if (generation !== renderGeneration) {
		return;
	}

	const mars2d = getMars2d();
	const kind = props.activeTab === 'area-monitor' ? 'area' : 'line';
	const sourcePatches = kind === 'area' ? taskListPatches.value : lineTaskListPatches.value;
	const sourceLoading = kind === 'area' ? taskListLoading.value : lineTaskListLoading.value;

	if (!sourcePatches.length) {
		if (sourceLoading) {
			return;
		}

		shapeLayer.clear();
		nextClusterLayer.clear();
		renderedPatchIds.clear();

		if (generation !== renderGeneration) {
			return;
		}

		updateShapeLayerVisibility(map);
		return;
	}

	if (reset) {
		shapeLayer.clear();
		nextClusterLayer.clear();
		renderedPatchIds.clear();
	}

	const clusterWasHidden = nextClusterLayer.show === false;
	if (clusterWasHidden) {
		nextClusterLayer.show = true;
	}

	for (const patch of sourcePatches) {
		if (generation !== renderGeneration) {
			return;
		}

		if (renderedPatchIds.has(patch.id)) {
			continue;
		}

		addPatchGraphic(shapeLayer, mars2d, patch, kind);
		renderedPatchIds.add(patch.id);
		addClusterMarker(
			nextClusterLayer,
			mars2d,
			patch,
			kind,
			getPositionsCenter(patch.positions)
		);
	}

	if (generation !== renderGeneration) {
		return;
	}

	updateShapeLayerVisibility(map);
}

function clearGraphics() {
	monitorLayer?.clear();
	clusterLayer?.clear();
	renderedPatchIds.clear();
}

function destroyLayer() {
	const map = getMapInstance();

	renderRetryTimer && clearTimeout(renderRetryTimer);
	renderRetryTimer = null;
	renderRetryAttempt = 0;

	if (!map) {
		monitorLayer = null;
		clusterLayer = null;
		return;
	}

	if (monitorLayer) {
		map.removeLayer(monitorLayer, true);
	}
	if (clusterLayer) {
		map.removeLayer(clusterLayer, true);
	}

	monitorLayer = null;
	clusterLayer = null;
	renderedPatchIds.clear();
	shapeVisibilityBound = false;
}

function requestRenderGraphics({ reset = false } = {}) {
	const generation = ++renderGeneration;
	void renderGraphics({ reset, generation });
}

watch(
	() => [taskListPatches.value, taskListPageNum.value, taskListLoading.value],
	() => {
		if (props.activeTab === 'area-monitor') {
			requestRenderGraphics({ reset: taskListPageNum.value <= 1 });
		}
	},
	{ deep: true }
);

watch(
	() => [lineTaskListPatches.value, lineTaskListPageNum.value, lineTaskListLoading.value],
	() => {
		if (props.activeTab === 'line-monitor') {
			requestRenderGraphics({ reset: lineTaskListPageNum.value <= 1 });
		}
	},
	{ deep: true }
);

watch(
	() => props.activeTab,
	(tab) => {
		if (isMonitorTab(tab)) {
			renderRetryAttempt = 0;
			renderRetryTimer && clearTimeout(renderRetryTimer);
			renderRetryTimer = null;
			requestRenderGraphics({ reset: true });
			return;
		}
		renderRetryTimer && clearTimeout(renderRetryTimer);
		renderRetryTimer = null;
		renderRetryAttempt = 0;
		renderGeneration += 1;
		clearGraphics();
	}
);

onMounted(() => {
	if (isMonitorTab(props.activeTab)) {
		requestRenderGraphics({ reset: true });
	}
});

onBeforeUnmount(() => {
	destroyLayer();
});
</script>

<template></template>
