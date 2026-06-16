<script setup>
import MapDataStatsPanel from '../../business/map-shell/components/MapDataStatsPanel.vue';
</script>

<template>
	<main class="statistics-page">
		<MapDataStatsPanel :visible="true" />
	</main>
</template>

<style scoped lang="scss">
.statistics-page {
	position: relative;
	width: 100%;
	height: 100%;
	overflow: hidden;
	background: var(--tabbar-bg, #000);
}
</style>
