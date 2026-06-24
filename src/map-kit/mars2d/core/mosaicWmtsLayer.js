import { fetchMosaicMapList, pickDefaultMosaicService } from '../../../api/mosaicMap.js';
import { MOSAIC_WMTS_LAYER_ID } from '../../constants.js';
import { getMapInstance } from './engine.js';

let mosaicLayer = null;
let mosaicLayerReady = false;
let mosaicReadyResolve = null;
let mosaicReadyPromise = null;
let currentServiceName = '';

function resetMosaicReadyPromise() {
	// 切换服务前结束旧 promise，避免 waitMapLoaded 一直等待已废弃的 promise
	if (mosaicReadyResolve) {
		mosaicReadyResolve(null);
		mosaicReadyResolve = null;
	}
	mosaicLayerReady = false;
	mosaicReadyPromise = new Promise((resolve) => {
		mosaicReadyResolve = resolve;
	});
}

resetMosaicReadyPromise();

function resolveMosaicReady(layer) {
	mosaicLayerReady = true;
	if (mosaicReadyResolve) {
		mosaicReadyResolve(layer);
		mosaicReadyResolve = null;
	}
}

export function getMosaicMapConfig() {
	const config = globalThis.APP_MAP_CONFIG?.mosaicMap || {};
	return {
		enabled: config.enabled !== false,
		serviceListUrl: config.serviceListUrl || 'https://www.img.net/api/v1/service/list',
		wmtsUrlTemplate:
			config.wmtsUrlTemplate ||
			'https://lxjcjg.com/access/rest/services/{serviceName}/Transfer',
		defaultServiceName: config.defaultServiceName || 'MosaicMap_2024_05M_Q3',
		replaceBasemap: config.replaceBasemap !== false,
		zIndex: config.zIndex ?? -100,
		format: config.format || 'image/webp',
		tileMatrixSetID: config.tileMatrixSetID || 'EPSG:4326',
		tilematrixBefore: config.tilematrixBefore || 'EPSG:4326:',
		crs: config.crs || 'EPSG:4326',
		chinaCRS: 'WGS84'
	};
}

export function usesMosaicBasemap() {
	const config = getMosaicMapConfig();
	return config.enabled && config.replaceBasemap;
}

export function buildMosaicWmtsUrl(serviceName) {
	const { wmtsUrlTemplate } = getMosaicMapConfig();
	return wmtsUrlTemplate.replace('{serviceName}', encodeURIComponent(serviceName));
}

export function getCurrentMosaicServiceName() {
	return currentServiceName;
}

export function waitMosaicWmtsReady() {
	if (!getMosaicMapConfig().enabled) {
		return Promise.resolve(null);
	}
	if (mosaicLayerReady) {
		return Promise.resolve(mosaicLayer);
	}
	return mosaicReadyPromise;
}

function createWmtsLayer(serviceName) {
	const mars2d = globalThis.mars2d;
	const config = getMosaicMapConfig();

	return new mars2d.layer.WmtsLayer({
		url: buildMosaicWmtsUrl(serviceName),
		format: config.format,
		tileMatrixSetID: config.tileMatrixSetID,
		tilematrixBefore: config.tilematrixBefore,
		crs: config.crs,
		id: MOSAIC_WMTS_LAYER_ID,
		name: '镶嵌影像',
		zIndex: config.zIndex
	});
}

function removeMosaicLayer(map) {
	if (!mosaicLayer) {
		return;
	}

	if (map?.removeLayer) {
		map.removeLayer(mosaicLayer, true);
	} else {
		mosaicLayer.destroy?.();
	}

	mosaicLayer = null;
	currentServiceName = '';
}

export async function setMosaicWmtsService(map = getMapInstance(), serviceName) {
	if (!map || !serviceName) {
		return null;
	}

	const existing = map.getLayerById?.(MOSAIC_WMTS_LAYER_ID);
	if (existing && currentServiceName === serviceName) {
		return existing;
	}

	removeMosaicLayer(map);
	resetMosaicReadyPromise();

	mosaicLayer = createWmtsLayer(serviceName);
	currentServiceName = serviceName;
	try {
		await map.addLayer(mosaicLayer);
		resolveMosaicReady(mosaicLayer);
		return mosaicLayer;
	} catch (error) {
		console.warn('[mosaicWmts] 镶嵌图层加载失败', error);
		resolveMosaicReady(null);
		return null;
	}
}

async function resolveDefaultServiceName() {
	const config = getMosaicMapConfig();

	try {
		const mosaicMap = await fetchMosaicMapList();
		const service = pickDefaultMosaicService(mosaicMap);
		if (service?.serviceName) {
			return service.serviceName;
		}
	} catch (error) {
		console.warn('[mosaicWmts] 镶嵌图列表获取失败，使用默认服务名', error);
	}

	return config.defaultServiceName;
}

export async function ensureMosaicWmtsLayer(map = getMapInstance()) {
	if (!map || !getMosaicMapConfig().enabled) {
		resolveMosaicReady(null);
		return null;
	}

	const existing = map.getLayerById?.(MOSAIC_WMTS_LAYER_ID);
	if (existing) {
		mosaicLayer = existing;
		resolveMosaicReady(existing);
		return existing;
	}

	try {
		const serviceName = await resolveDefaultServiceName();
		return await setMosaicWmtsService(map, serviceName);
	} catch (error) {
		console.warn('[mosaicWmts] 镶嵌图层初始化失败', error);
		resolveMosaicReady(null);
		return null;
	}
}

export function clearMosaicWmtsLayer(map = getMapInstance()) {
	removeMosaicLayer(map);
	resetMosaicReadyPromise();
}
