<template>
  <div id="canvas" ref="canvasRef"></div>
  <a href="#" @click.prevent="logout" class="logout-btn">退出登录</a>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
// 导入改造后的原生 JS
import { initPhotoWall, destroyPhotoWall } from '../core/main.js';

const canvasRef = ref(null);
const router = useRouter();

onMounted(() => {
  // 安全校验：未登录则跳回登录页
  if (sessionStorage.getItem('photoWallLoggedIn') !== 'true') {
    router.push('/login');
    return;
  }
  // 初始化照片墙
  if (canvasRef.value) {
    initPhotoWall(canvasRef.value);
  }
});

onUnmounted(() => {
  // 组件销毁时清理事件和动画帧
  if (canvasRef.value) {
    destroyPhotoWall(canvasRef.value);
  }
});

const logout = () => {
  sessionStorage.removeItem('photoWallLoggedIn');
  router.push('/login');
};
</script>

<style scoped>
#canvas {
    width: 100%;      /* 原来是 100vw，改成 100% */
    height: 100vh;    /* 保持 100vh 或者改成 100% 都可以 */
    cursor: grab;
    position: relative;
    user-select: none;
    -webkit-user-select: none;
    touch-action: none;
    -webkit-tap-highlight-color: transparent;
    overflow: hidden;
}
#canvas:active { cursor: grabbing; }

/* 退出按钮样式 */
.logout-btn {
    position: fixed;
    top: 10px;
    right: 10px;
    color: white;
    z-index: 100;
    background: rgba(0,0,0,0.5);
    padding: 6px 12px;
    border-radius: 6px;
    text-decoration: none;
    font-family: sans-serif;
}
</style>

<!-- 因为 item 是原生 JS 动态创建的，为了不破坏样式，这里不用 scoped 或在全局引入 -->
<style>
.item {
    position: absolute;
    border-radius: 16px;
    overflow: hidden;
    pointer-events: none;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    transition: box-shadow 0.3s ease;
    transform-origin: center center;
    display: flex;
    align-items: center;
    justify-content: center;
    backface-visibility: hidden;
}
.item img {
    position: relative;
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
    transition: transform 0.4s ease;
    flex-shrink: 0;
}
.item:hover img { transform: scale(1.05); }
</style>