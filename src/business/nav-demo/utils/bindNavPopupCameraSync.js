import { getLocationMarkerLayer, getMapInstance } from '../../../map-kit/mapApi.js';
import { isNavPopupAutoPanning, panMapToFitNavPopup } from './fitNavPopupInViewport.js';

export const NAV_POPUP_BASE_OFFSET = { x: 0, y: -10 };

function syncPopupWithGraphic(graphic, popup, baseOffset) {
	const anchor = graphic.positionShow || graphic.position || graphic.center;
	if (anchor) {
		popup.position = anchor;
	}

	popup.setStyle?.({
		offsetX: baseOffset.x ?? 0,
		offsetY: baseOffset.y ?? -10
	});
	popup.updateDivPosition?.();
}

function syncOpenPopups(layer, baseOffset) {
	for (const graphic of layer?.graphics || []) {
		const popup = graphic.getPopup?.();
		if (!popup?.show) {
			continue;
		}
		syncPopupWithGraphic(graphic, popup, baseOffset);
	}
}

/**
 * 弹框打开时：平移地图使弹框完整可见（弹框始终在图标正上方）
 * 地图缩放/平移时：仅同步弹框位置，不再偏移弹框
 * @param {{ x?: number, y?: number }} [baseOffset]
 * @returns {() => void}
 */
export function bindNavPopupCameraSync(baseOffset = NAV_POPUP_BASE_OFFSET) {
	const map = getMapInstance();
	const mars3d = globalThis.mars3d;

	if (!map || !mars3d) {
		return () => {};
	}

	let markerLayer = null;
	let openPopupCount = 0;
	let syncRafId = null;
	let disposed = false;
	let layerBindToken = 0;

	const cancelScheduledSync = () => {
		if (syncRafId) {
			cancelAnimationFrame(syncRafId);
			syncRafId = null;
		}
	};

	const schedulePopupSync = () => {
		if (disposed || openPopupCount === 0 || syncRafId || isNavPopupAutoPanning()) {
			return;
		}

		syncRafId = requestAnimationFrame(() => {
			syncRafId = null;
			if (disposed || openPopupCount === 0 || isNavPopupAutoPanning()) {
				return;
			}
			syncOpenPopups(markerLayer, baseOffset);
		});
	};

	const onCameraChanged = () => {
		schedulePopupSync();
	};

	const onCameraMoveEnd = async () => {
		if (disposed || openPopupCount === 0 || isNavPopupAutoPanning()) {
			return;
		}

		const layer = markerLayer || (await getLocationMarkerLayer(map));
		if (disposed) {
			return;
		}
		markerLayer = layer;
		syncOpenPopups(layer, baseOffset);
	};

	const bindCameraListeners = () => {
		// cameraChanged 在移动过程中每帧触发；已有 rAF 节流，且仅在弹框打开时绑定
		map.on(mars3d.EventType.cameraChanged, onCameraChanged);
		map.on(mars3d.EventType.cameraMoveEnd, onCameraMoveEnd);
	};

	const unbindCameraListeners = () => {
		map.off(mars3d.EventType.cameraChanged, onCameraChanged);
		map.off(mars3d.EventType.cameraMoveEnd, onCameraMoveEnd);
		cancelScheduledSync();
	};

	const onPopupOpen = async (event) => {
		openPopupCount += 1;
		if (openPopupCount === 1) {
			bindCameraListeners();
		}

		const graphic = event?.graphic || event?.target;
		const layer = markerLayer || (await getLocationMarkerLayer(map));
		if (disposed) {
			return;
		}
		markerLayer = layer;

		if (!graphic) {
			return;
		}

		const popup = graphic.getPopup?.();
		if (!popup?.show) {
			return;
		}

		await new Promise((resolve) => requestAnimationFrame(resolve));
		if (disposed) {
			return;
		}

		syncPopupWithGraphic(graphic, popup, baseOffset);
		await panMapToFitNavPopup(popup, map);
		if (disposed) {
			return;
		}
		syncPopupWithGraphic(graphic, popup, baseOffset);
	};

	const onPopupClose = () => {
		openPopupCount = Math.max(0, openPopupCount - 1);
		if (openPopupCount === 0) {
			unbindCameraListeners();
		}
	};

	const bindLayerPopupEvents = (layer) => {
		if (!layer || disposed) {
			return;
		}
		layer.on?.(mars3d.EventType.popupOpen, onPopupOpen);
		layer.on?.(mars3d.EventType.popupClose, onPopupClose);
	};

	const unbindLayerPopupEvents = (layer) => {
		layer?.off?.(mars3d.EventType.popupOpen, onPopupOpen);
		layer?.off?.(mars3d.EventType.popupClose, onPopupClose);
	};

	const token = ++layerBindToken;
	getLocationMarkerLayer(map).then((layer) => {
		if (disposed || token !== layerBindToken) {
			return;
		}
		markerLayer = layer;
		bindLayerPopupEvents(layer);
	});

	return () => {
		disposed = true;
		layerBindToken += 1;
		unbindCameraListeners();
		unbindLayerPopupEvents(markerLayer);
		openPopupCount = 0;
		markerLayer = null;
	};
}
