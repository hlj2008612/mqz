<template>
  <!--
    画报（/pictorial）—— 瀑布流照片卡片
    ----------------------------------------------------------------
    结构、尺寸、时长逐条对照 PICTORIAL_SPEC.md（主理人用真实 Chrome
    实测 forum.hanakos.cc 首页计算样式后记录）。

      .site-bg / .scanlines   固定背景层（纯深色 + 扫描线）
      main.pictorial-page     滚动容器，padding-top 给固定导航让位
        .pictorial-inner      最大宽 2200px 居中
          .pictorial-tabs     默认 / 热度 胶囊
          .masonry-grid       多列 flex
            .masonry-column   每列独立堆叠
              .card-shell     外层（承载入场动画与 hover 位移）
                .card-tilt    倾斜/视差层（本轮简化为静态）
                  .card-glass 玻璃卡片本体
  -->
  <div class="site-bg" aria-hidden="true"></div>
  <div class="scanlines" aria-hidden="true"></div>

  <main class="pictorial-page" ref="pageRef">
    <!--
      读屏用标题：参考站整个首屏就是卡片流本身，再叠一行大标题会破坏构图。
      但页面没有标题会让读屏用户失去定位，所以用 sr-only 提供，视觉上不可见。
    -->
    <h1 class="pictorial-sr-only">画报 · 照片卡片</h1>

    <div class="pictorial-inner">
      <div class="pictorial-tabs" role="group" aria-label="排序方式">
        <button type="button" class="pictorial-tab is-active" aria-pressed="true">默认</button>
        <!--
          「热度」刻意做成不可用：本项目没有任何真实互动数据（点赞/评论/收藏
          一律显示 0），若让它"生效"就只能靠伪造一个排序，等于骗人。
          保留按钮是为了维持参考站的两个胶囊的视觉结构；后端有真实数据时，
          把 aria-disabled 去掉并接上排序即可。
        -->
        <button
          type="button"
          class="pictorial-tab"
          aria-pressed="false"
          aria-disabled="true"
          title="暂无热度数据"
        >热度</button>
      </div>

      <div ref="gridRef" class="masonry-grid">
        <div v-for="(column, ci) in columns" :key="'col-' + ci" class="masonry-column">
          <div
            v-for="(card, i) in column"
            :key="card.uid"
            class="card-shell"
            :class="{ 'is-visible': revealed.has(card.uid), 'is-settled': animatedOnce.has(card.uid) }"
            :data-uid="card.uid"
            :style="{ '--card-delay': Math.min(i * 45, 270) + 'ms' }"
          >
            <div
              class="card-tilt"
              @mouseenter="onTiltEnter"
              @mousemove="onTiltMove"
              @mouseleave="onTiltLeave"
            >
              <article class="card-glass">
                <div class="card-media">
                  <img
                    :src="card.src"
                    alt="写真"
                    :width="card.w"
                    :height="card.h"
                    :loading="card.eager ? 'eager' : 'lazy'"
                    decoding="async"
                    draggable="false"
                  />
                  <div class="card-media-fade" aria-hidden="true"></div>
                </div>

                <div class="card-author">
                  <!--
                    头像 = 打开照片预览的按钮（复刻参考站点头像弹出 popover 的交互，
                    内容换成这张卡对应的照片）。

                    【为什么用 <button> 包一个 img，而不是给 img 加 tabindex】
                    .card-shell 带 contain: layout style，卡片又是被 hover 抬升的层，
                    在 img 上直接绑键盘事件要自己补 role/tabindex/Enter·Space 处理，
                    还容易在 Firefox 里出现「可聚焦 img」的读屏歧义。用原生 button
                    一次拿到键盘可达、Enter/Space 触发、以及不依赖 i18n 的语义。

                    【alt 仍然置空】读屏信息由 button 的 aria-label 承担（它是图片本身，
                    不是"美琴的头像"），图片再报一次照片编号只会念两遍。
                  -->
                  <button
                    type="button"
                    class="card-avatar"
                    :aria-label="'预览照片 ' + padId(card.uid)"
                    :aria-expanded="activeCard && activeCard.uid === card.uid ? 'true' : 'false'"
                    aria-haspopup="true"
                    :data-uid="card.uid"
                    @mouseenter="onAvatarEnter($event, card)"
                    @mouseleave="onAvatarLeave(false)"
                    @focus="onAvatarEnter($event, card)"
                    @blur="onAvatarLeave(true)"
                    @click.stop="togglePreview($event, card)"
                  >
                    <img
                      :src="card.src"
                      alt=""
                      aria-hidden="true"
                      width="40"
                      height="40"
                      loading="lazy"
                      decoding="async"
                      draggable="false"
                    />
                  </button>
                  <span>美琴</span>
                </div>

                <div class="card-divider"></div>

                <div class="card-body">
                  <div class="card-body-inner">
                    <!--
                      标题行原本是 <h2 class="card-title">写真</h2>，已按需求删除：
                      每张卡片的标题都是同一个词，没有信息量，反而占走正文区第一行。
                      现在 .card-body-inner 里只剩互动图标那一行（padding 不变，
                      首行留白由 .card-body-inner 的 padding-top 提供）。
                    -->
                    <!--
                      互动图标保留（它是参考站视觉语言的一部分，删掉卡片下半部
                      会空一块），但数字一律是 0 —— 本项目没有真实互动数据，
                      不伪造数字。整组对读屏隐藏：三个恒为 0 的数字没有信息量。
                    -->
                    <div class="card-actions" aria-hidden="true">
                      <span class="card-action">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
                             stroke="currentColor" stroke-width="1.6" stroke-linecap="round"
                             stroke-linejoin="round">
                          <path d="M12 20.3 10.6 19C6 14.9 3 12.2 3 8.9 3 6.2 5.1 4 7.8 4c1.5 0 3 .7 4.2 2 1.2-1.3 2.7-2 4.2-2C18.9 4 21 6.2 21 8.9c0 3.3-3 6-7.6 10.1L12 20.3Z" />
                        </svg>
                        <span class="card-action-count">0</span>
                      </span>
                      <span class="card-action">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
                             stroke="currentColor" stroke-width="1.6" stroke-linecap="round"
                             stroke-linejoin="round">
                          <path d="M21 11.5a7.5 7.5 0 0 1-7.5 7.5H8l-4 3v-4.2A7.5 7.5 0 0 1 8 4h5.5A7.5 7.5 0 0 1 21 11.5Z" />
                        </svg>
                        <span class="card-action-count">0</span>
                      </span>
                      <span class="card-action">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
                             stroke="currentColor" stroke-width="1.6" stroke-linecap="round"
                             stroke-linejoin="round">
                          <path d="M6 3.5h12v17l-6-4.2-6 4.2v-17Z" />
                        </svg>
                        <span class="card-action-count">0</span>
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>

  <!--
    照片预览弹层（仿参考站点开头像弹出的 popover，内容是这张卡对应的照片）。

    【为什么 Teleport 到 body】
    本页滚动容器 .pictorial-page 是 overflow:auto，祖先还有 #app 的 overflow:hidden。
    只要弹层留在卡片 DOM 里，任何 ancestor 的 overflow 都会把它裁掉；
    而且卡片 hover 时带 transform（translateY(-10px) scale(1.05)），
    transform 会另建包含块，position:fixed 在那里面会变成相对卡片定位。
    Teleport 到 body + position:fixed 才真正相对视口。

    v-if 而不是 v-show：关闭时必须从 DOM 移除，否则那张 1600px 的 full 图
    会一直留在内存里，20 张卡片来回点会累积。

    @click.stop 必须写在弹层容器上（见脚本里的注释）：
    弹层的点击不能被 document 上的"点外部关闭"监听器当成"点在外部"。
  -->
  <Teleport to="body">
    <div
      v-if="activeCard"
      ref="popoverRef"
      class="card-popover"
      :class="popoverAnim === 'closing' ? 'is-closing' : 'is-open'"
      :data-side="popoverState.side"
      :data-align="popoverState.align"
      role="dialog"
      aria-modal="false"
      tabindex="-1"
      :aria-label="'照片 ' + padId(activeCard.uid) + ' 预览'"
      :style="popoverStyle"
      @mouseenter="onCardEnter"
      @mouseleave="onAvatarLeave(false)"
      @wheel="onPopoverWheel"
      @click.stop
      @animationend="onPopoverAnimEnd"
    >
      <!--
        悬停预览：直接显示这张卡对应的照片本身（1600px 版）。

        【为什么用 full 而不是 src】src 是缩略图（最长边 560px），放大到 320px 宽的浮层里
        还算清楚，但用户接下来多半想看细节。full 是同一张图的 1600px 版，
        20 张合计 2.55 MB 且只在悬停时按需加载一张，代价可接受。

        【尺寸由宽高比决定】外层 .card-popover-photo 的 aspect-ratio 用 fw/fh 内联写死，
        这样图片进 DOM 之前浮层就已经占好正确高度，computePopoverPosition 不会先按
        一个错误高度判「放得下」再被撑开 —— 这是上一版资料卡用固定高度 339 的原因，
        照片形态必须改成按比例算。
      -->
      <div
        class="card-popover-photo"
        :style="{
          aspectRatio: activeCard.fw + ' / ' + activeCard.fh,
          maxHeight: popoverState.photoHeight ? popoverState.photoHeight + 'px' : null,
        }"
      >
        <img
          :src="activeCard.full"
          :alt="'照片 ' + padId(activeCard.uid) + ' 预览'"
          decoding="async"
          draggable="false"
        />
        <span class="card-popover-no">NO.{{ padId(activeCard.uid) }}</span>
      </div>
      <div class="card-popover-foot">
        <span class="card-popover-hint">点击查看大图 · 移开自动关闭</span>
        <button
          type="button"
          class="card-popover-btn is-primary"
          @click.stop="openViewerFromCard(activeCard)"
        >查看大图</button>
      </div>
    </div>
  </Teleport>

  <!--
    大图查看层（点资料卡里的「查看大图」打开）。

    【为什么单独一层、不复用资料卡】资料卡是 288x338 的浮层，大图要占大半屏，
    两者的定位逻辑、遮罩、退出方式完全不同；硬塞进同一个弹层会让
    computePopoverPosition 同时处理两种形态，改一处坏一处。

    v-if 而不是 v-show：关闭时那张 1600px 的 full 图必须离开 DOM，
    否则 20 张来回看会在内存里累积。
  -->
  <Teleport to="body">
    <div
      v-if="viewerCard"
      ref="viewerRef"
      class="photo-viewer"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      :aria-label="'照片 ' + padId(viewerCard.uid) + ' 大图'"
      @click="onViewerBackdropClick"
      @keydown.esc.stop="closeViewer"
    >
      <figure class="photo-viewer-figure" @click.stop>
        <img
          :src="viewerCard.full"
          :alt="'照片 ' + padId(viewerCard.uid) + ' 大图'"
          decoding="async"
          draggable="false"
          @error="onViewerImgError"
        />
        <figcaption class="photo-viewer-cap">
          <span class="photo-viewer-no">NO.{{ padId(viewerCard.uid) }}</span>
          <span class="photo-viewer-hint">按 Esc 或点击空白关闭</span>
        </figcaption>
      </figure>

      <button type="button" class="photo-viewer-close" aria-label="关闭大图" @click.stop="closeViewer">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="18" y1="6" x2="6" y2="18" />
        </svg>
      </button>
    </div>
  </Teleport>
</template>

<script setup>
/**
 * 画报页脚本
 * ----------------------------------------------------------------
 * 三件事：把清单映射成卡片、把卡片贪心平衡地分到 N 列、滚动入场。
 * 没有引入任何瀑布流库 / 动画库（规格第 5.5 条）。
 */
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, shallowRef, onUpdated } from 'vue';
// 【必须】从 config.js 取 IMAGE_POOL，而不是直接取 imageManifest.js 的原始清单：
// config.js 的 validatePool() 会校验张数与字段，无效时返回空数组。
// 绕过它直接取模，空池时 entry 是 undefined，读 entry.thumb 会抛 TypeError
// 整页白屏（Cinema.vue 里记录过同样的实测）。空池时本页渲染空网格，符合规格第 5.4 条。
import { IMAGE_POOL } from '../core/config.js';
import { assetUrl } from '../core/imageManifest.js';

/**
 * 卡片数据（一次性构建，不随列数变化重建）。
 * 地址必须走 assetUrl(entry.thumb)：清单里是 "images/thumbnails/1.webp" 这样的
 * 相对路径，前缀由 import.meta.env.BASE_URL 提供，子路径部署才不会 404。
 * 这里绝不能写死 /images/thumbnails/x.webp（规格第 5.1 条）。
 */
const cards = IMAGE_POOL
  // 清单条目必须带 id 与 thumb：缺 id 会让 :key 与 data-uid 全部变成 undefined
  // （Vue 报重复 key、卡片无法区分），缺 thumb 会请求 /undefined 拿 404。
  // 生成脚本目前总会写出这两个字段，这里只是防御，不改变正常路径。
  .filter((entry) => entry && entry.id != null && entry.thumb)
  .map((entry, i) => ({
    uid: entry.id,
    src: assetUrl(entry.thumb),
    // 头像弹层用的大图：清单里 full 是 1600px 版本（见 imageManifest.js 的 ImageEntry）。
    // 继续走 assetUrl()，而不是手拼路径 —— 子路径部署（gh-pages 的 /mqz/）才不会 404。
    // full 字段缺失时退回 thumb：宁可糊一点，也不要弹层里是张裂图。
    full: assetUrl(entry.full || entry.thumb),
    w: entry.w,
    h: entry.h,
    // 原图像素宽高，弹层按它算显示高宽比（w/h 是缩略图的宽度，比例相同但语义不同）。
    fw: entry.w,
    fh: entry.h,
    // 首屏前几张优先加载：全部 lazy 会让 LCP 等到滚动容器的懒加载判定，
    // 首屏出现一段空白。6 张 ≈ 一屏两行的量。
    eager: i < 6,
  }));

/* ------------------------------------------------------------ 列数 */

/**
 * 断点（规格第 4.1 条，建议值 1024 / 640）：
 *   桌面 ≥1024 → 5 列；平板 640–1023 → 3 列；手机 <640 → 2 列。
 * 与规格 2.1 的 640px 媒体查询边界对齐，避免"列数变了但间距没变"的错位。
 */
const getColumnCount = (width) => {
  if (width >= 1024) return 5;
  // 用 > 而不是 >=：样式表里的窄屏间距是 @media (max-width: 640px)，
  // 含 640 本身。两边取同一个边界，640px 整不会出现"3 列 + 窄间距"的错配。
  if (width > 640) return 3;
  return 2;
};

const viewportWidth = () => (typeof window === 'undefined' ? 1440 : window.innerWidth);

const columnCount = ref(getColumnCount(viewportWidth()));
const columns = shallowRef([]);
const gridRef = ref(null);

/* ------------------------------------------------ 贪心平衡分配（核心） */

/**
 * 实测到的卡片高度（uid → px）。挂载后由 measureHeights() 填入。
 * 规格第 4.2 条允许"固定估算值"，这里先估算、再实测纠正，两者都支持。
 */
const measured = new Map();

/**
 * 卡片除图片以外的固定高度估算（作者行 + 分隔线 + 正文区）。
 * 只在"还没测过"时用；实测后 measured 会覆盖它。
 */
const CHROME_ESTIMATE = 104;

/** 单张卡片的估算高度：图片是 1:1 正方形，高度 = 列宽；再加固定装饰高度。 */
const estimateHeight = (columnWidth) => columnWidth + CHROME_ESTIMATE;

/**
 * 贪心平衡分配：按原始顺序逐张放入【当前累计高度最短】的列。
 *
 * 【为什么不是轮询】轮询只在"所有卡片等高"时等价于平衡；一旦出现宽卡/无图卡
 * 这类高度不同的卡片，轮询会让某些列明显更长。贪心对任意高度分布都能把
 * 列高的极差压到最小。
 *
 * 【并列时取最左列】用严格小于比较，累计高度相同时不换目标，
 * 于是等高卡片会得到 0,1,2,3,4,0,1,… 的整齐落位（20 张 / 5 列 = 每列 4 张，
 * 与规格第 4.3 条一致），不会出现"第 5 列只有 1 张"这种偏斜。
 *
 * @param {number} count 列数
 * @returns {Array<Array<object>>} 每列的卡片数组
 */
function assignColumns(count) {
  const buckets = Array.from({ length: count }, () => []);
  if (!cards.length || count <= 0) return buckets;

  const totals = new Array(count).fill(0);
  const fallback = estimateHeight(gridRef.value?.firstElementChild?.clientWidth || 262);

  for (const card of cards) {
    let target = 0;
    for (let i = 1; i < count; i += 1) {
      if (totals[i] < totals[target]) target = i;
    }
    buckets[target].push(card);
    totals[target] += measured.get(card.uid) || fallback;
  }
  return buckets;
}

/** 分配结果的指纹，用来判断"重新分配后是否真的变了"，避免无意义的重复渲染。 */
const layoutKey = (buckets) => buckets.map((b) => b.map((c) => c.uid).join(',')).join('|');

/**
 * 实测已渲染卡片的高度（规格第 4.2 条：可在挂载后用 offsetHeight 实测）。
 * @returns {boolean} 是否有高度被更新
 */
function measureHeights() {
  const root = gridRef.value;
  if (!root) return false;

  let changed = false;
  const nodes = root.querySelectorAll('.card-shell[data-uid]');
  for (const node of nodes) {
    const uid = Number(node.dataset.uid);
    const h = node.offsetHeight;
    if (!Number.isFinite(h) || h <= 0) continue;
    if (measured.get(uid) !== h) {
      measured.set(uid, h);
      changed = true;
    }
  }
  return changed;
}

/* --------------------------------------------------------- 滚动入场 */

/** 已入场的卡片 uid。用 reactive(Set)：模板里 revealed.has() 会被追踪。 */
const revealed = reactive(new Set());

/**
 * 已经播过入场动画的 uid（普通 Set，故意不做响应式）。
 *
 * 【为什么需要】跨断点重排时 Vue 会把跨父列的 .card-shell 销毁重建。
 * 新节点一挂载就带 .is-visible，animation 会从头再跑一遍 1.1s，
 * 整片卡片重新模糊闪入（实测跨 5 列 -> 3 列时 20 张里有 14 张重播）。
 * 这里记住「已播过」，重建出的节点直接带 .is-settled 跳过动画。
 * 故意不响应式：只在渲染时读一次当时的值，不需要触发更新。
 */
const animatedOnce = new Set();
let observer = null;
/** 当前正在被 observer 观察的节点，用来清理已脱离文档的旧节点。 */
const observedNodes = new Set();

/**
 * 懒挂载 IntersectionObserver：只有浏览器支持时才创建。
 * 不支持时 observeCards() 会把所有卡片直接标成已入场（降级为无动画）。
 */
function ensureObserver() {
  if (observer) return observer;
  if (typeof IntersectionObserver === 'undefined') return null;

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const uid = Number(entry.target.dataset.uid);
        revealed.add(uid);
        animatedOnce.add(uid);
        observer.unobserve(entry.target);
        observedNodes.delete(entry.target);
      }
    },
    // 提前 240px 触发：等卡片真的进视口再播 1.1s 的模糊揭示，会看到"先空后闪"。
    { root: null, rootMargin: '240px 0px', threshold: 0 }
  );
  return observer;
}

/** 观察当前 DOM 里所有还没入场的卡片（重新分配列后要再调一次）。 */
function observeCards() {
  const root = gridRef.value;
  if (!root) return;

  const io = ensureObserver();
  const nodes = root.querySelectorAll('.card-shell[data-uid]');

  if (!io) {
    for (const node of nodes) { const uid = Number(node.dataset.uid); revealed.add(uid); animatedOnce.add(uid); }
    return;
  }

  // 【关键】先把已经脱离文档的旧节点移出观察列表。
  // 跨断点时 Vue 会销毁并重建跨父列的卡片，旧节点虽然已不在 DOM 里，
  // 却仍被 IntersectionObserver 强引用（连同整棵子树和 img），
  // 直到组件卸载才 disconnect()。实测连跨 4 次断点会留下 28 个游离节点。
  for (const node of observedNodes) {
    if (!node.isConnected) {
      io.unobserve(node);
      observedNodes.delete(node);
    }
  }

  for (const node of nodes) {
    const uid = Number(node.dataset.uid);
    if (revealed.has(uid)) continue;
    if (observedNodes.has(node)) continue;
    io.observe(node);
    observedNodes.add(node);
  }
}

/* --------------------------------------------------------- 布局调度 */

/** 重新分配并（必要时）重新渲染，然后实测高度、修正分配、重新观察。 */
async function rebuild() {
  const count = columnCount.value;
  const next = assignColumns(count);

  if (layoutKey(next) !== layoutKey(columns.value)) {
    columns.value = next;
    await nextTick();
  }

  // 实测纠正：首次渲染后卡片真实高度才可读。等高时这一步不会改变分配
  // （layoutKey 相同 → 不触发重渲染），只有出现高度不一的卡片才真的重排。
  if (measureHeights()) {
    const corrected = assignColumns(count);
    if (layoutKey(corrected) !== layoutKey(columns.value)) {
      columns.value = corrected;
      await nextTick();
    }
  }

  observeCards();
}

/* ------------------------------------------------------ 响应式列数 */

let rafId = 0;

/**
 * resize 用 requestAnimationFrame 节流（规格第 4.4 条）：
 * 拖动窗口时 resize 每秒能触发上百次，每次都重排会让主线程一直忙。
 */
function onResize() {
  if (rafId) return;
  rafId = requestAnimationFrame(() => {
    rafId = 0;
    const next = getColumnCount(window.innerWidth);
    if (next === columnCount.value) return;
    columnCount.value = next;
    rebuild();
  });
}

onMounted(() => {
  // 先同步铺一次，避免首帧空网格闪一下。
  rebuild();
  window.addEventListener('resize', onResize, { passive: true });
  // 点窗口外（切到别的应用 / 地址栏）时关闭预览：非模态弹层留在屏幕上没有意义。
  window.addEventListener('blur', handleWindowBlur);
});

onUnmounted(() => {
  window.removeEventListener('resize', onResize);
  window.removeEventListener('blur', handleWindowBlur);

  // 弹层：先终止出场定时器，再解绑全局监听，最后清状态。
  // 【顺序不能反】closePreview() 会重新挂一个定时器并再次调 detach，
  // 这里直接走幂等的清理路径，不留任何异步尾巴。
  clearHoverTimers();   // 悬停弹出/关闭的定时器也必须作废，否则卸载后仍会调 openPreview
  viewerCard.value = null;      // 大图同样不能留在 DOM 里（1600px 原图）
  viewerReturnFocus = null;
  clearCloseTimer();
  detachGlobalListeners();
  activeCard.value = null;
  popoverAnim.value = 'idle';
  popoverAnchor = null;
  popoverState.side = 'bottom';
  popoverState.align = 'start';
  popoverState.top = 0;
  popoverState.left = 0;
  popoverState.photoHeight = 0;

  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
  if (observer) {
    observer.disconnect();
    observedNodes.clear();
    observer = null;
  }
  measured.clear();

  // 倾斜视差可能还排着一个 rAF：不取消的话，卸载后回调仍会跑一次
  // （applyTilt 里有 isConnected 守卫，但取消更干净，也避免持有元素引用）。
  if (tiltRaf) {
    cancelAnimationFrame(tiltRaf);
    tiltRaf = 0;
  }
  tiltBox = null;
});

/* --------------------------------------------------- 3D 倾斜视差 */

/**
 * 悬停时的 3D 倾斜与视差（逐字复刻参考站）。
 *
 * 参考站源码（page chunk @1341 附近的 S 组件）：
 *   onMouseEnter 量一次卡片矩形，记 cx/cy/w/h，加 .is-tilting
 *   onMouseMove  归一化 n = clamp((x-cx)/w, -0.5, 0.5)、r = clamp((y-cy)/h, -0.5, 0.5)
 *                然后写 6 个自定义属性：
 *                  --tilt-x      = (-(2*r*6)).toFixed(2) + 'deg'   垂直倾斜，最大 ±6deg
 *                  --tilt-y      = ((2*n*8)).toFixed(2) + 'deg'    水平倾斜，最大 ±8deg
 *                  --card-par-x  = ((2*n*10)).toFixed(1) + 'px'    图片视差，最大 ±10px
 *                  --card-par-y  = ((2*r*6)).toFixed(1) + 'px'     图片视差，最大 ±6px
 *                  --tilt-shadow-x = (-(2*n*12)).toFixed(1) + 'px' 投影偏移，最大 ±12px
 *                  --tilt-shadow-y = (-(2*r*12)).toFixed(1) + 'px'
 *   onMouseLeave 取消 rAF、清空矩形、逐个 removeProperty、移除 .is-tilting
 *
 * 三条与参考站一致的约束：
 *   1. 只在 (hover: hover) and (pointer: fine) 且非 reduced-motion 下启用 ——
 *      参考站是在 effect 里算一次 c.current 布尔值，触屏与减少动态效果环境直接不响应。
 *   2. mousemove 用 rAF 合并，且用 s.current 作为「已排队」标志（同参考站）。
 *   3. 矩形只在 mouseenter 量一次，移动过程不再读布局 —— 避免每帧强制回流。
 */

/** 参考站清理时遍历的属性名，顺序一致。 */
const TILT_PROPS = [
  '--tilt-x',
  '--tilt-y',
  '--card-par-x',
  '--card-par-y',
  '--tilt-shadow-x',
  '--tilt-shadow-y',
];

/** 当前指针位置（rAF 里读，避免每个 mousemove 都进渲染帧）。 */
const tiltPointer = { x: 0, y: 0 };
/** 当前卡片的矩形缓存，null 表示未进入任何卡片。 */
let tiltBox = null;
/** 待执行的 rAF id，0 表示空闲。参考站用同一个变量兼任「已排队」标志。 */
let tiltRaf = 0;

/**
 * 是否启用倾斜。与参考站一致：算一次，不随窗口变化重算。
 * 用 try/catch 包住 matchMedia：极老的环境里没有 matchMedia，不能因此整页报错。
 */
const tiltEnabled = (() => {
  try {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return false;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    return true;
  } catch (e) {
    return false;
  }
})();

/**
 * 指针进入卡片：只记元素并加上倾斜类，【不读布局】。
 *
 * 【为什么不在 enter 里量矩形】滚动时指针可以完全不动，而卡片会从指针下方
 * 滑过 —— 浏览器会因此连续触发 mouseenter/mouseleave。实测「指针停在卡片上
 * 滚 8 格」期间 mouseenter 7 次、mouseleave 8 次、mousemove 0 次。
 * 原先每次 enter 都 getBoundingClientRect()，等于每个滚动步强制一次同步布局
 * （CDP 计数器：卡片上 layout 7-8 次，卡片间隙 0-1 次）。
 *
 * 矩形只在【第一次真的要倾斜】时才量（见 applyTilt）。纯滚动不产生任何布局读取，
 * 而一旦指针移动，那一帧本来就要写样式，顺手量一次矩形不再额外付出代价。
 */
const onTiltEnter = (e) => {
  if (!tiltEnabled) return;
  const el = e.currentTarget;
  if (!el) return;
  tiltBox = { el, cx: 0, cy: 0, w: 0, h: 0, measured: false };
  el.classList.add('is-tilting');
};

/** 指针移动：只记坐标，真正写样式交给 rAF。 */
const onTiltMove = (e) => {
  if (!tiltEnabled || !tiltBox) return;
  tiltPointer.x = e.clientX;
  tiltPointer.y = e.clientY;
  if (tiltRaf) return;
  tiltRaf = requestAnimationFrame(applyTilt);
};

/** 把归一化坐标换算成 6 个自定义属性写进元素。 */
function applyTilt() {
  tiltRaf = 0;
  const box = tiltBox;
  if (!box) return;
  const el = box.el;
  if (!el || !el.isConnected) return;

  // 矩形延迟到此刻才量：这是唯一一次布局读取，且只发生在指针真的移动时。
  if (!box.measured) {
    const rect = el.getBoundingClientRect();
    box.cx = rect.left + rect.width / 2;
    box.cy = rect.top + rect.height / 2;
    box.w = rect.width;
    box.h = rect.height;
    box.measured = true;
  }

  // clamp 到 ±0.5：参考站用 Math.max/Math.min 而不是 Math.max(-1,...)，
  // 因为卡片可能被缩放，指针跑到边缘外时也不该让倾斜超过设计上限。
  const n = Math.max(-0.5, Math.min(0.5, (tiltPointer.x - box.cx) / box.w));
  const r = Math.max(-0.5, Math.min(0.5, (tiltPointer.y - box.cy) / box.h));

  el.style.setProperty('--tilt-x', (-(2 * r * 6)).toFixed(2) + 'deg');
  el.style.setProperty('--tilt-y', (2 * n * 8).toFixed(2) + 'deg');
  el.style.setProperty('--card-par-x', (2 * n * 10).toFixed(1) + 'px');
  el.style.setProperty('--card-par-y', (2 * r * 6).toFixed(1) + 'px');
  el.style.setProperty('--tilt-shadow-x', (-(2 * n * 12)).toFixed(1) + 'px');
  el.style.setProperty('--tilt-shadow-y', (-(2 * r * 12)).toFixed(1) + 'px');
}

/** 指针离开卡片：取消排队、清缓存、逐个移除属性、去掉倾斜类。 */
const onTiltLeave = (e) => {
  if (tiltRaf) {
    cancelAnimationFrame(tiltRaf);
    tiltRaf = 0;
  }
  tiltBox = null;
  const el = e && e.currentTarget;
  if (!el) return;
  for (const prop of TILT_PROPS) el.style.removeProperty(prop);
  el.classList.remove('is-tilting');
};


/* --------------------------------------------------- 照片预览弹层 */
/**
 * 点头像弹出「这张卡对应的照片」大图（复刻参考站点头像弹 popover 的交互形态，
 * 内容不是用户资料，而是照片本身）。
 *
 * 【规格来源】参考站用真 Chrome 读计算样式得到的值，逐条照搬：
 *   宽 288px、圆角 16px、background rgba(20,20,28,.55)、
 *   border 1px solid rgba(255,255,255,.15)、
 *   box-shadow 0 24px 64px rgba(0,0,0,.5)、
 *   backdrop-filter blur(24px) saturate(1.5)、overflow hidden；
 *   出现在锚点下方（data-side=bottom / data-align=start），距锚点 22px；
 *   200ms 淡入 + zoom .95→1 + 从顶部滑入 8px。
 * 这些全部写在 <style scoped> 的 .card-popover 里（**注意 scoped 与 Teleport 的
 * 组合：Vue 3 会给 Teleport 内容也打上 scope id，所以 scoped 样式对弹层生效**）。
 *
 * 与本项目的差异（适配，不是遗漏）：
 *   1. 参考站内容是可滚动的用户资料卡；这里是一张按原比例显示的图片，
 *      所以高度由图片长宽比和视口决定，需要一套「翻转 + 横向钳制」的定位算法
 *      （参考站因为宽度固定、内容自适应，只需要简单的固定偏移）。
 *      纵向【不钳制】：浮层始终贴在锚点边上、随锚点（含滚动）逐像素移动，
 *      与参考站实测行为一致 —— 详见 computePopoverPosition 的注释。
 *   2. 大图走 assetUrl(entry.full)：表格里的 thumb 只有 560px，放大后必糊。
 *   3. 图上叠的编号用 padId()，不伪造点赞数（与卡片上的 0 一致）。
 */

/** 照片编号补零成两位，卡片与弹层共用（原 card-title 里的 "NO.xx" 的同一套编号）。 */
const padId = (id) => String(id).padStart(2, '0');

/** 当前打开的卡片（null = 关闭）。整个页面同一时刻只有一个。 */
const activeCard = ref(null);
/** 当前打开的大图（null = 关闭）。与资料卡互斥，同一时刻只显示一个。 */
const viewerCard = ref(null);
/** 大图层 DOM 引用（用来接管焦点，Esc 时还原）。 */
const viewerRef = ref(null);
/** 打开大图前的焦点元素，关闭时还原，键盘用户不会丢失位置。 */
/** 弹层 DOM 引用，定位时需要量它自己的尺寸。 */
let viewerReturnFocus = null;
const pageRef = ref(null);
const popoverRef = ref(null);

/**
 * 弹层动画阶段：'opening'（入场中）/ 'closing'（出场中，播完才卸载）/ 'idle'。
 * 模板里把非 closing 的状态一律映射成 .is-open —— 这样首帧 DOM 就带着入场
 * keyframes，不存在「先挂载、下一帧再加类」时的一帧裸弹层闪动。
 */
const popoverAnim = ref('opening');
/** 弹层的锚点元素（被点的那个头像按钮）。用普通变量而非 ref：不需要响应式。 */
let popoverAnchor = null;

/*
 * 滚动跟随的基准值（见 handleScrollChange 的说明）。
 *
 * 【为什么需要这组缓存】弹层是 position:fixed，页面滚动时它必须跟着锚点一起移动。
 * 最直觉的做法是每次 scroll 都 anchor.getBoundingClientRect() 再重算 —— 但那是
 * 【滚动帧里强制同步布局】：读 rect 会逼浏览器立刻完成一次 layout，紧接着写
 * popoverState 又让 Vue 重新渲染，下一次滚动再读再写…… 实测在弹层打开时滚动
 * 20 格，LayoutCount 从 0 飙到 27、TaskDuration 从 39ms 涨到 188ms（4.8 倍），
 * 用户感受到的就是「鼠标停在卡面上时整个页面滚动一顿一顿」。
 *
 * 解法：锚点相对滚动容器的位置在滚动过程中【不变】，变的只是 scrollTop。
 * 所以打开时记下 (基准 top, 基准 scrollTop)，之后每一帧只做一次减法即可，
 * 完全不需要读布局。
 */
let anchorBaseTop = 0;
let anchorBaseLeft = 0;
let anchorBaseScrollTop = 0;
let anchorBaseScrollLeft = 0;
/** 滚动跟随的 rAF 句柄，0 表示空闲（用来把同帧内的多次 scroll 合并成一次写入）。 */
let scrollShiftRaf = 0;
/*
 * 已经直接写进 DOM 的 top/left。
 *
 * 【为什么绕过 popoverState】滚动跟随是每帧都发生的热路径。若每帧都写
 * popoverState（reactive），Vue 要走一遍「触发依赖 -> 重算 computed ->
 * 虚拟 DOM diff -> patch style」，实测光这一步就让弹层打开时的滚动帧
 * 比空白处多出约 30 次样式重算。改为直接写 el.style 后，滚动帧只做
 * 一次属性赋值，不再惊动 Vue 的调度器。
 *
 * popoverState 仍是【唯一真相源】：打开、resize、nextTick 校正都写它，
 * 写完后用 syncPopoverDom() 把 DOM 拉回同一状态，两边不会失配。
 */
let scrollAppliedTop = 0;
let scrollAppliedLeft = 0;

/** 定位结果：side（bottom / top）、align（start / center[横向钳制后才出现]）、坐标。 */
const popoverState = reactive({
  side: 'bottom',
  align: 'start',
  top: 0,
  left: 0,
  // 照片区高度（由 measurePopoverSize 的预算算出），模板绑定到 max-height。
  // 【为什么必须由 JS 决定而不是纯 CSS】预算依赖「两侧空间的最坏情况」，
  // 而 CSS 拿不到锚点位置；只有 JS 知道当前视口能给出多少。
  photoHeight: 0,
});

/**
 * 渲染用样式。只负责「在什么位置」，视觉（背景/圆角/阴影/动画）全在 CSS 里 ——
 * 这样 reference 站给的那组数值只需要维护一份。
 */
/*
 * 【关键保护】滚动跟随直接写 el.style 绕开了 Vue，但 Vue 一旦因别的原因
 * 重新 patch（比如 popoverAnim 切到 closing、activeCard 换卡），它会用
 * popoverStyle 里的 popoverState 值把 top/left 覆盖回去 —— 那是滚动前的旧值，
 * 弹层会瞬间跳位。所以在每次 patch 之后把我们的值重新写回去，消除失配。
 */
onUpdated(() => {
  if (!activeCard.value) return;
  const el = popoverRef.value;
  if (!el) return;
  // 无条件写回：patch 是低频事件（开/关/换卡），而「比较后再写」会被 CSS 序列化坑到 ——
  // '46px 0px' 读回来是 '46px'、'0px 0px' 读回来是 '0px'，y 为 0 时判断恒真、
  // 反而每次都写一次。同值赋值代价近乎为零，直接写更可靠。
  writePopoverOffset(el, scrollAppliedTop, scrollAppliedLeft);
});

/*
 * 【定位只写一个属性：translate】
 * 参考站实测：位置由内联 transform: translate(x,y) 逐帧承担，top/left 恒为 0。
 * 我方原先逐帧写 top/left（布局属性），每帧强制布局；弹层带 backdrop-filter，
 * 布局一变模糊背景就要重新采样，滚动时弹层总比页面慢半拍。
 * translate 是合成层属性、不参与布局，机制与参考站等价。
 * 不能用 transform 承载位置：它已被入场/出场的 scale + translateY 占用。
 * 不支持 translate 的浏览器由下方 supportsTranslateProp() 回退到 top/left。
 */
let translatePropSupported = null;
function supportsTranslateProp() {
  if (translatePropSupported !== null) return translatePropSupported;
  translatePropSupported = typeof CSS !== 'undefined'
    && typeof CSS.supports === 'function'
    && CSS.supports('translate', '1px 1px');
  return translatePropSupported;
}

/**
 * 把浮层位置写进 DOM 的唯一入口。
 * 所有写位置的地方都必须走这里，否则会出现 top/left 与 translate 两套写法并存、
 * 一半位置生效一半不生效的错乱。
 */
function writePopoverOffset(el, top, left) {
  if (supportsTranslateProp()) {
    el.style.translate = `${left}px ${top}px`;
  } else {
    el.style.top = `${top}px`;
    el.style.left = `${left}px`;
  }
}

const popoverStyle = computed(() => (
  supportsTranslateProp()
    ? { translate: `${popoverState.left}px ${popoverState.top}px` }
    : { top: popoverState.top + 'px', left: popoverState.left + 'px' }
));

/**
 * 锚点与弹层之间的间距（参考站实测 22px）。
 * 【现在是硬保证，不再被压缩】纵向不再把 top 钳进视口，所以浮层每一帧都严格
 * 距锚点 22px（bottom: top = rect.bottom + 22；top: top = rect.top - 22 - height）。
 */
const POPOVER_GAP = 22;
/** 弹层与视口边缘至少留出的距离。 */
const POPOVER_MARGIN = 12;
/**
 * 固定导航栏占用的顶部高度（px）。导航 `.glass-nav` 是 fixed + top:20px + height:60px，
 * 底边落在 80px；再留 10px 呼吸，取 90。窄屏导航 54px + top 20 = 74，88 足够。
 * 【现在只参与翻转判定，不再作为钳制下界】它决定「上方还剩多少可用空间」：
 * 锚点本来就可能滚到导航底下，浮层跟过去被导航遮住是跟随的必然结果，
 * 这不是定位错误（不再像以前那样把 top 硬拉到 90，反而与锚点脱开）。
 */
const NAV_SAFE_TOP = 90;
const NAV_SAFE_TOP_NARROW = 88;
/** 参与「是否够放」判断时用的视口最小高度（手机软键盘/小窗会把它压到很小）。 */
const POPOVER_FALLBACK_VW = 320;

/**
 * 悬停预览的照片显示宽度（px）。与 CSS 里 .card-popover 的 width 必须一致，
 * 否则 measurePopoverSize() 算出的宽度和实际渲染宽度对不上，横向定位会偏。
 */
const POPOVER_PHOTO_WIDTH = 320;
/**
 * 弹层底部信息条的高度（px）。必须与 CSS 里 .card-popover-foot 的 height 一致，
 * 否则算出的总高比实际少这一截，翻到锚点上方时会压到锚点上。
 */
const POPOVER_FOOT_HEIGHT = 52;
/**
 * 浮层最小可用高度（px）= 信息条 52 + 边框 2 + 照片至少留 120。
 * 【为什么需要它】方案 A 让高度服从「所在一侧预算」hMax = (vh-186)/2，
 * 但视口极矮时（手机横屏 844x390，hMax 只有 102px）预算会小于最小可用高度。
 * 此时只能允许高度突破预算、接受浮层与锚点重叠 —— 因为照片压到 48px 已无意义。
 * 换言之：不重叠这个不变量只在「预算 >= POPOVER_MIN_HEIGHT」时成立，这里如实写出边界。
 */
const POPOVER_MIN_HEIGHT = POPOVER_FOOT_HEIGHT + 2 + 120;

const clampNum = (v, min, max) => Math.max(min, Math.min(max, v));

/**
 * 量悬停预览的显示尺寸：宽度固定，高度 = 照片宽度 / 这张图的宽高比 + 信息条。
 *
 * 【为什么必须在渲染前算出来】computePopoverPosition 要用高度判断「下方放不放得下」，
 * 否则得先渲染一次、量完再摆，第一帧会闪一下。
 * 照片高度由 activeCard 的 fw/fh 决定，所以每张图算出来都不一样。
 *
 * @returns {{ width:number, height:number }}
 */
function measurePopoverSize() {
  const vw = typeof window === 'undefined' ? 1440 : window.innerWidth;
  const vwOk = vw > 0 ? vw : POPOVER_FALLBACK_VW;
  // 与 CSS 里 @media (max-width:640px) 的 width: calc(100vw - 24px) 用同一公式。
  // Math.max(0, ...)：视口极窄时别算出负数宽度，否则定位会翻到屏幕外。
  const width = Math.max(0, Math.min(POPOVER_PHOTO_WIDTH, vwOk - POPOVER_MARGIN * 2));

  const card = activeCard.value;
  // 宽高比缺失或非法时退回 3:4（项目图片都是竖构图，比 1:1 更接近真实高度），
  // 避免 0 或 NaN 让整个浮层高度变成 0、定位算到视口外。
  const ratio = card && card.fw > 0 && card.fh > 0 ? card.fw / card.fh : 3 / 4;

  const vh = typeof window === 'undefined' ? 900 : window.innerHeight;
  // 【自然高度 = 照片按真实比例 + 信息条】完全解析计算，不读任何布局。
  // 绝不使用 offsetHeight 回填：高度一旦被 max-height 裁过，量到的就是裁剪后的值，
  // 再把它当自然高度就形成【棘轮效应】—— 视口放大后也永远长不回来。
  const maxPhoto = Math.min(480, Math.round(vh * 0.6));
  const photoNatural = (width - 2) / ratio;
  const natural = Math.round(Math.min(photoNatural, maxPhoto) + POPOVER_FOOT_HEIGHT + 2);

  // 【方案 A：高度服从「所在一侧预算」，而不是把位置钳进视口】
  // 浮层必须永不覆盖锚点：否则指针离开头像后立刻落进浮层，mouseleave 被浮层的
  // mouseenter 抢先取消，浮层从此再也不会关闭（这就是实测到的「滚到底也关不掉」）。
  // 但「不覆盖锚点」与「完整可见」在浮层高于两侧空间时【无解】——
  // 唯一出路是让高度变小：H := min(自然高度, 预算)。
  // 预算推导（A=40 锚点高、G=22 间距、M=12 边距、S=90 顶部安全区）：
  //   spaceBelow(y) = vh - y - 74        spaceAbove(y) = y - 112
  // 两侧同时不够的最坏锚点 y* = (vh - 38) / 2，此时可用空间 = (vh - 186) / 2。
  // 取这个与侧别无关的全局上限，好处是高度只随视口变化、side 不会因高度抖动。
  const hMax = Math.max(POPOVER_MIN_HEIGHT, Math.floor((vh - 186) / 2));
  const height = Math.min(natural, hMax);
  return { width, height, natural };
}


/**
 * 按锚点矩形与弹层尺寸算位置：优先下方，下方放不下就翻到上方；
 * 水平方向优先与锚点左边缘对齐（data-align=start），再钳进视口。
 *
 * 【纵向不钳制 —— 这是本函数的核心语义】浮层始终 = 锚点边 + gap，
 * 随锚点逐像素移动，允许底部超出视口被裁掉（与参考站实测一致：
 * 锚点 248→浮层 308、锚点 181→235、锚点 106→157、锚点 26→77，
 * 每次浮层位移都等于锚点位移）。以前把 top 钳进 [safeTop, vh-12-height]，
 * 滚动后 below 一碰到上界就被钉死，于是「浮层不跟着锚点走」。
 *
 * @param {DOMRect} rect 锚点矩形（来自 getBoundingClientRect）
 * @param {{width:number,height:number}} size 弹层尺寸
 * @returns {{side:'bottom'|'top', align:'start'|'center', top:number, left:number}}
 */
function computePopoverPosition(rect, size) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // 顶部安全区：桌面让出固定导航，窄屏略收。
  // 【只用于判定「上方还剩多少空间够不够翻转」】不再作为 top 的下界：
  // 用 POPOVER_MARGIN 当上界会把 1280x720 这类矮窗口的可用空间高估，
  // 翻上去后被导航压住；现在翻上去就是 rect.top - 22 - height，位置由锚点决定。
  const safeTop = vw <= 640 ? NAV_SAFE_TOP_NARROW : NAV_SAFE_TOP;

  const below = rect.bottom + POPOVER_GAP;
  const above = rect.top - POPOVER_GAP - size.height;
  const spaceBelow = vh - rect.bottom - POPOVER_GAP - POPOVER_MARGIN;
  // spaceAbove 同样扣安全区：否则「上方更宽裕」会高估，翻上去之后又被钳回来。
  const spaceAbove = rect.top - POPOVER_GAP - safeTop;

  // 【翻转规则：选空间更大的一侧，保证一定放得下】
  // measurePopoverSize 已把高度压到 hMax = (vh - 186) / 2 以内，而
  //   spaceBelow + spaceAbove = (vh - y - 74) + (y - 112) = vh - 186 = 2 * hMax
  // 恒成立（两项的 y 相互抵消），所以 max(spaceBelow, spaceAbove) >= hMax >= height。
  // 也就是说【至少一侧一定放得下】，下面这个二选一必然命中，不需要任何兜底钳制。
  // 两边都用「相对锚点的绝对量」判断，不含 rect 自身位置，滚动不会让 side 抖动。
  let side;
  if (spaceBelow >= size.height) side = 'bottom';
  else if (spaceAbove >= size.height) side = 'top';
  // 退化分支：hMax 被 POPOVER_MIN_HEIGHT 抬到预算之上（极矮视口，如 844x390）。
  // 此时两侧都放不下，选空间更大的一侧，让溢出尽量少、且落在远离导航的一边。
  else side = spaceAbove > spaceBelow ? 'top' : 'bottom';

  // 纵向：直接贴边，不做任何钳制 —— 而且这里【不需要】钳制：
  //   side=bottom: top + height = rect.bottom + 22 + height <= vh - 12  （由 height <= spaceBelow 推出）
  //   side=top   : top         = rect.top - 22 - height >= 90 = safeTop （由 height <= spaceAbove 推出）
  // 两个不变量都是【构造性成立】的，不是事后断言。
  // 这也顺带保证了浮层永不覆盖锚点（间距恒为 22px），指针离开头像后不会掉进浮层，
  // 关闭链路才能正常工作 —— 这是本函数存在的根本理由，不要为了「塞进视口」再加回钳制。
  const top = side === 'bottom' ? below : above;

  // 水平：与锚点左边缘对齐，右侧出界时先尝试整体左移（仍保持 start 对齐语义），
  // 移不动再钳进视口。
  let left = rect.left;
  const maxLeft = vw - POPOVER_MARGIN - size.width;
  left = clampNum(left, POPOVER_MARGIN, Math.max(POPOVER_MARGIN, maxLeft));

  // align 只作视觉/调试标记：参考站是 start；横向钳制后如果和锚点左边缘差得明显，
  // 标记成 center，便于日后排查「弹层为什么没对齐」。
  const align = Math.abs(left - rect.left) > 1 ? 'center' : 'start';

  return {
    side,
    align,
    top: Math.round(top),
    left: Math.round(left),
    // 照片区实际可用高度（border-box 内除信息条与边框）。模板把它写进 max-height，
    // 让 CSS 与 JS 用同一个数字，避免「JS 以为放得下、CSS 却裁掉」的分裂。
    photoHeight: Math.max(0, Math.round(size.height) - POPOVER_FOOT_HEIGHT - 2),
  };
}

/** 按当前锚点重新定位（打开时、尺寸变化时调用 —— 会读布局，不要放进滚动路径）。 */
function positionPopover() {
  if (!activeCard.value || !popoverAnchor || !popoverAnchor.isConnected) return;
  const rect = popoverAnchor.getBoundingClientRect();
  Object.assign(popoverState, computePopoverPosition(rect, measurePopoverSize()));
  captureScrollBase();
}

/**
 * 记录「当前弹层位置」与「当前滚动位置」的对应关系。
 * 滚动跟随只需在这两个基准上做减法，不必再碰布局。
 */
function captureScrollBase() {
  anchorBaseTop = popoverState.top;
  anchorBaseLeft = popoverState.left;
  const page = pageRef.value;
  anchorBaseScrollTop = page ? page.scrollTop : 0;
  anchorBaseScrollLeft = page ? page.scrollLeft : 0;
  syncPopoverDom();
}

/**
 * 滚动事件入口：只记一个 rAF，真正的位移计算推迟到下一帧。
 * 同一帧里多次 scroll 只会写一次 style，避免无谓的重复渲染。
 */
function handleScrollChange() {
  if (!activeCard.value || !popoverAnchor) return;
  if (scrollShiftRaf) return;
  scrollShiftRaf = requestAnimationFrame(applyScrollShift);
}

/**
 * 按滚动增量平移弹层 —— 【纯算术，不读任何布局】。
 *
 * 锚点相对滚动容器静止，容器向上滚 delta 像素，锚点在视口里就上移 delta，
 * 弹层同理：top = 基准 top - delta。横向同理。
 *
 * 用 Math.round 与 computePopoverPosition 的取整保持一致，避免亚像素抖动。
 * 只在值真的变了才写，进一步减少无意义的响应式触发。
 */
function applyScrollShift() {
  scrollShiftRaf = 0;
  if (!activeCard.value || !popoverAnchor) return;
  const page = pageRef.value;
  const el = popoverRef.value;
  if (!page || !el) return;
  const nextTop = Math.round(anchorBaseTop - (page.scrollTop - anchorBaseScrollTop));
  const nextLeft = Math.round(anchorBaseLeft - (page.scrollLeft - anchorBaseScrollLeft));
  // 【窄屏同样逐像素跟随 —— 2026-10 修正】
  // 曾经这里有一行 `if (window.innerWidth <= 640) return;`，理由是「窄屏弹层近似模态，
  // 跟着滚会飘走、难以点按」。但源站实测（390x844 真机 UA，documentElement 滚动）
  // 窄屏同样是精确跟随：滚 60px 浮层 top 273→213、滚 120px→93、滚 200px→-107，
  // 位移恒等于滚动量，且允许浮层滚出视口顶部不做钳制。
  // 而不跟随会破坏「浮层永不覆盖锚点」这个不变量：浮层钉死在打开时的位置，
  // 锚点却随页面移动，实测 390x844 下向上滚 50px 锚点就撞进浮层内部
  // （浮层[503,832]、锚点[491,531]，重叠）。所以窄屏必须和桌面一样跟随。
  // 直接写 DOM，绕开 Vue 的响应式调度（见 scrollAppliedTop 的说明）。
  // 只在值真的变了才写；写的是 translate（不触发布局），见 writePopoverOffset。
  if (nextTop !== scrollAppliedTop || nextLeft !== scrollAppliedLeft) {
    scrollAppliedTop = nextTop;
    scrollAppliedLeft = nextLeft;
    writePopoverOffset(el, nextTop, nextLeft);
  }
}

/**
 * 把 popoverState 的位置同步到 DOM，并重置「已应用值」。
 *
 * 任何写了 popoverState 的地方（打开、resize、nextTick 校正）都必须调它，
 * 否则直接写 DOM 的值会和真相源失配 —— 那正是这类优化最容易埋的坑。
 */
function syncPopoverDom() {
  scrollAppliedTop = popoverState.top;
  scrollAppliedLeft = popoverState.left;
  const el = popoverRef.value;
  if (!el) return;
  writePopoverOffset(el, scrollAppliedTop, scrollAppliedLeft);
}

/** 当前是否处于 reduced-motion：动画要按参考站原值放行，但位移/缩放要去掉。 */
const prefersReducedMotion = () =>
  typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* --------------------------------------------------- 全局事件（成对管理） */

/**
 * 【为什么要这三个监听、为什么必须成对】
 *   - document click（捕获阶段）：点弹层外部关闭。用 pointerdown 不行 ——
 *     参考站和本项目都用 click 判定，触屏也能触发，且不会与按钮的 click 重复。
 *     这里用【捕获阶段】是为了在卡片自己的 @click.stop 生效前就拿到事件，
 *     再在 handleDocClick 里用 closest('.card-avatar') 排除头像本身
 *     （否则「点同一个头像关闭」会被误判成「点在外部」再被 toggle 打开一次）。
 *   - document keydown：Esc 关闭；Tab 时把焦点收进弹层（见 trapFocus）。
 *   - window scroll（capture: true）：滚动容器是 .pictorial-page 而不是 window，
 *     只有 capture 才能收到它的 scroll；不监听的话卡片滚动后弹层会留在原地、
 *     与锚点脱开（纵向已改成「跟锚点走」，所以这里必须每帧重算 top）。
 *     passive: true —— 监听器不调 preventDefault，滚动不会被拖慢。
 *   - window resize：重新算法尺寸与位置（也覆盖手机旋转）。
 *
 * 全部用【同一个函数引用】removeEventListener —— 匿名函数移除不掉，
 * 这是最常见的泄漏来源。组件卸载与每次关闭都会走 detachGlobalListeners()，
 * 该函数自身用 bound 标志保证幂等，重复调用不会重复移除或重复添加。
 */
let listenersBound = false;

function handleDocClick(e) {
  if (!activeCard.value) return;
  const target = e.target;
  if (!(target instanceof Element)) return;
  // 点在弹层内部：不关（弹层容器上还有 @click.stop 兜底）。
  if (popoverRef.value && popoverRef.value.contains(target)) return;
  // 点在任何一张卡的头像上：交给头像自己的 click（togglePreview）处理。
  // 不 return 的话会出现「先当外部关掉、再被同一个 click 打开」的双重切换。
  if (target.closest('.card-avatar')) return;
  closePreview();
}

function handleDocKeydown(e) {
  if (!activeCard.value) return;
  if (e.key === 'Escape' || e.key === 'Esc') {
    e.preventDefault();
    // 【顺序】必须在 closePreview() 之前取锚点：reduce 分支会同步把 hoverAnchorEl 置 null，
    // 放在后面会记下 null，等于没抑制（本轮真踩过，表现为 Esc 后 200ms 又弹回来）。
    escSuppressedAnchor = hoverAnchorEl;
    closePreview();
    return;
  }
  if (e.key === 'Tab') trapFocus(e);
}

/*
 * 视口变化分两类，代价完全不同，必须分开处理：
 *   - scroll：高频、每帧都有。走纯算术位移（handleScrollChange），零布局读取。
 *   - resize：低频（用户拖窗口 / 转屏）。必须重新量尺寸与锚点，走 positionPopover。
 * 早期两者共用 positionPopover，导致滚动帧里也在读 getBoundingClientRect，
 * 弹层打开时滚动明显掉帧（实测 TaskDuration 188ms vs 无弹层 39ms）。
 */
function handleResizeChange() {
  if (!activeCard.value) return;
  positionPopover();
}

/**
 * 窗口失焦（切到其它应用、点地址栏）：关闭预览。
 * 【为什么不留着】弹层是 position:fixed 贴着头像的临时预览，
 * 用户离开页面后回来，它要么已经过期、要么挡在别的内容前面。
 * 这里只是「顺手关掉」，不参与核心的三种关闭方式（头像 / 外部 / Esc）。
 */
function handleWindowBlur() {
  if (activeCard.value) closePreview();
}

function attachGlobalListeners() {
  if (listenersBound) return;
  listenersBound = true;
  document.addEventListener('click', handleDocClick, true);
  // 【capture 不能省】keydown 在按键时分「有焦点元素」与「无焦点元素」两条路径：
  // 后者（刚进页面、点过空白处后）只在【捕获阶段】可靠派发，冒泡阶段收不到。
  // 实测：同一时刻用 KeyboardEvent 派发能关，用真实按键关不掉 —— 就是漏在捕获阶段。
  document.addEventListener('keydown', handleDocKeydown, true);
  // scroll 走零布局的算术跟随；resize 才重新测量。
  window.addEventListener('scroll', handleScrollChange, { passive: true, capture: true });
  window.addEventListener('resize', handleResizeChange, { passive: true });
  window.addEventListener('mousemove', trackPointer, { passive: true });
  // 触摸滚动转发：见下方 forwardPopoverTouch 的说明。
  // passive: false —— 因为要 preventDefault 接管；只在浮层打开期间存在。
  document.addEventListener('touchstart', onPopoverTouchStart, { passive: true, capture: true });
  document.addEventListener('touchmove', onPopoverTouchMove, { passive: false, capture: true });
  document.addEventListener('touchend', onPopoverTouchEnd, { passive: true, capture: true });
  document.addEventListener('touchcancel', onPopoverTouchEnd, { passive: true, capture: true });
}

function detachGlobalListeners() {
  if (!listenersBound) return;
  listenersBound = false;
  // 取消排队中的滚动跟随，否则弹层已关闭还会写一次 popoverState。
  if (scrollShiftRaf) { cancelAnimationFrame(scrollShiftRaf); scrollShiftRaf = 0; }
  document.removeEventListener('click', handleDocClick, true);
  document.removeEventListener('keydown', handleDocKeydown, true);
  window.removeEventListener('scroll', handleScrollChange, { capture: true });
  window.removeEventListener('mousemove', trackPointer);
  window.removeEventListener('resize', handleResizeChange);
  document.removeEventListener('touchstart', onPopoverTouchStart, true);
  document.removeEventListener('touchmove', onPopoverTouchMove, true);
  document.removeEventListener('touchend', onPopoverTouchEnd, true);
  document.removeEventListener('touchcancel', onPopoverTouchEnd, true);
}

/**
 * 焦点管理（非模态预览卡）：
 *   【为什么不锁焦点】aria-modal="false" —— 这是参考站式的 popover，不是对话框。
 *   弹层里没有任何可交互元素，强行锁焦点只会让键盘用户 "Tab 进去出不来"。
 *   打开时焦点仍留在头像按钮上，用户可以继续 Tab 到下一张卡。
 *
 *   【但要防住一个真实的坑】弹层被设为 tabindex="-1" 以接受程序化焦点，
 *   若键盘用户 Shift+Tab 到它，焦点会落在一个没有出口的 div 上，
 *   之后的 Tab 还能出去（不会被困死），所以只需要在 keydown 里兜一次：
 *   焦点落在弹层自身时，按 Tab 直接跳回锚点。
 */
function trapFocus(e) {
  const el = popoverRef.value;
  if (!el || e.key !== 'Tab') return;
  if (e.target !== el) return;
  if (e.shiftKey) return;
  const anchor = popoverAnchor;
  if (anchor && anchor.isConnected) {
    e.preventDefault();
    anchor.focus({ preventScroll: true });
  }
}

/** 出场动画的兜底定时器（reduced-motion 下没有 animationend，或动画被禁用时用）。 */
let closeTimer = 0;

/** 取消出场兜底定时器（重复打开时不能让它把新弹层清掉）。 */
function clearCloseTimer() {
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = 0;
  }
}

/**
 * 打开弹层（只服务于 togglePreview：调用方已保证「同一时刻只有一个」——先 close 再 open）。
 *
 * @param {HTMLElement} anchor 被点的头像按钮
 * @param {object} card 卡片数据
 */
function openPreview(anchor, card) {
  closeProbeCount = 0;   // 新一轮悬停，重排计数归零
  clearCloseTimer();
  // 顺序：先关掉上一张（动画会走 closing，但新弹层直接替换 ref），再设置新锚点。
  activeCard.value = card;
  popoverAnchor = anchor;

  // 尺寸/位置必须在弹层【渲染前】算好并写进 style，
  // 否则会先以 top:0/left:0 出现在左上角再跳位（一帧可见的错位）。
  Object.assign(popoverState, computePopoverPosition(
    anchor.getBoundingClientRect(),
    measurePopoverSize()
  ));
  captureScrollBase();

  popoverAnim.value = 'opening';
  attachGlobalListeners();

  // 渲染后按弹层真实宽度再校正一次（只校正横向）：
  // 【高度绝不回填】高度由 measurePopoverSize 的预算解析算出，是权威值。
  // 若在这里用 el.offsetHeight 覆盖，量到的必然是已被 max-height 裁过的值，
  // 就形成棘轮效应（视口放大也长不回来）。横向则不同：宽度受 CSS 媒体查询影响，
  // 实测值更可靠，且宽度不参与预算推导，覆盖它是安全的。
  nextTick(() => {
    const el = popoverRef.value;
    // 判空之后再读尺寸（el 可能已因快速关闭/路由卸载而变 null）
    if (!el || !activeCard.value || !popoverAnchor || popoverAnim.value === 'closing') return;
    const rect = popoverAnchor.getBoundingClientRect();
    const size = measurePopoverSize();
    Object.assign(popoverState, computePopoverPosition(rect, {
      width: el.offsetWidth || size.width,
      height: size.height,
    }));
    // 校正后的位置才是后续滚动跟随的基准，必须重新记一次。
    captureScrollBase();
  });
}

/** 关闭弹层：先播出场动画（POPOVER_DURATION），再卸载 DOM 并解绑全局事件；reduce 下直接同步卸载。 */
function closePreview() {
  if (!activeCard.value) return;
  clearHoverTimers();  // 关闭时作废在途的悬停定时器，避免它把弹层重新打开
  // 【reduced-motion 必须同步卸载】全局规则把动画压成 animation: none !important，
  // 于是【永远不会触发 animationend】。而 onPopoverAnimEnd 是卸载 DOM 的唯一路径（
  // closeTimer 只是兜底，且同样依赖动画时长），所以这里不能指望事件：
  // 直接把 DOM 拆掉，绕开动画。否则 reduce 用户打开弹层后 Esc 关不掉，弹层会永久停留。
  if (prefersReducedMotion()) {
    detachGlobalListeners();
    clearCloseTimer();
    activeCard.value = null;
    popoverAnim.value = 'idle';
    popoverAnchor = null;
    hoverAnchorEl = null;
    return;
  }
  const anim = POPOVER_DURATION;
  popoverAnim.value = 'closing';
  detachGlobalListeners();
  clearCloseTimer();
  closeTimer = setTimeout(() => {
    closeTimer = 0;
    activeCard.value = null;
    popoverAnim.value = 'idle';
    popoverAnchor = null;
    hoverAnchorEl = null;
  }, anim);
}

/**
 * 头像点击：同一张卡再点一次 = 关闭；点另一张 = 切换（旧的先关）。
 * stopPropagation 防止触发卡片的其它点击行为，也防止 document 监听误判。
 */
/**
 * 悬停弹出资料卡（参考站是 HoverCard）
 * ----------------------------------------------------------------
 * 【为什么不用纯 CSS :hover】弹层 Teleport 到了 body，与头像不是父子关系，
 * CSS 选择器够不着；而且鼠标从头像移向弹层时要留出跨越空隙的时间，
 * 否则指针穿过 4~6px 的空档弹层就没了，用户根本点不到里面的按钮。
 * 所以用「进入延迟 + 离开宽限」两个定时器来模拟 HoverCard 的安全区。
 *
 * 【触发区】参考站实测只在「头像 + 作者名」这一块触发，不是整张卡片
 *（悬停卡片图片区 360,200 实测为 closed，悬停头像 347,409 为 open）。
 * 我方同样只绑在 .card-avatar 上，刻意不扩大到整卡：
 * 整卡悬停会让指针移向弹层的路径变短、更容易在空隙里超时，反而降低可用性。
 * 参考站实测：移入后约 255ms 出现、移出后约 224ms 关闭（Radix HoverCard 默认 700/300，
 * 参考站显式覆盖了这两个默认值）。我们照实测值取 255/224，让手感与参考站一致。
 */
const AVATAR_OPEN_DELAY = 255;   // 移入后多久弹出（参考站实测 255ms）
const AVATAR_CLOSE_DELAY = 224;  // 移出后多久关闭（参考站实测 224ms，留出移到弹层上的时间）

let hoverOpenTimer = 0;
let hoverCloseTimer = 0;

/** 当前资料卡的头像按钮（用来在关闭前判断指针是否还在头像附近）。 */
let hoverAnchorEl = null;
/**
 * Esc 关闭后抑制重开，但【只对被按 Esc 时所在的那个头像生效】。
 *
 * 为什么不用一个全局布尔：全局布尔要靠「一定有某次 mouseleave 发生」来解除，
 * 而键盘用户 Esc 后直接 Tab 到下一张头像时，下一次 onAvatarEnter 已经先于
 * 解除被执行，会白吞一次聚焦（审查发现）。改成记录锚点后，别的头像照常弹出，
 * 无需依赖任何离开事件即可自愈。
 */
let escSuppressedAnchor = null;
/** 最近一次指针位置，关闭前用它判断指针是否还在头像与弹层之间的空隙里。 */
let lastPointerX = 0;
let lastPointerY = 0;
/**
 * 是否真的收到过指针位置。
 * 【为什么需要】lastPointerX/Y 的初值是 0,0，而 inRect 有 8px 容差，
 * 于是「从未移动过指针」时，视口左上角 (-8..8) 会被误判成「指针还在头像里」，
 * 弹层就永远关不掉。触屏（只 tap 不 move）和纯键盘操作都会踩到。
 * 未知位置 = 按「已离开」处理，与 mouseleave 的直觉一致。
 */
let pointerKnown = false;

/**
 * 本轮「指针夹在头像与弹层之间」的重排次数。
 * 【为什么要有上限】若只按「指针还在空隙里」无限重排，指针停在缝隙中不动时
 * 定时器会永远每 220ms 重排一次（真机实测静止 3 秒创建 14 次），
 * 每次重排都是一次完整的再判定。上限 = 1 次首次判定 + CLOSE_PROBE_MAX 次重排 = 6 次 ≈ 1.4 秒
 * （实测验收：静止在空隙 3 秒内共创建 6 个 220ms 定时器，约 1.4 秒后自动关闭），之后强制关闭。
 */
let closeProbeCount = 0;
const CLOSE_PROBE_MAX = 5;

function clearHoverTimers() {
  if (hoverOpenTimer) { clearTimeout(hoverOpenTimer); hoverOpenTimer = 0; }
  if (hoverCloseTimer) { clearTimeout(hoverCloseTimer); hoverCloseTimer = 0; }
}

/** 指针进入头像（或键盘 focus）：延迟弹出。 */
function onAvatarEnter(e, card) {
  clearHoverTimers();
  const anchor = e && e.currentTarget;
  hoverAnchorEl = anchor;   // 关闭前要用它判断指针是否还在头像附近
  // 已经在显示同一张，不用重开（避免从弹层移回头像时反复重播入场动画）
  if (activeCard.value && activeCard.value.uid === card.uid) return;
  // 【Esc 抑制重开】Esc 关闭后，指针可能仍停在头像上。若此时再走延迟打开，
  // 用户按 Esc 就变成了「关掉又自己弹回来」。只有指针真正离开头像（onAvatarLeave）才解除抑制。
  if (escSuppressedAnchor && escSuppressedAnchor === anchor) return;
  hoverOpenTimer = setTimeout(() => {
    hoverOpenTimer = 0;
    clearCloseTimer();
    openPreview(anchor, card);
  }, AVATAR_OPEN_DELAY);
}

/** 指针进入弹层本体：取消关闭倒计时（安全区）。 */
function onCardEnter() {
  if (hoverCloseTimer) { clearTimeout(hoverCloseTimer); hoverCloseTimer = 0; }
  if (hoverOpenTimer) { clearTimeout(hoverOpenTimer); hoverOpenTimer = 0; }
}

/**
 * 把浮层上的滚轮转发给本页的滚动容器。
 *
 * 【为什么需要这一条】浮层用 Teleport 挂到了 body 下，而本页的滚动容器是
 * .pictorial-page（html/body 被全局 main.css 钉成 overflow:hidden，
 * 本页自己 height:100% + overflow-y:auto 当滚动容器）。
 * 滚轮事件沿 DOM 祖先链冒泡，浮层的祖先只有 body -> html，
 * 永远到不了 .pictorial-page —— 于是「鼠标停在浮层上滚轮完全没反应」。
 *
 * 参考站没有这个问题，是因为它整页就是 body 滚动（body 高 2717 > 视口）。
 * 我们为了不改全局样式才用了内部滚动容器，代价就是浮层必须手动补这一跳。
 *
 * 【不抢浮层自己的滚动】若浮层内部出现可滚动区域，交给它自己。
 *
 * 【必须 preventDefault（本轮修复的真实 BUG）】
 * 这里曾经刻意不加 preventDefault，理由是「html/body 被 main.css 钉成 overflow:hidden，
 * body 链上没有可滚容器，不可能双重滚动」。这个论证是错的，已被实测推翻：
 *   - 弹层 Teleport 到 body，祖先链是 .card-popover < body < html，链上确实没有滚动容器；
 *   - 但浏览器并不沿「祖先链」找滚动容器。wheel 的默认滚动作用于最近的可滚动祖先或视口，
 *     本页把 html/body 钉死、改用 .pictorial-page 当滚动容器后，Chrome 仍会把 wheel 的默认
 *     滚动作用到 .pictorial-page 上（它不在弹层祖先链上，却照样被滚）。
 *   - 于是「手动 page.scrollTop += deltaY」与「浏览器原生滚动」叠加，每格滚 2 倍。
 * 实测（1440x900，指针在头像 69,448，弹层打开，逐格 40px 滚轮）：
 *   原样                  逐格 40,40,40,40,80,80,80,80,...  ← 前 4 格 1x，之后突然变 2x
 *   弹层上 preventDefault  逐格 40 × 12 全一致，总位移 480px = 理论值
 *   scrollTop 写入追踪     每格只被 JS 写 1 次（写 80 从 40），说明多出来的一份来自原生滚动
 * 「前 4 格是 1x」并不是正常现象，而是滚动起步阶段的一次被取整/节流吃掉；
 * 正因为「一会 1x 一会 2x」，用户感知到的就是「页面移动一下一下、不平滑」。
 *
 * 【passive 的真实默认值】元素级 addEventListener 默认就是 passive:false
 * （只有 window/document/body 的 touchstart/touchmove/wheel 才默认 passive:true），
 * Vue 的 @wheel 也没加 .passive，所以这里的 preventDefault() 完全有效（实测已确认）。
 *
 * 【ctrl/⌘ 手势仍然让路】见函数体第一行：直接 return 让浏览器做缩放，不 preventDefault。
 *
 * 【为什么不做动量】CSSOM 平滑滚动无法跨元素组合 momentum，
 * 手工派发 wheel 事件合成动量在跨浏览器下不可靠；而滚动位移本身是线性的，
 * 手感与在页面其它地方滚动一致，没有做动量的必要。
 */
function onPopoverWheel(e) {
  // 【修饰键手势必须让回浏览器】Ctrl/⌘ + 滚轮是缩放，不是滚动。
  // 实测：按住 Ctrl 在浮层上滚 100，ctrlKey 为 true，但若照常转发页面就会滚 100，
  // 缩放被我们的假滚动盖掉。这里直接 return，让事件继续走浏览器默认行为。
  // 注意【不能】改成 preventDefault：那才会把缩放也一起吞掉。
  if (e.ctrlKey || e.metaKey) return;
  const page = pageRef.value;
  // isConnected：若本页被销毁重建，pageRef 可能还指着已脱离文档的旧 <main>，
  // 那种元素的 scrollHeight 恒为 0，会走到下面的判断里静默 return，滚轮彻底没反应。
  if (!page || !page.isConnected) return;
  // 浮层内部若有可滚动元素、且指针正停在它上面，优先让它自己滚。
  // 【为什么用 composedPath 而不是 currentTarget】currentTarget 恒为浮层本身，
  // 用了它就等于「只判断浮层自己」，子元素里的滚轮会被吞成页面位移；
  // 手搓的 delta 不会触发子元素的原生滚动，子元素会纹丝不动。
  // 【为什么要判 overflow 而不只看 scrollHeight】
  // 只比 scrollHeight/clientHeight 判的是「内容是否溢出」，不是「是否真能滚」。
  // 若将来浮层里加一个内容略溢出、却用 overflow:hidden 裁掉的装饰元素，
  // 这条会误 return，滚轮在浮层上静默失效（失败方向是「不滚」，比双倍更难排查）。
  // 所以额外要求该元素的计算样式 overflow-y 确实是 auto/scroll。
  for (const node of e.composedPath()) {
    if (node === e.currentTarget) break;   // 走到浮层就停，不往 body 看
    if (node && typeof node.scrollHeight === 'number'
        && node.scrollHeight > node.clientHeight + 1) {
      const cs = getComputedStyle(node);
      if (cs && /auto|scroll/.test(cs.overflowY)) return;
    }
  }
  if (page.scrollHeight <= page.clientHeight + 1) return;
  // 【关键】必须拦住浏览器默认滚动，否则会和下面的手动赋值叠加成 2 倍速。
  // 走到这里说明：没有修饰键、页面确实可滚、弹层内部也没有该自己滚的子元素，
  // 这一格滚轮的滚动完全由本函数负责，拦下来是安全的。
  // cancelable 为 false 时不调，避免无意义的控制台告警。
  if (e.cancelable) e.preventDefault();
  // 【deltaMode 必须归一化 —— 否则 Firefox 上几乎滚不动】
  // wheel 的 deltaY 单位由 deltaMode 决定：
  //   0 = DOM_DELTA_PIXEL（Chrome/Edge/Windows 常见，deltaY 约 ±40 或 ±100）
  //   1 = DOM_DELTA_LINE（Firefox 鼠标滚轮，deltaY 约 ±3，单位是「行」）
  //   2 = DOM_DELTA_PAGE（少见，单位是「页」）
  // 不加 preventDefault 时浏览器原生滚动会替我们做行->像素换算，
  // 所以旧代码「看起来」正常；一旦改由本函数独家负责滚动，
  // 就必须自己换算，否则 Firefox 每格只滚 3px（比原来更难用）。
  // 16 是各浏览器默认行高（约 1em）的通行近似值。
  const unit = e.deltaMode === 1 ? 16 : (e.deltaMode === 2 ? page.clientHeight : 1);
  page.scrollTop += e.deltaY * unit;
  page.scrollLeft += e.deltaX * unit;
}

/*
 * 触摸滚动转发（手机端「手指在弹层上滑动没反应」的修复）
 * ================================================================
 * 【问题】点开头像后手指落在预览浮层上滑动，页面完全不动（实测位移 0px）。
 * 【根因】浮层是 position: fixed 且 Teleport 到 body，它的祖先链是
 *         .card-popover -> body -> html，里面【没有任何可滚动容器】——
 *         真正能滚的 .pictorial-page 是它的兄弟节点的后代，不在链上。
 *         浏览器做触摸滚动时会沿祖先链找 scroll container，找不到就丢弃手势。
 *         已实测排除：touchmove 全部 defaultPrevented === false（没人拦）、
 *         .pictorial-page 的 scrollHeight(3369) > clientHeight(844)（容器本身正常）。
 *         所以改 touch-action / overflow 都没用，必须【自己把位移转发给容器】。
 * 【做法】与桌面端的 onPopoverWheel 同源：手搓位移写给 page.scrollTop。
 *         区别是触摸要 preventDefault 掉原生行为（否则 iOS 会当页面滚动处理），
 *         且必须在 touchmove 里逐帧累加 —— 触摸没有 wheel 那样的离散 delta。
 * 【只转发落在浮层上的手势】起点不在浮层里（比如点在页面空白处）时完全不介入，
 *   交给浏览器原生滚动，保留惯性/回弹的原生手感。
 */
let touchScrolling = false;
let touchLastY = 0;
let touchLastX = 0;

function onPopoverTouchStart(e) {
  touchScrolling = false;
  const pop = popoverRef.value;
  // 浮层没开、或是多指手势（双指缩放等）一律不接管。
  if (!pop || !pop.isConnected || e.touches.length !== 1) return;
  const t = e.touches[0];
  // 起点必须落在浮层内：用 composedPath 判断，浮层是 fixed 元素，points inside 才算。
  const inside = typeof e.composedPath === 'function' && e.composedPath().includes(pop);
  if (!inside) return;
  touchScrolling = true;
  touchLastY = t.clientY;
  touchLastX = t.clientX;
}

function onPopoverTouchMove(e) {
  if (!touchScrolling) return;
  if (e.touches.length !== 1) { touchScrolling = false; return; }
  const page = pageRef.value;
  if (!page || !page.isConnected) return;
  const t = e.touches[0];
  const dy = touchLastY - t.clientY;
  const dx = touchLastX - t.clientX;
  touchLastY = t.clientY;
  touchLastX = t.clientX;
  // preventDefault 必须在【非 passive】监听器里调用；本监听器已声明 passive:false。
  // 不拦的话 iOS 会把它当作页面级滚动，同时触发下拉刷新/回弹。
  if (e.cancelable) e.preventDefault();
  page.scrollTop += dy;
  page.scrollLeft += dx;
}

function onPopoverTouchEnd() {
  touchScrolling = false;
}

/**
 * 指针离开头像或弹层：宽限后关闭。
 *
 * 【viaBlur 的意义】键盘用户 Tab 过一张卡时，焦点会移走触发 blur，
 * 但他们没法把指针移进弹层去接住，安全区对他们不存在。
 * 若 blur 也走 220ms 延迟关闭，键盘用户看到的只是弹层一闪而过。
 * 所以 blur 走独立分支：只在焦点既不在头像也不在弹层里时才关。
 */
function onAvatarLeave(viaBlur = false) {
  // 指针离开头像/弹层即解除 Esc 抑制，下次悬停恢复正常弹出
  escSuppressedAnchor = null;
  // 只认严格的 true：@mouseleave="onAvatarLeave" 这种写法会把 MouseEvent
  // 当参数传进来，事件对象是 truthy，会被误判成 blur 分支（本轮真踩过）。
  const isBlur = viaBlur === true;
  if (hoverOpenTimer) { clearTimeout(hoverOpenTimer); hoverOpenTimer = 0; }
  if (hoverCloseTimer) { clearTimeout(hoverCloseTimer); hoverCloseTimer = 0; }

  if (isBlur) {
    // 焦点从头像移到别处（但不是移进弹层）：立即关。
    // 若焦点是移进弹层内部（Tab 到按钮），保持打开。
    // 存进 hoverCloseTimer 统一清理：组件若在同一帧内卸载，回调执行时已无 popover，
    // 不加跟踪就成了一个游离定时器（虽然 closePreview 幂等、不会崩，但违反「不留异步尾巴」）。
    hoverCloseTimer = setTimeout(() => {
      hoverCloseTimer = 0;
      const pop = popoverRef.value;
      const focused = document.activeElement;
      if (pop && focused && pop.contains(focused)) return;
      closePreview();
    }, 0);
    return;
  }

  hoverCloseTimer = setTimeout(() => {
    hoverCloseTimer = 0;
    maybeCloseByPointer();
  }, AVATAR_CLOSE_DELAY);
}

/**
 * 关闭倒计时到点时的最后一道判断：指针是不是真的离开了？
 *
 * 【为什么不能只靠 mouseleave】头像与弹层之间有 POPOVER_GAP(22px) 的空隙。
 * 鼠标逐点移动时，中间那几帧会命中卡片背景，于是先触发头像的 mouseleave；
 * 如果直接信它，用户还没碰到弹层就已经开始倒计时，指针稍慢一点弹层就没了。
 * 真机实测：16px 间隙、3 次 mouse.move 后弹层在 y=480 就消失了（弹层从 y=484 才开始）。
 *
 * 所以这里用真实指针坐标再判一次：只要指针还在「头像矩形」或「弹层矩形」里
 * （含 8px 容差，覆盖亚像素与鼠标抖动），就不关，并重新排一次倒计时继续观察。
 */
function maybeCloseByPointer() {
  if (!activeCard.value) return;

  // 从未收到过指针位置：按「已离开」处理（见 pointerKnown 注释）
  if (!pointerKnown) {
    closePreview();
    return;
  }

  const pad = 8;
  const inRect = (r, x, y) => r && x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;

  const pop = popoverRef.value;
  if (pop && inRect(pop.getBoundingClientRect(), lastPointerX, lastPointerY)) {
    closeProbeCount = 0;
    return;
  }
  if (hoverAnchorEl && hoverAnchorEl.isConnected && inRect(hoverAnchorEl.getBoundingClientRect(), lastPointerX, lastPointerY)) {
    closeProbeCount = 0;
    return;
  }

  // 指针还在「卡片 ↔ 弹层」之间时，视为正在穿越，不算离开。
  // 【为什么用凸包而不是只判垂直条带】弹层紧贴头像右侧渲染（实测弹层 x=46~366、
  // 头像 x=49~89，两者横向几乎重叠），指针从卡片任意位置斜向移进弹层时，
  // 中间帧可能落在卡片的左下方或右上方，只判「头像与弹层之间的垂直条带」会漏掉这些点，
  // 于是还没走到弹层就倒计时到点（这是本轮实测到的关闭过早问题）。
  // 凸包（外接矩形）能覆盖卡片与弹层之间的全部过渡区域，且两个矩形之外的任意一点必然已离开。
  if (pop && hoverAnchorEl && hoverAnchorEl.isConnected) {
    const pr = pop.getBoundingClientRect();
    const ar = hoverAnchorEl.getBoundingClientRect();
    const hull = {
      left: Math.min(pr.left, ar.left),
      right: Math.max(pr.right, ar.right),
      top: Math.min(pr.top, ar.top),
      bottom: Math.max(pr.bottom, ar.bottom),
    };
    if (inRect(hull, lastPointerX, lastPointerY) && closeProbeCount < CLOSE_PROBE_MAX) {
      closeProbeCount++;
      hoverCloseTimer = setTimeout(() => {
        hoverCloseTimer = 0;
        maybeCloseByPointer();
      }, AVATAR_CLOSE_DELAY);
      return;
    }
  }

  closeProbeCount = 0;
  closePreview();
}
/** 全局记录指针位置（只在资料卡打开期间需要，开销极小）。 */
function trackPointer(e) {
  pointerKnown = true;
  lastPointerX = e.clientX;
  lastPointerY = e.clientY;
}

/**
 * 资料卡里的「查看大图」：关闭资料卡，打开全屏大图。
 *
 * 【为什么必须先关掉资料卡】两者都是 position:fixed 的浮层，同时存在会叠在
 * 一起，而且资料卡的「点外部关闭」监听会把大图上的点击误判成外部点击。
 */
function openViewerFromCard(card) {
  clearHoverTimers();
  closePreview();
  openViewer(card);
}

/** 打开大图。记录来源焦点，关闭时还原。 */
function openViewer(card) {
  if (!card) return;
  viewerReturnFocus = document.activeElement;
  viewerCard.value = card;
  nextTick(() => {
    if (viewerRef.value) viewerRef.value.focus();
  });
}

/** 关闭大图。 */
function closeViewer() {
  const back = viewerReturnFocus;
  viewerReturnFocus = null;
  viewerCard.value = null;
  if (back && typeof back.focus === 'function' && back.isConnected) back.focus();
}

/** 点遮罩关闭（只有点在层本身、不是点在图片或按钮上时才关）。 */
function onViewerBackdropClick(e) {
  if (e.target === e.currentTarget) closeViewer();
}

const onViewerImgError = () => {
  /* 大图 404 时浏览器会显示裂图。这里不额外处理：
     full/ 与 thumbnails/ 同一批生成，失败只可能是部署漏了 public/images/full，
     显示裂图反而比静默消失更容易被发现问题。 */
};

function togglePreview(e, card) {
  if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
  const anchor = e && e.currentTarget;
  if (activeCard.value && activeCard.value.uid === card.uid) {
    closePreview();
    return;
  }
  // 上一张还在 closing 的定时器里，先取消它的卸载，避免它把新弹层清掉。
  clearCloseTimer();
  openPreview(anchor, card);
}

/** 出场动画结束：立刻卸载，比等定时器更快。 */
const onPopoverAnimEnd = (e) => {
  if (e.target !== popoverRef.value) return;
  if (popoverAnim.value !== 'closing') return;
  clearCloseTimer();
  activeCard.value = null;
  popoverAnim.value = 'idle';
  popoverAnchor = null;
  hoverAnchorEl = null;
};

/**
 * 大图加载完 / 失败：
 *   - 加载完：图片真实长宽比可能与清单略有出入，重新定位一次（尺寸规则是
 *     「宽铺满、高度按宽高比」由清单比例算出来已经够准，这里是最后一层保险；
 *     重算位置时纵向依然贴锚点，不会因为高度变化而被钳回视口）。
 *   - 失败：不显示破图。记录一次并在弹层里给出降级文案 —— 但本项目 full/
 *     与 thumbnails/ 同一批生成，失败通常意味着部署漏了 public/images/full。
 */

/** 出场动画时长（ms），与 CSS 的 300ms 保持一致。 */
const POPOVER_DURATION = 300;

// 首屏同步布局：在 setup 阶段就把列填好，模板第一次渲染即有卡片。
columns.value = assignColumns(columnCount.value);
</script>

<style scoped>

/* ================================================================
   大图查看层
   ----------------------------------------------------------------
   没有照参考站做横向 carousel + 信息面板：本项目的每张照片是独立的，
   不是一篇文章的多图，所以只做「看这一张」的语义，配 ESC / 点空白关闭。
   ================================================================ */
.photo-viewer {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  box-sizing: border-box;
  background: rgba(8, 8, 12, 0.82);
  backdrop-filter: blur(15px) saturate(1.2);
  animation: viewerFadeIn 220ms ease both;
  cursor: zoom-out;
}

.photo-viewer:focus {
  outline: none;
}

.photo-viewer-figure {
  margin: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  max-width: 100%;
  max-height: 100%;
  cursor: default;
  animation: viewerZoomIn 260ms cubic-bezier(0.23, 1, 0.32, 1) both;
}

/* 图片自适应：宽高都不超过可视区的 78vh / 100%，保持原始比例。
   object-fit: contain 是必须的 —— 1600px 的长图在矮屏下要缩到能完整看见，
   cover 会把两侧裁掉。 */
.photo-viewer-figure img {
  display: block;
  max-width: 100%;
  max-height: 78vh;
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 12px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.6);
  background: rgba(255, 255, 255, 0.04);
}

.photo-viewer-cap {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
}

.photo-viewer-no {
  font-weight: 700;
  letter-spacing: 0.08em;
  font-variant-numeric: tabular-nums;
  color: #a3e635;
}

.photo-viewer-hint {
  color: rgba(255, 255, 255, 0.4);
}

.photo-viewer-close {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  padding: 0;
  border-radius: 9999px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(20, 20, 28, 0.7);
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.photo-viewer-close:hover {
  background: rgba(40, 40, 52, 0.9);
  border-color: rgba(255, 255, 255, 0.35);
}

.photo-viewer-close:focus-visible {
  outline: 2px solid #a3e635;
  outline-offset: 2px;
}

@keyframes viewerFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes viewerZoomIn {
  from { opacity: 0; transform: scale(0.94); }
  to { opacity: 1; transform: scale(1); }
}

/* ================================================================
   画报页样式
   ----------------------------------------------------------------
   ⚠️ @keyframes 是全局命名空间，scoped 不隔离它。
   项目里已有 ptr-*（main.css）与 cinema*（Cinema.vue），
   这里统一用 card / pictorial 前缀：cardEnterBlurReveal、cardSheenSweep。
   规格 2.11 写的 postEnterBlurReveal 不带前缀，按规格第 5.2 条改名。
   ================================================================ */

/* ---------------- 背景层 ---------------- */
/* 参考站的背景图是它自己的 mos-background-1920.webp，本项目没有这张图，
   按规格第 2.9 条改为纯深色（与 main.css 的 --bg 一致）+ 扫描线。 */
.site-bg {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: -1;
  background-color: #0d0d0d;
  background-size: cover;
  background-position: center center;
  background-repeat: no-repeat;
}

.scanlines {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, 0.15),
    rgba(0, 0, 0, 0.15) 2px,
    rgba(0, 0, 0, 0.03) 2px,
    rgba(0, 0, 0, 0.03) 4px
  );
}

/* ---------------- 页面骨架 ----------------
   #app 在 App.vue 里是 overflow:hidden、height:100%，全局 main.css 也把
   html/body 的 overflow 钉死成 hidden。所以本页自己当滚动容器：
   height:100% + overflow-y:auto。这样不必改全局样式，
   也不会把 body 的滚动条（已被全局隐藏）搅进来。 */
.pictorial-page {
  --pictorial-accent: #a3e635;

  position: relative;
  z-index: 1;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  /* 给固定导航让位：NavBar top:20 + height:60 = 80，这里留 16px 呼吸 */
  padding-top: 96px;
  overflow-x: hidden;
  overflow-y: auto;
  /* 滚到顶/底时不要把滚动链传给 body（body 不滚，传过去只会产生橡皮筋） */
  overscroll-behavior-y: contain;
}

.pictorial-inner {
  box-sizing: border-box;
  width: 100%;
  max-width: 2200px;
  margin: 0 auto;
  padding: 2rem 2rem 5rem;
}

/* 只给读屏用的文本 */
.pictorial-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  border: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
}

/* ---------------- 标签胶囊 ---------------- */
.pictorial-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.pictorial-tab {
  border: 1px solid transparent;
  border-radius: 9999px;
  padding: 6px 16px;
  font-size: 14px;
  font-family: inherit;
  background: transparent;
  color: inherit;
  cursor: pointer;
  transition: background-color 0.25s ease, color 0.25s ease, border-color 0.25s ease;
}

.pictorial-tab.is-active {
  font-weight: 600;
  background: rgba(255, 255, 255, 0.9);
  color: #000;
}

.pictorial-tab:not(.is-active) {
  font-weight: 400;
  color: rgba(255, 255, 255, 0.5);
}

.pictorial-tab:not(.is-active):hover {
  color: rgba(255, 255, 255, 0.8);
  border-color: rgba(255, 255, 255, 0.16);
}

.pictorial-tab[aria-disabled='true'] {
  cursor: not-allowed;
}

/* 主题色：青柠 #a3e635。参考站玻璃卡片的光泽扫过（规格 2.4 的
   rgba(190,242,99,.12)）本身就是这个色相，这里把它提为板块主色，
   与首页紫 #8b6ce8 / 照片墙蓝 #4a9eff / 影院金 #e4bb38 都能区分。 */
.pictorial-page :focus-visible {
  outline-color: var(--pictorial-accent);
}

/* ---------------- 瀑布流 ---------------- */
.masonry-grid {
  display: flex;
  align-items: flex-start;
  width: auto;
  margin-left: -1rem;
}

.masonry-column {
  /* 规格只给了 padding-left；等宽列需要 flex 撑开，否则列宽由内容决定。
     flex-basis:0 + min-width:0：每列内容宽 = (网格宽 - 5×1rem) / 5，
     1440px 视口下正好 262.4px，与规格第 2.1 条的实测 262.391px 吻合。 */
  flex: 1 1 0;
  min-width: 0;
  padding-left: 1rem;
  background-clip: padding-box;
}

.masonry-column > .card-shell {
  margin-bottom: 1rem;
}

/* ---------------- 卡片外壳 ---------------- */
.card-shell {
  position: relative;
  width: 100%;
  height: auto;
  contain: layout style;
  /* 入场前的初始态（规格 2.11）。is-visible 由 IntersectionObserver 打上。 */
  opacity: 0;
  filter: blur(24px);
  transform: translateY(20px);
  transition: transform 0.45s cubic-bezier(0.23, 1, 0.32, 1);
}

/* ⚠️ 顺序有意义：这条必须写在下面的 :hover 规则【之前】。
   两者优先级相同（0,2,0），后写的胜出，否则入场结束后 hover 位移会失效。 */
.card-shell.is-visible {
  opacity: 1;
  filter: none;
  transform: none;
  animation: cardEnterBlurReveal 1.1s cubic-bezier(0.23, 1, 0.32, 1) var(--card-delay, 0ms) backwards;
}

/* 已经播过入场动画、因跨断点被重建的卡片：直接显示，不再重播。
   必须写在 .is-visible 之后才能覆盖它的 animation。 */
.card-shell.is-visible.is-settled {
  animation: none;
}

@keyframes cardEnterBlurReveal {
  from {
    opacity: 0;
    filter: blur(24px);
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    filter: none;
    transform: none;
  }
}

/* 触屏没有真悬停：不加这层门控，移动端点过卡片会留下"粘住的"抬升态。 */
@media (hover: hover) and (pointer: fine) {
  .card-shell:hover {
    transform: translateY(-10px) scale(1.05);
    z-index: 20;
  }
}

/*
 * 倾斜/视差层。逐字对应参考站的 .post-card-tilt。
 *
 * 静止时只有位置与过渡声明，不写 transform —— 由脚本在指针进入时通过
 * 6 个自定义属性驱动，离开时脚本会把属性逐个 removeProperty 掉，
 * 这里靠 var() 的默认值 0deg/0 回落到平面。
 *
 * 两段过渡时长不同，这是参考站的原样设计：
 *   .card-tilt            0.45s  (指针离开后平滑回正)
 *   .card-tilt.is-tilting 0.12s  (跟随指针，短才能跟手)
 */
.card-tilt {
  position: relative;
  transition:
    transform 0.45s cubic-bezier(0.23, 1, 0.32, 1),
    box-shadow 0.45s cubic-bezier(0.23, 1, 0.32, 1);
}

/*
 * 参考站把这条包在 @media (hover: hover) and (pointer: fine) 里，
 * 触摸设备不会有倾斜态（脚本里 tiltEnabled 也会把它关掉，这里是双保险）。
 */
@media (hover: hover) and (pointer: fine) {
  .card-tilt.is-tilting {
    transform: perspective(1000px) rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg));
    transition:
      transform 0.12s ease-out,
      box-shadow 0.12s ease-out;
    will-change: transform;
    border-radius: 24px;
    /* 投影跟着倾斜方向反向偏移，制造「卡片被抬起」的体积感。 */
    box-shadow: var(--tilt-shadow-x, 0) var(--tilt-shadow-y, 0) 22px rgba(0, 0, 20, 0.3);
  }
}

/*
 * 倾斜时图片反向视差 + 放大到 1.1，比普通 hover 的 1.08 更强，产生景深。
 *
 * 【选择器方向：真实 DOM 是 .card-tilt > .card-glass > .card-media > img】
 * 曾经写成 `.card-glass:hover .card-tilt.is-tilting ...`（把两者写反），
 * 那个选择器永远匹配不到任何元素，导致视差完全不生效。
 * 下面第 1940 行的 `.card-glass:hover .card-media img { transform: scale(1.08) }`
 * 与本规则原本的特异性完全相同（都是 0,3,1），而它在样式表里出现得更靠后，
 * 同特异性时后者胜出 —— 结果就是视差的 translate 被整个覆盖掉，只剩 1.08。
 * 实测：悬停到卡片四角时 --card-par-x/y 确实有值（非 0），但图片的
 * computed transform 恒为 matrix(1.08,0,0,1.08,0,0)，translate 一直是 0。
 * 这里把选择器加到 0,4,1 以确保倾斜态永远压过普通 hover。
 */
@media (hover: hover) and (pointer: fine) {
  .card-tilt.is-tilting .card-glass:hover .card-media img,
  .card-tilt.is-tilting .card-media img {
    transform: translate3d(var(--card-par-x, 0), var(--card-par-y, 0), 0) scale(1.1);
    transition: transform 0.15s ease-out;
  }
}

/* ---------------- 玻璃卡片 ---------------- */
/*
 * 【最终结论：刻意不使用 backdrop-filter —— 这是帧率的唯一瓶颈】
 *
 * 参考站的 .glass-card 用了 backdrop-filter: blur(20px) saturate(1.4)。
 * 照抄它会让「鼠标在卡面上移动」变成一顿一顿的，根因已由严格的单变量
 * 对照实验确认（同一张卡、同一台机器、同样的页面内 125Hz 圆周轨迹，
 * 只开关滤镜，各测 2 秒 rAF 帧间隔）：
 *
 *   A. 有 backdrop-filter   25fps  帧间隔 40.0ms  每帧倾角跳变中位 1.52°
 *   B. 去掉 backdrop-filter 60fps  帧间隔 16.7ms  每帧倾角跳变中位 0.61°
 *   C. 恢复（复核）          24fps  帧间隔 41.5ms  每帧倾角跳变中位 1.64°
 *   D. 去掉 will-change      25fps  帧间隔 39.9ms  每帧倾角跳变中位 1.53°
 *
 * 机制：卡片倾斜时包围盒每帧都在变，浏览器必须每帧对卡片背后的整块
 * 背景重新采样并重做高斯模糊，这笔开销直接把帧率砍到 25fps。
 * 帧率低 -> 每帧倾角跨度大 -> 视觉上就是「台阶」而不是连续运动。
 *
 * 【教训】早前那次「A/B/C/D/E 五组全是 60fps」的对照实验是无效的：
 * 那五组并没有真正让指针在卡面上持续移动，测到的多是静止帧率，
 * 所以全部读数满帧，错误地推翻了正确的结论。判断帧率问题必须让
 * 指针真的在动，且每次只改一个变量。
 *
 * 参考站自己也卡（实测 15-20fps，静止时都只有 20-25fps），所以
 * 「完全照抄」= 「和它一样卡」。这里选择保留玻璃的观感、放弃真实模糊：
 * 用一个足够深的半透明实底模拟玻璃，视觉上几乎无差别，
 * 但不再有每帧重采样模糊的开销。
 */
.card-glass {
  position: relative;
  width: 100%;
  height: auto;
  border-radius: 24px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: rgba(0, 0, 0, 0.2) 0 8px 32px;
  /*
   * 半透明实底替代 backdrop-filter（详见上方注释）。
   * 参考站的 0.38 是在「有模糊」前提下的透明度；没有模糊时 0.38 太透，
   * 背后的内容会盖过卡片本身，所以提高到 0.72 保持同样的视觉密度。
   */
  background: rgba(22, 22, 32, 0.72);
  transition:
    background-color 0.4s cubic-bezier(0.23, 1, 0.32, 1),
    border-color 0.4s cubic-bezier(0.23, 1, 0.32, 1),
    box-shadow 0.4s cubic-bezier(0.23, 1, 0.32, 1);
}

.card-glass:hover {
  /* 与静止态同步提高不透明度，保持悬停时「微微变亮」的层次 */
  background: rgba(34, 34, 46, 0.8);
  border-color: rgba(255, 255, 255, 0.2);
  box-shadow:
    rgba(0, 0, 0, 0.4) 0 16px 48px,
    rgba(255, 255, 255, 0.1) 0 0 20px,
    rgba(255, 255, 255, 0.15) 0 1px 0 inset;
}

/* 光泽扫过（规格 2.4）：一条 115deg 的斜向高光，中间掺青柠色 */
.card-glass::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  background: linear-gradient(
    115deg,
    transparent 38%,
    rgba(255, 255, 255, 0.16) 47%,
    rgba(190, 242, 99, 0.12) 53%,
    transparent 62%
  );
  transform: translateX(-130%);
  opacity: 0;
}

/* 顶部高光线（规格 2.5） */
.card-glass::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  opacity: 0;
  transition: opacity 0.3s;
}

.card-glass:hover::after {
  opacity: 1;
}

@media (hover: hover) and (pointer: fine) {
  .card-glass:hover::before {
    animation: cardSheenSweep 0.9s cubic-bezier(0.23, 1, 0.32, 1) 1;
  }
}

/* 参考站没在可读样式表里暴露这条 keyframes，按规格给的语义补 */
@keyframes cardSheenSweep {
  0% {
    transform: translateX(-130%);
    opacity: 0;
  }
  30% {
    opacity: 1;
  }
  100% {
    transform: translateX(130%);
    opacity: 0;
  }
}

/* ---------------- 图片区 ---------------- */
.card-media {
  position: relative;
  overflow: hidden;
  /* 参考站 .image-glow 的 contain 是 content */
  contain: content;
  aspect-ratio: 1 / 1;
  background: transparent;
  border-radius: 14px 14px 0 0;
}

.card-media img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  /*
   * 参考站：position absolute + inset 0 + overflow clip，
   * 静止过渡是 transform 0.6s cubic-bezier(.23,1,.32,1)（不是 0.5s）。
   * 倾斜/悬停时再切成 0.15s ease-out。
   */
  position: absolute;
  inset: 0;
  overflow: clip;
  transition: transform 0.6s cubic-bezier(0.23, 1, 0.32, 1);
}

/* 参考站原文就包在媒体查询里，且值是 1.08。 */
@media (hover: hover) and (pointer: fine) {
  .card-glass:hover .card-media img {
    /*
     * 参考站是 1.08。
     * 倾斜态要覆盖成 1.1，但本规则特异性 0,3,1 且位置更靠后，
     * 所以倾斜态那条必须写成 0,4,1 才能赢 —— 见上面 .card-tilt.is-tilting 的注释。
     */
    transform: scale(1.08);
  }
}

/* 底部渐变遮罩：让上浮的作者行与图片底部之间有过渡，不至于硬切 */
.card-media-fade {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(
    to bottom,
    transparent 30%,
    rgba(18, 13, 30, 0.45) 56%,
    rgba(18, 13, 30, 0.65) 84%,
    rgba(13, 10, 24, 0.8) 100%
  );
}

/* ---------------- 作者行 ---------------- */
.card-author {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0 1rem;
  /* 上浮盖住图片底部（规格 2.7） */
  margin-top: -1.25rem;
}

/* 头像：<button class="card-avatar"> 包一个圆形 img。
   按钮本身必须【完全透明且去掉原生外观】，否则浏览器默认的灰底/内边距/焦点框
   会把 40px 的圆形头像撑成一块方块；尺寸与布局语义与原 <img> 保持一致，
   卡片的总高度（贪心分配用的实测值）因此不会变。 */
.card-avatar {
  display: block;
  flex: 0 0 auto;
  width: 2.5rem;
  height: 2.5rem;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 9999px;
  background: none;
  color: inherit;
  font: inherit;
  line-height: 0;
  cursor: pointer;
  /* 头像悬停会等比放大 1.15 并旋转 10deg，超出圆形的部分不能撑出滚动条 */
  -webkit-tap-highlight-color: transparent;
}

.card-avatar img {
  display: block;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 9999px;
  object-fit: cover;
  border: 2px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  cursor: pointer;
}

.card-avatar:hover img,
.card-avatar:focus-visible img {
  transform: scale(1.15) rotate(10deg);
}

/* 键盘焦点环：跟随圆形轮廓（全局 :focus-visible 是矩形描边，落在按钮上会是个方框）。
   不用 outline:none 一刀切，只是把描边改圆。 */
.card-avatar:focus-visible {
  outline: 2px solid var(--pictorial-accent);
  outline-offset: 3px;
  border-radius: 9999px;
}

/* 弹层打开时，对应头像保持放大态，让「这个弹层属于谁」一目了然 */
.card-avatar[aria-expanded='true'] img {
  transform: scale(1.15) rotate(10deg);
}

.card-author span {
  position: relative;
  top: 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #fff;
}

.card-divider {
  margin: 0.625rem 1rem 0;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

/* ---------------- 正文区 ---------------- */
.card-body {
  padding: 0.25rem 0.5rem;
}

.card-body-inner {
  padding: 0.5rem 0.75rem 0.5rem 0.5rem;
}

/* .card-title 规则已随模板里的 <h2 class="card-title">写真</h2> 一并删除。
   正文区现在第一行就是互动图标那一行；.card-body-inner 的 padding-top（0.5rem）
   保留，否则图标会贴到分隔线上。 */

.card-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-bottom: 0.5rem;
  gap: 0.25rem;
}

.card-action {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  /* 规格给的组间距只有 0.25rem，三组图标会挤在一起；
     用内边距把视觉间距撑到约 12px，同时不改规格里的 gap 值。 */
  padding: 0 0.25rem;
  color: rgba(255, 255, 255, 0.55);
}

.card-action-count {
  font-size: 0.75rem;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}


/* ================================================================
   照片预览弹层（Teleport 到 body，见模板注释）
   ----------------------------------------------------------------
   以下数值【逐条照搬】参考站 popover 的计算样式（真 Chrome 实测）：
     宽 288px / border-radius 16px / background rgba(20,20,28,.55)
     border 1px solid rgba(255,255,255,.15)
     box-shadow 0 24px 64px rgba(0,0,0,.5)
     backdrop-filter blur(24px) saturate(1.5) / overflow hidden
     出现在锚点下方、左对齐（data-side=bottom / data-align=start），间距 22px
    300ms 淡入 + scale .95→1 + 从顶部滑入 8px，曲线 cubic-bezier(.16,1,.3,1)
   本项目适配的部分都在「内容区 / 定位 / 无障碍」三块，已在各处单独注明。

   ⚠️ scoped 与 Teleport：Vue 3 会把 scope id 打到 Teleport 出去的内容上，
   所以这段 scoped 样式对 body 下的弹层同样生效，不需要全局样式。
   ================================================================ */
.card-popover {
  /* 盒子模型：宽 320 是【含边框】的总宽，与脚本里的 POPOVER_PHOTO_WIDTH 一致 */
  box-sizing: border-box;
  position: fixed;
  /*
   * 【位置由独立的 translate 属性承担，不再逐帧写 top/left】
   * 参考站实测：外层包裹节点是 position:fixed + top:0 + left:0，
   * 位置完全由内联 transform: translate(x,y) 承担，滚动时逐帧只写 transform。
   * 我方原先逐帧写 top/left —— 这两个是布局属性，每帧都会强制布局；
   * 弹层又带 backdrop-filter，布局一变模糊背景就要重新采样，
   * 于是滚动时弹层总比页面慢半拍，手感发涩。
   * 改用 translate：合成层属性，不触发布局，与参考站机制等价。
   * 不用 transform 是因为它已被入场/出场的 scale + translateY 占用；
   * 两者是不同的 CSS 属性，并存且互不覆盖。
   * 不支持 translate 的老浏览器由 writePopoverOffset() 回退到 top/left。
   */
  top: 0;
  left: 0;
  z-index: 2000;
  width: 320px;
  border-radius: 16px;
  background: rgba(20, 20, 28, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
  -webkit-backdrop-filter: blur(24px) saturate(1.5);
  backdrop-filter: blur(24px) saturate(1.5);
  /*
   * 【overflow 必须是 hidden —— 圆角裁切完全依赖它】
   * 浮层的 border-radius: 16px 只有在 overflow: hidden 时才会裁切子元素；
   * .card-popover-photo 自身的 border-radius 是 0，它靠父级裁切才得到圆角。
   * 曾经为了修手机端滑动改成 visible，实测截图里照片四角变直角、顶出圆角轮廓 ——
   * 所以这里保持 hidden。手机端的滚动问题【不是】它造成的，见下方 touch 转发方案。
   */
  overflow: hidden;
  /* pan-y：声明本区域允许纵向滚动手势。 */
  color: #fff;
  /* 弹层里的图片与文字都不要被选中/拖拽（拖拽会触发浏览器原生 ghost image） */
  user-select: none;
  -webkit-user-select: none;
  /* 浮层没有 popper wrapper，top/left 直接落在锚点附近，
     所以元素左上角就是「靠近锚点的角」——展开原点取 0 0。
     这不是照抄参考站的 0 0：参考站那层的 scale 恒为 1，0 0 在它那里不产生视觉；
     我方是真的在缩放，原点选错会变成「从中心胀开」。 */
  transform-origin: 0 0;
  /* will-change 不做常驻：常驻会让元素整个生命周期占一个合成层，
     20 张卡反复悬停时层反复创建销毁。只在动画期声明（见 .is-open / .is-closing）。 */
}

/*
 * 入场 / 出场：两个 keyframes 覆盖同一组属性，用 animation-direction /
 * animation-name 切换，而不是「入场写一套、出场写另一套反向值」——
 * 后者在动画被打断（打开后立刻关闭）时会把元素闪回初始态。
 *
 * 名字按项目约定加 card 前缀：scoped 不隔离 keyframes 名，
 * 项目里已有 ptr-*（main.css）与 cinema*（Cinema.vue）。
 */
.card-popover.is-open {
  will-change: transform, opacity;
            animation: cardPopoverIn 300ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.card-popover.is-closing {
  will-change: transform, opacity;
  animation: cardPopoverOut 200ms cubic-bezier(0.4, 0, 1, 1) both;
  pointer-events: none;
}

@keyframes cardPopoverIn {
  from {
    opacity: 0;
    transform: translateY(-8px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes cardPopoverOut {
  from {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateY(-8px) scale(0.95);
  }
}

/*
 * 翻到锚点上方时，从下方滑入、向上收起 —— 位移动画必须跟着翻转方向，
 * 否则「在下方弹出却从上面滑下来」会有一次穿模感。
 * transform-origin 同理：水平统一取 0（与 data-align=start 一致），
 * 垂直取靠近锚点的那条边 —— 下方弹出 0 0（顶边贴锚点），上方弹出 0 100%（底边贴锚点）。
 */
.card-popover[data-side='top'] {
  transform-origin: 0 100%;
}

.card-popover[data-side='top'].is-open {
  animation-name: cardPopoverInUp;
}

.card-popover[data-side='top'].is-closing {
  animation-name: cardPopoverOutUp;
}

@keyframes cardPopoverInUp {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes cardPopoverOutUp {
  from {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateY(8px) scale(0.95);
  }
}


/* ---------------- 悬停预览：这张卡对应的照片 ----------------
   需求（用户 m05970）：悬停头像弹出的必须是这张卡的照片本身，而不是资料卡。

   【照片区用内联 aspect-ratio】模板里给 .card-popover-photo 写了
   aspectRatio: fw / fh，图片进 DOM 之前浮层就已占好正确高度；
   computePopoverPosition 因此不会先按错误高度判「放得下」再被撑开。
   下面的 aspect-ratio: 3 / 4 只是内联值缺失时的兜底（例如清单条目没有 w/h）。 */
.card-popover-photo {
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 4;
  /*
   * 【必须限高，否则浮层会盖住锚点、关闭链直接断掉】
   * 高度 = 宽度 / 宽高比，320 宽的竖构图会算出 400~430px，加上信息条就 ~480px。
   * 而「不覆盖锚点」要求 高度 <= 该侧可用空间，两侧同时不够时无解 ——
   * 唯一出路是把高度压下来（见 measurePopoverSize 的 hMax 推导）。
   *
   * 【max-height 现在由 JS 内联给出，不在这里写死】
   * 因为预算 hMax = (vh - 186) / 2 依赖视口高度，CSS 拿不到锚点位置，
   * 只能给出一个与视口无关的保守值，那必然在矮窗口下算错。
   * 所以模板绑定 :style="{ maxHeight: popoverState.photoHeight + 'px' }"，
   * 让 JS 与 CSS 用同一个数字，避免「JS 以为放得下、CSS 却裁掉」的分裂。
   * 这里的 50dvh 只是内联值缺失时的兜底（与 hMax 同源，同样保守）。
   * max-height 会和 aspect-ratio 打架吗？不会 —— aspect-ratio 是建议尺寸，
   * 一旦 max-height 更小，盒子按 max-height 收缩，图片靠 object-fit: cover 裁切。
   */
  max-height: min(480px, calc(50dvh - 147px));
  overflow: hidden;
  background: rgba(255, 255, 255, 0.06);
  flex: none;
}

.card-popover-photo img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 编号胶囊：右上角，压在照片上。深色半透明底 + 描边，任何亮度的照片上都可读。 */
.card-popover-no {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 2px 8px;
  border-radius: 9999px;
  background: rgba(0, 0, 0, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.18);
  font-size: 11px;
  font-weight: 600;
  line-height: 16px;
  letter-spacing: 0.02em;
  color: rgba(255, 255, 255, 0.92);
  font-variant-numeric: tabular-nums;
  pointer-events: none;
}

/* 底部信息条：高度必须与脚本里的 POPOVER_FOOT_HEIGHT 一致（52），
   否则 measurePopoverSize() 算出的总高与实际渲染高度对不上，
   翻到锚点上方时会多出 52px 的偏差。 */
.card-popover-foot {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  height: 52px;
  padding: 0 12px;
  flex: none;
}

.card-popover-hint {
  min-width: 0;
  font-size: 12px;
  line-height: 16px;
  color: rgba(255, 255, 255, 0.5);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-popover-btn {
  flex: 1 1 0;
  box-sizing: border-box;
  padding: 10px 0;
  border-radius: 12px;
  border: 1px solid transparent;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: filter 0.2s ease, background-color 0.2s ease;
}

/* 主按钮用画报页的青柠主题色 #a3e635（= rgb(163,230,53)），与参考站同色。 */
.card-popover-btn.is-primary {
  background-color: rgb(163, 230, 53);
  color: #000;
  box-shadow: 0 4px 18px rgba(163, 230, 53, 0.25);
}

.card-popover-btn.is-primary:hover {
  filter: brightness(1.08);
}

.card-popover-btn.is-primary:focus-visible {
  outline: 2px solid rgba(163, 230, 53, 0.9);
  outline-offset: 2px;
}

/* 弹层本身被程序化聚焦时（tabindex=-1）不要描边：
   它的焦点意义只是「Tab 的落点」，不是可操作控件。 */
.card-popover:focus {
  outline: none;
}

/* ================================================================
   无障碍：prefers-reduced-motion
   ----------------------------------------------------------------
   src/assets/main.css 有一条全局规则，在 reduce 环境下把
   animation-duration 压到 0.01ms、transition-duration 压到 0.01ms（都是 !important）。
   对本页的影响与对策：

   1. 入场动画被压成 0.01ms —— 因为用了 backwards 填充，动画会瞬间跑完，
      之后回落到 .is-visible 的静态样式，卡片仍可见，不会白屏。
      但为了不依赖这个推理，这里直接把入场动画整个关掉并强制可见。
   2. 光泽扫过被压成 0.01ms —— 变成一次看不见的闪烁，直接禁用。
   3. 图片缩放 / 头像旋转 / 卡片抬升是纯动效，reduce 下全部取消；
      玻璃卡片的颜色、边框、阴影过渡保留（它们不产生位移，不引发不适）。
   ================================================================ */
@media (prefers-reduced-motion: reduce) {
  .card-shell {
    opacity: 1 !important;
    filter: none !important;
    transform: none !important;
    animation: none !important;
  }

  .card-glass::before {
    display: none !important;
  }

  .card-glass:hover .card-media img,
  .card-author img:hover,
  .card-shell:hover {
    transform: none !important;
  }

  /*
   * 倾斜视差：脚本层面 tiltEnabled 已经在这种环境下返回 false、根本不会
   * 加 .is-tilting，所以下面两条理论上不会命中。仍然写上是为了防住
   * 「用户在页面打开后才切换系统设置」的场景 —— matchMedia 只在 setup 时
   * 求值一次，设置改变后脚本不会重新计算，此时必须由 CSS 兜底压平。
   */
  .card-tilt,
  .card-tilt.is-tilting {
    transform: none !important;
    box-shadow: none !important;
    transition: none !important;
  }

  .card-tilt.is-tilting .card-media img,
  .card-tilt.is-tilting .card-glass:hover .card-media img {
    transform: none !important;
    transition: none !important;
  }

  /*
   * 预览弹层：
   *   1. main.css 的全局规则会把 animation-duration 压到 0.01ms，
   *      如果不处理，弹层会「瞬间出现、瞬间消失」—— 消失时因为
   *      .is-closing 的 animation-fill-mode: both 会停在 opacity:0，
   *      之后才被 setTimeout 卸载，看起来像闪一下。
   *   2. 位移 8px 与缩放 0.95 本身就是「让用户不适」的动效，reduce 下必须去掉。
   * 做法：整段动画关掉，强制终态（不透明、无变换）；关闭时的卸载
   * 由脚本里的 prefersReducedMotion() 判断（直接 0ms 卸载，不等 animationend）。
   */
  .card-popover,
  .card-popover.is-open,
  .card-popover.is-closing,
  .card-popover[data-side='top'].is-open,
  .card-popover[data-side='top'].is-closing {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
  }

  .card-popover.is-closing {
    opacity: 0 !important;
  }

  .card-avatar:hover img,
  .card-avatar:focus-visible img,
  .card-avatar[aria-expanded='true'] img {
    transform: none !important;
  }
}

/* ================================================================
   窄屏适配（规格 2.1 的 640px 断点，数值逐字照抄）
   ================================================================ */
@media (max-width: 640px) {
  .masonry-grid {
    margin-left: -0.5rem;
  }

  .masonry-column {
    padding-left: 0.5rem;
  }

  .masonry-column > .card-shell {
    margin-bottom: 0.5rem;
  }

  .pictorial-inner {
    padding: 1rem 1rem 4rem;
  }

  .pictorial-page {
    /* 小屏导航同样 60px 高，但总高度紧张，收一点留白 */
    padding-top: 88px;
  }

  /* 窄屏弹层宽度必须与脚本的 measurePopoverSize() 用同一公式 min(320, 视口-24)，
     否则 CSS 画 320px、脚本按更小值算定位，left 会偏出去。
     border-radius 收小一点，免得在 320px 屏上几乎占满宽度时圆角显得过大。 */
  .card-popover {
    width: calc(100vw - 24px);
    border-radius: 14px;
  }
}
</style>