> ⚠️ **时效说明**：本报告基于 2026-10-26 上午的工作区快照。当天下午画报页悬停浮层已重构（宽度改为卡片实宽、高度改为完全自适应，见`记忆/04`第十一批），报告中涉及浮层的**行号已失效**；未采纳/未做的条目见`记忆/07`第 36、38 批。正文保留原样，不再校正。

# 前端实现审查报告（只读，未改动任何源文件）

> 审查范围：`src/views/Pictorial.vue`、`src/components/PtrTransition.vue`、`src/components/NavBar.vue`、
> `src/assets/main.css`，以及牵连到的 `src/App.vue` / `src/router/index.js` / `src/core/*.js` / `docs/pictorial-spec.md`。
> 行号全部取自当前工作区文件、逐条回读核对；凡未实测的结论均标注「推断」。
>
> **更正记录**：本报告初稿曾把「`onAvatarLeave` 缺 `viaPopover` 形参」列为阻塞级。复核 `Pictorial.vue:1718`
> 后确认参数**已正确声明**（`function onAvatarLeave(viaBlur = false, viaPopover = false)`），该条不成立，已删除。
> 保留这条更正本身，是因为它恰好暴露了真问题：这类「形参与实参是否对上」在本仓库**没有任何自动检查**（见 S14）。

## 结论摘要

工程底子扎实：渲染热路径的强制布局被逐条实测砍掉（tilt 延迟量矩形、弹层滚动走 `translate` 纯算术、ptr 转场事件驱动状态机）。**没有会让线上立刻出错的阻塞级缺陷**。按优先级，真正值得动手的是三件事：

1. **动效类语义漏了 `animation-delay`**：全局 reduced-motion 只压 `transition-duration` / `animation-duration`，而画报页入场、ptr 三段擦除都靠「延迟 + 填充模式」驱动 → 开了「减少动效」的用户看到的是「先空白、再闪出/错时闪现」。这是无障碍缺陷，也是唯一一条我认为该当阻塞处理的。
2. **块尾注释里的行号已全部过期**（`Pictorial.vue` 5 处），而其中一处正是「`.card-tilt` 相对特异性」事故的取证注释 —— 指错位置的注释比没有更危险。
3. **`onUpdated` 与滚动跟随的坐标来源不一致**：滚动期间 DOM 上的 `translate` 是直接写的，而 `popoverState` 仍是打开时的旧值；任何一次 patch 都会把弹层拉回旧坐标。

---

## 一、阻塞

### B1. reduced-motion 全局规则漏压 `animation-delay`

- 位置：`src/assets/main.css:67-81`；受影响规则 `Pictorial.vue:2180`、`main.css:89-95`、`main.css:179-186`
- 问题：
  - `Pictorial.vue:2180`：`.card-shell.is-visible { animation: cardEnterBlurReveal 1.1s ... var(--card-delay, 0ms) backwards }`。全局把 `animation-duration` 压到 `0.01ms` 后，`backwards` 填充会在 `--card-delay`（`Pictorial.vue:54` 注入，0~270ms）期间**继续持有 `from` 帧**（`opacity:0; filter:blur(24px)`）→ 卡片先空白一段时间再瞬间出现。
  - `main.css:89-95` 对 `.ptr-wipe` 只放行了 `animation-duration` 与 `animation-iteration-count`，**没有放行/归零 `animation-delay`**；而 `main.css:181-186` 给三条 wipe 与不同延迟。reduce 下三段擦除都变成 0.01ms，延迟却仍是 0 / .06 / .12s → 观感是「三段错时闪现」，而不是「一次性瞬时完成」。
  - `NavBar.vue:730` 的抽屉 `animation: navDrawerIn 0.22s ease-out both` 无延迟，安全。
- 改法：
  1. 在 `main.css:73-80` 的 `*` 规则里补一行 `animation-delay: 0.01ms !important;`（与既有两条同源）；
  2. `Pictorial.vue:2837-2843` 的 reduce 分支补 `.card-shell.is-visible { animation-delay: 0ms !important; }`（`--card-delay` 由内联变量给出，CSS 覆盖 delay 即生效，不必改 JS）；
  3. 若第 1 步影响到 ptr（`main.css:89-95` 的放行块在它之后、优先级更高，会重新拿回 `.28s`，但 delay 会被压成 0.01ms）→ 这反而是 reduce 下**想要**的效果：三段同时擦完。请在改完后按 `docs` 的口径实测一次 reduce 下的转场与入场（Chrome DevTools 的 Emulate `prefers-reduced-motion`）。

### B2. 滚动跟随写 DOM 与 `popoverState` 脱钩，`onUpdated` 会用旧坐标覆盖回去

- 位置：`Pictorial.vue:869-870`（`scrollAppliedTop/Left`）、`:896-904`（`onUpdated`）、`:1193-1216`（`applyScrollShift`）、`:1224-1230`（`syncPopoverDom`）、`:938-942`（`popoverStyle`）
- 问题：`applyScrollShift` 只更新 `scrollAppliedTop/Left` 并 `writePopoverOffset`，**不更新** `popoverState.top/left`；而 `onUpdated`（`:896`）在每次 patch 后把 `scrollAppliedTop/Left` 写回 DOM。注释 `:866-867` 声称「`popoverState` 仍是唯一真相源」——这句在滚动之后就不成立了。触发路径：滚动若干像素 → 点开另一张卡 / 弹层切到 `closing`（都会触发 patch）→ `popoverStyle`（`:938-942`）仍返回**旧的** `popoverState` 坐标，`writePopoverOffset` 又写回旧的 `scrollApplied*` → 弹层跳回打开时的位置，直到下一次 scroll 才恢复。
- 改法（二选一，推荐第一种）：
  - **A**：滚动跟随改为同步更新真相源，然后只走 `writePopoverOffset` 一条路径——`Object.assign(popoverState, { top: nextTop, left: nextLeft })` 后再 `syncPopoverDom()`。为免每帧惊动 Vue，把 `top/left` 从 `reactive popoverState` 里拆出来，放进一个普通对象 `livePos`，`popoverStyle` 改读 `livePos`；`onUpdated` 里用 `markRaw` 的引用同步，不再需要「写回」这一步。
  - **B**（最小改动）：删掉 `onUpdated`，并在所有会触发 patch 的状态写入点（`:1453`、`:1866`、`:1403`）之后调用 `syncPopoverDom()`；`scrollApplied*` 与 `popoverState` 保持分离但在 `closePreview` / `openPreview` 时一起重置。
- 注：这条**在静态阅读里成立**，但我没有跑真实浏览器复现；建议先按 `记忆/04` 第五批的口径（CDP `Performance.getMetrics` + 逐步 `scrollTop` 与 `translate` 对读）复现一次再动代码。

---

## 二、建议

### S1. 块尾注释里的行号已全部过期（可维护性，最高优先）

`Pictorial.vue` 里 5 处「第 NNNN 行 / 见 :NNN」的引用，逐一核对：

| 位置 | 注释里写的 | 实际所在 |
|---|---|---|
| `Pictorial.vue:2251` | 第 1940 行 | **2414**（`.card-glass:hover .card-media img`） |
| `Pictorial.vue:1723` | 头像 `:98` | **96-107**（`mouseleave` 在 104） |
| `Pictorial.vue:1724` | 浮层 `:198` | **204** |
| `PtrTransition.vue:227` | `Pictorial.vue:1492` | **2586** |
| `PtrTransition.vue:309` | `App.vue:85` | 85（正确） |

改法：**一律改成按选择器/函数名引用**，例如「见下方 `.card-glass:hover .card-media img`」。2900 行的 SFC 里行号必然腐烂，而 `:2251` 那段注释的读者正是「准备调 `.card-tilt` 特异性」的人。

### S2. `.card-tilt.is-tilting` 的胜负靠「特异性 + 源码顺序」双重巧合

- 位置：`:2258-2264`（0,4,1）、`:2413-2422`（0,3,1）
- 问题：`:2259` 的 `.card-tilt.is-tilting .card-glass:hover .card-media img` 与 `:2260` 的 `.card-tilt.is-tilting .card-media img` 同时存在，只为把特异性堆到 0,4,1；真正生效的是后者（前者要求指针同时在 `.card-glass` 上，属于子集）。
- 改法：只保留 `.card-tilt.is-tilting .card-media img`，并把普通 hover 那条（`:2413-2422`）改写成 `... .card-tilt:not(.is-tilting) .card-media img`，让优先级由结构决定而不是数字大小。

### S3. 悬停浮层仍用 `backdrop-filter`，与卡片「放弃真模糊」的取舍不一致

- 位置：`:2592-2593`（`.card-popover`）、`:1919`（`.photo-viewer`）；对照 `.card-glass` 的取舍注释 `:2268-2293`（实测有滤镜 25fps / 去掉 60fps）
- 问题：`.card-popover` 是 `position: fixed`，出现在卡片上方；指针从头像移到浮层的路径上会经过倾斜中的 `.card-tilt`（每秒改写 6 个自定义属性），此时「卡片重绘 + 浮层模糊重采样」同时发生，属于 `:2280-2282` 测过的同一类开销换了个位置。大图层同理（`:1919` 的 `blur(15px)`）。
- 改法：先 A/B 实测（用户规范：视觉类决策先给对比图）。若确有掉帧，把浮层改 `blur(16px)` + 深色实底加深（与 `.card-glass` 的 `rgba(22,22,32,.72)` 同族），并给 `.card-popover` 加 `contain: paint`。

### S4. `eager` 只按数组下标判定，与列数无关

- 位置：`:340`（`eager: i < 6`），列数 `:363-378`
- 问题：8 列（≥1900px）时前 6 张只填满第 1 列 + 第 2 列一半，首屏右侧是懒加载区；2 列时 6 张又超出首屏。直接影响 LCP。
- 改法：模板里改成 `:loading="card.uid <= eagerCount ? 'eager' : 'lazy'"`，`eagerCount = computed(() => columnCount.value * 2)`。`cards` 是模块级常量（`:321`），不建议为了 `eager` 改它的结构。

### S5. `rebuild()` 的「估算 → 实测 → 再分配」依赖一个隐式微任务契约

- 位置：`:564-584`、`measureHeights` `:456-472`
- 问题：契约本身**成立**（Vue 3 的 `nextTick` 在浏览器里走微任务，微任务在绘制前排空），但它是隐式的、没有任何测试守护，且注释 `:557-562` 用了整整一段在警告后来者。
- 改法：把「中间态不能上屏」的前提从「永远」收窄到「只在 resize 时」：首次挂载允许估算分配直接上屏，实测修正放到 `requestAnimationFrame`；`onResize` 路径保留现有微任务写法。这样注释里那句「不要改成等一帧」就只约束 resize，不易被误删。

### S6. `onResize` 里 `assignColumns` 读到的是**旧列数**的卡片宽

- 位置：`onResize:594-608`、`assignColumns:436`（`gridRef.value?.querySelector('.card-shell')?.clientWidth || 262`）
- 问题：`:600` 先写 `columnCount.value = next`，`:606` 同步调 `rebuild()` → `assignColumns` 立刻执行，此时 DOM 仍按旧列数布局，`clientWidth` 拿到旧宽度。随后 `measureHeights` 会纠正，但第一次分配必然偏。
- 改法：把列宽改成**解析计算**（与 `computePhotoBox` 「完全不读布局」的思路一致）：`(grid.clientWidth - (count - 1) * gap) / count`，gap 从 `--masonry-gap` CSS 变量读（见 S12）。或至少把这次读取挪到 `:570` 的 `await nextTick()` 之后。

### S7. 移动端抽屉 `aria-modal="true"` 但没有焦点循环

- 位置：`NavBar.vue:65-75`（dialog + `tabindex="-1"`）、`:478-488`、`:456-462`（`onKeydown` 只处理 Esc）
- 问题：`aria-modal` 只**告知**读屏软件「背后不可交互」，不会真的移出 tab 序。焦点从抽屉最后一个按钮（`.nav-drawer-logout`，`:91`）Tab 出去会落到背后页面的卡片头像上，此时读屏仍认为身处模态。
- 改法：在 `:456-462` 的 `onKeydown` 里加 `Tab` 循环：取 `drawerRef.value.querySelectorAll('button')`（抽屉里只有导航卡片 + 退出，数量固定，不需要通用实现），在末项按 Tab / 首项按 Shift+Tab 时 `preventDefault` 并 wrap。

### S8. 移动端抽屉关闭后，"触屏不回焦"的判断在混合输入下会失准

- 位置：`NavBar.vue:387-400`（`closeMenu`）、`:403-409`（`markKeyboard/markPointer`）
- 问题：`:395` 用 `lastInputWasKeyboard` 决定是否回焦。iPad 接键盘时，用户在抽屉里**点击**卡片会用 pointerdown 把标志清掉；但之后焦点无处可去（卡片被 `v-if` 销毁），`aria-expanded` 所在按钮失去焦点环。这不是缺陷（点击路径本来就会导航离开），但「Esc 关闭时一定回焦」这条被 `:395` 的判断挡掉了——Esc 恰好是键盘操作，`markKeyboard` 会先跑，所以实际安全（推断）。
- 改法：把「是否回焦」从「最近一次输入方式」改为「关闭原因」：`closeMenu(reason)`，`reason === 'escape' | 'nav'` 时回焦，`'card'` 时不回焦。语义更直接，也不依赖全局输入标志。

### S9. 移动端：导航卡片英文小字 9px

- 位置：`NavBar.vue:788-793`（`font-size: 9px; letter-spacing: 0.22em`）
- 问题：`PICTORIAL` 这类文字在 375px 屏上渲染约 9px，低于常见可读阈值。
- 改法：抬到 11px；或给 `.nav-card-en` 加 `aria-hidden="true"`（它与 `.nav-card-name` 表达同一信息），保持 9px 纯装饰——后者更符合「参考站视觉语言」的定位。

### S10. 画报页：`CHROME_ESTIMATE` 是硬编码常数，移动端字体缩放会让它系统性偏小

- 位置：`:398`（`const CHROME_ESTIMATE = 104`）、`:408-411`
- 问题：作者行 + 正文区的实际高度会随 iOS 动态字体 / Android 字体大小变化，而估算值固定。`measureHeights` 之后会纠正，但纠正前的估算偏差在窄屏（2 列、卡片少）会被放大成明显的列高不齐。
- 改法：在 `measureHeights` 里顺便记录「实测高度 − 估算高度」的中位数，存进一个 `let chromeMeasured`，下次 `estimateHeight` 优先用它；`measured.clear()` 时一并清空。

### S11. `POPOVER_DURATION` 与 CSS 的 300ms / 200ms 是两套时长

- 位置：`:1895`（`const POPOVER_DURATION = 300`）、CSS `.is-open` 300ms `:2626`、`.is-closing` 200ms `:2631`、`:1452`（关闭时用 `POPOVER_DURATION` 做兜底）
- 问题：入场 300ms、出场 200ms，而兜底定时器统一用 300ms。`:1894` 的注释写「与 CSS 的 300ms 保持一致」——对入场成立，对出场多等 100ms（无害，但注释口径错）。真正的风险是有人只改 CSS 没改常量。
- 改法：拆成 `POPOVER_OPEN_MS = 300` / `POPOVER_CLOSE_MS = 200`，各就各位；注释注明两处必须同改。

### S12. CSS 组织：间距 16px / 8px 在 6 个文件里各写一遍

- 位置：`Pictorial.vue:2144`（`margin-left: -1rem`）、`:2153`（`padding-left: 1rem`）、`:2158`（`margin-bottom: 1rem`）、`:2909-2919`（窄屏三处 `-0.5rem` / `0.5rem`）
- 问题：记忆 `02` 明确写着「这两个值动不得」、且「列数变了不需要动」。既然它是**布局不变量**，就应该有名字。
- 改法：`.masonry-grid` 上定义 `--masonry-gap: 1rem`，另两条用 `var(--masonry-gap)`；`@media (max-width: 640px)` 里只覆盖 `--masonry-gap: 0.5rem`。S6 的列宽解析计算正好需要读这个值。

### S13. CSS 组织：`Pictorial.vue` 单文件 2938 行，样式块内按「主题 + 组件」混排

- 现状：`<template>` 298 行、`<script setup>` ~1600 行、`<style scoped>` ~1030 行；`<style>` 里既有大图层（`:1903-2009`）又有画报主体（`:2011-2551`）又有浮层（`:2553-2821`）又有 reduced-motion（`:2823-2903`）又有窄屏（`:2905-2937`）。reduced-motion 与窄屏**放在最后**是有意的（覆盖），但文件里没有任何「顺序即优先级」的顶部提示。
- 改法（不改行为）：
  1. 拆出 `.photo-viewer`（`:1903-2009`，约 107 行）到 `src/components/PhotoViewer.vue`——它是独立语义的组件，props 只有 `card` + 两个 emit；
  2. 浮层同理由 `src/components/PhotoPopover.vue` 承载，`computePhotoBox / measurePopoverSize / computePopoverPosition`（`:999-1151`，约 150 行）抽到 `src/views/pictorial/popover-position.js` 纯函数模块——这三个函数**完全不依赖组件状态**（只读视口 + 传入的 card），是目前最容易被单独测试的部分（若将来加测试）；
  3. 在 `<style scoped>` 顶部加 6 行目录注释，标出「reduced-motion 与窄屏必须在文件末尾」。

### S14. 没有 `no-undef` 级别的静态检查

- 证据：`package.json:6-12` 只有 `dev / build / preview / optimize:images / analyze`；`记忆/04` 记录「项目里没有测试框架」。
- 影响：模板与脚本分离 300+ 行，属性名拼错、`ref` 未声明都**不会被 Vite 拦下**（Vite 不做绑定检查）。本报告初稿正是在这一步判断失误（见顶部更正记录）。
- 改法：加 `eslint` + `eslint-plugin-vue`，只开 `no-undef`、`vue/no-undef-properties`、`vue/no-unused-vars`，**不引入任何格式化规则**（避免全量 reformat）。注意这与「不要 `npm install`」的硬约定冲突（`记忆/03`），需要用户先决定是否接受一次受控的依赖变更。

### S15. `/`、`/cinema`、`/login` 不可滚，导航收起逻辑实际只在画报页生效

- 位置：`NavBar.vue:206-230`（`readScrollTop` 的注释）、初值 `:311`
- 核实：`Home.vue:20` 是 `height: 100vh` 的 flex 容器（不可滚）；`Cinema.vue:335/356` 是 `height: 100%`（不可滚）；`PhotoWall.vue` 走 `hideNav`，NavBar 不渲染。**唯一可滚的是 `.pictorial-page`**。
- 问题：注释 `:210-212` 让人以为「每个视图都自带滚动容器」。行为上不是 bug，但结论会误导后续维护者：将来给首页加内容导致溢出时，它会变成 `height:100vh + overflow` 而不可滚（内容被裁）。
- 改法：注释改准（「目前只有 `.pictorial-page` 可滚」）；并把「找滚动容器」抽成 `resolveScroller(e)`——沿 target 祖先链找第一个 `scrollHeight > clientHeight` 且 `overflow-y` 为 auto/scroll 的元素，作为 capture 监听之后的补充。

---

## 三、可选

### O1. `docs/pictorial-spec.md` 与代码的分叉清单

| spec 位置 | spec 写的 | 代码实际 |
|---|---|---|
| `:27` | `.masonry-grid`「5 列 flex 容器」 | 7 档查表，2~8 列（`Pictorial.vue:363-378`） |
| `:263` | 「桌面 5 列；平板 3 列；手机 2 列（断点建议 1024 / 640）」 | 768/1024/1280/1500/1680/1900 六档，最小 2 列、最大 8 列 |
| `§2.11` `:231` | `animation: postEnterBlurReveal 1.1s ...` | 改名为 `cardEnterBlurReveal`（`:2189`）；spec 自己 `:278` 要求加前缀，两处自相矛盾 |
| `§2.2` `:61` | `.card-shell { contain: layout style }` | 一致（`:2166`） |
| `§2.6` `:128` | `.card-media { contain: layout style paint }` | 实际是 `contain: content`（`:2385`，等价于 `layout paint style`，但写法不同） |
| `§4.2` `:270` | 「实测值缓存在 `measured`」 | 一致（`:392`），但 spec 没写「列数变化时必须 `clear()`」 |
| `§2.3` `:71-92` | `.card-glass` 带 `backdrop-filter: blur(20px) saturate(140%)` | **刻意移除**（`:2268-2293` 有实测理由），spec 仍按参考站原文写 |

改法：至少同步 `:27`、`:263`、`§2.3` 三处——前两处会让人写出错误的断点，第三处会让人「按 spec 修回去」把帧率砍回 25fps。

### O2. `PtrTransition.vue` 遗留调试探针

- 位置：`:351`（`window.__dbg && window.__dbg({ ev: 'finish', ... })`）
- 改法：包进 `if (import.meta.env.DEV)`。它每次 `finish()` 都会计算一个对象（`pending.path`、`route.path` 等），生产环境白白付出一次对象分配。

### O3. `PtrTransition.vue` 的 `timers` 数组单调增长

- 位置：`later()` `:260-264`、`clearTimers()` `:265-268`（只在 `onUnmounted` 调）
- 问题：每轮转场 append 3 个 id（start 兜底 / minCover / reveal 兜底），`finish()` 不清理。`clearTimeout` 对已触发的 id 是无操作，不算泄漏，但数组无界增长（100 次导航约 300 个已死 id）。
- 改法：返回 id 的同时在回调第一行从集合里删掉；或改用 `Set` 并在 `finish()` 里 `timers.clear()`（此时所有为本轮排的定时器都已触发或应收割）。

### O4. 路由全部静态 import，首屏（登录页）带上了画报页 2938 行

- 位置：`src/router/index.js:2-6`、`vite.config.js:282-286`（所有 `node_modules` 归 `vendor`，无视图级分包）
- 现状：`dist/assets/js/index-*.js` 32.94 kB raw（`记忆/03`），其中包含 `core/` 渲染引擎与四个视图。
- 改法：`/wall`、`/cinema`、`/pictorial` 改 `component: () => import(...)`。**注意**：这会改变 `PtrTransition.vue:516` 注释里「push 之后新组件是同步挂载的」这一假设，`pushReady` 必须等到路由组件真正加载完，否则会退化成等满 1500ms 的 `registerReadySignal`。需实测。

### O5. 每张卡有两个 `<img>` 指向同一个 `src`

- 位置：`:70-78`（卡面，`loading` 依 `card.eager`）、`:109-118`（头像，`loading="lazy"`）
- 说明：同一 URL 只下载一次（缓存），但 23 张卡共 46 个解码实例，头像是 40×40 却按原图尺寸解码。
- 改法：给头像加 `fetchpriority="low"`（已是 lazy）；若图片管线能出 80px 版本，用 `srcset` + `sizes="40px"` 更彻底。

### O6. `viewportWidth()` / `POPOVER_FALLBACK_VW` 的兜底值分散在三处

- 位置：`:380`、`:1000-1001`、`:1042-1043`、`:962`
- 说明：本项目无 SSR，这些兜底永不触发，却各自维护一套魔数。抽一个 `const vp = () => ({ w: viewportWidth(), h: viewportHeight() })` 收口即可。

### O7. `setup` 末尾同步填 `columns` 与 `onMounted` 的 `rebuild()` 重复算一次

- 位置：`:1897-1898` vs `:610-616`
- 说明：`rebuild()` 会先 `assignColumns` 再比 `layoutKey`，结果相同 → 不重渲染，但多算一次贪心；且 setup 阶段 `gridRef.value` 为 `null`，必然走 `|| 262` 兜底（见 S6）。
- 改法：保留预填（避免首帧空网格），但 `assignColumns(count, widthHint)` 接受可选宽度；setup 时传解析值。

### O8. `NavBar.vue:8` 的 `@mousedown.stop @wheel.stop` 已无作用对象（推断）

- 说明：这两条应该是为了让 PhotoWall 的画布拖拽/缩放不吃掉导航栏的输入；但 `/wall` 是 `hideNav`，NavBar 不渲染。确认无依赖后可删；保留则补一句说明守卫的具体行为。

### O9. `main.css` 里的死规则与重复变量

- 位置：`main.css:69-71`（`.transition-film::before`，`记忆/04` 第 28 条已记录为死选择器）、`:12-15`（`--theme-color`，注释自承无人使用）
- 另：`Pictorial.vue:2030` 的 `background-color: #0d0d0d` 与 `main.css:10` 的 `--bg` 是同一色的两份真相。
- 改法：删死规则；Pictorial 背景改 `var(--bg)`。

### O10. 移动端浮层上的触摸滚动没有惯性

- 位置：`:1675-1708`（`touchmove` 里手动 `page.scrollTop += dy`）
- 说明：注释也承认不做动量。iOS 上手指在浮层上滑动是「跟手但松手急停」，与页面其它区域的原生滚动手感明显不同。
- 改法（体验优化，需先给对比）：复用 `src/core/inertia.js` 的衰减常数，在 `touchend` 后按最后 2~3 帧的速度做 rAF 衰减。

### O11. `role="dialog"` 用在非模态悬停面板上语义偏重

- 位置：`:198-201`（`role="dialog" aria-modal="false" tabindex="-1"`）
- 说明：读屏用户会先进入一个「对话框」再 Tab 到按钮（`:1343-1364` 的 `trapFocus` 正是为此设计的）。但它既非模态、也不含表单，`role="group"` + `aria-label` 更贴近实际。
- 改法：改 `role="group"` 后需同步删掉 `trapFocus` 的特殊处理（否则成了「给 group 写 Tab 重定向」）。

### O12. 板块主题色分散在三个文件

- 位置：`Pictorial.vue:2056`（`--pictorial-accent`）、`:1997`、`:2813`、`NavBar.vue:122`（`color: '#a3e635'`）
- 改法：`main.css:9-22` 的 `:root` 里统一加 `--accent-home / --accent-wall / --accent-cinema / --accent-pictorial`，NavBar 的 `navItems` 改为引用变量。这是记忆 `02` 那张色值表的代码化。

---

## 四、性能：按实测可验证的顺序

1. **滚动热路径**：`Pictorial` 已做到「零布局读取」（`:1185-1216`）。剩下两处布局读都在低频路径上：`maybeCloseByPointer`（`:1763-1812`，关闭判定时 4 次 `getBoundingClientRect`）、`positionPopover`（`:1154-1159`，打开/resize）。建议按记忆 `04` 第五批的口径复测「弹层打开 + 滚动 + 悬停移动」组合，`LayoutCount` 目标 ≤ 3。
2. **Tilt 热路径**：`:744-772` 形态正确。唯一可省的是 `:752-758` 首次 `getBoundingClientRect()`——它发生在同一帧已写 `.is-tilting` 之后，会强制一次布局。可改为读 `offsetWidth/offsetHeight` + 仅取 rect 的 `left/top`，代价是两次强制布局，**不划算，建议维持现状**（列出只为说明这一点已被考虑过）。
3. **入场动画**：`filter: blur(24px) → none` 是逐帧重绘，23 张并行时开销明显。可考虑只对「即将进入视口的前 2~3 张」保留 blur，其余用 `opacity + translateY`。这会改变观感，需先给对比。

---

## 五、与 `记忆/02` 的对照

架构描述与代码**大体一致**，发现 3 处记忆需要补充：

1. `02` 的「列分配：贪心平衡」只提到一次分配；实际 `rebuild()` 内有**二次分配**（`:575-581`），其正确性依赖微任务契约（见 S5）。
2. `02` 的「指针进入只量一次矩形，移动过程不读布局」成立（`:726-732`、`:752-759`），但没提「首次 `applyTilt` 仍会强制一次布局」。
3. `02` 的「全局 reduced-motion 把 `animation-duration` 压到 0.01ms」——正确，但**漏了 `animation-delay` 未被压制**（B1）。这正是「新增动画必须加放行规则」那条提醒的反面：延迟同样会决定 reduce 用户的观感。

> 本次审查**未修改任何源文件**（仅新增本报告）。所有改动建议均需用户确认后另起 commit。
