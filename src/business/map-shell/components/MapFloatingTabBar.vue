<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import statsIcon from '../../../assets/images/profile/stats.png';
import statsActiveIcon from '../../../assets/images/profile/stats-active.png';
import areaIcon from '../../../assets/images/profile/area.png';
import areaActiveIcon from '../../../assets/images/profile/area-active.png';
import lineIcon from '../../../assets/images/profile/line.png';
import lineActiveIcon from '../../../assets/images/profile/line-active.png';
import mineIcon from '../../../assets/images/profile/mine.png';
import mineActiveIcon from '../../../assets/images/profile/mine-active.png';

const TAB_ICONS = {
	stats: { default: statsIcon, active: statsActiveIcon },
	area: { default: areaIcon, active: areaActiveIcon },
	line: { default: lineIcon, active: lineActiveIcon },
	mine: { default: mineIcon, active: mineActiveIcon }
};

const TAB_ROUTES = {
	stats: '/statistics',
	'area-monitor': '/area',
	'line-monitor': '/line',
	mine: '/mine'
};

const props = defineProps({
	modelValue: {
		type: String,
		default: ''
	},
	visible: {
		type: Boolean,
		default: true
	},
	motionClass: {
		type: String,
		default: ''
	},
	tabs: {
		type: Array,
		default: () => [
			{ id: 'stats', label: '数据统计', icon: 'stats' },
			{ id: 'area-monitor', label: '面状监测', icon: 'area', badge: 8 },
			{ id: 'line-monitor', label: '线状监测', icon: 'line' },
			{ id: 'mine', label: '我的', icon: 'mine' }
		]
	}
});

const emit = defineEmits(['update:modelValue']);

const route = useRoute();
const router = useRouter();

const activeTab = computed(() => {
	if (props.modelValue) {
		return props.modelValue;
	}

	const matched = [...route.matched].reverse().find((record) => record.meta?.tab);
	if (matched?.meta?.tab) {
		return matched.meta.tab;
	}

	const monitorTab = props.tabs.find(
		(tab) => tab.id === 'area-monitor' || tab.id === 'line-monitor'
	);
	return monitorTab?.id || props.tabs[0]?.id || 'stats';
});

function onTabClick(tab) {
	const path = TAB_ROUTES[tab.id];
	if (!path || route.path === path) {
		return;
	}

	emit('update:modelValue', tab.id);
	router.push(path);
}

function getTabIcon(icon, isActive) {
	const icons = TAB_ICONS[icon];
	if (!icons) return '';
	return isActive ? icons.active : icons.default;
}
</script>

<template>
	<div
		class="map-floating-tab-bar-wrap"
		:class="motionClass"
		:style="{ opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none' }"
	>
		<nav class="map-floating-tab-bar" aria-label="底部导航">
			<ul class="tab-list">
				<li
					v-for="tab in tabs"
					:key="tab.id"
					class="tab-item"
					:class="{ 'is-active': activeTab === tab.id }"
				>
					<button
						type="button"
						class="tab-btn"
						:aria-current="activeTab === tab.id ? 'page' : undefined"
						@click="onTabClick(tab)"
					>
						<span class="tab-icon-wrap">
							<img
								:src="getTabIcon(tab.icon, activeTab === tab.id)"
								alt=""
								class="tab-icon"
								aria-hidden="true"
							/>
							<span v-if="tab.badge" class="tab-badge">{{ tab.badge }}</span>
						</span>
						<span class="tab-label">{{ tab.label }}</span>
					</button>
				</li>
			</ul>
		</nav>
	</div>
</template>

<style scoped lang="scss">
.map-floating-tab-bar-wrap {
	flex-shrink: 0;
	width: 100%;
	z-index: 10;
	opacity: 1;
	transform: translate3d(0, 0, 0);
	pointer-events: auto;
	box-sizing: border-box;
	background: #141414;
}

.map-floating-tab-bar {
	width: 100%;
	background: #141414;
	border-top: 1px solid rgba(255, 255, 255, 0.06);
	min-height: var(--app-tab-bar-height, calc(52px + env(safe-area-inset-bottom, 0px)));
	padding-bottom: env(safe-area-inset-bottom, 0px);
}

.tab-list {
	display: flex;
	align-items: stretch;
	margin: 0;
	padding: 0;
	list-style: none;
}

.tab-item {
	flex: 1;
	display: flex;
	justify-content: center;
	min-width: 0;
}

.tab-btn {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 3px;
	width: 100%;
	min-height: 52px;
	padding: 5px 4px 7px;
	border: 0;
	border-radius: 0;
	background: transparent;
	cursor: pointer;
	-webkit-tap-highlight-color: transparent;
	color: rgba(255, 255, 255, 0.55);
	transition: color 0.15s ease;

	&:active {
		opacity: 0.85;
	}
}

.tab-item.is-active .tab-btn {
	color: var(--app-accent, #1cded4);
}

.tab-icon-wrap {
	position: relative;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 20px;
	height: 20px;
}

.tab-icon {
	display: block;
	width: 18px;
	height: 18px;
	object-fit: contain;
}

.tab-badge {
	position: absolute;
	top: -4px;
	right: -10px;
	min-width: 16px;
	height: 16px;
	padding: 0 4px;
	border-radius: 999px;
	background: #e50000;
	color: #fff;
	font-size: 10px;
	font-weight: 600;
	line-height: 16px;
	text-align: center;
}

.tab-label {
	font-size: 10px;
	line-height: 1.2;
	font-weight: 400;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	max-width: 100%;
}

.tab-item.is-active .tab-label {
	font-weight: 500;
}
</style>
