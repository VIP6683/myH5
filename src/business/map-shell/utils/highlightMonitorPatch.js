import { getMapInstance } from '../../../map-kit/mapApi.js';
import { MONITOR_LAYER_ID } from '../constants/monitorLayer.js';

const HIGHLIGHT_COLOR = '#1cded4';
const PULSE_DURATION_MS = 2400;
const PULSE_CYCLES = 3;
const BASE_OUTLINE_WIDTH = 4;

/** @type {string | number | null} */
let highlightedPatchId = null;
/** @type {unknown} */
let highlightedGraphic = null;
/** @type {number | null} */
let pulseFrameId = null;
/** @type {number | null} */
let pulseStartTime = null;
const originalStyles = new WeakMap();

function applyGraphicStyle(graphic, style) {
	if (!graphic || !style) {
		return;
	}

	if (typeof graphic.setStyle === 'function') {
		graphic.setStyle(style);
		return;
	}

	if (typeof graphic.setOptions === 'function') {
		graphic.setOptions({ style });
	}
}

function cloneStyle(style) {
	if (!style || typeof style !== 'object') {
		return {};
	}

	return { ...style };
}

function rememberOriginalStyle(graphic) {
	if (!graphic || originalStyles.has(graphic)) {
		return;
	}

	originalStyles.set(graphic, cloneStyle(graphic.style));
}

function buildHighlightStyle(graphic, outlineWidth = BASE_OUTLINE_WIDTH) {
	return {
		fill: true,
		fillColor: HIGHLIGHT_COLOR,
		fillOpacity: 0.2,
		outline: true,
		outlineColor: HIGHLIGHT_COLOR,
		outlineWidth,
		interactive: true
	};
}

function stopPulse() {
	if (pulseFrameId != null) {
		cancelAnimationFrame(pulseFrameId);
		pulseFrameId = null;
	}
	pulseStartTime = null;
}

function settleHighlight(graphic) {
	applyGraphicStyle(graphic, buildHighlightStyle(graphic, BASE_OUTLINE_WIDTH));
}

function startPulse(graphic) {
	stopPulse();
	pulseStartTime = performance.now();

	const tick = (now) => {
		if (graphic !== highlightedGraphic) {
			stopPulse();
			return;
		}

		const elapsed = now - pulseStartTime;
		if (elapsed >= PULSE_DURATION_MS) {
			settleHighlight(graphic);
			stopPulse();
			return;
		}

		const wave = 0.5 + 0.5 * Math.sin((elapsed / PULSE_DURATION_MS) * Math.PI * 2 * PULSE_CYCLES);
		const outlineWidth = BASE_OUTLINE_WIDTH + wave * 4;
		applyGraphicStyle(graphic, buildHighlightStyle(graphic, outlineWidth));
		pulseFrameId = requestAnimationFrame(tick);
	};

	pulseFrameId = requestAnimationFrame(tick);
}

/**
 * 清除列表定位产生的高亮描边
 */
export function clearMonitorPatchHighlight() {
	stopPulse();

	if (highlightedGraphic) {
		const savedStyle = originalStyles.get(highlightedGraphic);
		if (savedStyle) {
			applyGraphicStyle(highlightedGraphic, savedStyle);
			originalStyles.delete(highlightedGraphic);
		}
	}

	highlightedPatchId = null;
	highlightedGraphic = null;
}

/**
 * 高亮目标图斑：青绿描边 + 脉冲动画
 * @param {string | number} patchId
 */
export function highlightMonitorPatch(patchId) {
	if (!patchId) {
		return false;
	}

	const map = getMapInstance();
	if (!map) {
		return false;
	}

	const layer = map.getLayerById?.(MONITOR_LAYER_ID);
	const graphic = layer?.getGraphicById?.(patchId);
	if (!graphic) {
		return false;
	}

	if (highlightedPatchId !== patchId) {
		clearMonitorPatchHighlight();
	}

	highlightedPatchId = patchId;
	highlightedGraphic = graphic;
	rememberOriginalStyle(graphic);
	settleHighlight(graphic);
	startPulse(graphic);
	return true;
}
