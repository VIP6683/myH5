import { computed, onBeforeUnmount, ref } from 'vue';

/** 默认教程卡片顺序（对齐 pixelsay tutorialCard） */
export const DEFAULT_TUTORIAL_CARD_LIST = [
	'scale',
	'legend',
	'polymerize',
	'card',
	'line',
	'scenicList',
	'serviceList',
	'position'
];

const CARD_STEP_TIMES = {
	polymerize: [1000, 500, 200, 300, 3000],
	legend: [1000, 500, 100, 500, 500, 500, 800, 300, 500, 500, 300, 500, 500, 300, 500, 500, 300, 1000],
	scale: [1000, 500, 500, 500, 500, 600, 500, 300, 500, 200, 700, 500, 500, 500, 500, 500, 500, 500],
	card: [1000, 500, 200, 2000, 700, 200, 500],
	position: [1000, 500, 500, 500, 500, 500, 500, 500, 500, 500, 200, 500, 500, 500],
	line: [1000, 500, 200, 200, 500, 500, 200, 200, 1500, 500, 200, 500, 500],
	scenicList: [1000, 700, 200, 1500, 1000, 200, 500, 500, 2000, 500, 200, 500],
	serviceList: [1000, 1000, 200, 500, 700, 200, 500, 1000, 200, 1000, 500, 200, 500, 500, 1500, 700, 200, 500, 1500, 700, 200, 200]
};

const CARD_TITLES = {
	polymerize: '标记点',
	legend: '图例',
	scale: '缩放和拖动',
	card: '信息卡',
	position: '我的位置',
	line: '推荐路线',
	scenicList: '景点列表',
	serviceList: '服务设施'
};

/**
 * 操作说明轮播逻辑（Vue 版，替代 tutorialCard class）
 */
export function useTutorialGuide(cardList = DEFAULT_TUTORIAL_CARD_LIST) {
	const currentIndex = ref(0);
	const currentStep = ref(-1);
	const slideDirection = ref('none');
	let stepTimer = null;

	const activeCard = computed(() => cardList[currentIndex.value] || cardList[0]);
	const isFirstCard = computed(() => currentIndex.value <= 0);
	const isLastCard = computed(() => currentIndex.value >= cardList.length - 1);

	const clearStepTimer = () => {
		if (stepTimer) {
			clearTimeout(stepTimer);
			stepTimer = null;
		}
	};

	const resetStep = () => {
		clearStepTimer();
		currentStep.value = -1;
	};

	const playStepLoop = (steps, onLoopEnd) => {
		let stepIndex = 0;

		const runStep = () => {
			if (stepIndex >= steps.length) {
				currentStep.value = -1;
				onLoopEnd?.();
				return;
			}

			currentStep.value = stepIndex;
			const delay = steps[stepIndex];
			stepIndex += 1;
			stepTimer = setTimeout(runStep, delay);
		};

		runStep();
	};

	const playCard = (index) => {
		const safeIndex = Math.max(0, Math.min(index, cardList.length - 1));
		const cardName = cardList[safeIndex];
		const steps = CARD_STEP_TIMES[cardName];

		resetStep();
		currentIndex.value = safeIndex;

		if (!steps?.length) return;

		playStepLoop(steps, () => {
			playCard(safeIndex);
		});
	};

	const playByIndex = (index, direction = 'none') => {
		if (index === currentIndex.value) return;
		slideDirection.value = direction;
		playCard(index);
	};

	const playNext = () => {
		if (isLastCard.value) return;
		playByIndex(currentIndex.value + 1, 'next');
	};

	const playPrev = () => {
		if (isFirstCard.value) return;
		playByIndex(currentIndex.value - 1, 'prev');
	};

	const startPlay = () => {
		slideDirection.value = 'none';
		playCard(0);
	};

	const stopPlay = () => {
		resetStep();
	};

	const getCardTitle = (cardName, index) => {
		const title = CARD_TITLES[cardName] || cardName;
		return `${index + 1} ${title}`;
	};

	onBeforeUnmount(() => {
		stopPlay();
	});

	return {
		cardList,
		currentIndex,
		currentStep,
		activeCard,
		slideDirection,
		isFirstCard,
		isLastCard,
		startPlay,
		stopPlay,
		playNext,
		playPrev,
		playByIndex,
		getCardTitle
	};
}

/** 首次进入是否自动弹出（localStorage 对齐原站 tutorialCard） */
export function shouldAutoOpenTutorial(storageKey = 'tutorialCard') {
	try {
		return localStorage.getItem(storageKey) === null;
	} catch {
		return false;
	}
}

export function markTutorialOpened(storageKey = 'tutorialCard') {
	try {
		localStorage.setItem(storageKey, '1');
	} catch {
		// ignore
	}
}

export function markTutorialClosed(storageKey = 'tutorialCard') {
	try {
		if (localStorage.getItem(storageKey) === '1') {
			localStorage.setItem(storageKey, '2');
		}
	} catch {
		// ignore
	}
}
