<template>
  <div class="transition-container" ref="transitionRef">
    <div class="transition-color" ref="colorPanel"></div>
    <div class="transition-paper" ref="paperPanel"></div>
    <div class="transition-film" ref="filmPanel">
      <div class="film-strip strip-top">CINEMA ★ 03 ★ CINEMA ★ 03 ★ CINEMA ★ 03</div>
      <div class="film-strip strip-middle">MUSIC ★ 03 ★ MUSIC ★ 03 ★ MUSIC ★ 03</div>
      <div class="film-strip strip-bottom">CINEMA ★ 03 ★ CINEMA ★ 03 ★ CINEMA ★ 03</div>
      <div class="film-outline" ref="outlineRef">HOME</div>
      <div class="transition-title" ref="titleBox">
        <span ref="titleRef">HOME</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import gsap from 'gsap';

const router = useRouter();
const transitionRef = ref(null);
const colorPanel = ref(null);
const paperPanel = ref(null);
const filmPanel = ref(null);
const titleBox = ref(null);
const titleRef = ref(null);
const outlineRef = ref(null);

let isTransitioning = false;

const setInitialState = () => {
  if (!colorPanel.value) return;
  gsap.set([colorPanel.value, paperPanel.value, filmPanel.value], { xPercent: 100, force3D: true });
  gsap.set(titleBox.value, { clipPath: "inset(0 100% 0 0)" });
};

onMounted(() => {
  gsap.set(transitionRef.value, { autoAlpha: 1 });
  setInitialState();
});

const play = (title, color, targetPath) => {
  if (isTransitioning) return;
  isTransitioning = true;

  colorPanel.value.style.background = color;
  titleRef.value.textContent = title;
  outlineRef.value.textContent = title;

  // 把导航颜色注入到全局 CSS 变量
  document.documentElement.style.setProperty('--theme-color', color);

  setInitialState();

  const tl = gsap.timeline({
    defaults: { ease: "power2.out" },
    onComplete: () => { isTransitioning = false; }
  });

  tl
    .to(colorPanel.value, { xPercent: 0, duration: 0.22 })
    .to(paperPanel.value, { xPercent: 0, duration: 0.20 }, "-=0.08")
    .to(filmPanel.value, { xPercent: 0, duration: 0.25 }, "-=0.08")

    .to({}, { duration: 0.08 })

    .call(() => {
      requestAnimationFrame(() => {
        router.push(targetPath);
      });
    })

    .to(titleBox.value, { 
      clipPath: "inset(0 0% 0 0)", 
      duration: 0.22, 
      ease: "power2.out" 
    })

    .to({}, { duration: 0.45 })

    .to(titleBox.value, { clipPath: "inset(0 100% 0 0)", duration: 0.10 })
    .to(filmPanel.value, { xPercent: 100, duration: 0.20 })
    .to(paperPanel.value, { xPercent: 100, duration: 0.15 }, "-=0.05")
    .to(colorPanel.value, { xPercent: 100, duration: 0.15 }, "-=0.05");
};

defineExpose({ play });
</script>

<style scoped>
.transition-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 9999;
  pointer-events: none;
  overflow: hidden;
}

.transition-color {
  position: absolute;
  top: -50vh;
  left: -50vw;
  width: 200vw;
  height: 200vh;
  background: #8b6ce8;
  clip-path: polygon(20% 0, 100% 0, 80% 100%, 0% 100%);
  will-change: transform;
  transform-origin: center center;
}

.transition-paper {
  position: absolute;
  top: -50vh;
  left: -50vw;
  width: 200vw;
  height: 200vh;
  background: #faf8ee;
  clip-path: polygon(25% 0, 100% 0, 85% 100%, 5% 100%);
  will-change: transform;
  transform-origin: center center;
}

.transition-film {
  position: absolute;
  top: -50vh;
  left: -50vw;
  width: 200vw;
  height: 200vh;
  background: linear-gradient(135deg, #111, #050505);
  clip-path: polygon(30% 0, 100% 0, 90% 100%, 10% 100%);
  overflow: hidden;
  will-change: transform;
  transform-origin: center center;
}

/* 【改动：纹理颜色跟随主题色，透明度 30%】 */
.transition-film::before {
  content: "";
  position: absolute;
  inset: -80%;
  background: repeating-linear-gradient(
    -12deg,
    transparent 0px,
    transparent 65px,
    color-mix(in srgb, var(--theme-color, #dcb43c), transparent 70%) 66px,
    color-mix(in srgb, var(--theme-color, #dcb43c), transparent 70%) 96px,
    transparent 97px,
    transparent 150px
  );
  background-size: 600px 600px;
  animation: filmMove 3s linear infinite;
}

.transition-film::after {
  content: "";
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(-10deg, rgba(255, 255, 255, .03) 0, rgba(255, 255, 255, .03) 2px, transparent 2px, transparent 80px);
}

@keyframes filmMove {
  from { background-position: 0 0; }
  to { background-position: -160px 0; }
}

/* 【改动：胶片文字跟随主题色，透明度 55%】 */
.film-strip {
  position: absolute;
  width: 160%;
  left: -30%;
  white-space: nowrap;
  color: color-mix(in srgb, var(--theme-color, #dcb43c), transparent 45%);
  font-size: 14px;
  letter-spacing: 6px;
  font-weight: 900;
  transform: rotate(-10deg);
  font-family: Arial, sans-serif;
}
.strip-top { top: 12%; }
.strip-middle { top: 44%; }
.strip-bottom { bottom: 12%; }

/* 【改动：镂空字描边跟随主题色，透明度 75%】 */
.film-outline {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%) rotate(-8deg);
  font-size: clamp(90px, 10vw, 160px);
  font-weight: 900;
  font-style: italic;
  color: transparent;
  -webkit-text-stroke: 2px color-mix(in srgb, var(--theme-color, #dcb43c), transparent 75%);
  white-space: nowrap;
  font-family: Arial, sans-serif;
}

/* 【改动：主标题跟随主题色，提亮 30% 保证对比度】 */
.transition-title {
  position: absolute;
  left: 51%;
  top: 50%;
  transform: translate(-50%, -50%) rotate(-7deg);
  font-size: clamp(70px, 9vw, 150px);
  font-weight: 900;
  font-style: italic;
  letter-spacing: -5px;
  white-space: nowrap;
  font-family: Arial, sans-serif;
  color: color-mix(in srgb, var(--theme-color, #ffffff), white 30%);
}
.transition-title span { display: block; }
</style>