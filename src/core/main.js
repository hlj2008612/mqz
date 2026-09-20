// ================================================================
//  原生照片墙 - 初始化与销毁入口
// ================================================================
import { state, setCanvas } from './state.js';
import { WORLD_W, WORLD_H } from './config.js';
import { buildCards, updateRender } from './renderer.js';
import { bindEvents, unbindEvents } from './input.js';

export async function initPhotoWall(canvasEl) {
    // 初始化尺寸状态
    state.viewW = window.innerWidth;
    state.viewH = window.innerHeight;
    state.scrollX = WORLD_W / 2 - state.viewW / 2;
    state.scrollY = WORLD_H / 2 - state.viewH / 2;
    
    // 将 Vue 的 DOM 节点挂载到全局状态
    setCanvas(canvasEl);

    // 构建卡片 DOM（等待图片加载完毕）
    await buildCards(canvasEl);
    
    // 绑定鼠标、键盘、触摸事件
    bindEvents(canvasEl);
    
    // 渲染第一帧
    updateRender();
}

export function destroyPhotoWall(canvasEl) {
    // 解绑所有事件，防止内存泄漏
    unbindEvents(canvasEl);
    
    // 取消未完成的动画帧
    if (state.rafId) {
        cancelAnimationFrame(state.rafId);
        state.rafId = null;
    }
    state.canvas = null;
}