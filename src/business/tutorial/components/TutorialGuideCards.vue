<script setup>
defineProps({
	cardList: {
		type: Array,
		required: true
	},
	activeCard: {
		type: String,
		required: true
	},
	currentStep: {
		type: Number,
		default: -1
	},
	slideDirection: {
		type: String,
		default: 'none'
	},
	getCardTitle: {
		type: Function,
		required: true
	}
});
</script>

<template>
	<div class="tutorialCard">
		<div
			v-for="(cardName, index) in cardList"
			:id="`tutorialCard_${cardName}`"
			:key="cardName"
			class="item"
			:class="{
				'is-active': activeCard === cardName,
				'slide-from-next': activeCard === cardName && slideDirection === 'next',
				'slide-from-prev': activeCard === cardName && slideDirection === 'prev'
			}"
		>
			<!-- 展开聚合标记 -->
			<template v-if="cardName === 'polymerize'">
				<h3>{{ getCardTitle(cardName, index) }}</h3>
				<h4>点击数字标记点，展开聚合点位</h4>
				<div class="card cardPolymerize default" :class="currentStep >= 0 ? `step${currentStep}` : ''">
					<div class="map" />
					<div class="marker marker_1" />
					<div class="marker marker_2" />
					<div class="marker marker_3" />
					<div class="marker marker_all" />
					<div class="marker marker_toilet" />
					<div class="marker marker_restaurant" />
					<div class="hand" />
				</div>
			</template>

			<!-- 景点/设施切换 -->
			<template v-else-if="cardName === 'legend'">
				<h3>{{ getCardTitle(cardName, index) }}</h3>
				<h4>切换图例可查看不同类型点位</h4>
				<div class="card cardLegend default" :class="currentStep >= 0 ? `step${currentStep}` : ''">
					<div class="map" />
					<div class="marker marker_1" />
					<div class="marker marker_2" />
					<div class="marker marker_3" />
					<div class="marker marker_toilet" />
					<div class="marker marker_restaurant" />
					<div class="legend">
						<div class="up" />
						<div class="list">
							<ul>
								<li class="all"><i /><span>全部</span></li>
								<li class="scenic"><i /><span>景点</span></li>
								<li class="restaurant"><i /><span>餐厅</span></li>
								<li class="toilet"><i /><span>卫生间</span></li>
								<li class="service"><i /><span>服务点</span></li>
								<li class="carpark"><i /><span>停车场</span></li>
								<li class="medical"><i /><span>医疗点</span></li>
								<li class="exit"><i /><span>出入口</span></li>
							</ul>
						</div>
						<div class="down" />
					</div>
					<div class="hand" />
				</div>
			</template>

			<!-- 地图拖动和缩放 -->
			<template v-else-if="cardName === 'scale'">
				<h3>{{ getCardTitle(cardName, index) }}</h3>
				<h4>双指缩放，单指拖动地图</h4>
				<div class="card cardScale default" :class="currentStep >= 0 ? `step${currentStep}` : ''">
					<div class="map" />
					<div class="hand" />
					<div class="hand left" />
				</div>
			</template>

			<!-- 点位信息卡 -->
			<template v-else-if="cardName === 'card'">
				<h3>{{ getCardTitle(cardName, index) }}</h3>
				<h4>点击标记点，查看图文、讲解、寻路等</h4>
				<div class="card cardCard default" :class="currentStep >= 0 ? `step${currentStep}` : ''">
					<div class="map" />
					<div class="marker marker_1" />
					<div class="marker marker_2" />
					<div class="marker marker_3" />
					<div class="marker marker_toilet" />
					<div class="markerCard" />
					<div class="hand" />
				</div>
			</template>

			<!-- 回到我的位置 -->
			<template v-else-if="cardName === 'position'">
				<h3>{{ getCardTitle(cardName, index) }}</h3>
				<h4>点击“我的位置”，回到当前位置</h4>
				<div class="card cardPosition default" :class="currentStep >= 0 ? `step${currentStep}` : ''">
					<div class="map">
						<div class="myPosition" />
					</div>
					<div class="buts">
						<ul>
							<li class="introduce" />
							<li class="scenicList" />
							<li class="lineList" />
							<li class="facilityList" />
							<li class="myLocation" />
						</ul>
					</div>
					<div class="hand" />
				</div>
			</template>

			<!-- 推荐路线 -->
			<template v-else-if="cardName === 'line'">
				<h3>{{ getCardTitle(cardName, index) }}</h3>
				<h4>点击“路线推荐”，查看最佳游玩路线</h4>
				<div class="card cardLine default" :class="currentStep >= 0 ? `step${currentStep}` : ''">
					<div class="map" />
					<div class="line" />
					<div class="buts">
						<ul>
							<li class="introduce" />
							<li class="scenicList" />
							<li class="lineList" />
							<li class="facilityList" />
							<li class="myLocation" />
						</ul>
					</div>
					<div class="lineCard" />
					<div class="lineTip">精品A路线，全程约5.8km，<span>点击隐藏</span></div>
					<div class="hand" />
				</div>
			</template>

			<!-- 景点列表 -->
			<template v-else-if="cardName === 'scenicList'">
				<h3>{{ getCardTitle(cardName, index) }}</h3>
				<h4>在景点列表中，可查看所有景点</h4>
				<div class="card cardScenicList default" :class="currentStep >= 0 ? `step${currentStep}` : ''">
					<div class="map">
						<div class="marker marker_3" />
					</div>
					<div class="line" />
					<div class="buts">
						<ul>
							<li class="introduce" />
							<li class="scenicList" />
							<li class="lineList" />
							<li class="facilityList" />
							<li class="myLocation" />
						</ul>
					</div>
					<div class="line" />
					<div class="scenicListWin" />
					<div class="markerCard" />
					<div class="hand" />
				</div>
			</template>

			<!-- 服务设置列表 -->
			<template v-else-if="cardName === 'serviceList'">
				<h3>{{ getCardTitle(cardName, index) }}</h3>
				<h4>在服务设施中，可寻找附近的服务设施</h4>
				<div class="card cardServiceList default" :class="currentStep >= 0 ? `step${currentStep}` : ''">
					<div class="map">
						<div class="marker marker_toilet" />
						<div class="myPosition" />
					</div>
					<div class="lineTip">寻路中，剩余1.2km，<span>点击停止</span></div>
					<div class="line" />
					<div class="buts">
						<ul>
							<li class="introduce" />
							<li class="scenicList" />
							<li class="lineList" />
							<li class="facilityList" />
							<li class="myLocation" />
						</ul>
					</div>
					<div class="scale" />
					<div class="serviceListWin" />
					<div class="navCard" />
					<div class="hand" />
				</div>
			</template>
		</div>
	</div>
</template>

<style scoped lang="scss">
.tutorialCard .item {
	display: none;
}

.tutorialCard .item.is-active {
	display: block;
}

.tutorialCard .item.slide-from-next.is-active {
	animation: tutorialSlideInFromRight 0.5s ease;
}

.tutorialCard .item.slide-from-prev.is-active {
	animation: tutorialSlideInFromLeft 0.5s ease;
}

@keyframes tutorialSlideInFromRight {
	from {
		transform: translateX(100%);
	}
	to {
		transform: translateX(0);
	}
}

@keyframes tutorialSlideInFromLeft {
	from {
		transform: translateX(-100%);
	}
	to {
		transform: translateX(0);
	}
}
</style>
