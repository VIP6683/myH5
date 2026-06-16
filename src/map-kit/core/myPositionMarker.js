import { MY_POSITION_MARKER_ID } from '../constants.js';
import {
	ensureDeviceOrientationPermission,
	getLatestDeviceHeading,
	startDeviceHeadingWatch,
	stopDeviceHeadingWatch
} from '../../utils/deviceHeading.js';

function getMars3d() {
	const mars3d = globalThis.mars3d;
	if (!mars3d) {
		throw new Error('mars3d global not found. Check public/lib script loading in index.html.');
	}
	return mars3d;
}

function getCesium() {
	return globalThis.Cesium;
}

function requestMapRender(map) {
	map?.viewer?.scene?.requestRender?.();
}

const MARKER_HTML = `
<div class="mars-my-position" data-role="root">
  <div class="mars-my-position__halo" aria-hidden="true"></div>
  <div class="mars-my-position__rotator" data-role="rotator" aria-hidden="true">
    <div class="mars-my-position__beam"></div>
  </div>
  <div class="mars-my-position__dot" aria-hidden="true"></div>
</div>
`.trim();

const MARKER_STYLE_ID = 'mars-my-position-marker-style';

/** @type {import('mars3d').graphic.DivGraphic | null} */
let myPositionGraphic = null;

/** @type {import('mars3d').Map | null} */
let headingMap = null;

/** @type {HTMLElement | null} */
let rotatorElement = null;

/** @type {(() => void) | null} */
let unbindCameraListener = null;

function ensureMarkerStyles() {
	if (typeof document === 'undefined' || document.getElementById(MARKER_STYLE_ID)) {
		return;
	}

	const style = document.createElement('style');
	style.id = MARKER_STYLE_ID;
	style.textContent = `
.mars-my-position {
  position: relative;
  width: 56px;
  height: 56px;
  pointer-events: none;
  transform: translate(-50%, -50%);
}
.mars-my-position__halo {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: rgba(47, 129, 255, 0.16);
  box-shadow: 0 0 14px rgba(47, 129, 255, 0.34);
}
.mars-my-position__rotator {
  position: absolute;
  inset: 0;
  transform: rotate(0deg);
  transition: transform 0.12s linear;
}
.mars-my-position__beam {
  position: absolute;
  left: 50%;
  top: 4px;
  width: 0;
  height: 0;
  transform: translateX(-50%);
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-bottom: 18px solid rgba(47, 129, 255, 0.92);
  filter: drop-shadow(0 1px 2px rgba(15, 76, 168, 0.35));
}
.mars-my-position__dot {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 18px;
  height: 18px;
  margin: -9px 0 0 -9px;
  border-radius: 50%;
  background: #2f81ff;
  border: 3px solid #fff;
  box-shadow: 0 1px 5px rgba(0, 0, 0, 0.28);
}
`;
	document.head.appendChild(style);
}

function getMapHeadingDegrees(map) {
	const heading = map?.camera?.heading;
	if (typeof heading !== 'number') {
		return 0;
	}

	const cesium = getCesium();
	if (cesium?.Math?.toDegrees) {
		return cesium.Math.toDegrees(heading);
	}

	return (heading * 180) / Math.PI;
}

function updateMarkerRotation() {
	if (!rotatorElement) {
		return;
	}

	const deviceHeading = getLatestDeviceHeading();
	const mapHeading = getMapHeadingDegrees(headingMap);
	const rotation =
		typeof deviceHeading === 'number'
			? (deviceHeading - mapHeading + 360) % 360
			: 0;

	rotatorElement.style.transform = `rotate(${rotation}deg)`;
	requestMapRender(headingMap);
}

function bindMapHeadingListener(map) {
	unbindCameraListener?.();
	unbindCameraListener = null;

	if (!map) {
		return;
	}

	const mars3d = getMars3d();
	const onCameraChanged = () => updateMarkerRotation();
	map.on(mars3d.EventType.cameraChanged, onCameraChanged);
	map.on(mars3d.EventType.cameraMoveEnd, onCameraChanged);

	unbindCameraListener = () => {
		map.off?.(mars3d.EventType.cameraChanged, onCameraChanged);
		map.off?.(mars3d.EventType.cameraMoveEnd, onCameraChanged);
	};
}

function bindRotatorElement(graphic) {
	const container = graphic?.container || graphic?.div;
	const root = container?.querySelector?.('[data-role="root"]') || container?.firstElementChild;
	rotatorElement = root?.querySelector?.('[data-role="rotator"]') || null;
	updateMarkerRotation();
}

async function startHeadingTracking(map) {
	headingMap = map;
	await ensureDeviceOrientationPermission();
	startDeviceHeadingWatch(() => updateMarkerRotation());
	bindMapHeadingListener(map);
	updateMarkerRotation();
}

function createMyPositionGraphic({ lng, lat, alt }) {
	const mars3d = getMars3d();
	const cesium = getCesium();
	ensureMarkerStyles();

	const position = new mars3d.LngLatPoint(lng, lat, typeof alt === 'number' ? alt : 0);

	return new mars3d.graphic.DivGraphic({
		id: MY_POSITION_MARKER_ID,
		name: '我的位置',
		position,
		style: {
			html: MARKER_HTML,
			horizontalOrigin: cesium?.HorizontalOrigin?.CENTER,
			verticalOrigin: cesium?.VerticalOrigin?.CENTER,
			clampToGround: true,
			pointerEvents: false
		},
		attr: { kind: 'my_position' },
		pointerEvents: false
	});
}

/**
 * 添加或更新高德风格「我的位置」标记，并启动陀螺仪方向追踪
 * @param {object} options
 * @param {import('mars3d').layer.GraphicLayer} options.layer
 * @param {import('mars3d').Map} options.map
 * @param {number} options.lng
 * @param {number} options.lat
 * @param {number} [options.alt]
 */
export async function upsertMyPositionMarker(options = {}) {
	const { layer, map, lng, lat, alt } = options;
	if (!layer || !map) {
		throw new Error('Map layer is not ready.');
	}

	const existingGraphic = layer.getGraphicById(MY_POSITION_MARKER_ID);
	if (existingGraphic) {
		layer.removeGraphic(existingGraphic, true);
	}

	myPositionGraphic = createMyPositionGraphic({ lng, lat, alt });
	myPositionGraphic.unbindContextMenu?.();
	layer.addGraphic(myPositionGraphic);

	const mars3d = getMars3d();
	if (typeof myPositionGraphic?.on === 'function') {
		myPositionGraphic.on(mars3d.EventType.load, () => bindRotatorElement(myPositionGraphic));
	}

	bindRotatorElement(myPositionGraphic);
	globalThis.requestAnimationFrame(() => bindRotatorElement(myPositionGraphic));
	await startHeadingTracking(map);
	requestMapRender(map);

	return myPositionGraphic;
}

export function stopMyPositionMarker() {
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

	const graphic = layer.getGraphicById(MY_POSITION_MARKER_ID);
	if (!graphic) {
		stopMyPositionMarker();
		return false;
	}

	layer.removeGraphic(graphic, true);
	stopMyPositionMarker();
	return true;
}
