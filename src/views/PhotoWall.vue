<template>
  <div id="canvas" ref="canvasRef"></div>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { initPhotoWall, destroyPhotoWall } from '../core/main.js';

const canvasRef = ref(null);
const router = useRouter();

onMounted(() => {
  if (sessionStorage.getItem('photoWallLoggedIn') !== 'true') {
    router.push('/login');
    return;
  }
  if (canvasRef.value) {
    initPhotoWall(canvasRef.value);
  }
});

onUnmounted(() => {
  if (canvasRef.value) {
    destroyPhotoWall(canvasRef.value);
  }
});
</script>

<style scoped>
#canvas {
    width: 100vw;
    height: 100vh;
    cursor: grab;
    position: relative;
    overflow: hidden;
}
#canvas:active {
    cursor: grabbing;
}
</style>

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
.item:hover img {
    transform: scale(1.05);
}
</style>