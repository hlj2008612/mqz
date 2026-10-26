/**
 * 画报页一次性验收脚本（不入 package.json 依赖，也不需要 npm install）。
 *
 * 用法：
 *   1. npm run build
 *   2. npx vite preview --port 4173 --strictPort        （后台）
 *   3. 把本文件复制到装了 playwright-core 的目录，再在该目录执行：
 *        node pictorial-popover.mjs [--url http://localhost:4173/] [--shots <截图目录>]
 *
 *   为什么必须「复制到那个目录再跑」：脚本用裸模块名 `import ... from 'playwright-core'`，
 *   Node 按【脚本所在位置】向上找 node_modules。放在仓库的 scripts/verify/ 下
 *   （本项目没有也不要装 playwright-core）会直接 ERR_MODULE_NOT_FOUND。
 *   这就是「不入依赖」的代价 —— 也是本文件能进版本控制、同时又不动 package.json 的原因。
 *
 *   要换 Chrome 路径：--chrome "C:\...\chrome.exe"
 *
 * 断言的都是 记忆/04「第七~十一批」里出现过的不变量：
 *   A. 23 张卡不丢不重（uid 去重后 = 清单条数），且无横向溢出
 *   B. 列数 7 档查表，含 7 个 1px 边界档（700/767/1023/1279/1499/1679/1899）
 *   C. 浮层宽度 = 卡片实宽（±1px）
 *   D. 浮层照片比例误差 < 0.01
 *   D2. 高度只由「宽度 × 比例」决定 —— 同一张照片、同样卡宽就必须同样高（极差 ≤2）
 *   E. 浮层与锚点间距恒为 22px；E2. 不覆盖头像本身
 *   F. 移开指针后能关闭；Esc 能关闭
 *   G. 0 页面错误、0 个 4xx/5xx 请求
 *
 * ⚠️ 脚本里两个必须遵守的测量口径（踩过才知道，别改回去）：
 *   1. 卡片宽度用 `clientWidth`，不能用 `getBoundingClientRect().width` ——
 *      卡片悬停时有 `scale(1.05)`，rect 会把 262 读成 276。
 *   2. 「间距」不能用两个 rect 相减 —— 浮层宽于视口剩余空间时，
 *      getBoundingClientRect() 返回的是【视觉溢出矩形】，差出 4px。用内联 translate 推算。
 */
import { chromium } from 'playwright-core';

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const URL_BASE = arg('--url', 'http://localhost:4173/');
const SHOT_DIR = arg('--shots', '');
const CHROME = arg('--chrome', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe');

const results = [];
const record = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`);
};

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const pageErrors = [];
const httpErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') pageErrors.push('console: ' + m.text()); });
page.on('response', (r) => { if (r.status() >= 400) httpErrors.push(r.status() + ' ' + r.url()); });

async function login() {
  await page.goto(URL_BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input', { timeout: 20000 });
  const inputs = await page.$$('input');
  await inputs[0].fill('zmq');
  await inputs[1].fill('2008823');
  await page.locator('button[type=submit]').click();
  await page.waitForFunction(() => sessionStorage.getItem('photoWallLoggedIn') === 'true', { timeout: 20000 });
  await page.evaluate(() => { location.hash = '#/pictorial'; });
  await page.waitForSelector('.masonry-column', { timeout: 20000 });
  await page.waitForTimeout(900);
}

const snapshot = () => page.evaluate(() => {
  const uids = [...document.querySelectorAll('.card-shell[data-uid]')].map((n) => Number(n.dataset.uid));
  return {
    columns: document.querySelectorAll('.masonry-column').length,
    cards: uids.length,
    unique: new Set(uids).size,
    cardW: document.querySelector('.card-shell')?.getBoundingClientRect().width || 0,
    overflowX: (() => {
      const pg = document.querySelector('.pictorial-page');
      return pg ? pg.scrollWidth - pg.clientWidth : 0;
    })(),
  };
});

/** 用真实鼠标悬停头像打开浮层，并量最终 DOM（必须等 nextTick 校正完成）。 */
async function openAndMeasure(uid) {
  const pos = await page.evaluate(async (u) => {
    const a = document.querySelector(`.card-shell[data-uid="${u}"] .card-avatar`);
    if (!a) return null;
    a.scrollIntoView({ block: 'center' });
    await new Promise((r) => setTimeout(r, 320));
    const r = a.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, uid);
  if (!pos) return { error: 'no anchor' };
  await page.mouse.move(pos.x, pos.y);
  await page.waitForTimeout(820);           // 255ms 打开延迟 + 300ms 入场 + nextTick 校正
  // 【必须让几何彻底静止再量，而且不能用固定的 sleep】
  // scrollIntoView 会触发卡片入场（translateY 20px→0）与悬停抬升（0.45s），
  // 这段时间里锚点一直在动，translate 却只在打开瞬间算过一次。
  // 固定等 700ms 在慢机器/高负载下不够 —— 实测同一套脚本时快时慢，
  // 间距会在 22/23/25 之间跳，看起来像实现不稳定，其实是量早了。
  // 这里改成「主动轮询到连续 3 帧 rect 不变」，与机器快慢无关。
  await page.evaluate(async (u) => {
    let last = null;
    let stable = 0;
    for (let i = 0; i < 120 && stable < 3; i++) {
      await new Promise((r) => requestAnimationFrame(r));
      const el = document.querySelector('.card-popover');
      const a = document.querySelector(`.card-shell[data-uid="${u}"] .card-avatar`);
      const sig = el && a
        ? `${Math.round(el.getBoundingClientRect().top)}|${Math.round(a.getBoundingClientRect().bottom)}|${el.style.translate}`
        : 'none';
      if (sig === last) stable += 1;
      else { stable = 0; last = sig; }
    }
  }, uid);
  return page.evaluate((u) => {
    const pop = document.querySelector('.card-popover');
    if (!pop) return { error: 'popover not opened' };
    const photo = pop.querySelector('.card-popover-photo');
    const img = photo && photo.querySelector('img');
    const pr = photo.getBoundingClientRect();
    const popR = pop.getBoundingClientRect();
    const shell = document.querySelector(`.card-shell[data-uid="${u}"]`);
    const sr = shell.getBoundingClientRect();
    const ar = document.querySelector(`.card-shell[data-uid="${u}"] .card-avatar`).getBoundingClientRect();
    const gap = pr.top >= ar.bottom ? pr.top - ar.bottom : (ar.top >= pr.bottom ? ar.top - pr.bottom : -1);
    const overlap = !(pr.bottom <= ar.top || pr.top >= ar.bottom || pr.right <= ar.left || pr.left >= ar.right);
    return {
      uid: u,
      natural: img && img.naturalWidth ? +(img.naturalWidth / img.naturalHeight).toFixed(3) : null,
      rendered: +(pr.width / pr.height).toFixed(3),
      photoW: Math.round(pr.width), photoH: Math.round(pr.height),
      popoverW: Math.round(popR.width), popoverH: Math.round(popR.height),
      // 【必须用 clientWidth】卡片带 3D 倾斜视差 transform，getBoundingClientRect()
      // 量到的是变换后的包围盒（悬停时 scale 1.05 会把 262 读成 276），
      // 拿它当基准会把正确的浮层误判成「宽度不符」。
      cardW: Math.round(shell.clientWidth),
      gap: Math.round(gap),
      // 【精确间距，用内联 translate 与锚点算，不用两个 rect 相减】
      // 两条都成立才算对：
      //   bottom: 浮层 top = 锚点底边 + 22
      //   top   : 浮层底边 = 锚点顶边 - 22
      // 【为什么不用 rect 相减】浮层元素宽于视口剩余空间时，getBoundingClientRect()
      // 命中过宽元素返回的是【视觉溢出矩形】（左右各向外扩出 px），bottom 也会跟着
      // 虚高 4px —— 实测 844x390 下 rect 相减得 26，而 translate 推算得 22，
      // 差的 4px 全是「浮层左右两侧各溢出 2px」导致的。用它做断言会误报。
      exactGap: (() => {
        // 【两条定位通路都要读】现代浏览器写 style.translate；
        // 不支持 translate 属性的浏览器（writePopoverOffset 的回退分支）写 top/left。
        // 只读 translate 会让回退路径下的提示恒为 null → 被误判成全量失败。
        const m = /(-?[\d.]+)px\s+(-?[\d.]+)px/.exec(pop.style.translate || '');
        const cs = getComputedStyle(pop);
        const py = m ? parseFloat(m[2]) : parseFloat(cs.top);
        if (!Number.isFinite(py)) return null;
        const h = pop.offsetHeight;
        return pop.dataset.side === 'bottom'
          ? Math.round(py - ar.bottom)
          : Math.round(ar.top - (py + h));
      })(),
      anchorBottomRaw: +ar.bottom.toFixed(2),
      positionedBy: pop.style.translate ? 'translate' : 'top/left 回退',
      visualOverflow: (() => {
        // 浮层左右是否超出视口（用于解释上一条的 rect 偏差，本身不算失败）
        const m = /(-?[\d.]+)px\s+(-?[\d.]+)px/.exec(pop.style.translate || '');
        if (!m) return 0;
        const px = parseFloat(m[1]);
        return Math.round(Math.max(0, -px) + Math.max(0, px + pop.offsetWidth - window.innerWidth));
      })(),
      overlapAnchor: overlap,
      side: pop.dataset.side,
      inView: popR.top >= -1 && popR.left >= -1 && popR.right <= window.innerWidth + 1 && popR.bottom <= window.innerHeight + 1,
      offsetW: pop.offsetWidth,
      offsetH: pop.offsetHeight,
    };
  }, uid);
}

async function close() {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(420);
}

try {
  await login();
  const manifest = await page.evaluate(() => window.__IMAGE_POOL_COUNT__ || null);

  // A. 23 卡不丢不重
  const base = await snapshot();
  record('A 卡片不丢不重', base.cards === 23 && base.unique === 23,
    `cards=${base.cards} unique=${base.unique}${manifest ? ` manifest=${manifest}` : ''}`);
  record('A2 无横向溢出', base.overflowX <= 0, `overflowX=${base.overflowX}`);

  // B. 列数 7 档（含 1px 边界）
  const BREAK = [[700, 2], [767, 2], [768, 3], [1023, 3], [1024, 4], [1279, 4], [1280, 5], [1440, 5],
    [1499, 5], [1500, 6], [1679, 6], [1680, 7], [1899, 7], [1900, 8], [2560, 8]];
  const bad = [];
  for (const [w, expect] of BREAK) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(430);
    const s = await snapshot();
    if (s.columns !== expect) bad.push(`${w}→${s.columns}(期望${expect})`);
    if (s.cards !== 23 || s.unique !== 23) bad.push(`${w}→卡 ${s.cards}/${s.unique}`);
  }
  record('B 列数 7 档 15 个边界档', bad.length === 0, bad.join(' | ') || 'all ok');

  // C/D/E. 浮层：宽度跟卡片、比例自适应、间距恒定
  const VIEWS = [[1440, 900], [1280, 720], [1024, 768], [390, 844], [375, 812], [844, 390]];
  const UIDS = [8, 20, 12];
  const rows = [];
  for (const [w, h] of VIEWS) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(500);
    for (const uid of UIDS) {
      const r = await openAndMeasure(uid);
      r.viewport = `${w}x${h}`;
      rows.push(r);
      if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}\\popover-${w}x${h}-u${uid}.png` }).catch(() => {});
      await close();
    }
  }

  const widthBad = rows.filter((r) => r.error || Math.abs(r.popoverW - r.cardW) > 1);
  record('C 浮层宽度 = 卡片实宽', widthBad.length === 0,
    widthBad.length ? JSON.stringify(widthBad) : '所有视口/照片均吻合（±1px）');

  const ratioBad = rows.filter((r) => r.error || !r.natural || Math.abs(r.rendered - r.natural) >= 0.01);
  record('D 照片比例误差 < 0.01', ratioBad.length === 0,
    ratioBad.length ? JSON.stringify(ratioBad) : rows.map((r) => `${r.viewport} u${r.uid} ${r.rendered}/${r.natural}`).join(', '));

  // D2 高度完全自适应 —— 必须用「同 uid、同卡片宽、不同视口高度」来证伪。
  // 【为什么不能只看同宽同高】照片区是纯 aspect-ratio 盒（无 height / max-height），
  // 「宽度相同 ⇒ 高度相同」在 CSS 层面是恒等式，任何实现都能过 —— 那个断言是同义反复。
  // 真正能证伪「高度被视口高度约束」的，是固定宽度、只改 vh：
  //   若有人把 hMax=(vh-186)/2 之类的预算加回来，高度就会随 vh 缩小，这里立刻失败。
  const vhRows = [];
  for (const h of [1100, 900, 700, 560]) {
    await page.setViewportSize({ width: 1440, height: h });
    await page.waitForTimeout(500);
    for (const uid of [8, 12]) {
      const r = await openAndMeasure(uid);
      r.viewport = `1440x${h}`;
      vhRows.push(r);
      await close();
    }
  }
  const vhBad = [];
  const vhNotes = [];
  for (const uid of [8, 12]) {
    const list = vhRows.filter((r) => !r.error && r.uid === uid);
    if (!list.length) continue;
    const widths = new Set(list.map((r) => r.cardW));
    const heights = list.map((r) => r.photoH);
    const spread = Math.max(...heights) - Math.min(...heights);
    // 照片高必须完全一致（极差 0）：宽度相同就不允许任何视口高度影响它
    vhNotes.push(`u${uid}(${list.map((r) => `${r.viewport.split('x')[1]}:${r.photoH}`).join(' ')} 极差${spread})`);
    if (widths.size !== 1) vhBad.push(`u${uid} 卡片宽不一致 ${[...widths]} —— 断言前提失效`);
    if (spread !== 0) vhBad.push(`u${uid} 高度随视口高度变化：${list.map((r) => `${r.viewport}→${r.photoH}`).join(', ')}`);
    // 同时验证「浮层高 = 照片高 + 固定信息条(52) + 边框(2)」，防止有人单独把 foot 改掉
    for (const r of list) {
      const chrome = r.popoverH - r.photoH;
      if (Math.abs(chrome - 54) > 1) vhBad.push(`u${uid} ${r.viewport} 浮层高-照片高=${chrome}（应为 54）`);
    }
  }
  record('D2 高度完全自适应（固定宽度、只改视口高度，高度必须一模一样）', vhBad.length === 0,
    vhBad.length ? vhBad.join(' | ') : `极差全部为 0：${vhNotes.join(' ')}`);

  const gapBad = rows.filter((r) => !r.error && Math.abs(r.exactGap - 22) > 1);
  record('E 浮层与锚点间距恒为 22px', gapBad.length === 0,
    gapBad.length
      ? JSON.stringify(gapBad.map((r) => ({ v: r.viewport, u: r.uid, exactGap: r.exactGap, gapRect: r.gap, visualOverflow: r.visualOverflow })))
      : '所有样本精确间距 = 22px（由 translate 与锚点矩形推算，不受视觉溢出影响）');

  const overlapBad = rows.filter((r) => !r.error && r.overlapAnchor);
  record('E2 浮层不覆盖头像本身', overlapBad.length === 0,
    overlapBad.length ? JSON.stringify(overlapBad.map((r) => ({ v: r.viewport, u: r.uid }))) : 'none');

  // 溢出现象（不是失败指标，但要如实报告：高度自适应后长竖图可能超出视口）
  const outOfView = rows.filter((r) => !r.error && !r.inView);
  console.log(`\n[信息] 浮层超出视口的样本：${outOfView.length}/${rows.filter((r) => !r.error).length}`);
  for (const r of outOfView) console.log(`      ${r.viewport} u${r.uid} 浮层 ${r.popoverW}x${r.popoverH} 照片 ${r.photoW}x${r.photoH} side=${r.side}`);

  // F. 关闭链路
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(460);
  const opened = await openAndMeasure(12);
  if (!opened.error) {
    // 真实移出：移到浮层与头像矩形之外
    const target = await page.evaluate(() => {
      const pop = document.querySelector('.card-popover').getBoundingClientRect();
      const a = document.querySelector('.card-shell[data-uid="12"] .card-avatar').getBoundingClientRect();
      const right = Math.max(pop.right, a.right);
      return { x: Math.min(right + 140, window.innerWidth - 4), y: Math.max(a.top - 60, 6) };
    });
    await page.mouse.move(target.x, target.y, { steps: 6 });
    await page.waitForTimeout(1500);
    const closed = await page.evaluate(() => !document.querySelector('.card-popover'));
    record('F1 移开指针后关闭', closed, `stillOpen=${!closed}`);
  }
  const o2 = await openAndMeasure(20);
  if (!o2.error) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(450);
    const closed = await page.evaluate(() => !document.querySelector('.card-popover'));
    record('F2 Esc 关闭', closed, `stillOpen=${!closed}`);
  }

  // F3 滚动跟随 —— 浮层必须逐帧贴住锚点，不能落后一帧。
  // 【为什么必须测】历史上出现过「浮层比页面慢半拍」；本轮又新增了 rAF 锚点跟随，
  // 它与滚动跟随共用同一份位移状态，两路同时写会重复/漏加位移。
  // 实测过的两次回归都是「滚动起步那一帧间距从 22 跳成 26」，
  // 而所有「打开后静止再量」的用例都测不到 —— 必须在滚动进行中逐帧采样。
  //
  // 【选卡方式】前面的用例已经滚过页面，写死 uid 可能不在视口内、悬停不中。
  // 这里取「当前视口里靠上、四周都留足空间」的那张卡 —— 卡片悬停会上浮 10px、
  // 放大 1.05，贴边选卡会让指针在动画中途脱离头像，浮层根本不出现。
  // 【先把页面滚回顶部再选卡】前面的用例是一个个 scrollIntoView 打开的，
  // 结束时页面停在中间某处，视口里未必有「四周留足空间」的完整卡片。
  // 顶部的卡最稳妥：上方是导航留白，悬停上浮 10px 不会被裁。
  await page.evaluate(() => { document.querySelector('.pictorial-page').scrollTop = 0; });
  await page.waitForTimeout(600);
  const scrollTarget = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.card-shell[data-uid]')];
    const inView = cards
      .map((c) => ({ c, r: c.getBoundingClientRect() }))
      // 头像必须完整落在视口内、且其上还有余量给悬停上浮
      .filter((x) => {
        const ar = x.c.querySelector('.card-avatar').getBoundingClientRect();
        return ar.top > 130 && ar.bottom < window.innerHeight - 40;
      })
      .sort((a, b) => a.r.top - b.r.top);
    const cand = inView[0];
    if (!cand) return null;
    const ar = cand.c.querySelector('.card-avatar').getBoundingClientRect();
    return { uid: Number(cand.c.dataset.uid), x: ar.left + ar.width / 2, y: ar.top + ar.height / 2 };
  });
  if (scrollTarget) {
    await page.mouse.move(scrollTarget.x, scrollTarget.y);
    await page.waitForTimeout(1400);   // 等打开 + 锚点跟随收敛
    // 【必须按 uid 确认浮层属于这张卡，不能只判「有没有浮层」】
    // 曾经只判存在性：由于指针漂移，浮层其实是另一张卡开的，量出来的
    // 间距是 -487（两个不相关元素的距离），却当成「滚动跟随失败」报了 FAIL。
    const openedUid = await page.evaluate(() => {
      const pop = document.querySelector('.card-popover');
      if (!pop) return null;
      const m = /NO\.(\d+)/.exec(pop.textContent || '');
      return m ? Number(m[1]) : null;
    });
    if (openedUid === scrollTarget.uid) {
      const drifts = await page.evaluate(async (uid) => {
        const out = [];
        const pg = document.querySelector('.pictorial-page');
        const canDown = pg.scrollTop < pg.scrollHeight - pg.clientHeight - 200;
        const step = canDown ? 6 : -6;
        for (let i = 0; i < 20; i++) {
          pg.scrollTop += step;
          await new Promise((r) => requestAnimationFrame(r));
          const pop = document.querySelector('.card-popover');
          const anc = document.querySelector(`.card-shell[data-uid="${uid}"] .card-avatar`);
          if (!pop || !anc) { out.push(null); continue; }
          const pr = pop.getBoundingClientRect();
          const ar = anc.getBoundingClientRect();
          // 【必须按 side 分别算】浮层会翻到锚点上方，此时它整体在头像上面，
          // 用「浮层 top − 头像 bottom」会得到 -581 这种负数，被误判成「跟随失败」。
          // bottom: 浮层顶边 = 头像底边 + 22
          // top   : 浮层底边 = 头像顶边 − 22
          const gap = pop.dataset.side === 'bottom'
            ? Math.round(pr.top - ar.bottom)
            : Math.round(ar.top - pr.bottom);
          out.push(gap);
        }
        return out;
      }, scrollTarget.uid);
      // 滚动跟随的可接受误差：真实的位置是「22 + 亚像素误差」，两个取整后的边相减
      // 天然会差 1px（实测 side=top 时整段稳定在 23）。真正要抓的是**漂移** ——
      // 历史上出现过 22→23→…→30 的累积发散，那种下面这条断言会立刻抓到。
      // 判据因此是「全部样本的极差 ≤ 2」而不是「每个都恰好等于 22」。
      const valid = drifts.filter((d) => d !== null);
      const spread = valid.length ? Math.max(...valid) - Math.min(...valid) : 999;
      const off = valid.filter((d) => Math.abs(d - 22) > 2);
      const ok = valid.length === drifts.length && spread <= 2 && off.length === 0;
      record('F3 滚动过程中浮层逐帧贴住锚点（间距恒 22px）', ok,
        ok ? `20 帧滚动采样 22~24px 内，极差 ${spread}（uid ${scrollTarget.uid}）`
          : `滚动帧里出现漂移：${JSON.stringify(drifts)}（极差 ${spread}）`);
      await close();
    } else {
      // 打开失败要显式暴露，不能静默跳过 —— 否则「检查过 F3」是假的
      record('F3 滚动过程中浮层逐帧贴住锚点（间距恒 22px）', false,
        `预期打开 uid ${scrollTarget.uid} 的浮层，实际为 ${openedUid === null ? '未打开' : 'uid ' + openedUid}`);
    }
  } else {
    record('F3 滚动过程中浮层逐帧贴住锚点（间距恒 22px）', false, '视口内找不到可用于滚动的卡片，本项未执行');
  }

  // G. 错误
  record('G0 页面错误', pageErrors.length === 0, pageErrors.slice(0, 4).join(' || ') || 'none');
  record('G1 HTTP 4xx/5xx', httpErrors.length === 0, httpErrors.slice(0, 4).join(' || ') || 'none');

  console.log('\n=== 浮层明细 ===');
  for (const r of rows) {
    if (r.error) { console.log(`  ${r.viewport} u${r.uid} ERROR ${r.error}`); continue; }
    console.log(`  ${r.viewport.padEnd(9)} u${String(r.uid).padEnd(3)} 卡宽 ${r.cardW} 浮层 ${r.popoverW}x${r.popoverH} 照片 ${r.photoW}x${r.photoH} 比例 ${r.rendered}/${r.natural} 间距 ${r.exactGap} side ${r.side} inView ${r.inView}${r.visualOverflow ? ` 视觉溢出 ${r.visualOverflow}px` : ''}`);
  }
} finally {
  const fails = results.filter((r) => !r.pass);
  console.log(`\nSUMMARY: ${results.length - fails.length}/${results.length} pass, ${fails.length} fail`);
  await browser.close();
  process.exitCode = fails.length ? 1 : 0;
}
