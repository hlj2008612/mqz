// ================================================================
//  惯性滚动逻辑
// ================================================================
import { state } from './state.js';
import { WORLD_W, WORLD_H } from './config.js';
import { mod } from './utils.js';
import { updateRender } from './renderer.js';

function wrapScroll() {
    state.scrollX = mod(state.scrollX, WORLD_W);
    state.scrollY = mod(state.scrollY, WORLD_H);
}

function mainLoop() {
    let shouldContinue = false;

    if (state.inertiaActive) {
        state.scrollX += state.velocityX;
        state.scrollY += state.velocityY;
        wrapScroll();

        state.velocityX *= 0.91;
        state.velocityY *= 0.91;

        if (Math.abs(state.velocityX) < 0.4 && Math.abs(state.velocityY) < 0.4) {
            state.inertiaActive = false;
            state.velocityX = 0;
            state.velocityY = 0;
            if (state.canvas) state.canvas.classList.remove('grabbing');
        }

        updateRender();
        shouldContinue = state.inertiaActive;
    }

    if (state.needsUpdate && !state.inertiaActive) {
        state.needsUpdate = false;
        updateRender();
    }

    if (shouldContinue || state.needsUpdate) {
        state.rafId = requestAnimationFrame(mainLoop);
    } else {
        state.rafId = null;
    }
}

export function scheduleUpdate() {
    state.needsUpdate = true;
    if (!state.rafId) requestAnimationFrame(mainLoop);
}

export function startInertia() {
    if (Math.abs(state.velocityX) < 0.4 && Math.abs(state.velocityY) < 0.4) {
        state.inertiaActive = false;
        if (state.canvas) state.canvas.classList.remove('grabbing');
        scheduleUpdate();
        return;
    }
    state.inertiaActive = true;
    if (state.canvas) state.canvas.classList.add('grabbing');
    if (!state.rafId) requestAnimationFrame(mainLoop);
}

export function stopInertia() {
    state.inertiaActive = false;
    state.velocityX = 0;
    state.velocityY = 0;
    if (state.canvas) state.canvas.classList.remove('grabbing');
}