import { handleAuthExpired } from '../composables/useAuthSession.js';
import { getToken, isLoggedIn } from '../utils/auth.js';

/**
 * 接口根地址优先级：
 * 1. public/app-config.js 的 apiBaseUrl（部署后免打包覆盖）
 * 2. vite.config.js 的 API_PROXY_PREFIX（开发走 vite 代理，生产走部署侧 /api 反向代理）
 */
function getApiBaseUrl() {
	const runtimeBase = window.AppConfig?.apiBaseUrl;
	if (runtimeBase) {
		return runtimeBase;
	}

	return import.meta.env.VITE_API_PROXY_PREFIX || '/api';
}

function buildQueryString(params) {
	if (!params || typeof params !== 'object') {
		return '';
	}

	const searchParams = new URLSearchParams();
	Object.entries(params).forEach(([key, value]) => {
		if (value === undefined || value === null || value === '') {
			return;
		}
		searchParams.set(key, String(value));
	});

	return searchParams.toString();
}

function joinUrl(baseUrl, path, params) {
	const query = buildQueryString(params);
	const url = `${baseUrl}${path}`;
	if (!query) {
		return url;
	}

	const joiner = url.includes('?') ? '&' : '?';
	return `${url}${joiner}${query}`;
}

function resolvePayload(payload) {
	if (!payload || typeof payload !== 'object') {
		return payload;
	}

	if ('data' in payload && payload.data !== undefined && payload.data !== null) {
		return payload.data;
	}

	return payload;
}

function getErrorMessage(payload, fallback) {
	if (!payload || typeof payload !== 'object') {
		return fallback;
	}

	return payload.msg || payload.message || fallback;
}

function readResponseCode(payload) {
	if (!payload || typeof payload !== 'object' || !('code' in payload)) {
		return null;
	}

	const code = Number(payload.code);
	return Number.isFinite(code) ? code : null;
}

function isUnauthorized(status, payload) {
	if (status === 401) {
		return true;
	}

	return readResponseCode(payload) === 401;
}

function maybeHandleAuthExpired(status, payload) {
	if (isUnauthorized(status, payload) && isLoggedIn()) {
		handleAuthExpired();
	}
}

async function readResponsePayload(response) {
	const contentType = response.headers.get('content-type') || '';

	if (contentType.includes('application/json')) {
		return response.json();
	}

	const text = await response.text();
	if (!text) {
		return null;
	}

	try {
		return JSON.parse(text);
	} catch {
		if (!response.ok) {
			throw new Error(text || `请求失败（${response.status}）`);
		}

		return text;
	}
}

/**
 * 请求拦截：拼接 baseURL、序列化 params、注入 Token 与 Content-Type
 * @param {object} config
 */
function applyRequestInterceptor(config) {
	const { url, method = 'get', params, data, headers = {}, isToken = true } = config;

	const finalHeaders = {
		Accept: 'application/json',
		...headers
	};

	if (isToken) {
		const token = getToken();
		if (token && !finalHeaders.Authorization && !finalHeaders.authorization) {
			finalHeaders.Authorization = `Bearer ${token}`;
		}
	}

	let body;
	const normalizedMethod = String(method).toUpperCase();
	const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;

	if (
		data !== undefined &&
		data !== null &&
		normalizedMethod !== 'GET' &&
		normalizedMethod !== 'HEAD'
	) {
		if (isFormData) {
			body = data;
		} else if (typeof data === 'object') {
			finalHeaders['Content-Type'] =
				finalHeaders['Content-Type'] || 'application/json;charset=utf-8';
			body = JSON.stringify(data);
		} else {
			body = data;
		}
	}

	return {
		requestUrl: joinUrl(getApiBaseUrl(), url, params),
		fetchInit: {
			method: normalizedMethod,
			credentials: 'omit',
			headers: finalHeaders,
			body
		}
	};
}

/**
 * 响应拦截：统一解包 data、处理业务 code 与 401
 */
async function applyResponseInterceptor(response) {
	const payload = await readResponsePayload(response);

	maybeHandleAuthExpired(response.status, payload);

	if (!response.ok) {
		throw new Error(getErrorMessage(payload, `请求失败（${response.status}）`));
	}

	const responseCode = readResponseCode(payload);
	if (responseCode !== null && responseCode !== 200 && responseCode !== 0) {
		throw new Error(getErrorMessage(payload, '请求失败'));
	}

	return resolvePayload(payload);
}

/**
 * @param {object} config
 * @param {string} config.url
 * @param {string} [config.method]
 * @param {object} [config.params]
 * @param {unknown} [config.data]
 * @param {object} [config.headers]
 * @param {boolean} [config.isToken]
 */
async function request(config) {
	const { requestUrl, fetchInit } = applyRequestInterceptor(config);
	const response = await fetch(requestUrl, fetchInit);
	return applyResponseInterceptor(response);
}

export default request;
