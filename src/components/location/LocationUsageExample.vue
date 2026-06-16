<script setup>
/**
 * 定位授权调用示例（可复用到任意页面）
 *
 * 方式一：useLocationRequest + LocationPermissionDialog（推荐）
 * 方式二：直接使用 utils/locationPermission.js 工具函数
 */
import { ref } from 'vue';
import LocationPermissionDialog from '../components/location/LocationPermissionDialog.vue';
import { useLocationRequest } from '../composables/useLocationRequest.js';
import { getCurrentLocation, queryGeolocationPermission } from '../utils/locationPermission.js';

const lastCoords = ref(null);

const {
	dialogVisible,
	dialogMode,
	dialogErrorMessage,
	requestLocation,
	onDialogConfirm
} = useLocationRequest({
	onSuccess: (coords) => {
		lastCoords.value = coords;
		console.log('location-success', coords);
	}
});

// 点击定位按钮
const onLocateClick = async () => {
	try {
		const coords = await requestLocation();
		if (coords) {
			// { lng, lat }
			lastCoords.value = coords;
		}
	} catch (error) {
		if (error?.message === 'cancelled') return;
		console.warn('定位未完成', error);
	}
};

// 仅检测权限（不弹业务框）
const checkPermission = async () => {
	const state = await queryGeolocationPermission();
	console.log('permission:', state);
};

// 已授权场景可直接调用
const locateDirectly = async () => {
	const coords = await getCurrentLocation();
	lastCoords.value = coords;
};
</script>

<template>
	<section class="location-demo">
		<button type="button" @click="onLocateClick">获取当前位置（完整流程）</button>
		<button type="button" @click="checkPermission">检测权限状态</button>
		<button type="button" @click="locateDirectly">直接定位（需已授权）</button>

		<p v-if="lastCoords">当前坐标：{{ lastCoords.lng }}, {{ lastCoords.lat }}</p>

		<LocationPermissionDialog
			v-model:visible="dialogVisible"
			:mode="dialogMode"
			:error-message="dialogErrorMessage"
			@confirm="onDialogConfirm"
		/>
	</section>
</template>
