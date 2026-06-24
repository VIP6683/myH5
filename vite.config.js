import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const API_TARGET = 'https://cxfw.sj-dw.com/';

export default defineConfig({
	plugins: [vue()],

	server: {
		host: true,
		port: 5173,
		open: true,
		proxy: {
			'/api': {
				target: API_TARGET,
				changeOrigin: true
				// rewrite: (path) => path.replace(/^\/api/, '')
			}
		}
	}
});
