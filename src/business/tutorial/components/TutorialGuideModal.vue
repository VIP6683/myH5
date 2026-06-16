<script setup>
import { watch } from 'vue';

import MapModalShell from '../../map-shell/components/MapModalShell.vue';

import TutorialGuideCards from './TutorialGuideCards.vue';

import {
	DEFAULT_TUTORIAL_CARD_LIST,
	markTutorialClosed,
	useTutorialGuide
} from '../composables/useTutorialGuide.js';

import '../styles/tutorial-guide.scss';

const visible = defineModel('visible', { type: Boolean, default: false });

const props = defineProps({
	title: {
		type: String,
		default: '系统 - 使用说明'
	},
	cardList: {
		type: Array,
		default: () => DEFAULT_TUTORIAL_CARD_LIST
	}
});

const {
	cardList,
	currentIndex,
	activeCard,
	currentStep,
	slideDirection,
	isFirstCard,
	isLastCard,
	startPlay,
	stopPlay,
	playNext,
	playPrev,
	playByIndex,
	getCardTitle
} = useTutorialGuide(props.cardList);

watch(visible, (open) => {
	if (open) {
		startPlay();
	} else {
		stopPlay();
	}
});

const close = () => {
	visible.value = false;
};

const onClose = () => {
	markTutorialClosed();
};

const onPrev = () => playPrev();

const onNext = () => playNext();
</script>

<template>
	<MapModalShell v-model:visible="visible" :aria-label="title" @close="onClose">
		<div class="map-modal-card map-modal-card--tutorial">
			<button type="button" class="map-modal-card__close" aria-label="关闭" @click="close">
				<span>×</span>
			</button>

			<h3 class="map-modal-card__title">{{ title }}</h3>

			<div class="map-modal-card__body tutorial-guide-root">
				<TutorialGuideCards
					:card-list="cardList"
					:active-card="activeCard"
					:current-step="currentStep"
					:slide-direction="slideDirection"
					:get-card-title="getCardTitle"
				/>

				<div class="progressBar">
					<span
						v-for="(cardName, index) in cardList"
						:key="cardName"
						:class="[cardName, { this: currentIndex === index }]"
						@click="playByIndex(index, index > currentIndex ? 'next' : 'prev')"
					/>
				</div>

				<div class="map-modal-card__actions map-modal-card__actions--split">
					<button
						type="button"
						class="map-modal-card__btn map-modal-card__btn--secondary"
						:class="{ 'map-modal-card__btn--disabled': isFirstCard }"
						@click="onPrev"
					>
						上一个
					</button>

					<button
						type="button"
						class="map-modal-card__btn map-modal-card__btn--primary"
						:class="{ 'map-modal-card__btn--disabled': isLastCard }"
						@click="onNext"
					>
						下一个
					</button>
				</div>
			</div>
		</div>
	</MapModalShell>
</template>

<style scoped lang="scss">
.tutorial-guide-root {
	flex: 1 1 auto;
	min-height: 0;
}

.tutorial-guide-root .progressBar,
.tutorial-guide-root .map-modal-card__actions {
	flex-shrink: 0;
}

.tutorial-guide-root :deep(.tutorialCard) {
	height: 320px;
	max-height: 58vh;
}

.tutorial-guide-root :deep(.tutorialCard .card) {
	height: 300px;
	max-height: 52vh;
}

.tutorial-guide-root :deep(.tutorialCard h4) {
	font-size: 14px;
	font-weight: 400;
	color: #666;
	line-height: 1.6;
}

@media screen and (max-width: 767px) {
	.map-modal-card--tutorial {
		max-width: none; /* px-to-viewport-ignore */
	}
}
</style>
