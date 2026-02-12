import { parseGIF, decompressFrames } from 'https://cdn.jsdelivr.net/npm/gifuct-js@2.1.2/+esm';
import { state } from './state.js';
import { elements } from './dom.js';
import { loadImageFromFile } from './utils.js';
import { updateCanvasSize, showFrame, startAnimation, stopAnimation } from './animation.js';
import { extractPalette } from './palette.js';
import { updateSelectionInfo } from './selection.js';

export async function handleFiles(files, updateSwapHistoryDisplay) {
    if (files.length === 0) return;

    files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    const firstFile = files[0];
    const fileNameWithoutExt = firstFile.name.replace(/\.[^/.]+$/, '');
    state.projectName = fileNameWithoutExt;
    elements.projectNameInput.value = fileNameWithoutExt;

    if (files.length === 1 && firstFile.type === 'image/gif') {
        await loadGif(firstFile, updateSwapHistoryDisplay);
    } else {
        const nonGifImages = files.filter(f => f.type.startsWith('image/'));
        if (nonGifImages.length > 0) {
            await loadImages(nonGifImages, updateSwapHistoryDisplay);
        } else {
            alert('Please upload image files (PNG, JPG, WebP) or a GIF file.');
        }
    }
}

export async function loadImages(files, updateSwapHistoryDisplay) {
    elements.loading.classList.remove('hidden');
    elements.mainContent.classList.add('hidden');

    try {
        state.originalFrames = [];
        state.currentFrames = [];
        state.frameDelays = [];
        state.colorSwapHistory = [];
        state.editHistory = [];
        state.redoHistory = [];
        state.selectionMask = null;
        state.polygonPoints = [];
        state.tempPolygonPoint = null;
        state.isPainting = false;
        state.activePaintTool = null;
        state.strokeSelectionSet = null;
        state.strokePixelMap.clear();

        let maxWidth = 0;
        let maxHeight = 0;
        const loadedImages = [];

        for (const file of files) {
            const img = await loadImageFromFile(file);
            loadedImages.push(img);
            maxWidth = Math.max(maxWidth, img.width);
            maxHeight = Math.max(maxHeight, img.height);
        }

        state.gifWidth = maxWidth;
        state.gifHeight = maxHeight;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = maxWidth;
        tempCanvas.height = maxHeight;
        const tempCtx = tempCanvas.getContext('2d');

        for (const img of loadedImages) {
            tempCtx.clearRect(0, 0, maxWidth, maxHeight);
            const offsetX = Math.floor((maxWidth - img.width) / 2);
            const offsetY = Math.floor((maxHeight - img.height) / 2);
            tempCtx.drawImage(img, offsetX, offsetY);

            const imageData = tempCtx.getImageData(0, 0, maxWidth, maxHeight);
            state.originalFrames.push(new Uint8ClampedArray(imageData.data));
            state.currentFrames.push(new Uint8ClampedArray(imageData.data));
            state.frameDelays.push(state.customFrameDelay);
        }

        updateCanvasSize();
        extractPalette();
        showFrame(0);

        if (state.currentFrames.length > 1) {
            startAnimation();
        } else {
            stopAnimation();
        }

        elements.loading.classList.add('hidden');
        elements.mainContent.classList.remove('hidden');
        updateSwapHistoryDisplay();
        updateSelectionInfo();

    } catch (error) {
        console.error('Error loading images:', error);
        alert('Error loading images: ' + error.message);
        elements.loading.classList.add('hidden');
    }
}

export async function loadGif(file, updateSwapHistoryDisplay) {
    elements.loading.classList.remove('hidden');
    elements.mainContent.classList.add('hidden');
    state.colorSwapHistory = [];
    state.editHistory = [];
    state.redoHistory = [];
    state.selectionMask = null;
    state.polygonPoints = [];
    state.tempPolygonPoint = null;
    state.isPainting = false;
    state.activePaintTool = null;
    state.strokeSelectionSet = null;
    state.strokePixelMap.clear();

    try {
        const arrayBuffer = await file.arrayBuffer();
        const gif = parseGIF(arrayBuffer);
        const frames = decompressFrames(gif, true);

        if (frames.length === 0) {
            alert('Could not parse GIF frames');
            return;
        }

        state.gifWidth = frames[0].dims.width;
        state.gifHeight = frames[0].dims.height;
        state.originalFrames = [];
        state.currentFrames = [];
        state.frameDelays = [];

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = gif.lsd.width;
        tempCanvas.height = gif.lsd.height;
        const tempCtx = tempCanvas.getContext('2d');

        for (let i = 0; i < frames.length; i++) {
            const frame = frames[i];
            if (i > 0) {
                const prevFrame = frames[i - 1];
                if (prevFrame.disposalType === 2) {
                    tempCtx.clearRect(prevFrame.dims.left, prevFrame.dims.top, prevFrame.dims.width, prevFrame.dims.height);
                } else if (prevFrame.disposalType === 3) {
                    tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
                }
            }

            const frameImageData = new ImageData(new Uint8ClampedArray(frame.patch), frame.dims.width, frame.dims.height);
            const patchCanvas = document.createElement('canvas');
            patchCanvas.width = frame.dims.width;
            patchCanvas.height = frame.dims.height;
            patchCanvas.getContext('2d').putImageData(frameImageData, 0, 0);
            tempCtx.drawImage(patchCanvas, frame.dims.left, frame.dims.top);

            const fullFrameData = tempCtx.getImageData(0, 0, gif.lsd.width, gif.lsd.height);
            state.originalFrames.push(new Uint8ClampedArray(fullFrameData.data));
            state.currentFrames.push(new Uint8ClampedArray(fullFrameData.data));
            state.frameDelays.push(frame.delay || 100);
        }

        state.gifWidth = gif.lsd.width;
        state.gifHeight = gif.lsd.height;

        updateCanvasSize();
        extractPalette();
        showFrame(0);
        startAnimation();

        elements.loading.classList.add('hidden');
        elements.mainContent.classList.remove('hidden');
        updateSwapHistoryDisplay();
        updateSelectionInfo();
    } catch (error) {
        console.error('Error loading GIF:', error);
        alert('Error loading GIF: ' + error.message);
        elements.loading.classList.add('hidden');
    }
}
