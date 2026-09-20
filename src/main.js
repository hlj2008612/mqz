import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import './assets/main.css'; // 如果你还有额外的全局 CSS 可放在这里

createApp(App).use(router).mount('#app');