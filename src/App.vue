<template>
  <router-view />
</template>

<style>
/* 全局重置样式 */
body, html {
    margin: 0;
    padding: 0;
    height: 100%;
    background: #0d0d0d;
    overflow: hidden; /* 隐藏页面滚动条 */
}

#app {
    width: 100%;
    height: 100%;
    overflow: hidden; /* 确保挂载点也不出现滚动条 */
}
</style>