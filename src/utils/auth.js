const TOKEN_KEY = 'auth_token';
const PHONE_KEY = 'auth_phone';

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

/** 伪登录：写入本地 token */
export function setLogin(token, phone) {
	localStorage.setItem(TOKEN_KEY, token);
	localStorage.setItem(PHONE_KEY, phone);
}

export function clearLogin() {
	localStorage.removeItem(TOKEN_KEY);
	localStorage.removeItem(PHONE_KEY);
}
