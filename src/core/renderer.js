// ================================================================
//  渲染逻辑
// ================================================================
import { state, setCanvas } from './state.js';
import { WORLD_COLS, WORLD_ROWS, TOTAL_IMAGES, STEP, EPSILON } from './config.js';
import { mod } from './utils.js';

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
        // 在 Vite 中，public 目录下的文件可以直接用 / 访问
        img.src = `/images/thumbnails/${i}.webp`;
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

// 导出 buildCards 供 main.js 调用
export async function buildCards(canvasEl) {
    setCanvas(canvasEl); // 确保 state 里有 canvas
    await initSizeCache();

    const fragment = document.createDocumentFragment();

    for (let col = 0; col < WORLD_COLS; col++) {
        for (let row = 0; row < WORLD_ROWS; row++) {
            const card = document.createElement('div');
            card.className = 'item';

            const img = document.createElement('img');
            const imgIdx = ((col * 47 + row * 31) % TOTAL_IMAGES + TOTAL_IMAGES) % TOTAL_IMAGES + 1;
            img.src = `/images/thumbnails/${imgIdx}.webp`;
            img.decoding = 'async';
            img.loading = 'lazy';
            img.alt = '';

            card.appendChild(img);
            fragment.appendChild(card);
            allCards.push({
                el: card,
                col,
                row,
                baseW: sizeCache[col][row].w,
                baseH: sizeCache[col][row].h,
                imgIdx,
            });
        }
    }

    canvasEl.appendChild(fragment);
}

// ================================================================
//  3. 核心渲染函数（更新卡片位置、缩放、可见性、模糊）
// ================================================================
export function updateRender() {
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
            visibleSet.add(`${mod(gridX, WORLD_COLS)},${mod(gridY, WORLD_ROWS)}`);
        }
    }

    for (const card of allCards) {
        const cardKey = `${card.col},${card.row}`;
        if (!visibleSet.has(cardKey)) {
            card.el.style.display = 'none';
            continue;
        }

        let bestGridX = 0;
        let bestGridY = 0;
        let bestDist = Infinity;
        let bestDistY = Infinity;

        for (let k = -2; k <= 2; k++) {
            const candidateGridX = card.col + k * WORLD_COLS;
            const cellX = candidateGridX * currentStep + state.scrollX;
            const dist = Math.abs(cellX + currentStep / 2 - centerX);
            if (dist < bestDist) {
                bestDist = dist;
                bestGridX = candidateGridX;
            }
        }

        for (let k = -2; k <= 2; k++) {
            const candidateGridY = card.row + k * WORLD_ROWS;
            const cellY = candidateGridY * currentStep + state.scrollY;
            const dist = Math.abs(cellY + currentStep / 2 - centerY);
            if (dist < bestDistY) {
                bestDistY = dist;
                bestGridY = candidateGridY;
            }
        }

        const cellX = bestGridX * currentStep + state.scrollX;
        const cellY = bestGridY * currentStep + state.scrollY;
        const scaledW = Math.round(card.baseW * dynamicScale);
        const scaledH = Math.round(card.baseH * dynamicScale);
        const posX = Math.round(cellX + (currentStep - scaledW) / 2);
        const posY = Math.round(cellY + (currentStep - scaledH) / 2);

        if (posX + scaledW < -margin || posX > state.viewW + margin ||
            posY + scaledH < -margin || posY > state.viewH + margin) {
            card.el.style.display = 'none';
            continue;
        }

        const style = card.el.style;
        const cardCenterX = posX + scaledW / 2;
        const cardCenterY = posY + scaledH / 2;
        const dist = Math.hypot(cardCenterX - centerX, cardCenterY - centerY);
        const scale = 0.6 + ((maxDist - dist) / maxDist) * 1.2;
        const zIndex = Math.round(10000 - dist * 10);

        style.display = '';
        style.width = `${scaledW}px`;
        style.height = `${scaledH}px`;
        style.left = `${posX}px`;
        style.top = `${posY}px`;
        style.transform = `scale(${scale.toFixed(3)})`;
        style.zIndex = String(zIndex);
    }
}