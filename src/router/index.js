import { createRouter, createWebHistory } from 'vue-router';
import {
	getDefaultMonitorPath,
	hasAreaMonitorAccess,
	hasLineMonitorAccess,
	isLoggedIn
} from '../utils/auth.js';
import MapLayout from '../layouts/MapLayout.vue';
import DefaultLayout from '../layouts/DefaultLayout.vue';

const router = createRouter({
	history: createWebHistory(import.meta.env.BASE_URL),
	routes: [
		{
			path: '/',
			redirect: '/statistics'
		},
		{
			path: '/',
			component: MapLayout,
			name: 'MapLayout',
			meta: { layout: 'map' },
			children: [
				{
					path: 'area',
					name: 'area',
					meta: { tab: 'area-monitor', title: '面状异物监测' }
				},
				{
					path: 'line',
					name: 'line',
					meta: { tab: 'line-monitor', title: '线状异物监测' }
				}
			]
		},
		{
			path: '/statistics',
			component: DefaultLayout,
			meta: { layout: 'default' },
			children: [
				{
					path: '',
					name: 'statistics',
					component: () => import('../views/statistics/index.vue'),
					meta: { tab: 'stats', title: '数据统计' }
				}
			]
		},
		{
			path: '/mine',
			component: DefaultLayout,
			meta: { layout: 'default' },
			children: [
				{
					path: '',
					name: 'mine',
					component: () => import('../views/mine/index.vue'),
					meta: { tab: 'mine', title: '我的' }
				}
			]
		}
	]
});

router.beforeEach((to, _from, next) => {
	if (!isLoggedIn()) {
		next();
		return;
	}

	const tab = to.matched.find((record) => record.meta?.tab)?.meta?.tab;
	if (tab === 'area-monitor' && !hasAreaMonitorAccess()) {
		next(getDefaultMonitorPath());
		return;
	}
	if (tab === 'line-monitor' && !hasLineMonitorAccess()) {
		next(getDefaultMonitorPath());
		return;
	}

	next();
});

export default router;
