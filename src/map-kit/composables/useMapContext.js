import { inject, provide } from 'vue';
import { MAP_CONTEXT_KEY } from '../constants.js';

/** 创建地图上下文（getMap / setMap / hasMap），供布局层 provide */
export function createMapContext(source) {
	const resolve = () => {
		const value = source?.value !== undefined ? source.value : source;
		return value || null;
	};

	return {
		getMap: () => {
			const target = resolve();
			if (!target) {
				return null;
			}
			return typeof target.getMap === 'function' ? target.getMap() : target;
		},
		setMap: (map) => {
			const target = resolve();
			target?.setMap?.(map);
		},
		hasMap: () => {
			const target = resolve();
			if (!target) {
				return false;
			}
			return typeof target.hasMap === 'function' ? target.hasMap() : !!target.getMap?.();
		},
		showMapLoading: (text) => {
			const target = resolve();
			target?.showMapLoading?.(text);
		},
		hideMapLoading: () => {
			const target = resolve();
			target?.hideMapLoading?.();
		}
	};
}

/** 向子组件注入地图上下文 */
export function provideMapContext(context) {
	provide(MAP_CONTEXT_KEY, context);
}

/** 在业务页中获取布局注入的地图上下文 */
export function useMapContext() {
	return inject(MAP_CONTEXT_KEY, null);
}
