import { state } from './state.js';
import { elements } from './dom.js';
import { renderSelectionOverlay } from './selection.js';

export function showFrame(index) {
    if (state.currentFrames.length === 0) return;

    state.currentFrameIndex = ((index % state.currentFrames.length) + state.currentFrames.length) % state.currentFrames.length;
    elements.frameInfo.textContent = `Frame ${state.currentFrameIndex + 1} / ${state.currentFrames.length}`;
    renderCurrentFrame();
}

export function renderCurrentFrame() {
    if (state.currentFrames.length === 0) return;

    const frameData = state.currentFrames[state.currentFrameIndex];
    const imageData = new ImageData(new Uint8ClampedArray(frameData), state.gifWidth, state.gifHeight);

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = state.gifWidth;
    tempCanvas.height = state.gifHeight;
    tempCanvas.getContext('2d').putImageData(imageData, 0, 0);

    elements.ctx.clearRect(0, 0, elements.previewCanvas.width, elements.previewCanvas.height);
    elements.ctx.drawImage(tempCanvas, 0, 0, elements.previewCanvas.width, elements.previewCanvas.height);
}

export function startAnimation() {
    if (state.animationInterval) clearInterval(state.animationInterval);
    if (state.currentFrames.length <= 1) return;

    state.isPlaying = true;
    elements.playPauseBtn.textContent = '⏸️ Pause';

    let lastTime = 0;
    const animate = () => {
        if (!state.isPlaying) return;

        const now = performance.now();
        if (now - lastTime >= state.frameDelays[state.currentFrameIndex]) {
            showFrame(state.currentFrameIndex + 1);
            lastTime = now;
        }
        requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
}

export function stopAnimation() {
    state.isPlaying = false;
    elements.playPauseBtn.textContent = '▶️ Play';
}

export function togglePlayPause() {
    if (state.isPlaying) {
        stopAnimation();
    } else {
        startAnimation();
    }
}

export function updateCanvasSize() {
    elements.previewCanvas.width = state.gifWidth * state.zoom;
    elements.previewCanvas.height = state.gifHeight * state.zoom;
    elements.ctx.imageSmoothingEnabled = false;
    elements.selectionCanvas.width = elements.previewCanvas.width;
    elements.selectionCanvas.height = elements.previewCanvas.height;
    renderSelectionOverlay();
}
