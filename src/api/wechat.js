import request from './request.js';
import { isMobileDebugEnabled, logMobileDebug, logMobileDebugError } from '../utils/mobileDebugConsole.js';

const DEFAULT_SIGN_PATH = '/result/wechat/signature';

/**
 * 获取微信 JS-SDK 签名
 * POST /result/wechat/signature  body: { url }  （当前页 URL，不含 #）
 * @param {string} url
 * @param {string} [path]
 * @returns {Promise<{ appId?: string, timestamp: string|number, nonceStr: string, signature: string }>}
 */
export function fetchWechatSignature(url, path = DEFAULT_SIGN_PATH) {
	const signPath = path || DEFAULT_SIGN_PATH;
	if (isMobileDebugEnabled()) {
		logMobileDebug('wechat:signature:request', {
			method: 'POST',
			path: signPath,
			apiBase:
				window.AppConfig?.apiBaseUrl ||
				import.meta.env.VITE_API_PROXY_PREFIX ||
				'/api',
			body: { url }
		});
	}

	return request({
		url: signPath,
		method: 'post',
		data: { url }
	})
		.then((data) => {
			if (isMobileDebugEnabled()) {
				logMobileDebug('wechat:signature:success', {
					appId: data?.appId,
					timestamp: data?.timestamp,
					nonceStr: data?.nonceStr,
					hasSignature: Boolean(data?.signature)
				});
			}
			return data;
		})
		.catch((error) => {
			if (isMobileDebugEnabled()) {
				logMobileDebugError('wechat:signature:fail', error, { path: signPath, url });
			}
			throw error;
		});
}
