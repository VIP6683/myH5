<template>
	<div class="default-layout">
		<RouterView />
	</div>
</template>

<style scoped lang="scss">
.default-layout {
	position: relative;
	width: 100%;
	height: var(--app-vv-height, 100dvh);
	max-height: var(--app-vv-height, 100dvh);
	overflow: hidden;
	padding-bottom: calc(56px + env(safe-area-inset-bottom, 0px));
	box-sizing: border-box;
}
</style>
