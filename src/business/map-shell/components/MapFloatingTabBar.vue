<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

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
	return matched?.meta?.tab || 'area-monitor';
});

function onTabClick(tab) {
	const path = TAB_ROUTES[tab.id];
	if (!path || route.path === path) {
		return;
	}

	emit('update:modelValue', tab.id);
	router.push(path);
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
							<span class="tab-icon" aria-hidden="true">
								<svg
									v-if="tab.icon === 'stats'"
									viewBox="0 0 24 24"
									fill="none"
									xmlns="http://www.w3.org/2000/svg"
								>
									<path
										d="M6 18V10M12 18V6M18 18V13"
										stroke="currentColor"
										stroke-width="1.8"
										stroke-linecap="round"
									/>
								</svg>
								<svg
									v-else-if="tab.icon === 'area'"
									viewBox="0 0 24 24"
									fill="none"
									xmlns="http://www.w3.org/2000/svg"
								>
									<path
										d="M5 10l7-4 7 4v9l-7 4-7-4v-9Z"
										stroke="currentColor"
										stroke-width="1.8"
										stroke-linejoin="round"
									/>
									<path
										d="M12 6v17M5 10l7 4 7-4"
										stroke="currentColor"
										stroke-width="1.8"
										stroke-linejoin="round"
									/>
								</svg>
								<svg
									v-else-if="tab.icon === 'line'"
									viewBox="0 0 24 24"
									fill="none"
									xmlns="http://www.w3.org/2000/svg"
								>
									<path
										d="M4 16l5-8 4 5 7-9"
										stroke="currentColor"
										stroke-width="1.8"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
								</svg>
								<svg
									v-else
									viewBox="0 0 24 24"
									fill="none"
									xmlns="http://www.w3.org/2000/svg"
								>
									<circle
										cx="12"
										cy="12"
										r="8.5"
										stroke="currentColor"
										stroke-width="1.8"
									/>
									<circle cx="12" cy="10" r="2.8" fill="currentColor" />
									<path
										d="M7.5 16.2c1.1-1.8 2.8-2.7 4.5-2.7s3.4.9 4.5 2.7"
										stroke="currentColor"
										stroke-width="1.8"
										stroke-linecap="round"
									/>
								</svg>
							</span>
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
	position: absolute;
	left: 0;
	right: 0;
	bottom: 0;
	z-index: 1000;
	opacity: 1;
	transform: translate3d(0, 0, 0);
	pointer-events: auto;
	box-sizing: border-box;
}

.map-floating-tab-bar {
	width: 100%;
	background: #141414;
	border-top: 1px solid rgba(255, 255, 255, 0.06);
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
	gap: 4px;
	width: 100%;
	min-height: 56px;
	padding: 6px 4px 8px;
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
	width: 24px;
	height: 24px;
}

.tab-icon {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 22px;
	height: 22px;
}

.tab-icon svg {
	width: 100%;
	height: 100%;
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
	font-size: 11px;
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
