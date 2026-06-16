<script setup>
import { onBeforeUnmount, onMounted, watch } from 'vue';
import { emitMapEvent, MapEventType } from '../../../map-kit/core/mapEvents.js';
import { getMapInstance } from '../../../map-kit/core/mars3d.js';
import { getMonitorPatches, MONITOR_LAYER_ID } from '../utils/monitorMockStore.js';
const LAYER_EVENT_BOUND_KEY = '__monitorLayerEventBound__';

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

const AREA_STYLE = {
	fill: true,
	color: '#ff0000',
	opacity: 0.12,
	outline: true,
	outlineColor: '#ff0000',
	outlineWidth: 2,
	clampToGround: true
};

const LINE_STYLE = {
	color: '#ff0000',
	width: 3,
	clampToGround: true
};

const props = defineProps({
	activeTab: {
		type: String,
		default: 'area-monitor'
	}
});

let monitorLayer = null;

function getMars3d() {
	const mars3d = globalThis.mars3d;
	if (!mars3d) {
		throw new Error('mars3d global not found.');
	}
	return mars3d;
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

function bindLayerClick(layer, map) {
	if (!layer || layer[LAYER_EVENT_BOUND_KEY]) {
		return;
	}

	const mars3d = getMars3d();
	layer.on(mars3d.EventType.click, (event) => {
		const graphic = event?.graphic;
		if (!graphic) {
			return;
		}

		if (!graphic.cluster) {
			const attr = graphic.attr || {};
			if (attr.kind === 'area' || attr.kind === 'line') {
				emitMapEvent(MapEventType.FEATURE_CLICK, {
					kind: attr.kind,
					graphic,
					event,
					attr
				});
			}
			return;
		}

		const position = graphic.positionShow || graphic.position || event.cartesian;
		if (!position || !map?.flyToPoint) {
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
	});

	layer[LAYER_EVENT_BOUND_KEY] = true;
}

function ensureLayer(map) {
	const existing = map.getLayerById?.(MONITOR_LAYER_ID);
	if (existing) {
		monitorLayer = existing;
		bindLayerClick(monitorLayer, map);
		return monitorLayer;
	}

	const mars3d = getMars3d();
	monitorLayer = new mars3d.layer.GraphicLayer({
		id: MONITOR_LAYER_ID,
		name: '监测模拟图层',
		cluster: CLUSTER_OPTIONS
	});
	map.addLayer(monitorLayer);
	bindLayerClick(monitorLayer, map);
	return monitorLayer;
}

function renderGraphics() {
	const map = getMapInstance();
	if (!map || !isMonitorTab(props.activeTab)) {
		return;
	}

	const layer = ensureLayer(map);
	const mars3d = getMars3d();
	layer.clear();

	const kind = props.activeTab === 'area-monitor' ? 'area' : 'line';

	getMonitorPatches(kind).forEach((area) => {
		if (kind === 'area') {
			layer.addGraphic(
				new mars3d.graphic.PolygonEntity({
					id: area.id,
					positions: area.positions,
					style: AREA_STYLE,
					attr: {
						...area.attr,
						coordinates: getPositionsCenter(area.positions)
					}
				})
			);
			return;
		}

		layer.addGraphic(
			new mars3d.graphic.PolylineEntity({
				id: area.id,
				positions: area.positions,
				style: LINE_STYLE,
				attr: {
					...area.attr,
					coordinates: getPositionsCenter(area.positions)
				}
			})
		);
	});
}

function clearGraphics() {
	monitorLayer?.clear();
}

function destroyLayer() {
	const map = getMapInstance();
	if (!monitorLayer || !map) {
		monitorLayer = null;
		return;
	}

	map.removeLayer(monitorLayer, true);
	monitorLayer = null;
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
