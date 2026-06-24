import request from './request.js';

function extractLoginToken(payload) {
	if (typeof payload === 'string' && payload) {
		return payload;
	}

	if (!payload || typeof payload !== 'object') {
		return '';
	}

	return payload.token || payload.accessToken || payload.access_token || '';
}

/** 发送短信验证码 */
export function sendSmsCode(phonenumber) {
	return request({
		url: '/auth/sendSmsCode',
		method: 'post',
		params: { phonenumber },
		isToken: false
	});
}

/** 短信验证码登录 */
export async function smsLogin(phonenumber, smsCode) {
	const result = await request({
		url: '/auth/smsLogin',
		method: 'post',
		data: { phonenumber, smsCode },
		isToken: false
	});

	const token = extractLoginToken(result);
	if (!token) {
		throw new Error('登录失败，未获取到 token');
	}

	return { token, raw: result };
}
