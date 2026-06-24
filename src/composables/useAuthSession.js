import { ref } from 'vue';
import { clearLogin, isLoggedIn } from '../utils/auth.js';

export const loggedIn = ref(isLoggedIn());

export function handleAuthExpired() {
	clearLogin();
	loggedIn.value = false;
}

export function useAuthSession() {
	function markLoggedIn() {
		loggedIn.value = true;
	}

	function logout() {
		handleAuthExpired();
	}

	function clearAllData() {
		try {
			localStorage.clear();
			sessionStorage.clear();
		} catch {
			// ignore storage errors
		}
		loggedIn.value = false;
	}

	return {
		loggedIn,
		markLoggedIn,
		logout,
		clearAllData
	};
}
