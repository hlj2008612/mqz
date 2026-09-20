<template>
  <div class="login-container">
    <div class="login-box">
      <h1>美琴的照片墙</h1>
      <form @submit.prevent="handleLogin">
        <div class="input-group">
          <label for="username">账号</label>
          <input type="text" id="username" v-model="username" placeholder="请输入账号" required autofocus>
        </div>
        <div class="input-group">
          <label for="password">密码</label>
          <input type="password" id="password" v-model="password" placeholder="请输入密码" required>
        </div>
        <button type="submit">登 录</button>
        <div class="error-msg">{{ errorMsg }}</div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';

// ===== 硬编码的账号密码 =====
const VALID_USERNAME = 'zmq';
const VALID_PASSWORD = '2008823';

const username = ref('');
const password = ref('');
const errorMsg = ref('');
const router = useRouter();

const handleLogin = () => {
  if (username.value.trim() === VALID_USERNAME && password.value === VALID_PASSWORD) {
    // 登录成功：设置会话标志
    sessionStorage.setItem('photoWallLoggedIn', 'true');
    // 跳转到照片墙主页
    router.push('/');
  } else {
    errorMsg.value = '账号或密码错误';
    password.value = '';
  }
};
</script>

<style scoped>
/* 这里是登录页专属的样式，作用域被限制在当前组件，不会影响照片墙 */
.login-container {
    background: #0d0d0d;
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    width: 100vw;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #e0e0e0;
    overflow: hidden;
}
.login-box {
    background: #1a1a1a;
    padding: 40px;
    border-radius: 16px;
    width: 320px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.6);
    box-sizing: border-box;
}
h1 {
    text-align: center;
    font-weight: 300;
    margin-bottom: 30px;
    letter-spacing: 2px;
    color: #e0e0e0;
}
.input-group {
    margin-bottom: 20px;
}
.input-group label {
    display: block;
    margin-bottom: 6px;
    font-size: 14px;
    opacity: 0.8;
}
.input-group input {
    width: 100%;
    padding: 12px;
    border: 1px solid #333;
    border-radius: 8px;
    background: #0d0d0d;
    color: white;
    font-size: 16px;
    outline: none;
    transition: border 0.2s;
    box-sizing: border-box; /* 关键：防止输入框撑破父容器 */
}
.input-group input:focus {
    border-color: #4a9eff;
}
button {
    width: 100%;
    padding: 12px;
    background: #4a9eff;
    border: none;
    border-radius: 8px;
    color: white;
    font-size: 16px;
    cursor: pointer;
    transition: background 0.2s;
    margin-top: 10px;
}
button:hover {
    background: #3a7edf;
}
.error-msg {
    color: #ff5e5e;
    font-size: 14px;
    text-align: center;
    margin-top: 16px;
    min-height: 20px;
}
</style>