// ================================================================
//  配置 - 修改这里来调整照片和卡片
// ================================================================

// 【1】照片数量：改为你 images/thumbnails/ 里的实际图片张数
const TOTAL_IMAGES = 20;

// 【2】网格尺寸：卡片总数 = WORLD_COLS × WORLD_ROWS
// 数值越大，一张屏幕上显示的图片种类越多，但性能消耗也越大
const WORLD_COLS = 20;
const WORLD_ROWS = 15;

// 【3】卡片间距：数值越大卡片越分散，反之越密集
const STEP = 340;

// 【4】浮点修正（保持默认即可，解决边缘卡顿）
const EPSILON = 1e-6;

// 自动计算世界尺寸（无需修改）
const WORLD_W = WORLD_COLS * STEP;
const WORLD_H = WORLD_ROWS * STEP;