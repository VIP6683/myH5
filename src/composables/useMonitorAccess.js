import { computed } from 'vue';
import {
	getUserRoles,
	hasAreaMonitorAccess,
	hasLineMonitorAccess
} from '../utils/auth.js';
import { loggedIn } from './useAuthSession.js';

export function useMonitorAccess() {
	const roles = computed(() => (loggedIn.value ? getUserRoles() : []));

	const hasAreaMonitor = computed(() => hasAreaMonitorAccess(roles.value));
	const hasLineMonitor = computed(() => hasLineMonitorAccess(roles.value));

	return {
		roles,
		hasAreaMonitor,
		hasLineMonitor
	};
}
