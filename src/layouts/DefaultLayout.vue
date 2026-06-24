<template>
	<div class="default-layout">
		<RouterView />
	</div>
</template>

<style scoped lang="scss">
.default-layout {
	position: relative;
	width: 100%;
	height: 100%;
	overflow: hidden;
	background: var(--tabbar-bg, #000);
}
</style>
