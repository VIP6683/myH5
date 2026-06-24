/**
 * 运行时地图配置（部署后可改此文件，无需重新打包）
 *
 * layerSource:
 * - backend：内网模式，底图/注记/DEM 均来自接口 getLayersData（对齐原 Map.vue）
 * - online：使用下方 basemap / annotation 在线或自建瓦片（需能访问外网或内网瓦片地址）
 *
 * 场景/视角：改 public/map-scene-2d.js（MAP_SCENE_2D_CONFIG）
 * @see map-kit/config/runtimeConfig.js
 */
window.APP_MAP_CONFIG = {
	/** online：使用下方天地图在线瓦片；backend 则走内网 getLayersData */
	layerSource: 'online',

	tokens: {
		/** 天地图 Key，留空则使用 Mars2D 内置默认 Key；建议到 https://console.tianditu.gov.cn/api/key 申请后填入 */
		tianditu: '',
		gaode: ''
	},

	/** 业务镶嵌图 WMTS（暂不使用，仅保留配置项） */
	mosaicMap: {
		enabled: false,
		replaceBasemap: false,
		serviceListUrl: 'https://www.img.net/api/v1/service/list',
		wmtsUrlTemplate: 'https://lxjcjg.com/access/rest/services/{serviceName}/Transfer',
		defaultServiceName: 'MosaicMap_2024_05M_Q3',
		zIndex: -100,
		format: 'image/webp',
		tileMatrixSetID: 'EPSG:4326',
		tilematrixBefore: 'EPSG:4326:',
		crs: 'EPSG:4326'
	},

	/** 天地图影像底图 */
	basemap: {
		enabled: true,
		name: '天地图影像',
		type: 'tdt',
		layer: 'img_d',
		url: '',
		key: [],
		show: true,
		zIndex: 1,
		maximumLevel: 17,
		subdomains: '01234567',
		/** 天地图为 CGCS2000（与 WGS84 等价），业务数据同为无偏坐标，直接叠加 */
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
		maximumLevel: 17,
		subdomains: '01234567',
		chinaCRS: 'WGS84'
	},

	// 给 mars2d.Map options 用（本项目优先从 public/map-scene-2d.js 读取）
	scene: null
};

