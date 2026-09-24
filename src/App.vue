<template>
  <NavBar @navigate="handleNavigate" />
  <router-view />
  <PageTransition ref="transitionRef" />
</template>

<script setup>
import { ref } from 'vue';
import NavBar from './components/NavBar.vue';
import PageTransition from './components/PageTransition.vue';

const transitionRef = ref(null);

// 接收 NavBar 发出的导航请求，统一触发转场动画
const handleNavigate = (item) => {
  if (transitionRef.value) {
    transitionRef.value.play(item.title, item.color, item.path);
  }
};
</script>

<style>
body, html {
    margin: 0; padding: 0; height: 100vh; width: 100vw;
    background: #0d0d0d; overflow: hidden;
    user-select: none; -webkit-user-select: none;
}
#app { width: 100%; height: 100%; overflow: hidden; }
</style>