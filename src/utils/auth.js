import { MONITOR_ROLE } from '../constants/monitorRole.js';

const TOKEN_KEY = 'auth_token';
const PHONE_KEY = 'auth_phone';
const USER_INFO_KEY = 'auth_user_info';

export function isLoggedIn() {
	try {
		return !!localStorage.getItem(TOKEN_KEY);
	} catch {
		return false;
	}
}

export function getToken() {
	try {
		return localStorage.getItem(TOKEN_KEY) || '';
	} catch {
		return '';
	}
}

export function getPhone() {
	try {
		return localStorage.getItem(PHONE_KEY) || '';
	} catch {
		return '';
	}
}

export function setLogin(token, phone) {
	localStorage.setItem(TOKEN_KEY, token);
	localStorage.setItem(PHONE_KEY, phone);
}

export function setUserInfo(userInfo) {
	localStorage.setItem(USER_INFO_KEY, JSON.stringify(userInfo));
}

export function getUserInfo() {
	try {
		const raw = localStorage.getItem(USER_INFO_KEY);
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}

export function getUserRoles() {
	const info = getUserInfo();
	return Array.isArray(info?.roles) ? info.roles : [];
}

export function hasAreaMonitorAccess(roles = getUserRoles()) {
	return roles.includes(MONITOR_ROLE.AREA);
}

export function hasLineMonitorAccess(roles = getUserRoles()) {
	return roles.includes(MONITOR_ROLE.LINE);
}

/** 无监测权限时回退到数据统计 */
export function getDefaultMonitorPath(roles = getUserRoles()) {
	if (hasAreaMonitorAccess(roles)) {
		return '/area';
	}
	if (hasLineMonitorAccess(roles)) {
		return '/line';
	}
	return '/statistics';
}

/** 从 getInfo 结果中提取页面展示字段 */
export function getUserProfile() {
	const info = getUserInfo();
	const user = info?.user;

	return {
		username: user?.nickName || user?.userName || '',
		phone: user?.phonenumber || getPhone(),
		role: user?.roles?.[0]?.roleName || info?.roles?.[0] || '',
		organization: user?.dept?.deptName || ''
	};
}

export function clearLogin() {
	localStorage.removeItem(TOKEN_KEY);
	localStorage.removeItem(PHONE_KEY);
	localStorage.removeItem(USER_INFO_KEY);
}
