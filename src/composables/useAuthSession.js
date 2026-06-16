import { ref } from 'vue';
import { clearLogin, isLoggedIn } from '../utils/auth.js';

const loggedIn = ref(isLoggedIn());

export function useAuthSession() {
	function markLoggedIn() {
		loggedIn.value = true;
	}

	function logout() {
		clearLogin();
		loggedIn.value = false;
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
