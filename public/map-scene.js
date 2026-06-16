/**
 * 场景/视角配置（供 src/map-kit/config/mapSceneConfig.js 读取）
 *
 * center：初始/复位视角
 * cameraController：滚轮缩放、视距
 * scene：
 *   - 大气/光照开关（减负，不影响清晰度）
 *   - resolutionScale / fxaa / msaa：整屏清晰度（含图标、聚合点）
 *   - globe.maximumScreenSpaceError：静止时瓦片精细度
 *   - globe.interactionMaximumScreenSpaceError：拖动/缩放时临时降精细度，松手恢复
 */
window.MAP_SCENE_CONFIG = {
	/** Cesium.SceneMode：3=三维，2=二维 */
	sceneMode: 2,
	sceneModeMorphDuration: 0,

	center: {
		lng: 111.526034,
		lat: 27.381146,
		alt: 800000
	},

	cameraController: {
		/**
		 * 最远视距（米）；越大双指能缩得越远（高德可缩到省级/全国）
		 * 原 2000000 相对初始视角 800000 只能再缩小约 2.5 倍，范围偏窄
		 */
		maximumZoomDistance: 2000000,
		/**
		 * 最近视距（米）；越小双指能放得越大（街道级约 300～1000）
		 * 须小于聚合下钻 flyToPoint 的 maximumHeight（约 4km）
		 */
		minimumZoomDistance: 500,
		/**
		 * 双指/滚轮缩放灵敏度；越大单次手势缩放幅度越大（默认 5，高德体感约 10～15）
		 * Mars3D 会同步到 Cesium controller._zoomFactor
		 */
		zoomFactor: 15,
		/**
		 * 惯性系数 [0, 1)；高德/百度类地图接近 0，松手即停
		 * 未配置时 Cesium 默认：translate/spin=0.9，zoom=0.8，易有拖泥带水感
		 */
		inertiaTranslate: 0,
		inertiaSpin: 0,
		inertiaZoom: 0,
		/** 单帧最大缩放/平移占屏比；略提高可让双指缩放更跟手（默认 0.1） */
		maximumMovementRatio: 0.32,
		/** 2D 缩放到边界时的回弹时长（秒），0 为无回弹 */
		bounceAnimationTime: 0
	},

	scene: {
		/** 无底图瓦片时的场景底色（中性浅灰，避免偏蓝） */
		backgroundColor: '#f5f6f7',
		showSun: false,
		showMoon: false,
		fog: false,
		showSkyAtmosphere: false,

		/** 保持 1，勿用 0.75，否则整屏（含图标）发糊 */
		resolutionScale: 1,
		useBrowserRecommendedResolution: false,
		fxaa: false,
		msaaSamples: 2,
		orderIndependentTranslucency: false,

		/** 相机停止移动后多久恢复清晰瓦片（毫秒）；移动端双指缩放间隙需更长防抖 */
		interactionDebounceMs: 160,

		/**
		 * 按需渲染：静止时不持续 requestAnimationFrame，显著降低 GPU/发热
		 * 相机移动、图层变化等由 Mars3D/Cesium 自动触发 requestRender
		 */
		requestRenderMode: true,

		/**
		 * 按需渲染下，模拟时间变化超过该值（秒）才触发新帧；Infinity 表示仅显式变化时渲染
		 */
		maximumRenderTimeChange: Infinity,

		/** 移动端可设为 30 省电；60 为流畅优先 */
		targetFrameRate: 60,

		globe: {
			/** 球面底色，与 backgroundColor 一致 */
			baseColor: '#f5f6f7',
			showGroundAtmosphere: false,
			enableLighting: false,
			depthTestAgainstTerrain: false,

			/** 静止时 SSE，2 为 Mars3D 默认清晰档 */
			maximumScreenSpaceError: 2,

			/** 拖动/缩放时临时提高 SSE，减轻 GPU；松手后恢复上一项 */
			interactionMaximumScreenSpaceError: 3
		}
	}
};
