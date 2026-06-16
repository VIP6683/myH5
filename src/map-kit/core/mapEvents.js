/**
 * 地图模块统一事件总线（业务弹框、侧栏等由宿主项目监听处理）
 */

/** @typedef {'feature-click' | 'layer-node-click'} MapEventType */

const listeners = new Map();

export const MapEventType = {
	/** 矢量点/标记/雷达影像等要素点击 */
	FEATURE_CLICK: 'feature-click',
	/** 图层树节点行点击（非勾选） */
	LAYER_NODE_CLICK: 'layer-node-click'
};

/**
 * @param {MapEventType} type
 * @param {(payload: object) => void} handler
 * @returns {() => void} 取消订阅
 */
export function onMapEvent(type, handler) {
	if (typeof handler !== 'function') {
		return () => {};
	}

	if (!listeners.has(type)) {
		listeners.set(type, new Set());
	}

	listeners.get(type).add(handler);
	return () => offMapEvent(type, handler);
}

export function offMapEvent(type, handler) {
	listeners.get(type)?.delete(handler);
}

export function emitMapEvent(type, payload) {
	const set = listeners.get(type);
	if (!set?.size) {
		return;
	}

	for (const handler of set) {
		try {
			handler(payload);
		} catch (error) {
			console.error(`[map-kit] ${type} handler error`, error);
		}
	}
}

export function clearMapEventListeners(type) {
	if (type) {
		listeners.delete(type);
		return;
	}

	listeners.clear();
}
