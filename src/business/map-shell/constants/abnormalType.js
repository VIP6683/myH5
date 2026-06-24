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

/**
 * @param {string} color
 */
export function buildMonitorAreaStyle(color) {
	return {
		fill: true,
		fillColor: color,
		fillOpacity: 0.22,
		outline: true,
		outlineColor: color,
		outlineWidth: 3,
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
