// ================================================================
//  惯性滚动逻辑
// ================================================================

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
            canvas.classList.remove('grabbing');
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

function scheduleUpdate() {
    state.needsUpdate = true;
    if (!state.rafId) requestAnimationFrame(mainLoop);
}

function startInertia() {
    if (Math.abs(state.velocityX) < 0.4 && Math.abs(state.velocityY) < 0.4) {
        state.inertiaActive = false;
        canvas.classList.remove('grabbing');
        scheduleUpdate();
        return;
    }
    state.inertiaActive = true;
    canvas.classList.add('grabbing');
    if (!state.rafId) requestAnimationFrame(mainLoop);
}

function stopInertia() {
    state.inertiaActive = false;
    state.velocityX = 0;
    state.velocityY = 0;
    canvas.classList.remove('grabbing');
}