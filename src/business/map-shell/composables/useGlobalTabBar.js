import { ref } from 'vue';

const visible = ref(true);
const motionClass = ref('');

/** 地图页底栏动效状态，供 App 层全局 TabBar 同步 */
export function useGlobalTabBar() {
	return { visible, motionClass };
}
