// ================================================================
//  初始化
// ================================================================

updateRender();
resetHintTimer();

// 暴露 API（控制台可用）
window.canvasAPI = {
    resetView() {
        stopInertia();
        state.scrollX = WORLD_W / 2 - state.viewW / 2;
        state.scrollY = WORLD_H / 2 - state.viewH / 2;
        updateRender();
        resetHintTimer();
    },
    refresh() {
        updateRender();
    }
};