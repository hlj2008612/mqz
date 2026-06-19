// ================================================================
//  全局状态
// ================================================================

const state = {
    viewW: window.innerWidth,
    viewH: window.innerHeight,
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
};

const canvas = document.getElementById('canvas');