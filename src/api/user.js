import request from './request.js';

/** 获取当前登录用户信息 */
export function fetchUserInfo() {
	return request({
		url: '/system/user/getInfo',
		method: 'get'
	});
}
