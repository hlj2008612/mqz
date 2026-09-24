import { state } from './state.js';
import { WORLD_W, WORLD_H } from './config.js';
import { stopInertia, startInertia, scheduleUpdate } from './inertia.js';

function getPos(e) {
    if (e.touches?.length) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    if (e.changedTouches?.length) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    return { x: e.clientX, y: e.clientY };
}

function onPointerDown(e) {
    stopInertia();
    state.isDragging = true;
    const p = getPos(e);
    state.lastMouseX = p.x;
    state.lastMouseY = p.y;
    state.lastMoveTime = performance.now();
    state.moveDxHistory = [];
    state.moveDyHistory = [];
    state.velocityX = 0;
    state.velocityY = 0;
    if (state.canvas) state.canvas.classList.add('grabbing');
    e.preventDefault();
}

function onPointerMove(e) {
    if (!state.isDragging) return;
    const p = getPos(e);
    const dx = p.x - state.lastMouseX;
    const dy = p.y - state.lastMouseY;
    const now = performance.now();
    const dt = Math.max(now - state.lastMoveTime, 1);
    state.moveDxHistory.push((dx / dt) * 16.67);
    state.moveDyHistory.push((dy / dt) * 16.67);
    if (state.moveDxHistory.length > 5) state.moveDxHistory.shift();
    if (state.moveDyHistory.length > 5) state.moveDyHistory.shift();
    state.scrollX += dx;
    state.scrollY += dy;
    state.lastMouseX = p.x;
    state.lastMouseY = p.y;
    state.lastMoveTime = now;
    scheduleUpdate();
    e.preventDefault();
}

function onPointerUp() {
    if (!state.isDragging) return;
    state.isDragging = false;
    if (state.moveDxHistory.length) {
        state.velocityX = state.moveDxHistory.reduce((a, b) => a + b, 0) / state.moveDxHistory.length;
        state.velocityY = state.moveDyHistory.reduce((a, b) => a + b, 0) / state.moveDyHistory.length;
    }
    if (Math.abs(state.velocityX) > 35) state.velocityX = Math.sign(state.velocityX) * 35;
    if (Math.abs(state.velocityY) > 35) state.velocityY = Math.sign(state.velocityY) * 35;
    if (Math.abs(state.velocityX) > 0.4 || Math.abs(state.velocityY) > 0.4) {
        startInertia();
    } else {
        if (state.canvas) state.canvas.classList.remove('grabbing');
        scheduleUpdate();
    }
    state.moveDxHistory = [];
    state.moveDyHistory = [];
}

function onWheel(e) {
    if (e.ctrlKey || e.metaKey) { e.preventDefault(); return; }
    stopInertia();
    state.scrollX -= e.deltaX;
    state.scrollY -= e.deltaY;
    scheduleUpdate();
    e.preventDefault();
}

function onKeyDown(e) {
    const key = e.key.toLowerCase();
    let handled = true;
    switch (key) {
        case 'arrowleft': case 'a': stopInertia(); state.scrollX -= 200; break;
        case 'arrowright': case 'd': stopInertia(); state.scrollX += 200; break;
        case 'arrowup': case 'w': stopInertia(); state.scrollY -= 200; break;
        case 'arrowdown': case 's': stopInertia(); state.scrollY += 200; break;
        case 'r':
            stopInertia();
            state.scrollX = WORLD_W / 2 - state.viewW / 2;
            state.scrollY = WORLD_H / 2 - state.viewH / 2;
            break;
        default: handled = false;
    }
    if (handled) { scheduleUpdate(); e.preventDefault(); }
}

function onResize() {
    state.viewW = window.innerWidth;
    state.viewH = window.innerHeight;
    scheduleUpdate();
}

export function bindEvents(canvasEl) {
    canvasEl.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('mouseleave', onPointerUp);
    canvasEl.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);
}

export function unbindEvents(canvasEl) {
    canvasEl.removeEventListener('mousedown', onPointerDown);
    window.removeEventListener('mousemove', onPointerMove);
    window.removeEventListener('mouseup', onPointerUp);
    window.removeEventListener('mouseleave', onPointerUp);
    canvasEl.removeEventListener('wheel', onWheel);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('resize', onResize);
}