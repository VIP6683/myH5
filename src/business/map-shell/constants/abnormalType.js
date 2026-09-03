/** 异物类型 value → 地图绘制颜色（卫星底图需高饱和、高对比） */
export const ABNORMAL_TYPE_COLORS = {
	'color-steel': '#FF0000',
	mulch: '#FF00FF',
	'dust-net': '#FFFF00',
	construction: '#FF8C00',
	greenhouse: '#00FF00',
	water: '#00BFFF'
};

export const DEFAULT_ABNORMAL_COLOR = '#FF0000';

/**
 * @param {string | undefined | null} objectType
 * @returns {string}
 */
export function getAbnormalTypeColor(objectType) {
	if (!objectType) {
		return DEFAULT_ABNORMAL_COLOR;
	}
	return ABNORMAL_TYPE_COLORS[objectType] || DEFAULT_ABNORMAL_COLOR;
}

/** 半透明填充（有色可见） */
export const MONITOR_FILL_OPACITY = 0.22;
/**
 * 视觉上空心，但保留极低透明度，避免 Leaflet/Mars2D 在 fillOpacity=0 时点不中多边形内部
 */
export const MONITOR_OUTLINE_ONLY_OPACITY = 0.01;

/**
 * 是否使用半透明填充（否则仅描边）
 * 线状：待核查填充，待处置仅边框
 * 面状：待核查仅边框，待处置填充
 * @param {'area' | 'line'} kind
 * @param {string | number | null | undefined} taskStatus 0 未核查 / 2 待处置
 */
export function shouldFillMonitorPatch(kind, taskStatus) {
	const isPendingDispose = String(taskStatus ?? '') === '2';
	if (kind === 'line') {
		return !isPendingDispose;
	}
	return isPendingDispose;
}

/**
 * @param {string} color
 * @param {{ filled?: boolean }} [options]
 */
export function buildMonitorAreaStyle(color, options = {}) {
	const filled = options.filled !== false;
	return {
		fill: true,
		fillColor: color,
		fillOpacity: filled ? MONITOR_FILL_OPACITY : MONITOR_OUTLINE_ONLY_OPACITY,
		outline: true,
		outlineColor: color,
		outlineWidth: 3,
		outlineOpacity: 1,
		/** Leaflet Path 直传，保证描边色/不透明度与填充解耦 */
		color,
		opacity: 1,
		weight: 3,
		interactive: true
	};
}

/**
 * @param {string} color
 */
export function buildMonitorLineStyle(color) {
	return {
		color,
		width: 6,
		lineCap: 'round',
		lineJoin: 'round',
		interactive: true
	};
}
