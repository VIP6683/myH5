import { createRouter, createWebHistory } from 'vue-router';
import MapLayout from '../layouts/MapLayout.vue';
import DefaultLayout from '../layouts/DefaultLayout.vue';

const router = createRouter({
	history: createWebHistory(import.meta.env.BASE_URL),
	routes: [
		{
			path: '/',
			redirect: '/area'
		},
		{
			path: '/',
			component: MapLayout,
			name: 'MapLayout',
			meta: { layout: 'map' },
			redirect: '/area',
			children: [
				{
					path: 'area',
					name: 'area',
					component: () => import('../views/area/index.vue'),
					meta: { tab: 'area-monitor', title: '面状异物监测' }
				},
				{
					path: 'line',
					name: 'line',
					component: () => import('../views/line/index.vue'),
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

export default router;
