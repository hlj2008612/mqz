# 美琴的照片墙 (photo-wall-vue)

Vue 3 + Vite 重构版照片墙。用无限画布把 23 张照片铺满整面墙，支持惯性拖拽与沉浸式浏览。

线上地址：<https://zmq-hlj.ccwu.cc/>

## 技术栈

| 组件 | 版本 | 用途 |
| --- | --- | --- |
| Vue | 3.4 | 视图层 |
| vue-router | 4.3 | Hash 路由（`createWebHashHistory`，静态托管友好） |
| Vite | 5 | 构建 / 开发服务器 |

## 目录结构

```
index.html              入口 HTML（含 SEO / 社交 meta 与防白屏内联底色）
vite.config.js          构建配置 + 体积报告插件
public/
  CNAME                 自定义域名 zmq-hlj.ccwu.cc
  favicon.svg
  icons.svg
  _headers              Netlify / Cloudflare Pages 缓存与安全策略（GitHub Pages 忽略）
  images/thumbnails/    缩略图 webp，照片墙实际加载的就是这些（发布载荷）
  images/full/          1600px 大图，画报页悬停浮层与「查看大图」使用
assets-src/images/zmq/  100.9 MB 原图，【不在】public/ 下，因此不会进 dist/
src/
  core/                 原生 JS 照片墙引擎（渲染、惯性、输入、状态）
  views/                PhotoWall / Home / Cinema / Pictorial / Login
  components/           NavBar / PtrTransition（ptr 擦除转场覆盖层）
```

## 命令

```bash
npm run dev              # 开发服务器
npm run build            # 生产构建 → dist/
npm run preview          # 本地预览 dist/
npm run analyze          # 打印构建体积报告（读 dist/.build-report.json）
npm run optimize:images  # 生成响应式图片（见 README 图片一节）
```

---

## Build & Deploy

### 构建

```bash
npm run build
```

产物输出到 `dist/`。构建结束时会打印一张 **raw / gzip / brotli** 体积表，并把同样的数据写到 `dist/.build-report.json`（由 `vite.config.js` 里的本地插件用 Node 内置 `zlib` 计算，**没有引入任何新的 npm 依赖**）。

构建耗时主要在 `public/` 的拷贝上：`public/` 会被逐字节复制进 `dist/`。97 MB 的原图已经移出 `public/`，所以拷贝量大幅下降。

### 子路径部署

`base` 由环境变量 `VITE_BASE` 控制，默认 `/`：

```bash
VITE_BASE=/photo-wall-vue/ npm run build
```

GitHub Pages 的**项目页**（`https://<user>.github.io/<repo>/`）需要传子路径；本仓库用的是**自定义域名** `zmq-hlj.ccwu.cc`（`public/CNAME`），站点挂在根路径，所以保持默认 `/` 即可。

### 部署

本项目的发布方式是 **本地 `npm run build`，然后手工把 `dist/` 上传到服务器**（不使用 GitHub Actions）。

> `dist/` 已被 `.gitignore` 忽略；请提交源码，在本地构建出 `dist/` 再上传。

#### ⚠️ 上传 `dist/` 时必须遵守

1. **`dist/` 就是站点根目录，要原样上传。** 它里面已经包含了发布所需的全部内容：
   `index.html`、`CNAME`、`_headers`、`assets/js/`、`assets/css/`、`images/thumbnails/`、
   `images/full/`。
2. **不要把 `dist/` 之外的任何东西上传上去** —— 不要上传仓库根目录，那里有 `public/`、
   `src/`、`node_modules/`（以及 `assets-src/` 里的原图），体积远大于站点本身。
3. **上传前先删掉旧的 `dist/` 再重新构建**（`Remove-Item -Recurse -Force dist` 后 `npm run build`）。
   `vite.config.js` 已显式设置 `emptyOutDir: true`，正常情况下构建会自行清空；但手工上传这个
   环节没有校验，清空重建是唯一能保证没有陈旧文件混进去的做法。
4. **`dist/` 里不应该出现 `.git`。** 历史上这里混进过一个 105.93 MB 的 `gh-pages` worktree
   （`dist/.git`）。因为 `dist/` 在 `.gitignore` 里，`git status` 不会显示它 —— 于是一次性的
   遗留会变成**每次部署都重复上传 106 MB**。`vite.config.js` 现在会在构建开始时检测并告警
   （`emptyOutDir` 会把它删掉，告警只是防止再次无声发生）。
5. **`images/zmq/`（97 MB 原图）已经移出 `public/`**，现在位于仓库的 `assets-src/images/zmq/`，
   因此**不会**出现在 `dist/` 里。这些原图当前没有任何代码引用。

### 缓存现实（重要）

**GitHub Pages 完全忽略 `public/_headers`。** 这个文件里写的 `Cache-Control` 在 GitHub Pages 上不会生效 —— 它的作用是：一旦把站点迁到 Netlify / Cloudflare Pages / Vercel，缓存策略无需改动即可直接生效。

GitHub Pages 上实际生效的（且无法用仓库内配置文件覆盖）是：

- 所有资源由 Fastly CDN 提供，`Cache-Control: max-age=600`（10 分钟）；
- 超过 10 分钟后浏览器会重新校验，但只会拿到 `304` 或同名新内容。

因此本项目的做法是**不依赖服务端缓存头**：

1. 构建产物（`assets/js`、`assets/css`、`assets/img`）全部带内容哈希 `[hash]`，文件名即版本号 —— 内容一变，文件名就变，不会出现“旧 HTML 引用被缓存的新文件”这类问题；
2. HTML 本身很短（约 1.5 KB / brotli 后更小），10 分钟缓存窗口带来的陈旧风险可以接受；
3. 图片资源（`/images/thumbnails/*`、`/images/full/*`）**不带哈希**，是靠 `public/` 原样拷贝的 —— 替换图片时文件名不变，所以更新图片后需要等 CDN 缓存过期（最长 10 分钟），这是 GitHub Pages 上的固有限制。

### 首屏载荷：图片才是大头

照片墙的性能瓶颈不在 JS，而在图片。参考量级：

| 资源 | 体积 |
| --- | --- |
| 全部 JS + CSS（brotli） | 约 70 KB |
| `public/images/thumbnails/`（23 张 webp，发布载荷） | 约 652 KB（667,932 B） |
| `public/images/full/`（1600px 大图，**悬停浮层与大图查看使用**） | 约 3.07 MB（3,221,330 B） |
| `assets-src/images/zmq/`（原图，**不发布**） | 约 100.9 MB（105,766,966 B） |

也就是说，**图片比代码大两个数量级以上**。任何有意义的优化都必须先把图片做下来：

- 照片墙只为每张卡渲染缩略图（`/images/thumbnails/*.webp`），
  画报页悬停头像弹出的预览层与「查看大图」用的是 `public/images/full/` 的 1600px 大图；
- 照片墙只加载 `public/images/thumbnails/` 里的 webp；原图在 `assets-src/` 且不参与发布；
- 用 `npm run optimize:images` 重新生成响应式尺寸，避免在卡片里塞 1 MB 级的图。

**不要给图片加 `<link rel="preload" as="image">`** —— 缩略图最大单张约 1.1 MB，预加载会抢走首屏带宽，反而拖慢可交互时间。卡片加载已经用 `img.loading = 'lazy'` + `decoding = 'async'`。

---

## 构建优化说明

`vite.config.js` 里做了这些事：

1. **代码分割**：`vue` + `vue-router` 合并进 `vendor` chunk（唯一的第三方包）。转场已改为纯 CSS 的 ptr 覆盖层，不再依赖 gsap，因此没有额外的动画库分块。
2. **内容哈希 + 分目录**：`assets/js/[name]-[hash].js`、`assets/css/[name]-[hash].css`、`assets/img/[name]-[hash][extname]`。
3. **`target: 'es2018'`**：覆盖更老的浏览器 / 内嵌 WebView。
4. **`cssCodeSplit: true`、`sourcemap: false`、`reportCompressedSize: true`**。
5. **体积报告插件**：`writeBundle` 阶段用 `zlib` 计算每个产物的 gzip / brotli 体积，打印表格并写出 `dist/.build-report.json`。

## 安全与隐私

站点通过路由守卫保护：要求 `sessionStorage.photoWallLoggedIn === 'true'` 才放行。请注意这只是**客户端**拦截，图片 URL 本身没有任何鉴权 —— 任何人拿到直链都能访问。站点本身对搜索引擎可见（`index.html` 中为 `<meta name="robots" content="index, follow">`）。`public/_headers` 里附加了一组安全响应头（`X-Content-Type-Options`、`X-Frame-Options`、`Referrer-Policy` 等），同样只在支持 `_headers` 的平台上生效。
