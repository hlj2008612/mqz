// ================================================================
//  1. 尺寸缓存（根据图片比例动态生成）
// ================================================================

const sizeCache = [];

/**
 * 异步加载所有图片的宽高比，并生成尺寸缓存
 */
async function initSizeCache() {
    const aspectRatios = {};
    const promises = [];

    // 1. 并发加载所有图片，获取真实宽高比
    for (let i = 1; i <= TOTAL_IMAGES; i++) {
        const img = new Image();
        img.src = `images/thumbnails/${i}.webp`;
        const promise = new Promise((resolve) => {
            img.onload = () => {
                const ratio = img.naturalWidth / img.naturalHeight;
                aspectRatios[i] = ratio;
                resolve();
            };
            img.onerror = () => {
                aspectRatios[i] = 1; // 图片加载失败时默认方形
                resolve();
            };
        });
        promises.push(promise);
    }

    await Promise.all(promises);

    // 2. 根据宽高比生成 sizeCache
    for (let gx = 0; gx < WORLD_COLS; gx++) {
        sizeCache[gx] = [];
        for (let gy = 0; gy < WORLD_ROWS; gy++) {
            const imgIdx = ((gx * 47 + gy * 31) % TOTAL_IMAGES + TOTAL_IMAGES) % TOTAL_IMAGES + 1;
            const ratio = aspectRatios[imgIdx] || 1;

            // 基础面积：保持卡片总面积大致不变
            const baseArea = 180 * 180;
            let w = Math.sqrt(baseArea * ratio);
            let h = Math.sqrt(baseArea / ratio);

            // 限制在 CARD_SIZE_MIN ~ CARD_SIZE_MAX 之间
            const min = 140;
            const max = 210;
            if (w > max) { w = max; h = w / ratio; }
            if (h > max) { h = max; w = h * ratio; }
            if (w < min) { w = min; h = w / ratio; }
            if (h < min) { h = min; w = h * ratio; }

            sizeCache[gx][gy] = {
                w: Math.round(w),
                h: Math.round(h)
            };
        }
    }
}

// ================================================================
//  2. 预创建所有卡片 DOM
// ================================================================

const allCards = [];

// 用立即执行异步函数确保 sizeCache 初始化完成后再构建 DOM
(async function buildCards() {
    await initSizeCache();

    for (let col = 0; col < WORLD_COLS; col++) {
        for (let row = 0; row < WORLD_ROWS; row++) {
            const card = document.createElement('div');
            card.className = 'item';
            const img = document.createElement('img');
            const imgIdx = ((col * 47 + row * 31) % TOTAL_IMAGES + TOTAL_IMAGES) % TOTAL_IMAGES + 1;
            img.src = `images/thumbnails/${imgIdx}.webp`;
            img.decoding = 'async';
            img.loading = 'lazy';
            img.alt = '';
            card.appendChild(img);
            canvas.appendChild(card);
            allCards.push({
                el: card,
                col: col,
                row: row,
                baseW: sizeCache[col][row].w,
                baseH: sizeCache[col][row].h,
                imgIdx: imgIdx,
            });
        }
    }

    // 卡片构建完成后，立即渲染第一帧
    updateRender();
})();

// ================================================================
//  3. 核心渲染函数（更新卡片位置、缩放、可见性、模糊）
// ================================================================

function updateRender() {
    const dynamicScale = Math.min(1.4, Math.max(0.5, Math.min(state.viewW / 1400, state.viewH / 900)));
    const currentStep = STEP * dynamicScale;
    const centerX = state.viewW / 2;
    const centerY = state.viewH / 2;
    const maxDist = Math.hypot(centerX, centerY);
    const margin = 250;

    const buffer = 2;
    const startCol = Math.floor(-state.scrollX / currentStep + EPSILON) - buffer;
    const startRow = Math.floor(-state.scrollY / currentStep + EPSILON) - buffer;
    const colsNeeded = Math.ceil(state.viewW / currentStep) + buffer * 2;
    const rowsNeeded = Math.ceil(state.viewH / currentStep) + buffer * 2;

    const visibleSet = new Set();
    for (let i = 0; i < colsNeeded; i++) {
        for (let j = 0; j < rowsNeeded; j++) {
            const gridX = startCol + i;
            const gridY = startRow + j;
            const worldCol = mod(gridX, WORLD_COLS);
            const worldRow = mod(gridY, WORLD_ROWS);
            visibleSet.add(`${worldCol},${worldRow}`);
        }
    }

    for (const card of allCards) {
        if (!visibleSet.has(`${card.col},${card.row}`)) {
            card.el.style.display = 'none';
            continue;
        }

        const targetScreenX = centerX;
        const targetScreenY = centerY;

        let bestGridX = null, bestGridY = null;
        let bestDist = Infinity, bestDistY = Infinity;

        for (let k = -2; k <= 2; k++) {
            const candidateGridX = card.col + k * WORLD_COLS;
            const cellX = candidateGridX * currentStep + state.scrollX;
            const dist = Math.abs(cellX + currentStep / 2 - targetScreenX);
            if (dist < bestDist) {
                bestDist = dist;
                bestGridX = candidateGridX;
            }
        }
        for (let k = -2; k <= 2; k++) {
            const candidateGridY = card.row + k * WORLD_ROWS;
            const cellY = candidateGridY * currentStep + state.scrollY;
            const dist = Math.abs(cellY + currentStep / 2 - targetScreenY);
            if (dist < bestDistY) {
                bestDistY = dist;
                bestGridY = candidateGridY;
            }
        }

        const gridX = bestGridX;
        const gridY = bestGridY;
        const cellX = gridX * currentStep + state.scrollX;
        const cellY = gridY * currentStep + state.scrollY;

        const baseW = card.baseW;
        const baseH = card.baseH;
        const scaledW = Math.round(baseW * dynamicScale);
        const scaledH = Math.round(baseH * dynamicScale);
        const posX = Math.round(cellX + (currentStep - scaledW) / 2);
        const posY = Math.round(cellY + (currentStep - scaledH) / 2);

        if (posX + scaledW < -margin || posX > state.viewW + margin ||
            posY + scaledH < -margin || posY > state.viewH + margin) {
            card.el.style.display = 'none';
            continue;
        }

        card.el.style.display = '';
        card.el.style.width = scaledW + 'px';
        card.el.style.height = scaledH + 'px';
        card.el.style.left = posX + 'px';
        card.el.style.top = posY + 'px';

        const cardCenterX = posX + scaledW / 2;
        const cardCenterY = posY + scaledH / 2;
        const dist = Math.hypot(cardCenterX - centerX, cardCenterY - centerY);
        const scale = 0.6 + ((maxDist - dist) / maxDist) * 1.2;
        const zIndex = Math.round(10000 - dist * 10);

        card.el.style.transform = `scale(${scale.toFixed(3)})`;
        card.el.style.zIndex = zIndex;

        // 【景深模糊效果】
        const maxBlur = 3; // 边缘最大模糊像素，按需调整
        const blurValue = Math.pow(dist / maxDist, 0.8) * maxBlur;
        card.el.style.filter = `blur(${blurValue.toFixed(1)}px)`;
    }
}