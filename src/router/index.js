import { createRouter, createWebHistory } from 'vue-router';
import Login from '../views/Login.vue';
import PhotoWall from '../views/PhotoWall.vue';

const routes = [
  { path: '/login', name: 'Login', component: Login },
  { 
    path: '/', 
    name: 'PhotoWall', 
    component: PhotoWall,
    meta: { requiresAuth: true } // 标记需要登录
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

// 全局路由守卫，替代原本 index.html 里的 sessionStorage 检查
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