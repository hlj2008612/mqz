# 画报页（Pictorial）实现规格

> 本文档记录 `/pictorial` 页面的实测规格，供后续维护者对照。
> 实现见 `src/views/Pictorial.vue`。规格数据由主理人用真实 Chrome 逐项读计算样式得到。

> 本文档记录把 `/music` 占位页改造成「瀑布流照片卡片」页面的实测规格。
> 参考对象：https://forum.hanakos.cc/ 首页（Next.js + Tailwind）。
> 规格由主理人用真实 Chrome（155.0.8059.40，1440x900）逐项读计算样式得到，非猜测。
> 实现见 `src/views/Pictorial.vue`。

## 0. 命名

- 导航显示名：**画报**
- 路由路径：`/pictorial`
- 转场覆盖层元数据：word=`PICTORIAL`、jp=`ピクトリアル`、cn=`画报`、no=`04`、mark=`◈`

理由：「画报」= 有图有字的刊物，正好对应"照片 + 标题 + 作者 + 互动条"的卡片流；
与已有的「照片墙」（沉浸式画布）语义区分清楚，不撞名。

## 1. 页面结构（自上而下）

```
.site-bg                 固定背景层，z-index:-1
.scanlines               固定扫描线层（叠在背景上）
main.pictorial-page      相对定位，padding-top 给固定导航留位
  .pictorial-tabs        「默认 / 热度」两个胶囊
  .masonry-grid          flex 容器（列数 2~8 随视口变化，见 §4）
    .masonry-column ×N    每列独立堆叠
      .card-shell        卡片外层（承载 hover 位移与 z-index）
        .card-tilt       倾斜/视差层（本项目简化为静态）
          .card-glass    玻璃卡片本体
            .card-media  图片容器
            .card-author 作者行（头像 + 名字，负 margin 上浮盖住图片底部）
            .card-divider 分隔线
            .card-body   标题 + 互动图标
```

## 2. 关键 CSS 数值（逐字，勿改）

### 2.1 瀑布流布局
```css
.masonry-grid { display: flex; width: auto; margin-left: -1rem; }
.masonry-column { padding-left: 1rem; background-clip: padding-box; }
.masonry-column > .card-shell { margin-bottom: 1rem; }

@media (max-width: 640px) {
  .masonry-grid { margin-left: -0.5rem; }
  .masonry-column { padding-left: 0.5rem; }
  .masonry-column > .card-shell { margin-bottom: 0.5rem; }
}
```
- 外层容器最大宽度 `2200px`，水平居中，底部留 `padding-bottom: 5rem`。
- 1440px 视口实测：5 列，列宽 `278.391px`，网格总宽 `1392px`，卡片宽 `262.391px`。
- **列数不是固定 5 列**，按 `COLUMN_BREAKPOINTS` 七档查表，见 §4。

### 2.2 卡片外壳
```css
.card-shell {
  position: relative;
  width: 100%;
  height: auto;
  contain: layout style;
  transition: transform 0.45s cubic-bezier(0.23, 1, 0.32, 1);
}
@media (hover: hover) and (pointer: fine) {
  .card-shell:hover { transform: translateY(-10px) scale(1.05); z-index: 20; }
}
```

### 2.3 玻璃卡片
```css
.card-glass {
  position: relative;
  width: 100%;
  height: auto;
  border-radius: 24px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: rgba(0, 0, 0, 0.2) 0px 8px 32px;
  background: rgba(25, 25, 35, 0.38);
  backdrop-filter: blur(20px) saturate(140%);
  transition: background-color 0.4s cubic-bezier(0.23, 1, 0.32, 1),
              border-color 0.4s cubic-bezier(0.23, 1, 0.32, 1),
              box-shadow 0.4s cubic-bezier(0.23, 1, 0.32, 1);
}
.card-glass:hover {
  background: rgba(35, 35, 48, 0.48);
  border-color: rgba(255, 255, 255, 0.2);
  box-shadow: rgba(0, 0, 0, 0.4) 0px 16px 48px,
              rgba(255, 255, 255, 0.1) 0px 0px 20px,
              rgba(255, 255, 255, 0.15) 0px 1px 0px inset;
}
```

### 2.4 卡片光泽扫过（::before）
```css
.card-glass::before {
  content: "";
  position: absolute; inset: 0; z-index: 2; pointer-events: none;
  background: linear-gradient(115deg, transparent 38%, rgba(255,255,255,0.16) 47%,
              rgba(190,242,99,0.12) 53%, transparent 62%);
  transform: translateX(-130%);
  opacity: 0;
}
@media (hover: hover) and (pointer: fine) {
  .card-glass:hover::before { animation: cardSheenSweep 0.9s cubic-bezier(0.23,1,0.32,1) 1; }
}
```
（`cardSheenSweep` 的 keyframes 参考站未在可读样式表里暴露，按语义补：
`0% { transform: translateX(-130%); opacity: 0 } 30% { opacity: 1 } 100% { transform: translateX(130%); opacity: 0 }`）

### 2.5 顶部高光线（::after）
```css
.card-glass::after {
  content: "";
  position: absolute; top: 0; left: 0; right: 0; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
  opacity: 0;
  transition: opacity 0.3s;
}
.card-glass:hover::after { opacity: 1; }
```

### 2.6 图片区
```css
.card-media {
  position: relative;
  overflow: hidden;
  /* 实测实现是 contain: content（参考站 .image-glow 也是 content），
     且没有 transform: translateZ(0)。改回 layout style paint 会改变包含块与层叠上下文。 */
  contain: content;
  /*
   * 【高度自适应】真实宽高比由模板内联到 style 上（来自清单里缩略图的真实像素）：
   *   <div class="card-media" :style="{ aspectRatio: card.w + ' / ' + card.h }">
   * 这里只在清单条目缺 w/h 时兜底，3:4 与 JS 侧 estimateHeight 的 0.75 是同一个约定。
   * 【不要改回固定值】固定 1:1 会让 23 张图全部等高，整页看起来像表格而不是瀑布流。
   * 参考站的图片区本来也不是正方形：实测有 260x171（约 1.52）这类横构图。
   */
  aspect-ratio: 3 / 4;
}
.card-media img {
  width: 100%; height: 100%;
  object-fit: cover;
  transition: transform 0.5s cubic-bezier(0, 0, 0.2, 1);
}
.card-glass:hover .card-media img { transform: scale(1.04); }
```
底部渐变遮罩（`pointer-events: none; position:absolute; inset:0`）：
```css
background: linear-gradient(to bottom,
  transparent 30%,
  rgba(18, 13, 30, 0.45) 56%,
  rgba(18, 13, 30, 0.65) 84%,
  rgba(13, 10, 24, 0.80) 100%);
```

### 2.7 作者行

> ⚠️ **已改**：头像从 `.card-author img` 改成 `.card-avatar`（`<button>` 包一层 `<img>`），
> 以获得原生键盘可达与 Enter/Space 支持，见 `src/views/Pictorial.vue`。
> 视觉尺寸不变（2.5rem、`display: block`），因此卡片总高不受影响、不干扰贪心分配。
> 下面保留参考站原始写法备查。

```css
.card-author {
  position: relative; z-index: 10;
  display: flex; align-items: center; gap: 0.625rem;
  padding: 0 1rem;
  margin-top: -1.25rem;          /* 上浮盖住图片底部 */
}
.card-author img {
  width: 2.5rem; height: 2.5rem;
  border-radius: 9999px; object-fit: cover;
  border: 2px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
  transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  cursor: pointer;
}
.card-author img:hover { transform: scale(1.15) rotate(10deg); }
.card-author span {
  position: relative; top: 0.75rem;
  font-size: 0.875rem; font-weight: 500; color: #fff;
}
.card-divider {
  margin: 0.625rem 1rem 0;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}
```

### 2.8 正文区

> ⚠️ **已改**：`.card-title` 已随模板里的 `<h2 class="card-title">写真</h2>` 一并删除，
> 当前实现中没有这个选择器。下面保留参考站原始写法备查。

```css
.card-body { padding: 0.25rem 0.5rem 0.25rem; }
.card-body-inner { padding: 0.5rem 0.75rem 0.5rem 0.5rem; }
.card-title {
  font-size: 1rem; font-weight: 500; color: #fff;
  margin-bottom: 0.375rem;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.card-actions { display: flex; justify-content: flex-end; align-items: center; margin-bottom: 0.5rem; gap: 0.25rem; }
```

### 2.9 背景层
```css
.site-bg {
  position: fixed; top: 0; left: 0;
  width: 100%; height: 100%;
  z-index: -1;
  background-size: cover;
  background-position: center center;
  background-repeat: no-repeat;
}
.scanlines {
  position: fixed; inset: 0; z-index: -1; pointer-events: none;
  background: repeating-linear-gradient(0deg,
    rgba(0, 0, 0, 0.15), rgba(0, 0, 0, 0.15) 2px,
    rgba(0, 0, 0, 0.03) 2px, rgba(0, 0, 0, 0.03) 4px);
}
```
**注意**：参考站的背景图是它自己的 `mos-background-1920.webp`，本项目没有这张图。
本项目背景改为**纯深色**（`#0d0d0d`，与 `src/assets/main.css` 的 `--bg` 一致）+ 扫描线层。
这是有意的适配，不是遗漏。

### 2.10 标签胶囊
```css
.pictorial-tab {
  border-radius: 9999px;
  padding: 6px 16px;
  font-size: 14px;
}
.pictorial-tab.is-active { font-weight: 600; background: rgba(255,255,255,0.9); color: #000; }
.pictorial-tab:not(.is-active) { font-weight: 400; color: rgba(255,255,255,0.5); }
```

### 2.11 入场动画
```css
.card-shell { opacity: 0; filter: blur(24px); transform: translateY(20px); }
.card-shell.is-visible {
  opacity: 1; filter: none; transform: none;
  animation: postEnterBlurReveal 1.1s cubic-bezier(0.23, 1, 0.32, 1) backwards;
}
@keyframes postEnterBlurReveal {
  from { opacity: 0; filter: blur(24px); transform: translateY(20px); }
  to   { opacity: 1; filter: none; transform: none; }
}
```

## 3. 数据与内容适配（本项目与参考站的差异）

参考站是论坛，卡片内容是「帖子」。本项目没有帖子数据，改用 `src/core/imageManifest.js` 的 `IMAGE_POOL`（23 张照片）。

| 参考站字段 | 本项目取值 |
|---|---|
| 主图 | `assetUrl(entry.thumb)` |
| 作者头像 | 同主图（缩略图自身，圆形裁切） |
| 作者名 | `美琴` |
| 标题 | `写真 NO.xx`（xx 为两位补零的照片编号） |
| 副标题 | 无（参考站的 wide 卡有，本项目省略） |
| 点赞/评论/收藏 | 图标保留，数字一律显示 `0`（本项目无真实互动数据，不伪造数字） |
| 时间 | 省略（无真实时间戳） |

**为什么保留图标而不删**：卡片底部那一行图标是参考站视觉语言的一部分，删掉会让卡片下半部变成一片空白，与「要一致」的目标冲突。显示 0 是诚实的做法。

## 4. 列分配算法

**关于参考站的列高**：5 个 `.masonry-grid-column` 的盒子高度确实完全相等（实测都是 2361px），
但那是父级 `.masonry-grid` 的 flex 拉伸把每列盒子撑到等高，**不是内容被平衡了**。
实测各列「最后一个子元素的底边」相差 638px（2208 / 2345 / 2224 / 1707 / 2054），
也就是说参考站的内容底部参差比本项目更大。本项目不做等高拉伸，列高就是内容真实高度。

本项目实现要求：
1. **列数按七档查表**（`COLUMN_BREAKPOINTS`，改前曾写死 5 列，与参考站不符）：

   | minWidth | ≥1900 | ≥1680 | ≥1500 | ≥1280 | ≥1024 | ≥768 | <768 |
   |---|---|---|---|---|---|---|---|
   | 列数 | 8 | 7 | 6 | 5 | 4 | 3 | 2 |

   **不要写成线性公式**：档位间隔不均匀（220 / 180 / 220），线性式会让分界点推迟。
2. 分配策略：**逐张放入当前累计高度最短的列**（贪心平衡），而不是简单轮询。
   卡片高度 = 图片高度 + 作者行 + 正文区，其中
   **图片高度 = 列宽 / (w/h) = 列宽 × h/w**（w/h 取自清单里缩略图的真实像素），
   所以 16:9 横图矮、9:16 竖图高，瀑布流的参差感就来自这里。
   列宽必须取**卡片实宽**（`.card-shell` 的 clientWidth），不能用列的 `clientWidth` ——
   列上有 `padding-left: 1rem`，含 padding 的宽度会比卡片宽约 16px，把图片高度高估约 6%。
   可在挂载后用 `offsetHeight` 实测，也可用估算值；实测值缓存在 `measured`（uid -> px）。
   **要求：不得引入任何瀑布流库（禁止新增依赖）。**
3. 23 张照片按视口分到 2~8 列，数量不固定（高度参差，贪心结果约每列 4~6 张）。
4. 响应式列数变化时（`resize`）要重新分配，用 `requestAnimationFrame` 节流。
   **列数变化时必须 `measured.clear()`** —— `measured` 是 `uid -> px`，不含列宽维度，跨断点后全部失效。

## 5. 必须遵守的约束

1. **图片地址必须走 `assetUrl(entry.thumb)`**，禁止硬编码 `/images/`（会破坏子路径部署）。
2. **`@keyframes` 名必须加 `pictorial-` 或 `card` 前缀**——scoped 样式不隔离 keyframes 名，
   项目里已有 `cinema*` 与 `ptr-*`，不加前缀会冲突。
3. **必须处理 `prefers-reduced-motion`**：`src/assets/main.css` 有全局规则把 `animation-duration`
   压到 `0.01ms`，会打死入场动画与光泽扫过。要加放行或显式禁用规则。
4. **空池降级**：`IMAGE_POOL` 为空时页面不能崩，渲染空网格即可。
5. **不引入新依赖**（禁止 masonry 库、禁止动画库）。
6. **必须 `npm run build` 通过**。

## 6. 同步改动清单（改路由名会牵连的地方）

把 `/music` 改为 `/pictorial` 需要同步改：

| 文件 | 改动 |
|---|---|
| `src/router/index.js` | 路由 path `/music` → `/pictorial`，import 与 component 名 |
| `src/components/NavBar.vue` | `navItems` 里的 `{ name: '音乐', path: '/music', title: 'MUSIC', color: '#eb418d' }` |
| `src/App.vue` | `ROUTE_ORDER` 里的 `'/music'` |
| `src/components/PtrTransition.vue` | `META` 表的 `'/music'` 键 |
| `src/views/Music.vue` | 删除，新建 `src/views/Pictorial.vue` |

**主题色**：新板块配色由实现者提议，需与现有三色区分开
（首页 `#8b6ce8` 紫 / 照片墙 `#4a9eff` 蓝 / 影院 `#e4bb38` 金）。

## 7. 参考站实测原始数据（备查）

```
1440x900 视口：
  .masonry-grid           1392 x 2360.59
  .masonry-grid-column   278.391 x 2360.59  ×5（高度全部相等）
  .post-card-container   262.391 x 423.391（wide）/ 262.391 x 195.391（tall）
  .post-card             262.391 x 399.391
  .image-container       260.391 x 260.391
  .px-2.pb-1.pt-1        260.391 x 106

卡片变体（class 后缀）：
  wide-template —— 有图片（宽卡）
  tall-template —— 无图片，只有文字（窄卡）

body: overflow "hidden auto"，background 透明（背景由 .site-bg 固定层提供）
```
