import { getMapTokens } from '../../../map-kit/config/runtimeConfig.js';

const GEOCODER_URL = 'https://api.tianditu.gov.cn/geocoder';

function resolveTiandituKey() {
	const { tianditu } = getMapTokens();
	if (tianditu?.length) {
		return tianditu[0];
	}

	const token = globalThis.mars3d?.Token?.tianditu;
	if (Array.isArray(token) && token.length) {
		return token[0];
	}

	if (typeof token === 'string' && token.trim()) {
		return token.trim();
	}

	return '';
}

/**
 * 调用天地图逆地理编码，将经纬度转为中文地址
 * @param {number} lng
 * @param {number} lat
 * @returns {Promise<string>}
 */
export async function reverseGeocode(lng, lat) {
	const tk = resolveTiandituKey();
	if (!tk) {
		throw new Error('未配置天地图 Key');
	}

	const postStr = JSON.stringify({ lon: lng, lat, ver: 1 });
	const url = `${GEOCODER_URL}?postStr=${encodeURIComponent(postStr)}&type=geocode&tk=${encodeURIComponent(tk)}`;

	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`天地图逆地理编码请求失败: ${response.status}`);
	}

	const data = await response.json();
	if (String(data.status) !== '0') {
		throw new Error(data.msg || '天地图逆地理编码失败');
	}

	const result = data.result || {};
	return result.formatted_address || result.addressComponent?.address || '';
}
