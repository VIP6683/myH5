<script setup>
import { computed } from 'vue';
import pointSvg from '../../../assets/images/profile/measure-point.svg?raw';
import distanceSvg from '../../../assets/images/profile/measure-distance.svg?raw';
import areaSvg from '../../../assets/images/profile/measure-area.svg?raw';

const ICONS = {
	point: pointSvg,
	distance: distanceSvg,
	area: areaSvg
};

const props = defineProps({
	name: {
		type: String,
		required: true,
		validator: (value) => ['point', 'distance', 'area'].includes(value)
	}
});

const iconSvg = computed(() => ICONS[props.name] || '');
</script>

<template>
	<span class="map-measure-icon" v-html="iconSvg" aria-hidden="true" />
</template>

<style scoped>
.map-measure-icon {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 100%;
	height: 100%;
	color: inherit;
}

.map-measure-icon :deep(svg) {
	display: block;
	width: 100%;
	height: 100%;
}
</style>
