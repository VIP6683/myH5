/**
 * 运行时地图配置（部署后可改此文件，无需重新打包）
 *
 * layerSource:
 * - backend：内网模式，底图/注记/DEM 均来自接口 getLayersData（对齐原 Map.vue）
 * - online：使用下方 basemap / annotation 在线或自建瓦片（需能访问外网或内网瓦片地址）
 *
 * 场景/视角：改 public/map-scene.js（MAP_SCENE_CONFIG）
 * @see map-kit/config/runtimeConfig.js
 */
window.APP_MAP_CONFIG = {
	/** online：使用下方天地图在线瓦片；backend 则走内网 getLayersData */
	layerSource: 'online',

	tokens: {
		/** 天地图 Key，留空则使用 Mars3D 内置默认 Key；建议到 https://console.tianditu.gov.cn/api/key 申请后填入 */
		tianditu: '',
		gaode: ''
	},

	/** 天地图影像底图（img_d） */
	basemap: {
		enabled: true,
		name: '天地图影像',
		type: 'tdt',
		layer: 'img_d',
		url: '',
		key: [],
		show: true,
		zIndex: 1,
		maximumLevel: 18,
		subdomains: '01234567',
		chinaCRS: 'WGS84'
	},

	/** 天地图影像注记（img_z，道路/地名） */
	annotation: {
		enabled: true,
		name: '地名注记',
		labelMode: 'tdt',
		type: 'tdt',
		layer: 'img_z',
		url: '',
		key: [],
		show: true,
		zIndex: 2,
		opacity: 1,
		maximumLevel: 18,
		subdomains: '01234567',
		chinaCRS: 'WGS84'
	},

	// 给 mars3d.Map options.scene 用（本项目优先从 public/map-scene.js 读取）
	scene: null
};

