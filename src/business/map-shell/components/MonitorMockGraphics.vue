<script setup>
import { onBeforeUnmount, onMounted, watch } from 'vue';
import { emitMapEvent, MapEventType } from '../../../map-kit/core/mapEvents.js';
import { getMapInstance } from '../../../map-kit/mapApi.js';
import { getMonitorPatches, MONITOR_LAYER_ID } from '../utils/monitorMockStore.js';

const LAYER_EVENT_BOUND_KEY = '__monitorLayerEventBound__';
const GRAPHIC_CLICK_BOUND_KEY = '__monitorGraphicClickBound__';
const CLUSTER_DRILL_BOUND_KEY = '__monitorClusterDrillBound__';
const CLUSTER_LAYER_ID = `${MONITOR_LAYER_ID}__cluster__`;
/** 放大到此级别后显示真实面/线，低级别用聚合点 */
const CLUSTER_DETAIL_ZOOM = 11;
/** 2D 聚合图标尺寸（移动端不宜过大） */
const CLUSTER_ICON_SIZE = 30;

const CLUSTER_OPTIONS = {
	enabled: true,
	pixelRange: 50,
	minimumClusterSize: 2,
	includePoly: true,
	image: {
		color: '#ff0000',
		opacity: 0.9,
		borderColor: 'rgba(255, 255, 255, 0.65)',
		borderWidth: 4,
		borderOpacity: 0.8,
		fontColor: '#ffffff',
		radius: 24
	}
};

const AREA_STYLE_3D = {
	fill: true,
	color: '#ff0000',
	opacity: 0.12,
	outline: true,
	outlineColor: '#ff0000',
	outlineWidth: 2,
	clampToGround: true
};

const AREA_STYLE_2D = {
	fill: true,
	fillColor: '#ff0000',
	fillOpacity: 0.15,
	outline: true,
	outlineColor: '#ff0000',
	outlineWidth: 2,
	interactive: true
};

const LINE_STYLE_3D = {
	color: '#ff0000',
	width: 3,
	clampToGround: true
};

const LINE_STYLE_2D = {
	color: '#ff0000',
	width: 4,
	interactive: true
};

const INVISIBLE_MARKER_STYLE = {
	image: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
	width: 1,
	height: 1,
	opacity: 0
};

const props = defineProps({
	activeTab: {
		type: String,
		default: 'area-monitor'
	}
});

let monitorLayer = null;
let clusterLayer = null;
let zoomVisibilityBound = false;

function getMarsApi() {
	return globalThis.mars3d || globalThis.mars2d;
}

function isMars2dMap(map) {
	return typeof map?.getZoom === 'function' && !map?.viewer?.scene;
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

function getClusterIconSize(count = 0) {
	if (count >= 100) {
		return CLUSTER_ICON_SIZE + 4;
	}
	if (count >= 10) {
		return CLUSTER_ICON_SIZE;
	}
	return CLUSTER_ICON_SIZE - 4;
}

function createClusterIcon(cluster) {
	const L = globalThis.L;
	const count = cluster?.getChildCount?.() ?? 0;
	const size = getClusterIconSize(count);
	return L.divIcon({
		html: `<div class="monitor-mock-cluster" style="width:${size}px;height:${size}px;font-size:${size <= 26 ? 11 : 12}px;">${count}</div>`,
		className: 'monitor-mock-cluster-wrap',
		iconSize: [size, size],
		iconAnchor: [size / 2, size / 2]
	});
}

function resolveClusterDrillZoom(map, cluster) {
	const currentZoom = map?.getZoom?.() ?? 0;
	const bounds = cluster?.getBounds?.();
	const getBoundsZoom = map?.getBoundsZoom;
	if (!bounds || typeof getBoundsZoom !== 'function') {
		const nextZoom = currentZoom + 1;
		return nextZoom >= CLUSTER_DETAIL_ZOOM ? CLUSTER_DETAIL_ZOOM : nextZoom;
	}

	// 保持“逐级放大”体验：每次点击默认只放大 1 级
	const stepZoom = currentZoom + 1;

	// 保留范围计算结果用于判定是否接近细节层
	const naturalZoom = getBoundsZoom.call(map, bounds.pad(0.2));

	// 当自然下钻已接近细节阈值时，直接切到细节层，避免出现“无聚合也无面”的空档
	if (naturalZoom >= CLUSTER_DETAIL_ZOOM - 0.001 || stepZoom >= CLUSTER_DETAIL_ZOOM) {
		return CLUSTER_DETAIL_ZOOM;
	}

	return stepZoom;
}

function drillDownCluster(map, cluster) {
	if (!map || !cluster) {
		return;
	}

	const targetZoom = resolveClusterDrillZoom(map, cluster);
	const center = cluster.getLatLng?.();
	if (center && typeof map.setView === 'function') {
		map.setView(center, targetZoom, { animate: true });
		return;
	}

	if (typeof map.setZoom === 'function') {
		map.setZoom(targetZoom);
	}
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

function resolveClickGraphic(event) {
	const graphic = event?.graphic ?? event?.layer ?? event?.sourceTarget;
	if (!graphic || graphic.cluster) {
		return null;
	}

	const attr = graphic.attr || {};
	if (attr.kind !== 'area' && attr.kind !== 'line') {
		return null;
	}

	return graphic;
}

function bindGraphicClick(graphic) {
	if (!graphic || graphic[GRAPHIC_CLICK_BOUND_KEY]) {
		return;
	}

	const mars = getMarsApi();
	graphic.on(mars.EventType.click, (event) => {
		emitFeatureClick(graphic, event);
	});
	graphic[GRAPHIC_CLICK_BOUND_KEY] = true;
}

function flyToClusterTarget(map, graphic, event) {
	if (isMars2dMap(map)) {
		return;
	}

	const center = graphic?.latlng || graphic?.center || event?.latlng;
	if (!center) {
		return;
	}

	if (!map?.flyToPoint) {
		return;
	}

	const position = graphic.positionShow || graphic.position || event?.cartesian;
	if (!position) {
		return;
	}

	const cameraHeight = map.camera?.positionCartographic?.height ?? 120000;
	const radius = Math.max(2000, Math.min(25000, cameraHeight * 0.15));
	const maximumHeight = Math.max(4000, Math.min(45000, cameraHeight * 0.18));

	map.flyToPoint(position, {
		radius,
		maximumHeight,
		duration: 0.5
	});
}

function bindLayerClick(layer, map) {
	if (!layer || layer[LAYER_EVENT_BOUND_KEY]) {
		return;
	}

	const mars = getMarsApi();
	layer.on(mars.EventType.click, (event) => {
		const graphic = resolveClickGraphic(event);
		if (!graphic) {
			return;
		}

		if (graphic.cluster) {
			if (!isMars2dMap(map)) {
				flyToClusterTarget(map, graphic, event);
			}
			return;
		}

		emitFeatureClick(graphic, event);
	});

	layer[LAYER_EVENT_BOUND_KEY] = true;
}

/** 2D 聚合下钻：按子点范围逐级放大，接近细节级别后切换为面/线图层 */
function bindClusterDrillDown(layer, map) {
	if (!layer || layer[CLUSTER_DRILL_BOUND_KEY]) {
		return;
	}

	layer.on('clusterclick', (event) => {
		const cluster = event?.layer;
		if (!cluster) {
			return;
		}
		drillDownCluster(map, cluster);
	});

	layer[CLUSTER_DRILL_BOUND_KEY] = true;
}

function updateLayerVisibility(map) {
	if (!isMars2dMap(map) || !monitorLayer || !clusterLayer) {
		return;
	}

	const showShapes = (map.getZoom?.() ?? 0) >= CLUSTER_DETAIL_ZOOM;
	monitorLayer.show = showShapes;
	clusterLayer.show = !showShapes;
}

function bindZoomVisibility(map) {
	if (!isMars2dMap(map) || zoomVisibilityBound) {
		return;
	}

	const mars = getMarsApi();
	const refresh = () => updateLayerVisibility(map);
	map.on(mars.EventType.zoomend, refresh);
	map.on(mars.EventType.moveend, refresh);
	zoomVisibilityBound = true;
	updateLayerVisibility(map);
}

async function ensureMars2dLayers(map) {
	const mars = getMarsApi();
	const existingShapeLayer = map.getLayerById?.(MONITOR_LAYER_ID);
	const existingClusterLayer = map.getLayerById?.(CLUSTER_LAYER_ID);

	if (existingShapeLayer) {
		monitorLayer = existingShapeLayer;
	}
	if (existingClusterLayer) {
		clusterLayer = existingClusterLayer;
	}

	if (!monitorLayer) {
		monitorLayer = new mars.layer.GraphicLayer({
			id: MONITOR_LAYER_ID,
			name: '监测模拟图层',
			zIndex: 350
		});
		await map.addLayer(monitorLayer);
	}

	if (!clusterLayer) {
		clusterLayer = new mars.layer.ClusterLayer({
			id: CLUSTER_LAYER_ID,
			name: '监测模拟聚合',
			zIndex: 300,
			zoomToBoundsOnClick: false,
			spiderfyOnMaxZoom: true,
			showCoverageOnHover: false,
			maxClusterRadius: 50,
			disableClusteringAtZoom: CLUSTER_DETAIL_ZOOM,
			iconCreateFunction: createClusterIcon
		});
		await map.addLayer(clusterLayer);
	}

	bindLayerClick(clusterLayer, map);
	bindClusterDrillDown(clusterLayer, map);
	bindZoomVisibility(map);
	return { shapeLayer: monitorLayer, clusterLayer };
}

function ensureMars3dLayer(map) {
	const existing = map.getLayerById?.(MONITOR_LAYER_ID);
	if (existing) {
		monitorLayer = existing;
		bindLayerClick(monitorLayer, map);
		return monitorLayer;
	}

	const mars = getMarsApi();
	monitorLayer = new mars.layer.GraphicLayer({
		id: MONITOR_LAYER_ID,
		name: '监测模拟图层',
		cluster: CLUSTER_OPTIONS
	});
	map.addLayer(monitorLayer);
	bindLayerClick(monitorLayer, map);
	return monitorLayer;
}

async function ensureLayers(map) {
	if (isMars2dMap(map)) {
		return ensureMars2dLayers(map);
	}
	return { shapeLayer: ensureMars3dLayer(map), clusterLayer: null };
}

function addPatchGraphic(layer, mars, patch, kind, is2d) {
	const center = getPositionsCenter(patch.positions);
	const attr = {
		...patch.attr,
		coordinates: center
	};

	let graphic;
	if (kind === 'area') {
		graphic = new mars.graphic.PolygonEntity({
			id: patch.id,
			...(is2d
				? { latlngs: toLatLngs(patch.positions), style: AREA_STYLE_2D }
				: { positions: patch.positions, style: AREA_STYLE_3D }),
			attr
		});
	} else {
		graphic = new mars.graphic.PolylineEntity({
			id: patch.id,
			...(is2d
				? { latlngs: toLatLngs(patch.positions), style: LINE_STYLE_2D }
				: { positions: patch.positions, style: LINE_STYLE_3D }),
			attr
		});
	}

	layer.addGraphic(graphic);
	if (is2d) {
		bindGraphicClick(graphic);
	}
}

function addClusterMarker(layer, mars, patch, center) {
	if (!center) {
		return;
	}

	layer.addGraphic(
		new mars.graphic.Marker({
			id: `${patch.id}__cluster`,
			latlng: [center.lat, center.lng],
			style: INVISIBLE_MARKER_STYLE,
			attr: {
				...patch.attr,
				patchId: patch.id,
				coordinates: center
			}
		})
	);
}

async function renderGraphics() {
	const map = getMapInstance();
	if (!map || !isMonitorTab(props.activeTab)) {
		return;
	}

	const is2d = isMars2dMap(map);
	const { shapeLayer, clusterLayer: nextClusterLayer } = await ensureLayers(map);
	const mars = getMarsApi();
	shapeLayer.clear();
	nextClusterLayer?.clear();

	const kind = props.activeTab === 'area-monitor' ? 'area' : 'line';

	getMonitorPatches(kind).forEach((patch) => {
		addPatchGraphic(shapeLayer, mars, patch, kind, is2d);
		if (is2d && nextClusterLayer) {
			addClusterMarker(nextClusterLayer, mars, patch, getPositionsCenter(patch.positions));
		}
	});

	if (is2d) {
		updateLayerVisibility(map);
	}
}

function clearGraphics() {
	monitorLayer?.clear();
	clusterLayer?.clear();
}

function destroyLayer() {
	const map = getMapInstance();
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
	zoomVisibilityBound = false;
}

watch(
	() => props.activeTab,
	(tab) => {
		if (isMonitorTab(tab)) {
			renderGraphics();
			return;
		}
		clearGraphics();
	}
);

onMounted(() => {
	if (isMonitorTab(props.activeTab)) {
		renderGraphics();
	}
});

onBeforeUnmount(() => {
	destroyLayer();
});
</script>

<template></template>

<style lang="scss">
.monitor-mock-cluster-wrap {
	background: transparent;
	border: none;
}

.monitor-mock-cluster {
	display: flex;
	align-items: center;
	justify-content: center;
	box-sizing: border-box;
	border-radius: 50%;
	background: rgba(255, 0, 0, 0.9);
	border: 2px solid rgba(255, 255, 255, 0.65);
	color: #fff;
	font-weight: 700;
	line-height: 1;
}
</style>
