<script setup>

import { computed, nextTick, ref, watch } from 'vue';

import { DEFAULT_SIDE_MENU_TYPES } from '../config/sideMenuTypes.js';
import LocationPermissionDialog from '../../../components/location/LocationPermissionDialog.vue';
import { useLocationRequest } from '../../../composables/useLocationRequest.js';
import {
	locateMyPosition,
	zoomMapIn,
	zoomMapOut
} from '../../../map-kit/core/mars3d.js';

import SystemTipModal from './SystemTipModal.vue';

import '../styles/side-menu.scss';

import '../styles/side-menu-overrides.scss';



const props = defineProps({

	motionClass: {

		type: String,

		default: ''

	},

	visible: {

		type: Boolean,

		default: true

	},

	types: {

		type: Array,

		default: () => DEFAULT_SIDE_MENU_TYPES

	},

	modelValue: {

		type: String,

		default: 'all'

	},

	showZoom: {

		type: Boolean,

		default: true

	},

	showClearScreen: {

		type: Boolean,

		default: true

	},

	showMyLocation: {

		type: Boolean,

		default: true

	},

	showTutorialGuide: {

		type: Boolean,

		default: true

	}

});



const emit = defineEmits([

	'update:modelValue',

	'type-change',

	'clear-screen',

	'show-type-panel',

	'open-tutorial'

]);



const typeListRef = ref(null);

const activeTouch = ref('');

const locating = ref(false);

const tipVisible = ref(false);

const tipMessage = ref('');

const tipConfirmHandler = ref(null);



const currentType = computed({

	get: () => props.modelValue,

	set: (value) => {

		emit('update:modelValue', value);

		emit('type-change', value);

	}

});



const typeIndex = computed(() =>

	props.types.findIndex((item) => item.id === currentType.value)

);



const scrollTypeToCenter = async () => {

	await nextTick();

	const container = typeListRef.value?.parentElement;

	const activeItem = typeListRef.value?.querySelector('li.cur');

	if (!container || !activeItem) return;



	const maxScroll = container.scrollHeight - container.clientHeight;

	if (maxScroll <= 0) return;



	const itemTop = activeItem.offsetTop;

	const itemHeight = activeItem.offsetHeight;

	const target = itemTop - (container.clientHeight - itemHeight) / 2;

	container.scrollTop = Math.max(0, Math.min(maxScroll, target));

};



const selectType = (typeId, center = false) => {

	if (currentType.value === typeId) {

		if (center) scrollTypeToCenter();

		return;

	}

	currentType.value = typeId;

	scrollTypeToCenter();

};



const prevType = () => {

	const index = typeIndex.value;

	if (index > 0) {

		selectType(props.types[index - 1].id, true);

	}

};



const nextType = () => {

	const index = typeIndex.value;

	if (index >= 0 && index < props.types.length - 1) {

		selectType(props.types[index + 1].id, true);

	}

};



const onTypeClick = (typeId) => {

	if (typeId === currentType.value) {

		scrollTypeToCenter();

		return;

	}

	selectType(typeId, true);

};



const onTouchStart = (key) => {

	activeTouch.value = key;

};



const onTouchEnd = () => {

	activeTouch.value = '';

};



const openSystemTip = (message, onConfirm = null) => {

	tipMessage.value = message;

	tipConfirmHandler.value = onConfirm;

	tipVisible.value = true;

};




const {
	dialogVisible: locationDialogVisible,
	dialogMode: locationDialogMode,
	dialogErrorMessage: locationDialogMessage,
	requestLocation,
	onDialogConfirm: onLocationDialogConfirm
} = useLocationRequest();



const handleTipConfirm = () => {

	const handler = tipConfirmHandler.value;

	tipConfirmHandler.value = null;

	handler?.();

};



const handleLocateMyPosition = async () => {

	if (locating.value) return;

	locating.value = true;

	try {

		const coords = await requestLocation();

		if (coords) {

			await locateMyPosition({ lng: coords.lng, lat: coords.lat });

		}

	} catch (error) {

		if (error?.message !== 'cancelled' && error?.message !== 'denied') {

			console.warn('[sideMenu] location request failed', error);

			openSystemTip('当前位置获取失败，请稍后重试');

		}

	} finally {

		locating.value = false;

	}

};



watch(

	() => props.visible,

	(visible) => {

		if (visible) scrollTypeToCenter();

	}

);

</script>



<template>

	<div v-show="visible" class="map-side-menu sideMenu" :class="motionClass">

		<ul class="selectType">

			<li

				class="showTouch up"

				:class="{ onTouch: activeTouch === 'up' }"

				@touchstart.passive="onTouchStart('up')"

				@touchend.passive="onTouchEnd"

				@touchcancel.passive="onTouchEnd"

				@mousedown="onTouchStart('up')"

				@mouseup="onTouchEnd"

				@mouseleave="onTouchEnd"

				@click="prevType"

			>

				<span />

				<i />

			</li>



			<div id="selectTypeList">

				<div ref="typeListRef">

					<li

						v-for="item in types"

						:key="item.id"

						class="showTouch"

						:class="[item.id, { cur: currentType === item.id, onTouch: activeTouch === item.id }]"

						@touchstart.passive="onTouchStart(item.id)"

						@touchend.passive="onTouchEnd"

						@touchcancel.passive="onTouchEnd"

						@mousedown="onTouchStart(item.id)"

						@mouseup="onTouchEnd"

						@mouseleave="onTouchEnd"

						@click="onTypeClick(item.id)"

					>

						<span />

						<em>{{ item.label }}</em>

					</li>

				</div>

			</div>



			<li

				class="showTouch more"

				:class="{ onTouch: activeTouch === 'more' }"

				@touchstart.passive="onTouchStart('more')"

				@touchend.passive="onTouchEnd"

				@touchcancel.passive="onTouchEnd"

				@mousedown="onTouchStart('more')"

				@mouseup="onTouchEnd"

				@mouseleave="onTouchEnd"

				@click="emit('show-type-panel')"

			>

				<span />

			</li>



			<li

				class="showTouch down"

				:class="{ onTouch: activeTouch === 'down' }"

				@touchstart.passive="onTouchStart('down')"

				@touchend.passive="onTouchEnd"

				@touchcancel.passive="onTouchEnd"

				@mousedown="onTouchStart('down')"

				@mouseup="onTouchEnd"

				@mouseleave="onTouchEnd"

				@click="nextType"

			>

				<span />

			</li>

		</ul>



		<ul v-if="showZoom" class="scale">

			<li

				class="showTouch zoom"

				:class="{ onTouch: activeTouch === 'zoom-in' }"

				@touchstart.passive="onTouchStart('zoom-in')"

				@touchend.passive="onTouchEnd"

				@touchcancel.passive="onTouchEnd"

				@mousedown="onTouchStart('zoom-in')"

				@mouseup="onTouchEnd"

				@mouseleave="onTouchEnd"

				@click="zoomMapIn()"

			>

				<span />

				<i />

			</li>

			<li

				class="showTouch zoom_out"

				:class="{ onTouch: activeTouch === 'zoom-out' }"

				@touchstart.passive="onTouchStart('zoom-out')"

				@touchend.passive="onTouchEnd"

				@touchcancel.passive="onTouchEnd"

				@mousedown="onTouchStart('zoom-out')"

				@mouseup="onTouchEnd"

				@mouseleave="onTouchEnd"

				@click="zoomMapOut()"

			>

				<span />

			</li>

		</ul>



		<ul v-if="showClearScreen" id="clearScreenBlock">

			<li

				class="clearScreenBlock showTouch"

				:class="{ onTouch: activeTouch === 'clear' }"

				@touchstart.passive="onTouchStart('clear')"

				@touchend.passive="onTouchEnd"

				@touchcancel.passive="onTouchEnd"

				@mousedown="onTouchStart('clear')"

				@mouseup="onTouchEnd"

				@mouseleave="onTouchEnd"

				@click="emit('clear-screen')"

			>

				<span />

			</li>

		</ul>



		<ul v-if="showMyLocation" id="myLocationBlock">

			<li

				class="myLocationBlock showTouch"

				:class="{ onTouch: activeTouch === 'location', locating }"

				@touchstart.passive="onTouchStart('location')"

				@touchend.passive="onTouchEnd"

				@touchcancel.passive="onTouchEnd"

				@mousedown="onTouchStart('location')"

				@mouseup="onTouchEnd"

				@mouseleave="onTouchEnd"

				@click="handleLocateMyPosition"

			>

				<span />

			</li>

		</ul>



		<ul v-if="showTutorialGuide" id="tutorialCard">

			<li

				class="tutorialCard showTouch"

				:class="{ onTouch: activeTouch === 'tutorial' }"

				@touchstart.passive="onTouchStart('tutorial')"

				@touchend.passive="onTouchEnd"

				@touchcancel.passive="onTouchEnd"

				@mousedown="onTouchStart('tutorial')"

				@mouseup="onTouchEnd"

				@mouseleave="onTouchEnd"

				@click="emit('open-tutorial')"

			>

				<span class="help-mark">?</span>

			</li>

		</ul>

	</div>



	<LocationPermissionDialog
		v-model:visible="locationDialogVisible"
		:mode="locationDialogMode"
		:error-message="locationDialogMessage"
		@confirm="onLocationDialogConfirm"
	/>

	<SystemTipModal

		v-model:visible="tipVisible"

		:message="tipMessage"

		@confirm="handleTipConfirm"

		@close="tipConfirmHandler = null"

	/>


</template>


