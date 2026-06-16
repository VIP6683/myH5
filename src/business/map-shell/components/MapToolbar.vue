<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as echarts from 'echarts';
import { Aim, Compass, DataAnalysis, Location, Position } from '@element-plus/icons-vue';
import {
	MAP_LAYER_KEYS,
	getAnnotationDefaultVisible,
	isLayerControllable,
	isAnnotationToolbarAvailable
} from '../../../map-kit/core/layerControl.js';
import { usesBackendLayers } from '../../../map-kit/config/runtimeConfig.js';
import { MapEventType, emitMapEvent } from '../../../map-kit/core/mapEvents.js';
import {
	clearMeasure,
	getMapInstance,
	getMeasureClearable,
	locateMarker,
	onMeasureToolbarStateChange,
	resetMapView,
	startAngleMeasure,
	startAreaMeasure,
	startDistanceMeasure,
	startHeightMeasure,
	startPointMeasure,
	startSectionMeasure,
	stopMeasureDrawing,
	to2d,
	to3d
} from '../../../map-kit/core/mars3d.js';
import {
	collectWmsNodesForCheck,
	filterLayerTreeByIds,
	resolveDefaultCheckedNodes,
	resolveRegionDefaultNodes
} from '../../../map-kit/utils/layerTree.js';
import layerIcon from '../../../map-kit/assets/images/tools-tuceng.png';
import searchIcon from '../../../map-kit/assets/images/tools-sousuo.png';
import pointIcon from '../../../map-kit/assets/images/tools-cedian.png';
import measureIcon from '../../../map-kit/assets/images/tools-ceju.png';
import areaIcon from '../../../map-kit/assets/images/tools-cemian.png';
import heightIcon from '../../../map-kit/assets/images/tools-gaoceng.png';
import sectionIcon from '../../../map-kit/assets/images/tools-pomian.png';
import resetIcon from '../../../map-kit/assets/images/tools-fuwei.png';
import clearIcon from '../../../map-kit/assets/images/tools-qingchu.png';
import noteIcon from '../../../map-kit/assets/images/tools-zhuji.png';
import baseIcon from '../../../map-kit/assets/images/base-icon.png';
import icon2d from '../../../map-kit/assets/images/erwei-map.png';
import icon3d from '../../../map-kit/assets/images/sanwei-map.png';

const props = defineProps({
	is3DMode: {
		type: Boolean,
		default: false
	},
	/** 路由/项目关联图层 id，不传则展示全部 */
	layerIds: {
		type: Array,
		default: () => []
	},
	/** 进入页面默认勾选的图层 id（如杆塔 471） */
	defaultCheckedLayerIds: {
		type: Array,
		default: () => []
	},
	/** 拉取图层树（由宿主项目注入，如对接各自后台） */
	fetchLayerTree: {
		type: Function,
		default: null
	},
	/** 拉取底图下拉列表 */
	fetchBasemapList: {
		type: Function,
		default: null
	},
	/** 是否展示 2D/3D 切换按钮（默认按需求隐藏） */
	showDimensionToggle: {
		type: Boolean,
		default: false
	},
	/**
	 * 搜索定位：由宿主注入的模糊查询方法。
	 * 入参：keyword(string)
	 * 出参：Promise<Array<{ id?: string|number, name?: string, title?: string, label?: string, lng?: number, lat?: number, longitude?: number, latitude?: number, address?: string }>>
	 */
	fetchSearchSuggestions: {
		type: Function,
		default: null
	},
	/** 进入页面默认勾选 layerUrl 含 region 的图层（对齐原 Map.vue） */
	autoCheckRegionLayers: {
		type: Boolean,
		default: true
	},
	/** 左侧面板是否折叠（剖面面板 left 走 CSS 变量，与侧栏同步缩放） */
	leftPanelCollapsed: {
		type: Boolean,
		default: true
	}
});

const emit = defineEmits([
	'layer-toggle',
	'layer-visibility-change',
	'layer-node-change',
	'layer-node-click',
	'basemap-change',
	'dimension-toggle'
]);

const layerPanelOpen = ref(false);
const panelLoading = ref(false);
/** 注记显隐（对齐原 Map.vue noteLayerShow，默认关闭） */
const noteVisible = ref(getAnnotationDefaultVisible());
const showNoteToolbar = computed(() => isAnnotationToolbarAvailable());
const basemapOptions = ref([]);
const selectedBasemap = ref('');
const layerTree = ref([]);
const layerTreeRef = ref(null);
const treeChecked = ref(false);

const isMeasureDrawing = ref(false);
const showMeasureClear = ref(getMeasureClearable());
let unbindMeasureToolbarState = null;

const activeTool = ref('');

const searchOpen = ref(false);
const searchText = ref('');
const searchError = ref('');
const searchLoading = ref(false);
const searchSuggestions = ref([]);
let searchDebounceTimer = null;

const baseShow = ref(false);
const baseMapIndex = ref(2); // 1=二维 2=三维（对齐旧版）
const baseMapImg = [
	{ id: 1, img: icon2d, name: '二维地图' },
	{ id: 2, img: icon3d, name: '三维地图' }
];

const sectionVisible = ref(false);
const sectionPanelRef = ref(null);
const sectionChartRef = ref(null);
let sectionChartInstance = null;
let sectionTipGraphic = null;
let sectionPendingData = null;
const sectionLoading = ref(false);
let sectionLoadingTimeout = null;
let unbindWindowResize = null;
let sectionChartResizeObserver = null;
let sectionResizeRaf = 0;
let sectionWindowResizeTimer = null;

const resolveSuggestionLabel = (item) => {
	if (!item) return '';
	return String(item.name ?? item.title ?? item.label ?? '').trim();
};

const resolveSuggestionLngLat = (item) => {
	const lng = Number(item?.lng ?? item?.longitude);
	const lat = Number(item?.lat ?? item?.latitude);
	if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
	return { lng, lat };
};

const fetchSuggestions = async (keyword) => {
	searchError.value = '';
	searchSuggestions.value = [];

	const text = String(keyword ?? '').trim();
	if (!text) return;
	if (typeof props.fetchSearchSuggestions !== 'function') {
		searchError.value = '未配置搜索接口（fetchSearchSuggestions）';
		return;
	}

	searchLoading.value = true;
	try {
		const list = await props.fetchSearchSuggestions(text);
		searchSuggestions.value = Array.isArray(list) ? list : [];
	} catch (error) {
		console.warn('搜索建议查询失败', error);
		searchError.value = '查询失败，请稍后重试';
		searchSuggestions.value = [];
	} finally {
		searchLoading.value = false;
	}
};

const handleSearchLocate = async (item) => {
	searchError.value = '';
	const pos = resolveSuggestionLngLat(item);
	if (!pos) {
		searchError.value = '请选择一个搜索结果后再定位';
		return;
	}

	try {
		const label = resolveSuggestionLabel(item);
		await locateMarker({
			id: 'search_locate',
			lng: pos.lng,
			lat: pos.lat,
			type: 'base',
			clear: true,
			flyTo: true,
			popup: false,
			attr: { ...item, ...pos, name: label || item?.name || item?.title || item?.label }
		});
		searchOpen.value = false;
	} catch (error) {
		console.warn('搜索定位失败', error);
		searchError.value = '定位失败，请稍后重试';
	}
};

const handleBaseToggle = () => {
	baseShow.value = !baseShow.value;
};

const handleBaseMapTab = (item) => {
	if (!item?.id) return;
	baseMapIndex.value = item.id;
	baseShow.value = false;

	// 交互对齐旧版：2D/3D 切换主要控制旋转与场景模式
	if (item.id === 1) {
		to2d();
	} else {
		to3d();
	}
};

const runMeasure = async (runner) => {
	let result = null;
	try {
		stopMeasureDrawing();
		isMeasureDrawing.value = true;
		result = await runner();
	} catch (error) {
		console.warn('量算启动失败', error);
	} finally {
		isMeasureDrawing.value = false;
	}
	return result;
};

const handlePointMeasure = () => {
	activeTool.value = 'point';
	return runMeasure(() => startPointMeasure());
};

const handleDistanceMeasure = () => {
	activeTool.value = 'distance';
	return runMeasure(() => startDistanceMeasure());
};
const handleHeightMeasure = () => {
	activeTool.value = 'height';
	return runMeasure(() => startHeightMeasure());
};
const handleAreaMeasure = () => {
	activeTool.value = 'area';
	return runMeasure(() => startAreaMeasure());
};
const handleAngleMeasure = () => {
	activeTool.value = 'angle';
	return runMeasure(() => startAngleMeasure());
};

const handleSectionMeasure = async () => {
	activeTool.value = 'section';
	sectionVisible.value = false;

	const graphic = await runMeasure(() => startSectionMeasure());

	sectionLoading.value = true;
	clearTimeout(sectionLoadingTimeout);
	sectionLoadingTimeout = setTimeout(() => {
		sectionLoading.value = false;
	}, 20000);

	if (!graphic) {
		clearTimeout(sectionLoadingTimeout);
		sectionLoading.value = false;
		return;
	}

	sectionPendingData = graphic;
	sectionVisible.value = true;
	await nextTick();

	const ok = setSectionEchartsData(sectionPendingData);
	sectionPendingData = null;
	clearTimeout(sectionLoadingTimeout);
	sectionLoading.value = false;
	if (!ok) {
		sectionVisible.value = false;
		return;
	}

	resizeSectionChart();
	showMeasureClear.value = getMeasureClearable();
};

const handleReset = async () => {
	try {
		await resetMapView();
	} catch (error) {
		console.warn('复位失败', error);
	}
};

const handleMeasureClear = () => {
	clearMeasure();
	showMeasureClear.value = getMeasureClearable();
	if (!isMeasureDrawing.value) {
		activeTool.value = '';
	}
	sectionVisible.value = false;
	hideSectionTipMarker();
	sectionLoading.value = false;
	sectionPendingData = null;
	clearTimeout(sectionLoadingTimeout);
};

const resolveSectionData = (data) => {
	const candidates = [
		data,
		data?.value,
		data?.attr,
		data?.options?.attr,
		data?.graphic?.attr,
		data?.graphic?.options?.attr
	];
	for (const item of candidates) {
		if (item?.arrPoint?.length && item?.arrHB?.length && item?.arrLen?.length) {
			return item;
		}
	}
	return null;
};

const resizeSectionChart = () => {
	if (!sectionChartInstance) return;
	cancelAnimationFrame(sectionResizeRaf);
	sectionResizeRaf = requestAnimationFrame(() => {
		sectionResizeRaf = requestAnimationFrame(() => {
			const el = sectionChartRef.value;
			if (!el || !sectionChartInstance) return;
			const width = el.clientWidth;
			const height = el.clientHeight;
			if (width > 0 && height > 0) {
				sectionChartInstance.resize({ width, height });
			} else {
				sectionChartInstance.resize();
			}
		});
	});
};

const bindSectionChartResizeObserver = () => {
	unbindSectionChartResizeObserver();
	const targets = [sectionPanelRef.value, sectionChartRef.value].filter(Boolean);
	if (!targets.length) return;
	sectionChartResizeObserver = new ResizeObserver(() => {
		resizeSectionChart();
	});
	for (const el of targets) {
		sectionChartResizeObserver.observe(el);
	}
};

const unbindSectionChartResizeObserver = () => {
	sectionChartResizeObserver?.disconnect();
	sectionChartResizeObserver = null;
};

const onSectionPanelTransitionEnd = (event) => {
	if (event.propertyName !== 'left' || !sectionVisible.value) return;
	resizeSectionChart();
};

const calculation = (params) => {
	const mars3d = globalThis.mars3d;
	const len = mars3d?.MeasureUtil?.formatDistance
		? mars3d.MeasureUtil.formatDistance(Number(params.axisValue))
		: `${Number(params.axisValue).toFixed(2)}米`;
	const hbgdStr = mars3d?.MeasureUtil?.formatDistance
		? mars3d.MeasureUtil.formatDistance(Number(params.value))
		: `${Number(params.value).toFixed(2)}米`;
	return { len, hbgdStr };
};

const hideSectionTipMarker = () => {
	if (!sectionTipGraphic) return;
	sectionTipGraphic.remove(true);
	sectionTipGraphic = null;
};

const showSectionTipMarker = (point, z, html) => {
	const map = getMapInstance();
	const mars3d = globalThis.mars3d;
	const Cesium = globalThis.Cesium;
	if (!map || !mars3d || !Cesium || !point) return;
	const pos = Cesium.Cartesian3.fromDegrees(point.lng, point.lat, z);

	if (!sectionTipGraphic) {
		sectionTipGraphic = new mars3d.graphic.BillboardEntity({
			name: '当前点',
			position: pos,
			style: {
				image: '//data.mars3d.cn/img/marker/mark-blue.png',
				scale: 1,
				horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
				verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
				scaleByDistance: new Cesium.NearFarScalar(10000, 1.0, 500000, 0.2)
			}
		}).addTo(map.graphicLayer);
		sectionTipGraphic._setPositionsToCallback?.();
	}

	sectionTipGraphic._position_draw = pos;
	sectionTipGraphic
		.bindPopup(html, {
			maxHeight: 1000,
			closeOnClick: false,
			autoClose: false
		})
		.openPopup();
};

const getMinZ = (arr = []) => {
	if (!arr.length) return 'dataMin';
	let min = arr[0].alt;
	for (const item of arr) {
		if (item.alt < min) min = item.alt;
	}
	return min;
};

const setSectionEchartsData = (data) => {
	const sectionData = resolveSectionData(data);
	if (!sectionData?.arrPoint?.length || !sectionChartRef.value) return false;
	const arrPoint = sectionData.arrPoint || [];
	const arrLen = sectionData.arrLen || [];
	const arrHB = sectionData.arrHB || [];

	sectionChartInstance?.dispose?.();
	sectionChartInstance = echarts.init(sectionChartRef.value);

	let popupHtml = '';
	const option = {
		grid: { left: 13, right: 53, bottom: 13, top: 43, containLabel: true },
		dataZoom: [{ type: 'inside', throttle: 50 }],
		tooltip: {
			trigger: 'axis',
			formatter: (params) => {
				if (!params.length) {
					hideSectionTipMarker();
					return popupHtml;
				}
				const hbgd = params[0].value;
				const point = arrPoint[params[0].dataIndex];
				const result = calculation(params[0]);
				popupHtml = `当前位置<br />距离起点：${result.len}<br />海拔：<span style='color:${params[0].color};'>${result.hbgdStr}</span><br />经度：${point.lng}<br />纬度：${point.lat}`;
				showSectionTipMarker(point, hbgd, popupHtml);
				return popupHtml;
			}
		},
		xAxis: [
			{
				name: '行程',
				type: 'category',
				nameTextStyle: { color: '#333' },
				boundaryGap: false,
				axisLine: { show: true },
				axisLabel: { show: true, formatter: '{value} 米', color: '#333' },
				data: arrLen
			}
		],
		yAxis: [
			{
				name: '高程',
				nameTextStyle: { color: '#333' },
				type: 'value',
				min: getMinZ(arrPoint),
				axisLabel: { formatter: '{value} 米', color: '#333' }
			}
		],
		series: [
			{
				name: '高程值',
				type: 'line',
				smooth: true,
				symbol: 'none',
				sampling: 'average',
				itemStyle: { color: '#d34670' },
				areaStyle: {
					color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
						{ offset: 0, color: '#f0754e' },
						{ offset: 1, color: 'rgb(211, 70, 112)' }
					])
				},
				data: arrHB
			}
		]
	};

	sectionChartInstance.setOption(option);
	bindSectionChartResizeObserver();
	resizeSectionChart();
	return true;
};

const treeProps = {
	children: 'children',
	label: 'layerTitle'
};

const appendAnnotationNode = (nodes) => {
	if (usesBackendLayers() || !isLayerControllable(MAP_LAYER_KEYS.ANNOTATION)) {
		return nodes;
	}

	return [
		{
			id: 'annotation',
			layerTitle: '注记',
			layerKey: MAP_LAYER_KEYS.ANNOTATION
		},
		...nodes
	];
};

const syncAnnotationChecked = async () => {
	if (usesBackendLayers() || !isLayerControllable(MAP_LAYER_KEYS.ANNOTATION)) {
		return;
	}

	await nextTick();
	layerTreeRef.value?.setChecked('annotation', noteVisible.value, false);
};

/** 地图工具栏注记开关（对齐原 Map.vue noteChange） */
const toggleNoteLayer = () => {
	noteVisible.value = !noteVisible.value;
	emit('layer-visibility-change', {
		layerKey: MAP_LAYER_KEYS.ANNOTATION,
		visible: noteVisible.value
	});
};

const applyLayerTree = (layerData) => {
	const list = Array.isArray(layerData) ? layerData : [];
	const ids = props.layerIds;
	layerTree.value = appendAnnotationNode(ids?.length ? filterLayerTreeByIds(list, ids) : list);
};

const emitLayerNodeVisible = (node, visible) => {
	emit('layer-node-change', { node, visible });
};

const collectLoadedLayerKeysFromMap = () => {
	const keys = new Set();
	const map = getMapInstance();
	if (!map) return keys;

	const walk = (list) => {
		for (const node of list || []) {
			if (node?.id != null && map.getLayerById?.(node.id)) {
				keys.add(node.id);
			}
			if (node?.children?.length) {
				walk(node.children);
			}
		}
	};

	walk(layerTree.value.filter((n) => n.id !== 'annotation'));
	if (
		!usesBackendLayers() &&
		isLayerControllable(MAP_LAYER_KEYS.ANNOTATION) &&
		noteVisible.value
	) {
		keys.add('annotation');
	}
	return keys;
};

const resolveDefaultCheckedKeys = () => {
	const keys = new Set();

	if (!layerTree.value.length) return keys;

	const defaultNodes = resolveDefaultCheckedNodes(layerTree.value, props.defaultCheckedLayerIds);
	for (const node of defaultNodes) {
		keys.add(node.id);
	}

	if (props.autoCheckRegionLayers) {
		const businessTree = layerTree.value.filter((n) => n.id !== 'annotation');
		const regionNodes = resolveRegionDefaultNodes(businessTree);
		for (const node of regionNodes) {
			keys.add(node.id);
		}
	}

	if (
		!usesBackendLayers() &&
		isLayerControllable(MAP_LAYER_KEYS.ANNOTATION) &&
		noteVisible.value
	) {
		keys.add('annotation');
	}

	return keys;
};

/** 面板打开后，同步树勾选态到当前默认显示规则（仅同步 UI，不重复触发加载） */
const syncTreeCheckedOnPanelOpen = async () => {
	await nextTick();
	// 优先按地图当前已加载图层回填，再用默认规则兜底
	const loadedKeys = collectLoadedLayerKeysFromMap();
	const defaultKeys = resolveDefaultCheckedKeys();
	const checkKeys = [...new Set([...loadedKeys, ...defaultKeys])];
	layerTreeRef.value?.setCheckedKeys(checkKeys);
};

/** 默认勾选配置的 WMS 图层（对齐参考进入页显示杆塔） */
const applyDefaultCheckedLayers = async () => {
	const ids = props.defaultCheckedLayerIds;
	if (!ids?.length) return;

	const nodes = resolveDefaultCheckedNodes(layerTree.value, ids);
	if (!nodes.length) return;

	await nextTick();
	const checkKeys = [...new Set(nodes.map((n) => n.id))];
	layerTreeRef.value?.setCheckedKeys(checkKeys);

	treeChecked.value = true;
	for (const node of nodes) {
		emitLayerNodeVisible(node, true);
	}
};

/** 默认勾选行政区划等 region 图层（对齐原 Map.vue createMap） */
const applyDefaultRegionLayers = async () => {
	if (!props.autoCheckRegionLayers) return;

	const businessTree = layerTree.value.filter((n) => n.id !== 'annotation');
	const nodes = resolveRegionDefaultNodes(businessTree);
	if (!nodes.length) return;

	await nextTick();
	const prevKeys = layerTreeRef.value?.getCheckedKeys?.() || [];
	const checkKeys = [...new Set([...prevKeys, ...nodes.map((n) => n.id)])];
	layerTreeRef.value?.setCheckedKeys(checkKeys);

	treeChecked.value = true;
	for (const node of nodes) {
		emitLayerNodeVisible(node, true);
	}
};

/** 重新拉取图层树 */
const reloadLayerTree = async () => {
	if (typeof props.fetchLayerTree !== 'function') {
		layerTree.value = appendAnnotationNode([]);
		return;
	}

	panelLoading.value = true;
	try {
		const layerData = await props.fetchLayerTree();
		applyLayerTree(layerData);
		await nextTick();
		layerTreeRef.value?.setCheckedKeys([]);
		await syncAnnotationChecked();
		await applyDefaultCheckedLayers();
		await applyDefaultRegionLayers();
	} catch (error) {
		console.warn('图层树加载失败', error);
		layerTree.value = appendAnnotationNode([]);
		await syncAnnotationChecked();
	} finally {
		panelLoading.value = false;
	}
};

const loadBasemapOptions = async () => {
	if (typeof props.fetchBasemapList !== 'function') {
		basemapOptions.value = [];
		selectedBasemap.value = '';
		return;
	}

	try {
		basemapOptions.value = await props.fetchBasemapList();
		selectedBasemap.value = basemapOptions.value[0]?.layer || '';
	} catch (error) {
		console.warn('底图配置加载失败', error);
		basemapOptions.value = [];
		selectedBasemap.value = '';
	}
};

onMounted(() => {
	loadBasemapOptions();
	reloadLayerTree();

	unbindMeasureToolbarState = onMeasureToolbarStateChange((clearable) => {
		showMeasureClear.value = clearable;
	});

	const onDocClick = () => {
		baseShow.value = false;
	};
	document.addEventListener('click', onDocClick);
	unbindDocClick = () => document.removeEventListener('click', onDocClick);

	const onResize = () => {
		clearTimeout(sectionWindowResizeTimer);
		sectionWindowResizeTimer = setTimeout(() => resizeSectionChart(), 100);
	};
	window.addEventListener('resize', onResize);
	unbindWindowResize = () => {
		window.removeEventListener('resize', onResize);
		clearTimeout(sectionWindowResizeTimer);
		sectionWindowResizeTimer = null;
	};
});

watch(sectionVisible, (visible) => {
	if (visible) {
		nextTick(() => {
			bindSectionChartResizeObserver();
			resizeSectionChart();
		});
	} else {
		unbindSectionChartResizeObserver();
	}
});

watch(
	() => props.leftPanelCollapsed,
	() => {
		if (!sectionVisible.value) return;
		nextTick(() => resizeSectionChart());
	}
);

let unbindDocClick = null;

onBeforeUnmount(() => {
	clearTimeout(searchDebounceTimer);
	searchDebounceTimer = null;
	unbindMeasureToolbarState?.();
	unbindMeasureToolbarState = null;
	unbindDocClick?.();
	unbindDocClick = null;
	unbindWindowResize?.();
	unbindWindowResize = null;
	unbindSectionChartResizeObserver();
	cancelAnimationFrame(sectionResizeRaf);
	sectionResizeRaf = 0;
	clearTimeout(sectionWindowResizeTimer);
	sectionWindowResizeTimer = null;
	sectionChartInstance?.dispose?.();
	sectionChartInstance = null;
	hideSectionTipMarker();
	clearTimeout(sectionLoadingTimeout);
});

watch(
	() => [props.layerIds, props.defaultCheckedLayerIds],
	() => {
		reloadLayerTree();
	},
	{ deep: true }
);

watch(
	() => props.fetchLayerTree,
	() => {
		reloadLayerTree();
	}
);

watch(
	() => [searchOpen.value, searchText.value],
	([open, text]) => {
		if (!open) return;
		clearTimeout(searchDebounceTimer);
		searchDebounceTimer = setTimeout(() => {
			fetchSuggestions(text);
		}, 350);
	},
	{ immediate: false }
);

watch(searchOpen, (open) => {
	if (open) return;
	searchText.value = '';
	searchError.value = '';
	searchLoading.value = false;
	searchSuggestions.value = [];
	clearTimeout(searchDebounceTimer);
	searchDebounceTimer = null;
});

watch(selectedBasemap, (layerKey) => {
	const item = basemapOptions.value.find((opt) => opt.layer === layerKey);
	if (item) {
		emit('basemap-change', item);
	}
});

/** 面板关闭时 el-tree 未挂载，需在打开后同步注记勾选与地图一致 */
watch(layerPanelOpen, (open) => {
	if (open) {
		// 交互优化：打开图层面板时，关闭搜索弹框
		searchOpen.value = false;
		syncTreeCheckedOnPanelOpen();
	}
});

// 面板打开后，若树是异步渲染出来的（loading -> tree 挂载），再同步一次勾选态
watch(
	() => [layerPanelOpen.value, panelLoading.value, layerTree.value.length],
	([open, loading, len]) => {
		if (!open || loading || !len) return;
		syncTreeCheckedOnPanelOpen();
	}
);

const toggleLayerPanel = () => {
	const next = !layerPanelOpen.value;
	layerPanelOpen.value = next;
	// 交互优化：打开图层面板时，关闭搜索弹框
	if (next) searchOpen.value = false;
	emit('layer-toggle', layerPanelOpen.value);
};

const closeLayerPanel = () => {
	layerPanelOpen.value = false;
	emit('layer-toggle', false);
};

const toggleSearchPanel = () => {
	const next = !searchOpen.value;
	searchOpen.value = next;
	// 交互优化：打开搜索弹框时，关闭图层面板
	if (next) {
		layerPanelOpen.value = false;
		emit('layer-toggle', false);
	}
};

/** 与 test LayerTools handleCheckChange 一致：记录当前勾选状态 */
const handleCheckChange = (_data, checked) => {
	treeChecked.value = checked;
};

/** 勾选变化：加载/移除该节点及子节点中带 layerUrl 的 WMS */
const handleTreeCheck = (data) => {
	if (data.layerKey === MAP_LAYER_KEYS.ANNOTATION) {
		emit('layer-visibility-change', {
			layerKey: data.layerKey,
			visible: treeChecked.value
		});
		return;
	}

	const visible = treeChecked.value;
	for (const node of collectWmsNodesForCheck(data)) {
		emitLayerNodeVisible(node, visible);
	}
};

/** 点击树节点行（非勾选）：抛出事件，由宿主打开自定义弹框 */
const handleTreeNodeClick = (data) => {
	const payload = { node: data };

	emit('layer-node-click', payload);
	emitMapEvent(MapEventType.LAYER_NODE_CLICK, payload);
};
</script>

<template>
	<div class="mapToolbarRoot">
		<div class="mapToolsWrap">
			<Transition name="layerPanelSlide">
				<aside v-if="layerPanelOpen" class="layerPanel">
					<header class="layerPanelHeader">
						<div class="layerPanelTitle">
							<img :src="layerIcon" alt="" class="layerPanelTitleIcon" />
							<span>图层管理</span>
						</div>
						<button
							type="button"
							class="layerPanelClose"
							title="关闭"
							aria-label="关闭图层管理"
							@click="closeLayerPanel"
						>
							×
						</button>
					</header>

					<div
						v-loading="panelLoading"
						element-loading-background="rgba(0, 8, 18, 0.65)"
						element-loading-custom-class="mapKitLoadingMask"
						class="layerPanelBody"
					>
						<div v-if="basemapOptions.length" class="layerPanelSelectWrap">
							<el-select
								v-model="selectedBasemap"
								class="layerPanelBasemapSelect"
								size="small"
								placeholder="选择底图"
								teleported
								popper-class="layerPanelBasemapPopper"
							>
								<el-option
									v-for="opt in basemapOptions"
									:key="opt.layer"
									:label="opt.name"
									:value="opt.layer"
								/>
							</el-select>
						</div>

						<el-tree
							v-if="layerTree.length"
							ref="layerTreeRef"
							class="layerPanelTree"
							:data="layerTree"
							show-checkbox
							node-key="id"
							:props="treeProps"
							:highlight-current="false"
							default-expand-all
							@check-change="handleCheckChange"
							@check="handleTreeCheck"
							@node-click="handleTreeNodeClick"
						/>
						<p v-else-if="!panelLoading" class="layerPanelEmpty">暂无图层数据</p>
					</div>
				</aside>
			</Transition>

			<div class="mapToolbar">
				<button
					type="button"
					class="mapToolButton"
					:class="{ isActive: searchOpen }"
					title="搜索定位"
					@click="toggleSearchPanel"
				>
					<img :src="searchIcon" alt="" class="mapToolIcon" />
				</button>

				<button
					type="button"
					class="mapToolButton"
					:class="{ isActive: layerPanelOpen }"
					title="图层控制"
					@click="toggleLayerPanel"
				>
					<img :src="layerIcon" alt="" class="mapToolIcon" />
				</button>

				<button
					type="button"
					class="mapToolButton"
					:class="{ isActive: activeTool === 'point' }"
					title="坐标测量"
					@click="handlePointMeasure"
				>
					<img :src="pointIcon" alt="" class="mapToolIcon" />
				</button>

				<button
					type="button"
					class="mapToolButton"
					:class="{ isActive: activeTool === 'distance' }"
					title="距离测量"
					@click="handleDistanceMeasure"
				>
					<img :src="measureIcon" alt="" class="mapToolIcon" />
				</button>

				<button
					type="button"
					class="mapToolButton"
					:class="{ isActive: activeTool === 'height' }"
					title="高度差测量"
					@click="handleHeightMeasure"
				>
					<img :src="heightIcon" alt="" class="mapToolIcon" />
				</button>

				<button
					type="button"
					class="mapToolButton"
					:class="{ isActive: activeTool === 'area' }"
					title="面积测量"
					@click="handleAreaMeasure"
				>
					<img :src="areaIcon" alt="" class="mapToolIcon" />
				</button>

				<button
					type="button"
					class="mapToolButton"
					:class="{ isActive: activeTool === 'angle' }"
					title="方位角测量"
					@click="handleAngleMeasure"
				>
					<el-icon class="mapToolSvgIcon"><Compass /></el-icon>
				</button>

				<button
					v-if="baseMapIndex === 2"
					type="button"
					class="mapToolButton"
					:class="{ isActive: activeTool === 'section' }"
					title="剖面分析"
					@click="handleSectionMeasure"
				>
					<img :src="sectionIcon" alt="" class="mapToolIcon" />
				</button>

				<button type="button" class="mapToolButton" title="复位" @click="handleReset">
					<img :src="resetIcon" alt="" class="mapToolIcon" />
				</button>

				<button
					v-if="showNoteToolbar"
					type="button"
					class="mapToolButton"
					:class="{ isActive: noteVisible }"
					title="注记"
					@click="toggleNoteLayer"
				>
					<img :src="noteIcon" alt="" class="mapToolIcon" />
				</button>

				<button
					v-if="props.showDimensionToggle"
					type="button"
					class="mapToolButton btn3d"
					:class="{ isActive: !is3DMode }"
					:title="is3DMode ? '切换为二维' : '切换为三维'"
					@click="emit('dimension-toggle')"
				>
					<img :src="is3DMode ? icon3d : icon2d" alt="" class="mapToolIcon" />
				</button>

				<button
					v-if="showMeasureClear"
					type="button"
					class="mapToolButton mapToolButtonClear"
					title="清除量算"
					aria-label="清除量算"
					@click="handleMeasureClear"
				>
					<img :src="clearIcon" alt="" class="mapToolIcon" />
				</button>
			</div>

			<Transition name="layerPanelSlide">
				<div v-if="searchOpen" class="searchPanel" @click.stop>
					<div class="searchPanelTitle">搜索定位</div>
					<el-input
						v-model="searchText"
						size="small"
						placeholder="输入关键字，如：长沙"
						clearable
					/>
					<div v-loading="searchLoading" class="searchSuggestWrap">
						<div
							v-if="!searchLoading && searchText && !searchSuggestions.length"
							class="searchSuggestEmpty"
						>
							暂无匹配结果
						</div>
						<ul v-else class="searchSuggestList">
							<li
								v-for="row in searchSuggestions"
								:key="row.id ?? resolveSuggestionLabel(row)"
								class="searchSuggestItem"
							>
								<button
									type="button"
									class="searchSuggestButton"
									@click="handleSearchLocate(row)"
								>
									<div class="searchSuggestTitle">
										{{ resolveSuggestionLabel(row) || '未命名' }}
									</div>
									<div v-if="row.address" class="searchSuggestDesc">
										{{ row.address }}
									</div>
								</button>
							</li>
						</ul>
					</div>
					<p v-if="searchError" class="searchPanelError">{{ searchError }}</p>
					<div class="searchPanelActions">
						<el-button size="small" @click="searchOpen = false">关闭</el-button>
					</div>
				</div>
			</Transition>
		</div>

		<!-- 二三维切换：独立于工具栏列，避免与控件重叠 -->
		<div class="baseMapSwitcher">
			<img
				class="base-map-icon"
				:src="baseIcon"
				alt="二三维切换"
				@click.stop="handleBaseToggle"
			/>
			<ul v-show="baseShow" class="base-map-box" @click.stop>
				<li
					v-for="item in baseMapImg"
					:key="item.id"
					:style="{ backgroundImage: `url(${item.img})` }"
					:class="{ baseMapBorder: baseMapIndex === item.id }"
					@click="handleBaseMapTab(item)"
				>
					<span>{{ item.name }}</span>
				</li>
			</ul>
		</div>

		<div v-if="sectionLoading" class="sectionGlobalLoadingMask" @click.stop>
			<div class="sectionStatusCard">
				<div class="sectionSpinner"></div>
				<div class="sectionStatusText">剖面分析中...</div>
			</div>
		</div>

		<div
			v-if="sectionVisible"
			ref="sectionPanelRef"
			class="sectionPanel"
			:class="{ 'is-sidebar-expanded': !leftPanelCollapsed }"
			@transitionend="onSectionPanelTransitionEnd"
			@click.stop
		>
			<div class="sectionPanelHeader">
				<span>剖面分析</span>
				<button
					type="button"
					class="sectionPanelClose"
					@click="
						sectionVisible = false;
						hideSectionTipMarker();
					"
				>
					×
				</button>
			</div>
			<div class="sectionBodyWrap">
				<div ref="sectionChartRef" class="sectionChart"></div>
			</div>
		</div>
	</div>
</template>

<style scoped lang="scss">
.mapToolbarRoot {
	position: absolute;
	inset: 0;
	pointer-events: none;
	z-index: 3;
}

.mapToolsWrap {
	position: absolute;
	top: var(--map-tools-inset-top, 8px);
	right: var(--map-tools-inset-right, 8px);
	display: flex;
	flex-direction: row;
	align-items: flex-start;
	gap: 5px;
	z-index: 998;
	pointer-events: auto;

	.layerPanel {
		position: absolute;
		top: 0;
		right: var(--map-panel-inset-right, 27.5px);
		width: 171px;
		max-height: calc(100% - 16px);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		border-radius: var(--app-radius-md);
		border: 1px solid var(--app-card-border);
		background: var(--app-card-bg-strong);
		backdrop-filter: blur(var(--app-backdrop-blur));
		box-shadow: var(--app-shadow-card);
	}

	.layerPanelHeader {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 26px;
		padding: 0 9px;
		background: linear-gradient(180deg, #f8fbff 0%, rgba(255, 255, 255, 0.92) 100%);
		border-bottom: 1px solid #eef2f7;
	}

	.layerPanelTitle {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 14px;
		font-weight: 600;
		color: var(--app-text-2);
		letter-spacing: 0.04em;
	}

	.layerPanelTitleIcon {
		width: 8px;
		height: 8px;
		object-fit: contain;
	}

	.layerPanelClose {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 14px;
		height: 14px;
		padding: 0;
		font-size: 20px;
		line-height: 1;
		color: var(--app-text-2);
		background: transparent;
		border: none;
		cursor: pointer;

		&:hover {
			color: var(--app-primary);
		}
	}

	.layerPanelBody {
		flex: 1;
		overflow: auto;
		padding: 9px;
		background: transparent;
		min-height: 60px;
	}

	.layerPanelEmpty {
		margin: 4px 0 0;
		font-size: 13px;
		color: var(--app-text-muted);
		text-align: center;
	}

	.layerPanelSelectWrap {
		margin-bottom: 6px;
	}

	:deep(.layerPanelBasemapSelect) {
		width: 100%;

		.el-select__wrapper {
			min-height: 17px;
			background: rgba(255, 255, 255, 0.92);
			box-shadow: 0 0 0 1px rgba(215, 226, 239, 0.95) inset;
			border-radius: 4px;
		}

		.el-select__wrapper.is-hovering,
		.el-select__wrapper.is-focused {
			box-shadow:
				0 0 0 1px rgba(0, 101, 192, 0.35) inset,
				0 0 0 3px rgba(0, 101, 192, 0.08);
		}

		.el-select__selected-item,
		.el-select__placeholder {
			font-size: 13px;
			color: var(--app-text-2);
		}

		.el-select__placeholder {
			color: #8ea0b8;
		}

		.el-select__caret {
			color: #5f708a;
		}
	}

	:deep(.layerPanelTree) {
		--el-tree-text-color: var(--app-text-2);
		--el-tree-expand-icon-color: #607084;
		--el-tree-node-hover-bg-color: #f2f6fb;

		background: transparent;
		color: #2e384b;

		.el-tree-node__content {
			height: 15px;
			color: var(--app-text-2);
			background: transparent;

			&:hover {
				background: #f2f6fb;
			}
		}

		.el-tree-node.is-current > .el-tree-node__content,
		.el-tree-node:focus > .el-tree-node__content {
			color: #1f2c3d;
			background: #ecf3fb;
		}

		.el-tree-node__label {
			font-size: 13px;
			color: var(--app-text-2);
		}

		.el-tree-node__expand-icon {
			color: #607084;

			&.is-leaf {
				color: transparent;
			}
		}

		.el-checkbox__inner {
			background: rgba(255, 255, 255, 0.92);
			border-color: #aebccd;
		}

		.el-checkbox__input.is-checked .el-checkbox__inner,
		.el-checkbox__input.is-indeterminate .el-checkbox__inner {
			background: var(--app-primary);
			border-color: var(--app-primary);
		}
	}

	.mapToolbar {
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		gap: 5px;
		padding: 4px;
		border-radius: 7px;
		border: 1px solid rgba(215, 226, 239, 0.85);
		background: rgba(255, 255, 255, 0.78);
		backdrop-filter: blur(5px);
		box-shadow:
			0 10px 28px rgba(15, 23, 42, 0.12),
			0 2px 8px rgba(15, 23, 42, 0.07);

		.mapToolButton {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 17.5px;
			height: 17.5px;
			padding: 0;
			/* 深色按钮更适配白色图标资源，保证可见性 */
			background: rgba(46, 56, 75, 0.92);
			border: 1px solid rgba(255, 255, 255, 0.14);
			border-radius: 5px;
			cursor: pointer;
			transition:
				background 0.18s ease,
				border-color 0.18s ease,
				transform 0.18s ease,
				box-shadow 0.18s ease;

			&.btn3d {
				padding: 3px;
				box-sizing: border-box;
			}

			&.mapToolButtonClear {
				height: auto;
				min-height: 16px;
				padding: 3px 2px;
				font-size: 12px;
				line-height: 1.2;
				color: rgba(255, 255, 255, 0.92);
				letter-spacing: 0.1em;
			}

			&:hover {
				transform: translateY(-1px);
				background: rgba(48, 57, 76, 0.96);
				border-color: rgba(255, 255, 255, 0.26);
				box-shadow: 0 6px 13px rgba(15, 23, 42, 0.18);
			}

			&.isActive {
				background: linear-gradient(
					180deg,
					rgba(0, 101, 192, 0.98),
					rgba(0, 101, 192, 0.86)
				);
				border-color: rgba(255, 255, 255, 0.22);
				box-shadow: 0 6px 13px rgba(0, 101, 192, 0.28);
			}

			.mapToolIcon {
				width: 100%;
				height: 100%;
				object-fit: contain;
				pointer-events: none;
			}

			.mapToolText {
				font-size: 14px;
				font-weight: 700;
				color: rgba(255, 255, 255, 0.92);
				letter-spacing: 2px;
				user-select: none;
			}

			.mapToolSvgIcon {
				font-size: 18px;
				color: #fff;
			}
		}
	}

	.searchPanel {
		position: absolute;
		top: 0;
		right: var(--map-panel-inset-right, 27.5px);
		width: 171px;
		padding: 9px;
		border-radius: var(--app-radius-md);
		border: 1px solid var(--app-card-border);
		background: var(--app-card-bg-strong);
		backdrop-filter: blur(var(--app-backdrop-blur));
		box-shadow: var(--app-shadow-card);
		pointer-events: auto;
	}

	.searchPanelTitle {
		margin-bottom: 6px;
		font-size: 14px;
		font-weight: 600;
		color: var(--app-text-2);
		letter-spacing: 0.04em;
	}

	.searchPanelError {
		margin: 4px 0 0;
		font-size: 12px;
		color: var(--app-danger);
	}

	.searchPanelActions {
		margin-top: 5px;
		display: flex;
		justify-content: flex-end;
		gap: 4px;
	}

	.searchSuggestWrap {
		margin-top: 5px;
		border-radius: 5px;
		border: 1px solid rgba(215, 226, 239, 0.9);
		background: rgba(255, 255, 255, 0.9);
		overflow: hidden;
		max-height: 120px;
	}

	.searchSuggestEmpty {
		padding: 7px 6px;
		font-size: 12px;
		color: var(--app-text-muted);
		text-align: center;
	}

	.searchSuggestList {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.searchSuggestItem + .searchSuggestItem {
		border-top: 1px solid rgba(233, 239, 247, 1);
	}

	.searchSuggestButton {
		width: 100%;
		text-align: left;
		padding: 5px 6px;
		border: none;
		background: transparent;
		cursor: pointer;
		transition: background 0.15s ease;

		&:hover {
			background: rgba(0, 101, 192, 0.06);
		}
	}

	.searchSuggestTitle {
		font-size: 13px;
		font-weight: 600;
		color: var(--app-text-2);
	}

	.searchSuggestDesc {
		margin-top: 1px;
		font-size: 12px;
		color: #73839a;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
}

.baseMapSwitcher {
	position: absolute;
	right: var(--map-tools-inset-right, 8px);
	bottom: 38px;
	z-index: 997;
	pointer-events: auto;
}

.base-map-icon {
	display: block;
	width: 20px;
	height: 20px;
	object-fit: cover;
	cursor: pointer;
	border: 1px solid var(--app-card-border);
	border-radius: 50%;
	background: rgba(255, 255, 255, 0.94);
	backdrop-filter: blur(5px);
	box-shadow: var(--app-shadow-card);
}

.base-map-box {
	position: absolute;
	right: 25px;
	bottom: 0;
	display: flex;
	gap: 5px;
	padding: 0;
	margin: 0;
	list-style: none;

	li {
		display: flex;
		align-items: flex-end;
		justify-content: flex-end;
		width: 57px;
		height: 40px;
		cursor: pointer;
		border-radius: 2px;
		background-repeat: no-repeat;
		background-size: 100% 100%;
		box-sizing: border-box;
		overflow: hidden;

		span {
			font-size: 14px;
			color: #fff;
			background: rgba(0, 101, 192, 0.92);
			padding: 1px 3px;
			border-top-left-radius: 3px;
		}
	}

	.baseMapBorder {
		border: 1px solid rgba(0, 101, 192, 0.75);
		box-shadow: 0 5px 11px rgba(0, 101, 192, 0.2);
	}
}

.sectionPanel {
	/* left/right 写在样式表内，由 postcss-px-to-viewport 转 vw；勿用行内 px */
	position: absolute;
	left: var(--section-panel-left-collapsed, 12px);
	right: calc(var(--map-tools-inset-right, 8px) + var(--map-panel-inset-right, 27.5px));
	bottom: 15px;
	height: 131px;
	z-index: 9999;
	box-sizing: border-box;
	border-radius: var(--app-radius-md);
	border: 1px solid var(--app-card-border);
	background: var(--app-card-bg-strong);
	backdrop-filter: blur(var(--app-backdrop-blur));
	box-shadow: var(--app-shadow-card);
	overflow: hidden;
	display: flex;
	flex-direction: column;
	min-width: 0;
	max-width: none;
	pointer-events: auto;
	transform: translate3d(0, 0, 0);
	transition: transform var(--sidebar-duration, 0.32s) var(--sidebar-ease, cubic-bezier(0.32, 0.72, 0, 1));
	will-change: transform;
	backface-visibility: hidden;

	&.is-sidebar-expanded {
		transform: translate3d(
			calc(var(--sidebar-width, 245px) + var(--section-panel-gap, 28px) - var(--section-panel-left-collapsed, 12px)),
			0,
			0
		);
	}
}

.sectionPanelHeader {
	height: 22px;
	padding: 0 7px;
	display: flex;
	align-items: center;
	justify-content: space-between;
	border-bottom: 1px solid #eef2f7;
	color: var(--app-text-2);
	font-weight: 600;
}

.sectionPanelClose {
	width: 14px;
	height: 14px;
	border: none;
	background: transparent;
	font-size: 20px;
	line-height: 1;
	cursor: pointer;
	color: var(--app-text-2);
}

.sectionBodyWrap {
	position: relative;
	flex: 1;
	min-height: 0;
}

.sectionChart {
	width: 100%;
	height: 100%;
	min-width: 0;
	min-height: 0;
	overflow: hidden;

	:deep(canvas) {
		display: block;
	}
}

.sectionGlobalLoadingMask {
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
	z-index: 10000;
	display: flex;
	align-items: center;
	justify-content: center;
	pointer-events: none;
}

.sectionStatusCard {
	min-width: 120px;
	padding: 9px 10px;
	border-radius: 4px;
	background: #fff;
	box-shadow: 0 3px 11px rgba(0, 0, 0, 0.18);
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 5px;
	pointer-events: none;
}

.sectionSpinner {
	width: 13px;
	height: 13px;
	border: 1.5px solid rgba(0, 101, 192, 0.2);
	border-top-color: #0065c0;
	border-radius: 50%;
	animation: sectionSpin 0.8s linear infinite;
}

.sectionStatusText {
	font-size: 13px;
	color: #2e384b;
}

@keyframes sectionSpin {
	to {
		transform: rotate(360deg);
	}
}

.layerPanelSlide-enter-active,
.layerPanelSlide-leave-active {
	transition:
		opacity 0.22s ease,
		transform 0.22s ease;
}

.layerPanelSlide-enter-from,
.layerPanelSlide-leave-to {
	opacity: 0;
	transform: translateX(8px);
}
</style>

<!-- 下拉 / loading 挂载到 body 或穿透 scoped，需独立样式块 -->
<style lang="scss">
.mapKitLoadingMask.el-loading-mask {
	background-color: rgba(0, 8, 18, 0.65) !important;
}

.layerPanelBasemapPopper.el-popper {
	border: 1px solid #d7e2ef !important;
	border-radius: 1px !important;
	background: #fff !important;

	.el-select-dropdown__item {
		font-size: 13px;
		color: #2e384b;

		&.is-hovering,
		&:hover {
			background: #f2f6fb;
			color: #2e384b;
		}

		&.is-selected {
			color: #0065c0;
			background: rgba(0, 101, 192, 0.1);
		}
	}

	.el-popper__arrow::before {
		border-color: #d7e2ef !important;
		background: #fff !important;
	}
}

.mars3d-popup-content,
.mars3d-template-content {
	overflow-y: hidden !important;
}

.mars3d-popup.mars3d-popup-background .mars3d-popup-content-wrapper,
.mars3d-popup .mars3d-popup-content-wrapper {
	/* 保持旧版“图片背景”质感 */
	background-image: url('/bg2.png') !important;
	background-size: cover !important;
	background-position: center !important;
	background-repeat: no-repeat !important;
	position: relative;
	border: 1px solid rgba(130, 160, 200, 0.55) !important;
	border-radius: 5px !important;
	box-shadow: 0 5px 12px rgba(0, 0, 0, 0.35);
}

.mars3d-popup.mars3d-popup-background .mars3d-popup-content-wrapper::after,
.mars3d-popup .mars3d-popup-content-wrapper::after {
	content: '';
	position: absolute;
	inset: 0;
	/* 旧版暗色蒙层，增强对比度 */
	background: rgba(10, 22, 34, 0.62);
	backdrop-filter: blur(1px);
	border-radius: inherit;
	pointer-events: none;
	z-index: 0;
}

.mars3d-popup .mars3d-popup-content {
	margin: 5px 6px !important;
	line-height: 1.4 !important;
	font-size: 12px !important;
	position: relative;
	z-index: 2;
}

.mars3d-popup-content-wrapper .mars3d-template-title {
	color: #f3f7ff !important;
	border-bottom: 1px solid rgba(120, 177, 255, 0.65) !important;
	font-weight: 600;
	text-shadow: 0 1px 1px rgba(0, 0, 0, 0.45);
	position: relative;
	z-index: 2;
	/* 对齐 mars3d 默认标题栏高度，留出关闭按钮空间 */
	height: 16.5px;
	line-height: 16.5px;
	padding: 0 19px 0 6.5px;
}

.mars3d-popup-content-wrapper .mars3d-template-content {
	color: #e6eeff !important;
	background: transparent !important;
	position: relative;
	z-index: 2;
	padding: 5px 6px 5.5px;
	font-size: 12px;
	line-height: 1.55;
}

.mars3d-popup-content-wrapper .mars3d-template-content > div {
	margin-bottom: 2px;
}

.mars3d-popup-content-wrapper .mars3d-template-content > div:last-child {
	margin-bottom: 0;
}

.mars3d-popup .mars3d-popup-tip {
	background-image: url('/bg2.png') !important;
	background-size: cover !important;
	background-position: center !important;
	background-repeat: no-repeat !important;
}

.mars3d-popup-close-button {
	color: #ffffff !important;
	text-shadow: 0 1px 1px rgba(0, 0, 0, 0.5);
	/* 修复：确保按钮可点击且与标题视觉居中 */
	position: absolute !important;
	top: 0 !important;
	right: 0 !important;
	z-index: 3 !important;
	pointer-events: auto !important;
	cursor: pointer;

	/* 与标题栏同高，保证和标题垂直居中 */
	width: 16.5px;
	height: 16.5px;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	padding: 0 !important;
	margin: 0 !important;
	line-height: 1 !important;
	font-size: 20px !important;
	border-radius: 0 5px 0 5px;
}
</style>
