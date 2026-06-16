<template>
	<Transition name="marsMapLoadingFade">
		<div
			v-if="visible"
			class="mapLoadingOverlay"
			:class="{ 'mapLoadingOverlay--blocking': blocking }"
		>
			<div class="mapLoadingOverlayCard">
				<div class="mapLoadingOverlayRing" aria-hidden="true">
					<span class="mapLoadingOverlayRing__track" />
					<span class="mapLoadingOverlayRing__arc" />
					<div class="mapLoadingOverlayBrand">数</div>
				</div>
				<p v-if="text" class="mapLoadingOverlayText">{{ text }}</p>
				<div class="mapLoadingOverlayBar" aria-hidden="true">
					<span />
				</div>
			</div>
		</div>
	</Transition>
</template>

<script setup>
defineProps({
	visible: {
		type: Boolean,
		default: false
	},
	text: {
		type: String,
		default: ''
	},
	blocking: {
		type: Boolean,
		default: false
	}
});
</script>

<style scoped lang="scss">
.mapLoadingOverlay {
	position: absolute;
	inset: 0;
	z-index: 20;
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgba(245, 246, 247, 0.88);
	backdrop-filter: blur(6px);
	-webkit-backdrop-filter: blur(6px);
	pointer-events: auto;
}

.mapLoadingOverlay--blocking {
	position: fixed;
	inset: 0;
	z-index: 3000;
	background: rgba(245, 246, 247, 0.92);
}

.mapLoadingOverlayCard {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 10px;
	padding: 16px 20px 14px;
	border-radius: 12px;
	background: rgba(255, 255, 255, 0.92);
	box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
	min-width: 0;
	max-width: 400px;
}

.mapLoadingOverlayRing {
	position: relative;
	width: 48px;
	height: 48px;
}

.mapLoadingOverlayRing__track,
.mapLoadingOverlayRing__arc {
	position: absolute;
	inset: 0;
	border-radius: 50%;
	box-sizing: border-box;
}

.mapLoadingOverlayRing__track {
	border: 1px solid rgba(255, 154, 60, 0.18);
}

.mapLoadingOverlayRing__arc {
	border: 2px solid transparent;
	border-top-color: #ff9a3c;
	border-right-color: #ff6b35;
	animation: mapLoadingSpin 0.9s linear infinite;
}

.mapLoadingOverlayBrand {
	position: absolute;
	left: 50%;
	top: 50%;
	transform: translate(-50%, -50%);
	width: 24px;
	height: 24px;
	border-radius: 6px;
	background: linear-gradient(135deg, #ff9a3c 0%, #ff6b35 100%);
	color: #fff;
	font-size: 12px;
	font-weight: 700;
	display: flex;
	align-items: center;
	justify-content: center;
	box-shadow: 0 2px 8px rgba(255, 107, 53, 0.28);
	z-index: 1;
}

.mapLoadingOverlayText {
	margin: 4px 0 0;
	font-size: 14px;
	color: #666;
	letter-spacing: 1px;
	font-weight: 500;
	white-space: nowrap;
}

.mapLoadingOverlayBar {
	width: 80px;
	height: 2px;
	border-radius: 999px;
	background: rgba(255, 154, 60, 0.15);
	overflow: hidden;

	span {
		display: block;
		width: 40%;
		height: 100%;
		border-radius: inherit;
		background: linear-gradient(90deg, #ff9a3c, #ff6b35);
		animation: mapLoadingBar 1.2s ease-in-out infinite;
	}
}

@keyframes mapLoadingSpin {
	to {
		transform: rotate(360deg);
	}
}

@keyframes mapLoadingBar {
	0% {
		transform: translateX(-120%);
	}
	100% {
		transform: translateX(320%);
	}
}

.marsMapLoadingFade-enter-active,
.marsMapLoadingFade-leave-active {
	transition: opacity 0.32s ease;
}

.marsMapLoadingFade-enter-from,
.marsMapLoadingFade-leave-to {
	opacity: 0;
}
</style>
