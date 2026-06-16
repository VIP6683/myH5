<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { addLocationMarkers, clearLocationMarkers } from '../../../map-kit/core/mars3d.js';
import { bindNavPopupCameraSync, NAV_POPUP_BASE_OFFSET } from '../utils/bindNavPopupCameraSync.js';
import { openNavDestination } from '../utils/openMapApp.js';
import { preloadWeChatJssdk } from '../utils/wechatJssdk.js';
import NavMapActionSheet from './NavMapActionSheet.vue';

const NAV_SHEET_EVENT = 'nav-demo:open-sheet';

/**
 * 长沙市内随机景点（GCJ02 坐标）
 * 用于测试手机地图 App 导航跳转功能
 */
const CHANGSHA_POIS = [
	{
		id: 'nav_demo_yuelu',
		name: '岳麓山风景区',
		desc: '岳麓山位于长沙市岳麓区，是国家级风景名胜区，以枫叶和爱晚亭著名。',
		lng: 112.9312,
		lat: 28.1890,
		category: '景区'
	},
	{
		id: 'nav_demo_tianxin',
		name: '天心阁',
		desc: '天心阁是长沙的标志性建筑，历史名胜，城南胜地，登阁可俯瞰长沙古城风貌。',
		lng: 112.9793,
		lat: 28.1897,
		category: '古迹'
	},
	{
		id: 'nav_demo_juzizhou',
		name: '橘子洲头',
		desc: '橘子洲位于湘江中心，毛泽东青年艺术雕像坐落于此，是长沙地标。',
		lng: 112.9687,
		lat: 28.2012,
		category: '景区'
	},
	{
		id: 'nav_demo_mawangdui',
		name: '马王堆汉墓',
		desc: '马王堆汉墓是西汉长沙国丞相利苍及其家属的墓葬，出土著名的辛追夫人。',
		lng: 113.0312,
		lat: 28.2156,
		category: '遗址'
	},
	{
		id: 'nav_demo_hunanmuseum',
		name: '湖南省博物馆',
		desc: '湖南省博物馆是湖南省最大的综合性博物馆，珍藏马王堆汉墓文物等。',
		lng: 112.9923,
		lat: 28.2278,
		category: '博物馆'
	},
	{
		id: 'nav_demo_wuyi',
		name: '五一广场',
		desc: '五一广场是长沙市中心最繁华的商业广场，也是重要的城市地标。',
		lng: 112.9792,
		lat: 28.2001,
		category: '广场'
	}
];

const sheetVisible = ref(false);
const activePoi = ref(null);
let unbindPopupCameraSync = null;

/** Mars3D Popup 配置：锚定图标坐标，缩放时实时跟随 */
const NAV_POPUP_OPTIONS = {
	className: 'nav-demo-popup-wrap',
	closeButton: true,
	closeOnClick: false,
	maxWidth: 320,
	useGraphicPostion: true,
	hasCache: true,
	offsetX: NAV_POPUP_BASE_OFFSET.x,
	offsetY: NAV_POPUP_BASE_OFFSET.y
};

function escapeHtml(str) {
	return String(str)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function escapeJs(str) {
	return String(str)
		.replace(/\\/g, '\\\\')
		.replace(/'/g, "\\'")
		.replace(/\n/g, '\\n')
		.replace(/\r/g, '\\r');
}

/**
 * 构建白色风格 popup：仅展示地点信息 +「到这里去」按钮
 */
function buildNavPopupHtml(poi) {
	const { name, desc, lng, lat, category } = poi;

	return `
<div class="nav-demo-popup">
  <div class="nav-demo-popup__header">
    <div class="nav-demo-popup__thumb">
      <div class="nav-demo-popup__thumb-placeholder">
        <span class="nav-demo-popup__category-icon">${getCategoryIcon(category)}</span>
      </div>
    </div>
    <div class="nav-demo-popup__info">
      <div class="nav-demo-popup__name">${escapeHtml(name)}</div>
      <div class="nav-demo-popup__desc">${escapeHtml(desc)}</div>
    </div>
  </div>
  <div class="nav-demo-popup__footer">
    <button
      type="button"
      class="nav-demo-popup__go-btn"
      onclick="window.dispatchEvent(new CustomEvent('${NAV_SHEET_EVENT}',{detail:{name:'${escapeJs(name)}',lng:${lng},lat:${lat}}}))">
      到这里去
    </button>
  </div>
</div>`;
}

function getCategoryIcon(category) {
	const map = {
		景区: '🏔',
		古迹: '🏛',
		遗址: '🏺',
		博物馆: '🏛',
		广场: '🏙'
	};
	return map[category] || '📍';
}

async function onOpenSheet(event) {
	activePoi.value = event.detail;
	const mode = await openNavDestination(event.detail);
	if (mode === 'fallback') {
		sheetVisible.value = true;
	}
}

async function addMarkers() {
	const markers = CHANGSHA_POIS.map((poi) => ({
		id: poi.id,
		name: poi.name,
		lng: poi.lng,
		lat: poi.lat,
		flyTo: false,
		popup: buildNavPopupHtml(poi),
		popupOptions: NAV_POPUP_OPTIONS,
		attr: { ...poi }
	}));

	await addLocationMarkers({
		markers,
		clear: true,
		flyToFirst: false
	});
}

onMounted(async () => {
	preloadWeChatJssdk();
	window.addEventListener(NAV_SHEET_EVENT, onOpenSheet);
	await addMarkers();
	unbindPopupCameraSync = bindNavPopupCameraSync(NAV_POPUP_BASE_OFFSET);
});

onBeforeUnmount(() => {
	unbindPopupCameraSync?.();
	unbindPopupCameraSync = null;
	window.removeEventListener(NAV_SHEET_EVENT, onOpenSheet);
	clearLocationMarkers();
});
</script>

<template>
	<NavMapActionSheet v-model:visible="sheetVisible" :poi="activePoi" />
</template>

<style>
	/* Nav Demo Popup 样式（Mars3D popup 渲染在地图层 DOM 外部，所以这里需要全局样式） */
	.nav-demo-popup {
		font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', sans-serif;
		min-width: 240px;
		max-width: 300px;
		padding: 0;
		background: #fff;
	}

	.nav-demo-popup__header {
		display: flex;
		gap: 10px;
		padding: 14px 14px 12px;
	}

	.nav-demo-popup__thumb {
		flex-shrink: 0;
		width: 56px;
		height: 56px;
		border-radius: 8px;
		overflow: hidden;
		background: #f5f5f5;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.nav-demo-popup__category-icon {
		font-size: 26px;
	}

	.nav-demo-popup__info {
		flex: 1;
		min-width: 0;
	}

	.nav-demo-popup__name {
		font-size: 16px;
		font-weight: 600;
		color: #1a1a1a;
		line-height: 1.4;
		margin-bottom: 4px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.nav-demo-popup__desc {
		font-size: 12px;
		color: #888;
		line-height: 1.5;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.nav-demo-popup__footer {
		padding: 0 14px 14px;
	}

	.nav-demo-popup__go-btn {
		display: block;
		width: 100%;
		padding: 10px 0;
		border: none;
		border-radius: 8px;
		background: #07c160;
		color: #fff;
		font-size: 15px;
		font-weight: 500;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
		transition: background 0.15s;
	}

	.nav-demo-popup__go-btn:active {
		background: #06ad56;
	}

	/* 覆盖全局暗色 Mars3D Popup 容器，改为纯白风格 */
	.nav-demo-popup-wrap.mars3d-popup .mars3d-popup-content-wrapper,
	.nav-demo-popup-wrap .mars3d-popup-content-wrapper {
		background: #fff !important;
		background-image: none !important;
		border: none !important;
		border-radius: 12px !important;
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12) !important;
	}

	.nav-demo-popup-wrap.mars3d-popup .mars3d-popup-content-wrapper::after,
	.nav-demo-popup-wrap .mars3d-popup-content-wrapper::after {
		display: none !important;
	}

	.nav-demo-popup-wrap .mars3d-popup-content {
		margin: 0 !important;
		padding: 0 !important;
		border-radius: 12px !important;
		overflow: hidden;
		background: #fff !important;
	}

	.nav-demo-popup-wrap .mars3d-popup-close-button {
		color: #bbb !important;
		text-shadow: none !important;
		font-size: 20px !important;
		width: 28px !important;
		height: 28px !important;
		padding: 4px !important;
		top: 4px !important;
		right: 4px !important;
	}

	.nav-demo-popup-wrap .mars3d-popup-tip {
		background: #fff !important;
		background-image: none !important;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08) !important;
	}
</style>
