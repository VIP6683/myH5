<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { lockMapSurface, unlockMapSurface } from '../composables/mapSurfaceLock.js';
import MapFilterPanel from './MapFilterPanel.vue';

const props = defineProps({
	modelValue: {
		type: String,
		default: 'pending-verify'
	},
	searchText: {
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
			{ id: 'pending-verify', label: '待核查', count: 5 },
			{ id: 'pending-dispose', label: '待处置', count: 3 }
		]
	}
});

const emit = defineEmits([
	'update:modelValue',
	'update:searchText',
	'filter-change',
	'filter-open'
]);

const filterOpen = ref(false);
const filterPanelRef = ref(null);

const createEmptyFilters = () => ({
	year: '',
	objectType: [],
	verifyStatus: '',
	disposeStatus: ''
});

const appliedFilters = ref(createEmptyFilters());

const activeTab = computed({
	get: () => props.modelValue,
	set: (value) => emit('update:modelValue', value)
});

const keyword = computed({
	get: () => props.searchText,
	set: (value) => emit('update:searchText', value)
});

const onTabClick = (tabId) => {
	activeTab.value = tabId;
};

const openFilter = () => {
	filterPanelRef.value?.syncDraftFromModel();
	filterOpen.value = true;
	emit('filter-open', true);
};

const closeFilter = () => {
	filterOpen.value = false;
	emit('filter-open', false);
};

const toggleFilter = () => {
	if (filterOpen.value) {
		closeFilter();
		return;
	}
	openFilter();
};

const onFilterConfirm = (filters) => {
	appliedFilters.value = filters;
	emit('filter-change', filters);
	closeFilter();
};

const onFilterReset = () => {
	// 重置仅清空面板草稿，确认后才生效
};

watch(filterOpen, (open) => {
	emit('filter-open', open);
	if (open) {
		lockMapSurface();
	} else {
		unlockMapSurface();
	}
});

onBeforeUnmount(() => {
	if (filterOpen.value) {
		unlockMapSurface();
	}
});
</script>

<template>
	<div
		class="map-top-bar"
		:class="[motionClass, { 'map-top-bar--filter-open': filterOpen }]"
		:style="{ opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none' }"
	>
		<div class="map-top-bar__head">
			<div class="map-top-bar__search">
				<span class="map-top-bar__search-icon" aria-hidden="true">
					<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
						<circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="1.8" />
						<path
							d="M16 16l4.5 4.5"
							stroke="currentColor"
							stroke-width="1.8"
							stroke-linecap="round"
						/>
					</svg>
				</span>
				<input
					v-model="keyword"
					type="search"
					class="map-top-bar__search-input"
					placeholder="请输入"
					enterkeyhint="search"
					autocomplete="off"
				/>
			</div>

			<div class="map-top-bar__nav">
				<div class="map-top-bar__tabs" role="tablist" aria-label="任务类型">
					<button
						v-for="tab in tabs"
						:key="tab.id"
						type="button"
						class="map-top-bar__tab"
						:class="{ 'is-active': activeTab === tab.id }"
						role="tab"
						:aria-selected="activeTab === tab.id"
						@click="onTabClick(tab.id)"
					>
						<span class="map-top-bar__tab-label">{{ tab.label }}</span>
						<span v-if="tab.count != null" class="map-top-bar__tab-count">{{
							tab.count
						}}</span>
					</button>
				</div>

				<button
					type="button"
					class="map-top-bar__filter-btn"
					:class="{ 'is-active': filterOpen }"
					aria-expanded="filterOpen"
					@click="toggleFilter"
				>
					<span>筛选</span>
					<svg
						class="map-top-bar__filter-arrow"
						viewBox="0 0 24 24"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
						aria-hidden="true"
					>
						<path
							d="M7 10l5 5 5-5"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				</button>
			</div>
		</div>

		<Transition name="map-filter-slide">
			<div v-if="filterOpen" class="map-top-bar__filter-wrap">
				<MapFilterPanel
					ref="filterPanelRef"
					v-model="appliedFilters"
					@confirm="onFilterConfirm"
					@reset="onFilterReset"
				/>
			</div>
		</Transition>

		<Transition name="map-filter-fade">
			<div
				v-if="filterOpen"
				class="map-top-bar__shade"
				aria-hidden="true"
				@click="closeFilter"
			/>
		</Transition>
	</div>
</template>

<style scoped lang="scss">
.map-top-bar {
	--map-top-bar-height: calc(96px + env(safe-area-inset-top, 0px));

	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	z-index: 1001;
	transform: translate3d(0, 0, 0);
}

.map-top-bar__head {
	position: relative;
	z-index: 3;
	padding: calc(8px + env(safe-area-inset-top, 0px)) 12px 0px;
	background: rgb(16 24 31 / 82%);
	border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	backdrop-filter: blur(10px);
	-webkit-backdrop-filter: blur(10px);
}

.map-top-bar__search {
	display: flex;
	align-items: center;
	gap: 8px;
	height: 36px;
	padding: 0 14px;
	border-radius: 999px;
	background: rgba(255, 255, 255, 0.08);
	border: 1px solid rgba(255, 255, 255, 0.06);
}

.map-top-bar__search-icon {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 16px;
	height: 16px;
	color: rgba(255, 255, 255, 0.55);
	flex-shrink: 0;
}

.map-top-bar__search-icon svg {
	width: 100%;
	height: 100%;
}

.map-top-bar__search-input {
	flex: 1;
	min-width: 0;
	border: 0;
	background: transparent;
	color: #fff;
	font-size: 14px;
	line-height: 1.4;
	outline: none;

	&::placeholder {
		color: rgba(255, 255, 255, 0.45);
	}

	&::-webkit-search-cancel-button {
		-webkit-appearance: none;
	}
}

.map-top-bar__nav {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	margin-top: 10px;
}

.map-top-bar__tabs {
	display: flex;
	align-items: center;
	gap: 20px;
	min-width: 0;
}

.map-top-bar__tab {
	position: relative;
	display: inline-flex;
	align-items: baseline;
	gap: 4px;
	padding: 2px 0 8px;
	border: 0;
	background: transparent;
	color: rgba(255, 255, 255, 0.82);
	font-size: 15px;
	line-height: 1.2;
	cursor: pointer;
	-webkit-tap-highlight-color: transparent;
	transition: color 0.15s ease;

	&::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 2px;
		border-radius: 1px;
		background: transparent;
		transition: background 0.15s ease;
	}

	&.is-active {
		color: var(--app-accent, #1cded4);
		font-weight: 500;

		&::after {
			background: var(--app-accent, #1cded4);
		}
	}
}

.map-top-bar__tab-count {
	font-size: 14px;
}

.map-top-bar__filter-btn {
	display: inline-flex;
	align-items: center;
	gap: 2px;
	flex-shrink: 0;
	height: 24px;
	padding: 0 10px;
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 6px;
	background: rgba(255, 255, 255, 0.06);
	color: rgba(255, 255, 255, 0.82);
	font-size: 13px;
	line-height: 1;
	cursor: pointer;
	margin-bottom: 6px;
	-webkit-tap-highlight-color: transparent;
	transition:
		background 0.15s ease,
		border-color 0.15s ease,
		color 0.15s ease;

	&.is-active {
		background: rgba(45, 212, 191, 0.12);
		border-color: rgba(45, 212, 191, 0.35);
		color: var(--app-accent, #1cded4);
	}
}

.map-top-bar__filter-arrow {
	width: 14px;
	height: 14px;
	transition: transform 0.2s ease;
}

.map-top-bar__filter-btn.is-active .map-top-bar__filter-arrow {
	transform: rotate(180deg);
}

.map-top-bar__filter-wrap {
	position: relative;
	z-index: 2;
	overflow: hidden;
	transform-origin: top center;
	backface-visibility: hidden;
}

.map-top-bar__shade {
	position: fixed;
	inset: 0;
	z-index: 1;
	background: rgba(0, 0, 0, 0.35);
	pointer-events: auto;
}

.map-filter-slide-enter-active,
.map-filter-slide-leave-active {
	transition:
		transform 0.28s cubic-bezier(0.32, 0.72, 0, 1),
		opacity 0.22s ease;
	will-change: transform, opacity;
}

.map-filter-slide-enter-from,
.map-filter-slide-leave-to {
	transform: scaleY(0) translateZ(0);
	opacity: 0;
}

.map-filter-slide-enter-to,
.map-filter-slide-leave-from {
	transform: scaleY(1) translateZ(0);
	opacity: 1;
}

.map-filter-fade-enter-active,
.map-filter-fade-leave-active {
	transition: opacity 0.22s ease;
}

.map-filter-fade-enter-from,
.map-filter-fade-leave-to {
	opacity: 0;
}
</style>
