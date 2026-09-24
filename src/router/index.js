import { createRouter, createWebHashHistory } from 'vue-router';
import Login from '../views/Login.vue';
import Home from '../views/Home.vue';
import PhotoWall from '../views/PhotoWall.vue';
import Cinema from '../views/Cinema.vue'; // 新增
import Music from '../views/Music.vue';   // 新增

const routes = [
  { path: '/login', name: 'Login', component: Login },
  { path: '/', name: 'Home', component: Home },
  { path: '/wall', name: 'PhotoWall', component: PhotoWall, meta: { requiresAuth: true } },
  { path: '/cinema', name: 'Cinema', component: Cinema }, // 新增
  { path: '/music', name: 'Music', component: Music }      // 新增
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

router.beforeEach((to, from, next) => {
  const isLoggedIn = sessionStorage.getItem('photoWallLoggedIn') === 'true';
  if (to.meta.requiresAuth && !isLoggedIn) {
    next('/login');
  } else if (to.path === '/login' && isLoggedIn) {
    next('/');
  } else {
    next();
  }
});

export default router;