import { MY_POSITION_MARKER_ID } from '../../constants.js';
import myPositionIcon from '../../../assets/my-position.svg';
import {
	ensureDeviceOrientationPermission,
	getLatestDeviceHeading,
	startDeviceHeadingWatch,
	stopDeviceHeadingWatch
} from '../../../utils/deviceHeading.js';

function getMars2d() {
	return globalThis.mars2d;
}

const MARKER_HTML = `
<div class="mars-my-position" data-role="root">
  <div class="mars-my-position__rotator" data-role="rotator" aria-hidden="true">
    <img class="mars-my-position__icon" src="${myPositionIcon}" alt="" draggable="false" />
  </div>
</div>
`.trim();

const MARKER_STYLE_ID = 'mars-my-position-marker-style';
let myPositionGraphic = null;
let headingMap = null;
let rotatorElement = null;
let unbindCameraListener = null;
let unbindHeadingWatch = null;

function listLayerGraphics(layer) {
	const fromMethod = layer?.getGraphics?.();
	if (Array.isArray(fromMethod)) return fromMethod;
	if (Array.isArray(layer?.graphics)) return layer.graphics;
	if (Array.isArray(layer?._graphics)) return layer._graphics;
	return [];
}

function cleanupLegacyMyPositionGraphics(layer) {
	if (!layer) return;
	const graphics = [...listLayerGraphics(layer)];
	for (const graphic of graphics) {
		if (myPositionGraphic && graphic === myPositionGraphic) continue;
		const idMatched = graphic?.id === MY_POSITION_MARKER_ID;
		const kindMatched = graphic?.attr?.kind === 'my_position';
		if (!idMatched && !kindMatched) continue;
		layer.removeGraphic?.(graphic, false);
	}
}

function updateGraphicLatLng(graphic, lng, lat) {
	if (!graphic) return false;
	const next = [lat, lng];
	if (typeof graphic.setLatLng === 'function') {
		graphic.setLatLng(next);
		return true;
	}
	if (typeof graphic.setLatlng === 'function') {
		graphic.setLatlng(next);
		return true;
	}
	if (typeof graphic.setOptions === 'function') {
		graphic.setOptions({ latlng: next });
		return true;
	}
	if (typeof graphic.setStyle === 'function') {
		graphic.setStyle({ latlng: next });
		return true;
	}
	return false;
}

function ensureMarkerStyles() {
	if (typeof document === 'undefined' || document.getElementById(MARKER_STYLE_ID)) {
		return;
	}

	const style = document.createElement('style');
	style.id = MARKER_STYLE_ID;
	style.textContent = `
.mars-my-position { position: relative; width: 48px; height: 48px; pointer-events: none; transform: translate(-50%, -50%); }
.mars-my-position__rotator { position: absolute; inset: 0; transform: rotate(0deg); transform-origin: center center; transition: transform 0.12s linear; }
.mars-my-position__icon { display: block; width: 100%; height: 100%; object-fit: contain; pointer-events: none; user-select: none; -webkit-user-drag: none; }
`;
	document.head.appendChild(style);
}

function bindRotatorElement(graphic) {
	const container = graphic?.container || graphic?.div;
	const root = container?.querySelector?.('[data-role="root"]') || container?.firstElementChild;
	const nextRotator = root?.querySelector?.('[data-role="rotator"]') || null;
	if (!nextRotator) return false;
	rotatorElement = nextRotator;
	updateMarkerRotation();
	return true;
}

function updateMarkerRotation(heading) {
	if (!rotatorElement) return;
	const deviceHeading = typeof heading === 'number' ? heading : getLatestDeviceHeading();
	const rotation = typeof deviceHeading === 'number' ? (deviceHeading + 360) % 360 : 0;
	rotatorElement.style.transform = `rotate(${rotation}deg)`;
}

function bindMapHeadingListener(map) {
	unbindCameraListener?.();
	if (!map) return;

	const mars2d = getMars2d();
	const onMove = () => updateMarkerRotation();
	map.on(mars2d.EventType.move, onMove);
	map.on(mars2d.EventType.moveend, onMove);
	unbindCameraListener = () => {
		map.off?.(mars2d.EventType.move, onMove);
		map.off?.(mars2d.EventType.moveend, onMove);
	};
}

function createMyPositionGraphic({ lng, lat }) {
	const mars2d = getMars2d();
	ensureMarkerStyles();
	return new mars2d.graphic.DivGraphic({
		id: MY_POSITION_MARKER_ID,
		name: '我的位置',
		latlng: [lat, lng],
		style: { html: MARKER_HTML, pointerEvents: false },
		attr: { kind: 'my_position' },
		pointerEvents: false
	});
}

export async function upsertMyPositionMarker({ layer, map, lng, lat }) {
	if (!layer || !map) {
		throw new Error('Map layer is not ready.');
	}

	if (myPositionGraphic) {
		const updated = updateGraphicLatLng(myPositionGraphic, lng, lat);
		if (!updated) {
			layer.removeGraphic?.(myPositionGraphic, false);
			myPositionGraphic = null;
			rotatorElement = null;
		}
	}

	if (!myPositionGraphic) {
		// 仅在首次创建时做一次兜底清理，避免重复删建触发 ClusterLayer 内部空引用
		if (!headingMap) {
			cleanupLegacyMyPositionGraphics(layer);
		}
		myPositionGraphic = createMyPositionGraphic({ lng, lat });
		layer.addGraphic(myPositionGraphic);
	}
	bindRotatorElement(myPositionGraphic);
	requestAnimationFrame(() => bindRotatorElement(myPositionGraphic));

	headingMap = map;
	const granted = await ensureDeviceOrientationPermission();
	if (!granted) {
		console.warn('[myPosition] 设备朝向权限未授予');
	}
	if (!unbindHeadingWatch) {
		unbindHeadingWatch = startDeviceHeadingWatch((heading) => updateMarkerRotation(heading));
	}
	bindMapHeadingListener(map);
	updateMarkerRotation();

	return myPositionGraphic;
}

export function stopMyPositionMarker() {
	unbindHeadingWatch?.();
	unbindHeadingWatch = null;
	stopDeviceHeadingWatch();
	unbindCameraListener?.();
	unbindCameraListener = null;
	headingMap = null;
	rotatorElement = null;
	myPositionGraphic = null;
}

export function removeMyPositionMarker(layer) {
	if (!layer) {
		stopMyPositionMarker();
		return false;
	}
	const graphic = layer.getGraphicById?.(MY_POSITION_MARKER_ID);
	if (!graphic) {
		stopMyPositionMarker();
		return false;
	}
	layer.removeGraphic(graphic, true);
	stopMyPositionMarker();
	return true;
}
