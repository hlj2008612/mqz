<template>
  <nav class="glass-nav" @mousedown.stop @wheel.stop>
    <div class="nav-left">
      <span class="logo">✦ 美琴の写真館</span>
      <div class="nav-items">
        <div class="active-pill" :style="pillStyle"></div>
        <a v-for="item in navItems" :key="item.path"
           href="#" 
           class="nav-link" 
           :class="{ active: currentPath === item.path }"
           @click.prevent="handleNavigate(item)">
          {{ item.name }}
        </a>
      </div>
    </div>
    <div class="nav-right">
      <a href="#" @click.prevent="logout" class="logout-btn">
        <span class="icon">⏻</span> 退出
      </a>
    </div>
  </nav>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const emit = defineEmits(['navigate']);
const route = useRoute();
const router = useRouter();

const currentPath = ref(route.path);
const pillStyle = ref({});

const navItems = [
  { name: '首页', path: '/', title: 'HOME', color: '#8b6ce8' },
  { name: '照片墙', path: '/wall', title: 'GALLERY', color: '#4a9eff' },
  { name: '影院', path: '/cinema', title: 'CINEMA', color: '#e4bb38' },
  { name: '音乐', path: '/music', title: 'MUSIC', color: '#eb418d' }
];

const updatePill = () => {
  const activeEl = document.querySelector('.nav-link.active');
  if (!activeEl) return;

  pillStyle.value = {
    width: `${activeEl.offsetWidth}px`,
    transform: `translateX(${activeEl.offsetLeft}px)`
  };
};

watch(() => route.path, async (newPath) => {
  currentPath.value = newPath;
  await nextTick();
  requestAnimationFrame(updatePill);
});

onMounted(() => {
  requestAnimationFrame(updatePill);
  window.addEventListener('resize', updatePill);
});

onUnmounted(() => {
  window.removeEventListener('resize', updatePill);
});

// 核心修改：点击时只发出事件，不在这里更新状态
const handleNavigate = (item) => {
  if (currentPath.value === item.path) return;
  emit('navigate', item); 
};

const logout = () => {
  sessionStorage.removeItem('photoWallLoggedIn');
  router.push('/login');
};
</script>

<style scoped>
/* 样式保持不变 */
.glass-nav { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); width: 90%; max-width: 1200px; height: 60px; background: rgba(15, 15, 25, 0.6); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 30px; display: flex; justify-content: space-between; align-items: center; padding: 0 24px; z-index: 99999; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 10px rgba(74, 158, 255, 0.2); }
.nav-left { display: flex; align-items: center; gap: 24px; }
.logo { font-weight: bold; font-size: 18px; letter-spacing: 1px; background: linear-gradient(90deg, #4a9eff, #a855f7); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.nav-items { position: relative; display: flex; gap: 8px; }
.nav-link { position: relative; z-index: 2; color: #a0a0a0; text-decoration: none; font-size: 15px; padding: 8px 16px; border-radius: 20px; transition: all 0.3s; cursor: pointer; }
.nav-link.active { color: #fff; text-shadow: 0 0 10px rgba(255,255,255,0.5); }
.active-pill { position: absolute; top: 0; left: 0; height: 100%; background: rgba(255, 255, 255, 0.1); border-radius: 20px; transition: all 0.4s cubic-bezier(0.25, 1, 0.5, 1); z-index: 1; }
.nav-right { display: flex; align-items: center; }
.logout-btn { color: #fff; text-decoration: none; font-size: 14px; padding: 8px 16px; border-radius: 20px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; gap: 6px; transition: all 0.3s; }
.logout-btn:hover { background: rgba(255, 70, 70, 0.2); border-color: rgba(255, 70, 70, 0.5); }
</style>