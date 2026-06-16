import { onBeforeUnmount, onMounted } from 'vue';
import { offMapEvent, onMapEvent } from '../core/mapEvents.js';

/**
 * 在业务页中订阅地图事件（自动卸载）
 * @param {import('../core/mapEvents.js').MapEventType} type
 * @param {(payload: object) => void} handler
 */
export function useMapEvent(type, handler) {
	onMounted(() => {
		onMapEvent(type, handler);
	});

	onBeforeUnmount(() => {
		offMapEvent(type, handler);
	});
}
