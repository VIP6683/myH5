<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
	fetchLineAllLineName,
	normalizeLineNameOptions
} from '../../../api/lineMonitor.js';
import { lockMapSurface, unlockMapSurface } from '../composables/mapSurfaceLock.js';
import { createEmptyFilters, createEmptyLineQuery } from '../utils/monitorFilters.js';
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
	lineQuery: {
		type: Object,
		default: () => createEmptyLineQuery()
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
	},
	monitorType: {
		type: String,
		default: 'area'
	},
	filters: {
		type: Object,
		default: () => createEmptyFilters()
	}
});

const emit = defineEmits([
	'update:modelValue',
	'update:searchText',
	'update:lineQuery',
	'filter-change',
	'filter-open'
]);

const filterOpen = ref(false);
const filterPanelRef = ref(null);
const lineNameOptions = ref([]);
const lineNameLoading = ref(false);
const lineDropdownOpen = ref(false);
const lineSelectWrapRef = ref(null);

const isLineMonitor = computed(() => props.monitorType === 'line');

const activeTab = computed({
	get: () => props.modelValue,
	set: (value) => emit('update:modelValue', value)
});

const keyword = computed({
	get: () => props.searchText,
	set: (value) => emit('update:searchText', value)
});

const patchLineQuery = (patch) => {
	emit('update:lineQuery', {
		...createEmptyLineQuery(),
		...props.lineQuery,
		...patch
	});
};

const lineName = computed({
	get: () => props.lineQuery?.lineName ?? '',
	set: (value) => {
		const next = { lineName: value };
		if (!value) {
			next.startTower = '';
			next.endTower = '';
		}
		patchLineQuery(next);
	}
});

const startTower = computed({
	get: () => props.lineQuery?.startTower ?? '',
	set: (value) => patchLineQuery({ startTower: value })
});

const endTower = computed({
	get: () => props.lineQuery?.endTower ?? '',
	set: (value) => patchLineQuery({ endTower: value })
});

const towerEnabled = computed(() => Boolean(String(lineName.value || '').trim()));

const searchPlaceholder = computed(() => {
	if (props.monitorType === 'area') return '请输入异物编号、变电站编号';
	return '请输入';
});

const lineSelectLabel = computed(() => {
	if (lineNameLoading.value) return '线路加载中...';
	return '请选择线路';
});

const lineDisplayLabel = computed(() => {
	if (!lineName.value) {
		return lineSelectLabel.value;
	}
	const matched = lineNameOptions.value.find((item) => item.value === lineName.value);
	return matched?.label || lineName.value;
});

const startTowerPlaceholder = computed(() =>
	towerEnabled.value ? '起始杆塔' : '先选线路'
);

const endTowerPlaceholder = computed(() =>
	towerEnabled.value ? '终止杆塔' : '先选线路'
);

function closeLineDropdown() {
	lineDropdownOpen.value = false;
}

function toggleLineDropdown() {
	if (lineNameLoading.value) {
		return;
	}
	lineDropdownOpen.value = !lineDropdownOpen.value;
}

function selectLineName(value) {
	lineName.value = value;
	closeLineDropdown();
}

function clearLineName(event) {
	event.stopPropagation();
	lineName.value = '';
	closeLineDropdown();
}

function clearStartTower(event) {
	event.stopPropagation();
	startTower.value = '';
}

function clearEndTower(event) {
	event.stopPropagation();
	endTower.value = '';
}

function onDocumentPointerDown(event) {
	if (!lineDropdownOpen.value) {
		return;
	}
	const root = lineSelectWrapRef.value;
	if (root && !root.contains(event.target)) {
		closeLineDropdown();
	}
}

async function loadLineNameOptions() {
	if (!isLineMonitor.value) {
		return;
	}

	lineNameLoading.value = true;
	try {
		const params = {};
		if (props.filters?.year) {
			params.year = props.filters.year;
		}
		if (props.filters?.period) {
			params.period = props.filters.period;
		}
		const data = await fetchLineAllLineName(params);
		lineNameOptions.value = normalizeLineNameOptions(data);

		const current = String(lineName.value || '').trim();
		if (current && !lineNameOptions.value.some((item) => item.value === current)) {
			lineName.value = '';
		}
	} catch {
		lineNameOptions.value = [];
	} finally {
		lineNameLoading.value = false;
	}
}

const onTabClick = (tabId) => {
	activeTab.value = tabId;
};

const openFilter = () => {
	closeLineDropdown();
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
	// 先收起筛选面板，再抛出确认，避免「展开列表」与「关筛选」同帧竞态
	closeFilter();
	nextTick(() => {
		emit('filter-change', filters);
	});
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

watch(
	() => props.monitorType,
	(type) => {
		closeLineDropdown();
		if (type === 'line') {
			loadLineNameOptions();
		}
	}
);

watch(
	() => [props.filters?.year, props.filters?.period],
	() => {
		if (isLineMonitor.value) {
			loadLineNameOptions();
		}
	}
);

onMounted(() => {
	document.addEventListener('pointerdown', onDocumentPointerDown, true);
	if (isLineMonitor.value) {
		loadLineNameOptions();
	}
});

onBeforeUnmount(() => {
	document.removeEventListener('pointerdown', onDocumentPointerDown, true);
	if (filterOpen.value) {
		unlockMapSurface();
	}
});

defineExpose({
	closeFilter: () => {
		closeLineDropdown();
		closeFilter();
	}
});
</script>

<template>
	<div
		class="map-top-bar"
		:class="[
			motionClass,
			{
				'map-top-bar--filter-open': filterOpen,
				'map-top-bar--line-query': isLineMonitor
			}
		]"
		:style="{ opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none' }"
	>
		<div class="map-top-bar__head">
			<div v-if="!isLineMonitor" class="map-top-bar__search">
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
					:placeholder="searchPlaceholder"
					enterkeyhint="search"
					autocomplete="off"
				/>
			</div>

			<div v-else class="map-top-bar__line-query">
				<div ref="lineSelectWrapRef" class="map-top-bar__line-select-wrap">
					<div
						class="map-top-bar__field map-top-bar__field--line"
						:class="{
							'is-active': Boolean(lineName),
							'is-open': lineDropdownOpen,
							'is-loading': lineNameLoading
						}"
						role="button"
						tabindex="0"
						aria-haspopup="listbox"
						:aria-expanded="lineDropdownOpen"
						aria-label="线路名称"
						@click="toggleLineDropdown"
						@keydown.enter.prevent="toggleLineDropdown"
						@keydown.space.prevent="toggleLineDropdown"
					>
						<span
							class="map-top-bar__line-value"
							:class="{ 'is-placeholder': !lineName }"
						>
							{{ lineDisplayLabel }}
						</span>
						<button
							v-if="lineName"
							type="button"
							class="map-top-bar__clear-btn"
							aria-label="清除线路"
							@click="clearLineName"
						>
							<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
								<path
									d="M7.5 7.5l9 9M16.5 7.5l-9 9"
									stroke="currentColor"
									stroke-width="1.8"
									stroke-linecap="round"
								/>
							</svg>
						</button>
						<span
							v-else
							class="map-top-bar__field-chevron"
							:class="{ 'is-open': lineDropdownOpen }"
							aria-hidden="true"
						>
							<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
								<path
									d="M8 10l4 4 4-4"
									stroke="currentColor"
									stroke-width="1.8"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
							</svg>
						</span>
					</div>

					<Transition name="map-line-dropdown">
						<div
							v-if="lineDropdownOpen"
							class="map-top-bar__line-dropdown"
							role="listbox"
							aria-label="线路列表"
						>
							<button
								v-for="option in lineNameOptions"
								:key="option.value"
								type="button"
								class="map-top-bar__line-option"
								:class="{ 'is-selected': lineName === option.value }"
								role="option"
								:aria-selected="lineName === option.value"
								@click="selectLineName(option.value)"
							>
								{{ option.label }}
							</button>
							<p
								v-if="!lineNameLoading && !lineNameOptions.length"
								class="map-top-bar__line-empty"
							>
								暂无线路
							</p>
						</div>
					</Transition>
				</div>

				<div
					class="map-top-bar__field map-top-bar__field--tower"
					:class="{ 'is-disabled': !towerEnabled, 'is-ready': towerEnabled }"
				>
					<div class="map-top-bar__tower-field">
						<input
							v-model="startTower"
							type="text"
							class="map-top-bar__tower-input"
							:class="{ 'has-clear': Boolean(startTower) }"
							:placeholder="startTowerPlaceholder"
							:disabled="!towerEnabled"
							autocomplete="off"
							enterkeyhint="search"
							aria-label="起始杆塔"
						/>
						<button
							v-if="startTower"
							type="button"
							class="map-top-bar__clear-btn map-top-bar__clear-btn--tower"
							aria-label="清除起始杆塔"
							@click="clearStartTower"
						>
							<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
								<path
									d="M7.5 7.5l9 9M16.5 7.5l-9 9"
									stroke="currentColor"
									stroke-width="1.8"
									stroke-linecap="round"
								/>
							</svg>
						</button>
					</div>
					<span class="map-top-bar__tower-divider" aria-hidden="true" />
					<span class="map-top-bar__tower-to" aria-hidden="true">至</span>
					<span class="map-top-bar__tower-divider" aria-hidden="true" />
					<div class="map-top-bar__tower-field">
						<input
							v-model="endTower"
							type="text"
							class="map-top-bar__tower-input"
							:class="{ 'has-clear': Boolean(endTower) }"
							:placeholder="endTowerPlaceholder"
							:disabled="!towerEnabled"
							autocomplete="off"
							enterkeyhint="search"
							aria-label="终止杆塔"
						/>
						<button
							v-if="endTower"
							type="button"
							class="map-top-bar__clear-btn map-top-bar__clear-btn--tower"
							aria-label="清除终止杆塔"
							@click="clearEndTower"
						>
							<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
								<path
									d="M7.5 7.5l9 9M16.5 7.5l-9 9"
									stroke="currentColor"
									stroke-width="1.8"
									stroke-linecap="round"
								/>
							</svg>
						</button>
					</div>
				</div>
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
					:model-value="filters"
					:monitor-type="monitorType"
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

	&.map-top-bar--line-query {
		--map-top-bar-height: calc(132px + env(safe-area-inset-top, 0px));
	}
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

.map-top-bar__line-query {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.map-top-bar__line-select-wrap {
	position: relative;
	z-index: 4;
}

.map-top-bar__field {
	display: flex;
	align-items: center;
	height: 36px;
	padding: 0 12px;
	border-radius: 6px;
	background: rgba(255, 255, 255, 0.06);
	border: 1px solid rgba(255, 255, 255, 0.1);
	transition:
		border-color 0.15s ease,
		background 0.15s ease,
		opacity 0.15s ease;

	&:focus-within {
		border-color: rgba(255, 255, 255, 0.22);
		background: rgba(255, 255, 255, 0.08);
	}
}

.map-top-bar__field--line {
	gap: 8px;
	padding-right: 10px;
	cursor: pointer;
	-webkit-tap-highlight-color: transparent;
	outline: none;

	&.is-loading {
		cursor: wait;
		opacity: 0.72;
	}

	&.is-active,
	&.is-open {
		border-color: rgba(255, 255, 255, 0.18);
		background: rgba(255, 255, 255, 0.09);
	}

	&.is-open {
		border-color: rgba(255, 255, 255, 0.28);
	}
}

.map-top-bar__field--tower {
	gap: 0;
	padding: 0 4px;

	&.is-disabled {
		opacity: 0.45;
		pointer-events: none;
	}

	&.is-ready {
		border-color: rgba(255, 255, 255, 0.14);
	}
}

.map-top-bar__line-value {
	flex: 1;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	color: #fff;
	font-size: 14px;
	font-weight: 400;
	line-height: 1.4;
	text-align: left;

	&.is-placeholder {
		color: rgba(255, 255, 255, 0.42);
	}
}

.map-top-bar__field-chevron,
.map-top-bar__clear-btn {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 22px;
	height: 22px;
	flex-shrink: 0;
	color: rgba(255, 255, 255, 0.45);
}

.map-top-bar__field-chevron {
	transition: transform 0.18s ease;

	&.is-open {
		transform: rotate(180deg);
		color: rgba(255, 255, 255, 0.72);
	}
}

.map-top-bar__field-chevron svg,
.map-top-bar__clear-btn svg {
	width: 14px;
	height: 14px;
}

.map-top-bar__clear-btn {
	border: 0;
	border-radius: 4px;
	background: transparent;
	cursor: pointer;
	-webkit-tap-highlight-color: transparent;
	transition:
		background 0.15s ease,
		color 0.15s ease;

	&:active {
		background: rgba(255, 255, 255, 0.1);
		color: rgba(255, 255, 255, 0.85);
	}

	&--tower {
		position: absolute;
		right: 2px;
		top: 50%;
		transform: translateY(-50%);
		width: 24px;
		height: 24px;
		z-index: 1;
	}
}

.map-top-bar__line-dropdown {
	position: absolute;
	top: calc(100% + 4px);
	left: 0;
	right: 0;
	z-index: 5;
	max-height: min(42vh, 280px);
	overflow-y: auto;
	padding: 4px 0;
	border-radius: 6px;
	background: #1a1f26;
	border: 1px solid rgba(255, 255, 255, 0.12);
	box-shadow: 0 8px 20px rgba(0, 0, 0, 0.35);
	-webkit-overflow-scrolling: touch;
	overscroll-behavior: contain;
}

.map-top-bar__line-option {
	display: flex;
	align-items: center;
	width: 100%;
	min-height: 40px;
	padding: 0 14px;
	border: 0;
	border-radius: 0;
	background: transparent;
	color: rgba(255, 255, 255, 0.88);
	font-size: 14px;
	line-height: 1.3;
	text-align: left;
	cursor: pointer;
	-webkit-tap-highlight-color: transparent;
	transition: background 0.12s ease;

	&:active {
		background: rgba(255, 255, 255, 0.06);
	}

	&.is-selected {
		background: rgba(255, 255, 255, 0.08);
		color: #fff;
		font-weight: 500;
	}
}

.map-top-bar__line-empty {
	margin: 0;
	padding: 16px 12px;
	color: rgba(255, 255, 255, 0.38);
	font-size: 13px;
	text-align: center;
}

.map-line-dropdown-enter-active,
.map-line-dropdown-leave-active {
	transition:
		opacity 0.14s ease,
		transform 0.16s ease;
	transform-origin: top center;
}

.map-line-dropdown-enter-from,
.map-line-dropdown-leave-to {
	opacity: 0;
	transform: translateY(-4px);
}

.map-top-bar__tower-field {
	position: relative;
	display: flex;
	align-items: center;
	flex: 1;
	min-width: 0;
	height: 100%;
}

.map-top-bar__tower-input {
	flex: 1;
	min-width: 0;
	width: 100%;
	height: 100%;
	padding: 0 12px;
	border: 0;
	background: transparent;
	color: #fff;
	font-size: 13px;
	line-height: 1.4;
	text-align: center;
	outline: none;

	&.has-clear {
		padding-right: 28px;
	}

	&::placeholder {
		color: rgba(255, 255, 255, 0.38);
	}

	&:disabled {
		color: rgba(255, 255, 255, 0.3);
	}
}

.map-top-bar__tower-divider {
	flex-shrink: 0;
	width: 1px;
	height: 14px;
	background: rgba(255, 255, 255, 0.12);
}

.map-top-bar__tower-to {
	flex-shrink: 0;
	padding: 0 8px;
	color: rgba(255, 255, 255, 0.4);
	font-size: 12px;
	font-weight: 400;
	line-height: 1;
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
	font-size: 14px;
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
		color: #1cded4;
		font-weight: 700;
		font-size: 14px;

		&::after {
			background: #1cded4;
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
