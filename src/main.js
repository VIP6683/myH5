import { createApp } from 'vue';
import './style.css';
import './business/map-shell/styles/tokens.scss';
import './business/map-shell/styles/measure-popup.scss';
import './business/map-shell/styles/map-modal-base.scss';
import App from './App.vue';
import router from './router/index.js';

createApp(App).use(router).mount('#app');
