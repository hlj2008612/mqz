(function() {
    const lightbox = document.createElement('div');
    lightbox.id = 'lightbox';
    lightbox.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.92);
        z-index: 99999;
        display: none;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        opacity: 0;
        transition: opacity 0.3s ease;
        backdrop-filter: blur(8px);
    `;

    const img = document.createElement('img');
    img.style.cssText = `
        max-width: 90vw;
        max-height: 90vh;
        object-fit: contain;
        box-shadow: 0 0 40px rgba(0, 0, 0, 0.6);
        border-radius: 12px;
        pointer-events: none;
        user-select: none;
        transition: transform 0.3s ease;
    `;

    const loadingText = document.createElement('div');
    loadingText.textContent = '⏳ 加载中...';
    loadingText.style.cssText = `
        position: absolute;
        color: rgba(255,255,255,0.6);
        font-size: 16px;
        pointer-events: none;
        display: none;
    `;

    lightbox.appendChild(loadingText);
    lightbox.appendChild(img);
    document.body.appendChild(lightbox);

    let isOpen = false;

    function openLightbox(src) {
        isOpen = true;
        img.src = '';
        loadingText.style.display = 'block';
        lightbox.style.display = 'flex';
        requestAnimationFrame(() => {
            lightbox.style.opacity = '1';
        });

        const newImg = new Image();
        newImg.onload = function() {
            img.src = src;
            loadingText.style.display = 'none';
        };
        newImg.onerror = function() {
            loadingText.textContent = '❌ 图片加载失败';
            loadingText.style.display = 'block';
        };
        newImg.src = src;
    }

    function closeLightbox() {
        if (!isOpen) return;
        isOpen = false;
        lightbox.style.opacity = '0';
        setTimeout(() => {
            lightbox.style.display = 'none';
            img.src = '';
            loadingText.style.display = 'none';
            loadingText.textContent = '⏳ 加载中...';
        }, 300);
    }

    lightbox.addEventListener('click', closeLightbox);
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && isOpen) closeLightbox();
    });

    window.lightbox = { open: openLightbox, close: closeLightbox };
})();