// ================================================================
//  全局状态
// ================================================================
import { WORLD_W, WORLD_H } from './config.js';

export const state = {
    viewW: window.innerWidth,
    viewH: window.innerHeight,
    // scrollX 和 scrollY 的初始值在 main.js 中统一计算
    scrollX: WORLD_W / 2 - window.innerWidth / 2,
    scrollY: WORLD_H / 2 - window.innerHeight / 2,
    isDragging: false,
    lastMouseX: 0,
    lastMouseY: 0,
    lastMoveTime: 0,
    velocityX: 0,
    velocityY: 0,
    inertiaActive: false,
    moveDxHistory: [],
    moveDyHistory: [],
    needsUpdate: true,
    rafId: null,
    canvas: null, // 用于存放 Vue 传递过来的 DOM 节点
};

// 提供给外部设置 canvas DOM 的方法
export function setCanvas(el) {
    state.canvas = el;
}