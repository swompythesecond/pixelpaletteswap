import { state } from './js/state.js';
import { elements } from './js/dom.js';
import {
    rgbToHex,
    rgbToLab,
    labToRgb,
    quantizeColorsLabWeighted,
    resizeFramesNearestNeighbor,
    getOpaqueBoundsAcrossFrames,
    cropFramesToBounds
} from './js/utils.js';
import { 
    selectTool, 
    updateSelectionInfo, 
    clearSelection, 
    invertSelection, 
    renderSelectionOverlay, 
    startMarchingAnts,
    applyRectangleSelection,
    applyPolygonSelection
} from './js/selection.js';
import {
    extractPalette,
    renderPalette,
    selectColor,
    handlePaletteSourceUpload,
    clearPaletteSource
} from './js/palette.js';
import { 
    showFrame, 
    renderCurrentFrame, 
    startAnimation, 
    stopAnimation, 
    togglePlayPause,
    updateCanvasSize 
} from './js/animation.js';
import { handleFiles } from './js/file-handler.js';
import { 
    exportCurrentFrame, 
    exportPngSequence, 
    exportPreset, 
    importPreset 
} from './js/export.js';

// Initialization
startMarchingAnts();
initializeReduceControls();
initializeResizeControls();
initializeTransparencyControls();
setReduceStatus('');
setResizeStatus('');
setTransparencyStatus('');
updateSwapHistoryDisplay();

let resizeAspectDriver = 'width';

function initializeReduceControls() {
    elements.reduceColorInput.value = state.reduceColorTarget;
    setActiveReducePreset(state.reduceColorTarget);
    elements.reduceToggle.checked = state.reduceEnabled;
    elements.reduceControlsPanel.classList.toggle('hidden', !state.reduceEnabled);

    elements.reduceToggle.addEventListener('change', (e) => {
        state.reduceEnabled = e.target.checked;
        elements.reduceControlsPanel.classList.toggle('hidden', !state.reduceEnabled);
        if (!state.reduceEnabled) {
            setReduceStatus('');
        }
    });

    elements.reducePresetButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const target = clampReduceTarget(btn.dataset.colors);
            state.reduceColorTarget = target;
            elements.reduceColorInput.value = target;
            setActiveReducePreset(target);
            setReduceStatus('');
        });
    });

    elements.reduceColorInput.addEventListener('input', (e) => {
        const parsed = parseInt(e.target.value, 10);
        if (!Number.isNaN(parsed)) {
            state.reduceColorTarget = clampReduceTarget(parsed);
            setActiveReducePreset(state.reduceColorTarget);
        }
    });

    elements.reduceColorInput.addEventListener('blur', (e) => {
        const clamped = clampReduceTarget(e.target.value);
        state.reduceColorTarget = clamped;
        e.target.value = clamped;
        setActiveReducePreset(clamped);
    });

    elements.applyReduceBtn.addEventListener('click', () => {
        applyColorReduction(state.reduceColorTarget);
    });
}

function clampReduceTarget(value) {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed)) return state.reduceColorTarget;
    return Math.max(state.reduceColorMin, Math.min(state.reduceColorMax, parsed));
}

function setActiveReducePreset(target) {
    elements.reducePresetButtons.forEach((btn) => {
        const buttonTarget = parseInt(btn.dataset.colors, 10);
        btn.classList.toggle('active', buttonTarget === target);
    });
}

function setReduceStatus(message, tone = 'neutral') {
    elements.reduceStatus.textContent = message;

    if (tone === 'error') {
        elements.reduceStatus.style.color = '#ff6b6b';
    } else if (tone === 'success') {
        elements.reduceStatus.style.color = '#4caf50';
    } else {
        elements.reduceStatus.style.color = '#888';
    }
}

function initializeResizeControls() {
    elements.resizePercentInput.value = state.resizePercent;
    elements.resizeWidthInput.value = state.resizeWidth;
    elements.resizeHeightInput.value = state.resizeHeight;
    elements.resizeKeepAspectCheckbox.checked = state.resizeKeepAspect;
    setActiveResizePreset(state.resizePercent);
    setResizeMode(state.resizeMode);

    elements.resizeModePercentBtn.addEventListener('click', () => {
        setResizeMode('percent');
        setResizeStatus('');
    });

    elements.resizeModePixelsBtn.addEventListener('click', () => {
        setResizeMode('pixels');
        setResizeStatus('');
    });

    elements.resizePresetButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const target = clampResizePercent(btn.dataset.percent);
            state.resizePercent = target;
            elements.resizePercentInput.value = target;
            setActiveResizePreset(target);
            setResizeMode('percent');
            setResizeStatus('');
        });
    });

    elements.resizePercentInput.addEventListener('input', (e) => {
        const parsed = parseInt(e.target.value, 10);
        if (!Number.isNaN(parsed)) {
            state.resizePercent = clampResizePercent(parsed);
            setActiveResizePreset(state.resizePercent);
        }
    });

    elements.resizePercentInput.addEventListener('blur', (e) => {
        const clamped = clampResizePercent(e.target.value);
        state.resizePercent = clamped;
        e.target.value = clamped;
        setActiveResizePreset(clamped);
    });

    elements.resizeWidthInput.addEventListener('input', (e) => {
        const parsed = parseInt(e.target.value, 10);
        if (!Number.isNaN(parsed)) {
            resizeAspectDriver = 'width';
            const clampedWidth = clampResizeDimension(parsed, state.resizeWidth);
            state.resizeWidth = clampedWidth;

            if (state.resizeKeepAspect) {
                const linkedHeight = getAspectLockedHeight(clampedWidth);
                state.resizeHeight = linkedHeight;
                elements.resizeHeightInput.value = linkedHeight;
            }
        }
    });

    elements.resizeHeightInput.addEventListener('input', (e) => {
        const parsed = parseInt(e.target.value, 10);
        if (!Number.isNaN(parsed)) {
            resizeAspectDriver = 'height';
            const clampedHeight = clampResizeDimension(parsed, state.resizeHeight);
            state.resizeHeight = clampedHeight;

            if (state.resizeKeepAspect) {
                const linkedWidth = getAspectLockedWidth(clampedHeight);
                state.resizeWidth = linkedWidth;
                elements.resizeWidthInput.value = linkedWidth;
            }
        }
    });

    elements.resizeWidthInput.addEventListener('blur', (e) => {
        resizeAspectDriver = 'width';
        const clampedWidth = clampResizeDimension(e.target.value, state.gifWidth || state.resizeWidth);
        state.resizeWidth = clampedWidth;
        e.target.value = clampedWidth;

        if (state.resizeKeepAspect) {
            const linkedHeight = getAspectLockedHeight(clampedWidth);
            state.resizeHeight = linkedHeight;
            elements.resizeHeightInput.value = linkedHeight;
        }
    });

    elements.resizeHeightInput.addEventListener('blur', (e) => {
        resizeAspectDriver = 'height';
        const clampedHeight = clampResizeDimension(e.target.value, state.gifHeight || state.resizeHeight);
        state.resizeHeight = clampedHeight;
        e.target.value = clampedHeight;

        if (state.resizeKeepAspect) {
            const linkedWidth = getAspectLockedWidth(clampedHeight);
            state.resizeWidth = linkedWidth;
            elements.resizeWidthInput.value = linkedWidth;
        }
    });

    elements.resizeKeepAspectCheckbox.addEventListener('change', (e) => {
        state.resizeKeepAspect = e.target.checked;
        if (state.resizeKeepAspect) {
            resizeAspectDriver = 'width';
            const linkedHeight = getAspectLockedHeight(state.resizeWidth);
            state.resizeHeight = linkedHeight;
            elements.resizeHeightInput.value = linkedHeight;
        }
        setResizeStatus('');
    });

    elements.applyResizeBtn.addEventListener('click', () => {
        applyImageResize();
    });

    syncResizeInputsFromCurrentSize();
}

function clampResizePercent(value) {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed)) return state.resizePercent;
    return Math.max(state.resizeMinPercent, Math.min(state.resizeMaxPercent, parsed));
}

function clampResizeDimension(value, fallback) {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed)) return fallback;
    return Math.max(1, Math.min(state.resizeMaxDimension, parsed));
}

function getResizeAspectBaseDimensions() {
    const baseWidth = state.gifWidth > 0 ? state.gifWidth : Math.max(1, state.resizeWidth);
    const baseHeight = state.gifHeight > 0 ? state.gifHeight : Math.max(1, state.resizeHeight);
    return { baseWidth, baseHeight };
}

function getAspectLockedHeight(width) {
    const { baseWidth, baseHeight } = getResizeAspectBaseDimensions();
    const scaledHeight = Math.round((width * baseHeight) / baseWidth);
    return clampResizeDimension(scaledHeight, Math.max(1, baseHeight));
}

function getAspectLockedWidth(height) {
    const { baseWidth, baseHeight } = getResizeAspectBaseDimensions();
    const scaledWidth = Math.round((height * baseWidth) / baseHeight);
    return clampResizeDimension(scaledWidth, Math.max(1, baseWidth));
}

function setResizeMode(mode) {
    state.resizeMode = mode === 'pixels' ? 'pixels' : 'percent';
    const isPixelsMode = state.resizeMode === 'pixels';
    elements.resizeModePercentBtn.classList.toggle('active', !isPixelsMode);
    elements.resizeModePixelsBtn.classList.toggle('active', isPixelsMode);
    elements.resizePercentPanel.classList.toggle('hidden', isPixelsMode);
    elements.resizePixelsPanel.classList.toggle('hidden', !isPixelsMode);
}

function setActiveResizePreset(target) {
    elements.resizePresetButtons.forEach((btn) => {
        const buttonTarget = parseInt(btn.dataset.percent, 10);
        btn.classList.toggle('active', buttonTarget === target);
    });
}

function syncResizeInputsFromCurrentSize() {
    if (state.currentFrames.length === 0) return;
    state.resizeWidth = state.gifWidth;
    state.resizeHeight = state.gifHeight;
    resizeAspectDriver = 'width';
    elements.resizeWidthInput.value = state.resizeWidth;
    elements.resizeHeightInput.value = state.resizeHeight;
}

function setResizeStatus(message, tone = 'neutral') {
    elements.resizeStatus.textContent = message;

    if (tone === 'error') {
        elements.resizeStatus.style.color = '#ff6b6b';
    } else if (tone === 'success') {
        elements.resizeStatus.style.color = '#6bc5ff';
    } else {
        elements.resizeStatus.style.color = '#888';
    }
}

function initializeTransparencyControls() {
    elements.transparencyThresholdInput.value = state.transparencyThreshold;

    elements.transparencyThresholdInput.addEventListener('input', (e) => {
        const parsed = parseInt(e.target.value, 10);
        if (!Number.isNaN(parsed)) {
            state.transparencyThreshold = clampTransparencyThreshold(parsed);
        }
    });

    elements.transparencyThresholdInput.addEventListener('blur', (e) => {
        const clamped = clampTransparencyThreshold(e.target.value);
        state.transparencyThreshold = clamped;
        e.target.value = clamped;
    });

    elements.deleteTransparentBtn.addEventListener('click', () => {
        applyTransparencyCleanup(state.transparencyThreshold);
    });

    elements.cropToAssetBtn.addEventListener('click', () => {
        applyCropToAssetBounds();
    });
}

function clampTransparencyThreshold(value) {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed)) return state.transparencyThreshold;
    return Math.max(state.transparencyThresholdMin, Math.min(state.transparencyThresholdMax, parsed));
}

function setTransparencyStatus(message, tone = 'neutral') {
    elements.transparencyStatus.textContent = message;

    if (tone === 'error') {
        elements.transparencyStatus.style.color = '#ff6b6b';
    } else if (tone === 'success') {
        elements.transparencyStatus.style.color = '#6bc5ff';
    } else {
        elements.transparencyStatus.style.color = '#888';
    }
}

function getSelectionContext() {
    if (!state.selectionMask) {
        return { hasSelection: false, selectedIndices: [], selectedSet: null };
    }

    const selectedIndices = [];
    for (let i = 0; i < state.selectionMask.length; i++) {
        if (state.selectionMask[i] === 1) selectedIndices.push(i);
    }

    if (selectedIndices.length === 0) {
        return { hasSelection: false, selectedIndices: [], selectedSet: null };
    }

    return {
        hasSelection: true,
        selectedIndices,
        selectedSet: new Set(selectedIndices)
    };
}

function getCanvasPixelFromEvent(e, clampToBounds = false) {
    const rect = elements.previewCanvas.getBoundingClientRect();
    const normalizedX = ((e.clientX - rect.left) / rect.width) * state.gifWidth;
    const normalizedY = ((e.clientY - rect.top) / rect.height) * state.gifHeight;

    let imgX = Math.floor(normalizedX);
    let imgY = Math.floor(normalizedY);

    if (clampToBounds) {
        imgX = Math.max(0, Math.min(state.gifWidth - 1, imgX));
        imgY = Math.max(0, Math.min(state.gifHeight - 1, imgY));
    } else if (imgX < 0 || imgX >= state.gifWidth || imgY < 0 || imgY >= state.gifHeight) {
        return null;
    }

    return {
        x: imgX,
        y: imgY,
        pixelIndex: imgY * state.gifWidth + imgX
    };
}

function getCurrentDrawColor() {
    const hex = elements.newColorPicker.value;
    return {
        r: parseInt(hex.slice(1, 3), 16),
        g: parseInt(hex.slice(3, 5), 16),
        b: parseInt(hex.slice(5, 7), 16),
        a: 255
    };
}

function canEditPixel(pixelIndex) {
    if (!state.strokeSelectionSet) return true;
    return state.strokeSelectionSet.has(pixelIndex);
}

function applyPaintAtPixel(pixel) {
    const frameData = state.currentFrames[state.currentFrameIndex];
    const dataIndex = pixel.pixelIndex * 4;

    if (!frameData || !canEditPixel(pixel.pixelIndex)) return false;

    const from = {
        r: frameData[dataIndex],
        g: frameData[dataIndex + 1],
        b: frameData[dataIndex + 2],
        a: frameData[dataIndex + 3]
    };

    const paintTool = state.activePaintTool || state.currentTool;
    const to = paintTool === 'eraser'
        ? { r: 0, g: 0, b: 0, a: 0 }
        : getCurrentDrawColor();

    if (from.r === to.r && from.g === to.g && from.b === to.b && from.a === to.a) {
        return false;
    }

    if (!state.strokePixelMap.has(pixel.pixelIndex)) {
        state.strokePixelMap.set(pixel.pixelIndex, { from, to });
    } else {
        state.strokePixelMap.get(pixel.pixelIndex).to = to;
    }

    frameData[dataIndex] = to.r;
    frameData[dataIndex + 1] = to.g;
    frameData[dataIndex + 2] = to.b;
    frameData[dataIndex + 3] = to.a;
    return true;
}

function beginPaintStroke(pixel) {
    stopAnimation();
    state.isPainting = true;
    state.activePaintTool = state.currentTool;
    const selectionContext = getSelectionContext();
    state.strokeSelectionSet = selectionContext.hasSelection ? selectionContext.selectedSet : null;
    state.strokePixelMap.clear();

    if (applyPaintAtPixel(pixel)) {
        renderCurrentFrame();
    }
}

function continuePaintStroke(pixel) {
    if (!state.isPainting) return;
    if (applyPaintAtPixel(pixel)) {
        renderCurrentFrame();
    }
}

function endPaintStroke() {
    if (!state.isPainting) return;
    state.isPainting = false;

    if (state.strokePixelMap.size === 0) {
        state.activePaintTool = null;
        state.strokeSelectionSet = null;
        return;
    }

    const paintTool = state.activePaintTool === 'eraser' ? 'eraser' : 'pencil';
    const pixels = Array.from(state.strokePixelMap.entries()).map(([pixelIndex, change]) => ({
        pixelIndex,
        from: change.from,
        to: change.to
    }));

    pushEditHistoryEntry({
        type: 'paint',
        tool: paintTool,
        frameIndex: state.currentFrameIndex,
        changedPixelCount: pixels.length,
        pixels
    });

    state.activePaintTool = null;
    state.strokeSelectionSet = null;
    state.strokePixelMap.clear();
    extractPalette();
    renderCurrentFrame();
    renderSelectionOverlay();
    updateSwapHistoryDisplay();
}

function clearColorSelectionState() {
    state.selectedColor = null;
    state.selectedGroup = null;
    state.selectedAnchorColor = null;
    elements.applySwapBtn.disabled = true;
    elements.originalColorEl.style.background = '#888';
    elements.originalColorLabel.textContent = 'Original';
    elements.originalColorLabel.classList.remove('anchor-label');
}

function applySwapEntryToFrames(swapEntry) {
    const oldR = swapEntry.from.r;
    const oldG = swapEntry.from.g;
    const oldB = swapEntry.from.b;
    const newR = swapEntry.to.r;
    const newG = swapEntry.to.g;
    const newB = swapEntry.to.b;
    const selectedSet = swapEntry.hasSelection && swapEntry.selectedIndices
        ? new Set(swapEntry.selectedIndices)
        : null;

    for (const frameData of state.currentFrames) {
        for (let i = 0; i < frameData.length; i += 4) {
            const pixelIndex = i / 4;
            if (selectedSet && !selectedSet.has(pixelIndex)) continue;
            if (frameData[i] === oldR && frameData[i + 1] === oldG && frameData[i + 2] === oldB) {
                frameData[i] = newR;
                frameData[i + 1] = newG;
                frameData[i + 2] = newB;
            }
        }
    }
}

function applyReductionEntryToFrames(reductionEntry) {
    const selectedSet = reductionEntry.hasSelection && reductionEntry.selectedIndices
        ? new Set(reductionEntry.selectedIndices)
        : null;

    for (const frameData of state.currentFrames) {
        for (let i = 0; i < frameData.length; i += 4) {
            const pixelIndex = i / 4;
            if (selectedSet && !selectedSet.has(pixelIndex)) continue;
            if (frameData[i + 3] === 0) continue;

            const colorKey = `${frameData[i]},${frameData[i + 1]},${frameData[i + 2]}`;
            const mappedColor = reductionEntry.colorMap[colorKey];
            if (!mappedColor) continue;

            frameData[i] = mappedColor.r;
            frameData[i + 1] = mappedColor.g;
            frameData[i + 2] = mappedColor.b;
        }
    }
}

function applyPaintEntryToFrames(paintEntry) {
    const frameData = state.currentFrames[paintEntry.frameIndex];
    if (!frameData || !Array.isArray(paintEntry.pixels)) return;

    for (const change of paintEntry.pixels) {
        const dataIndex = change.pixelIndex * 4;
        if (dataIndex < 0 || dataIndex + 3 >= frameData.length) continue;
        frameData[dataIndex] = change.to.r;
        frameData[dataIndex + 1] = change.to.g;
        frameData[dataIndex + 2] = change.to.b;
        frameData[dataIndex + 3] = change.to.a;
    }
}

function applyResizeEntryToFrames(resizeEntry) {
    const fromWidth = resizeEntry.fromWidth || state.gifWidth;
    const fromHeight = resizeEntry.fromHeight || state.gifHeight;
    const toWidth = resizeEntry.toWidth;
    const toHeight = resizeEntry.toHeight;

    if (!toWidth || !toHeight || toWidth < 1 || toHeight < 1) return;

    state.currentFrames = resizeFramesNearestNeighbor(
        state.currentFrames,
        fromWidth,
        fromHeight,
        toWidth,
        toHeight
    );
    state.gifWidth = toWidth;
    state.gifHeight = toHeight;
}

function applyCropTransparentBorderEntryToFrames(cropEntry) {
    const fromWidth = cropEntry.fromWidth || state.gifWidth;
    const fromHeight = cropEntry.fromHeight || state.gifHeight;
    const toWidth = cropEntry.toWidth;
    const toHeight = cropEntry.toHeight;
    const offsetX = cropEntry.offsetX ?? 0;
    const offsetY = cropEntry.offsetY ?? 0;

    if (
        !Number.isInteger(toWidth) || !Number.isInteger(toHeight) ||
        !Number.isInteger(offsetX) || !Number.isInteger(offsetY) ||
        toWidth < 1 || toHeight < 1 ||
        offsetX < 0 || offsetY < 0 ||
        offsetX + toWidth > fromWidth ||
        offsetY + toHeight > fromHeight
    ) {
        return;
    }

    const bounds = {
        minX: offsetX,
        minY: offsetY,
        width: toWidth,
        height: toHeight
    };

    state.currentFrames = cropFramesToBounds(
        state.currentFrames,
        fromWidth,
        fromHeight,
        bounds
    );
    state.gifWidth = toWidth;
    state.gifHeight = toHeight;
}

function applyTransparencyCleanupEntryToFrames(cleanupEntry) {
    const selectedSet = cleanupEntry.hasSelection && cleanupEntry.selectedIndices
        ? new Set(cleanupEntry.selectedIndices)
        : null;
    const thresholdAlpha = cleanupEntry.thresholdAlpha ?? Math.round((cleanupEntry.thresholdPercent / 100) * 255);

    for (const frameData of state.currentFrames) {
        for (let i = 0; i < frameData.length; i += 4) {
            const pixelIndex = i / 4;
            if (selectedSet && !selectedSet.has(pixelIndex)) continue;

            const alpha = frameData[i + 3];
            if (alpha > 0 && alpha < thresholdAlpha) {
                frameData[i] = 0;
                frameData[i + 1] = 0;
                frameData[i + 2] = 0;
                frameData[i + 3] = 0;
            }
        }
    }
}

function rebuildFramesFromHistory() {
    state.gifWidth = state.originalWidth;
    state.gifHeight = state.originalHeight;
    state.currentFrames = state.originalFrames.map((frame) => new Uint8ClampedArray(frame));

    state.colorSwapHistory = [];

    for (const entry of state.editHistory) {
        if (entry.type === 'swap') {
            applySwapEntryToFrames(entry.swap);
            state.colorSwapHistory.push(entry.swap);
        } else if (entry.type === 'reduction') {
            applyReductionEntryToFrames(entry);
        } else if (entry.type === 'paint') {
            applyPaintEntryToFrames(entry);
        } else if (entry.type === 'resize') {
            applyResizeEntryToFrames(entry);
        } else if (entry.type === 'crop_transparent_border') {
            applyCropTransparentBorderEntryToFrames(entry);
        } else if (entry.type === 'transparency_cleanup') {
            applyTransparencyCleanupEntryToFrames(entry);
        }
    }
}

function pushEditHistoryEntry(entry) {
    state.editHistory.push(entry);
    state.redoHistory = [];
}

function pushEditHistoryEntries(entries) {
    if (entries.length === 0) return;
    state.editHistory.push(...entries);
    state.redoHistory = [];
}

function updateHistoryButtons() {
    elements.undoBtn.disabled = state.editHistory.length === 0;
    elements.redoBtn.disabled = state.redoHistory.length === 0;
}

// Event Listeners
elements.projectNameInput.addEventListener('input', (e) => {
    state.projectName = e.target.value.trim() || 'palette-swapped';
});

elements.newColorPicker.addEventListener('input', (e) => {
    elements.newColorHex.value = e.target.value.toUpperCase();
});

elements.newColorHex.addEventListener('input', (e) => {
    let val = e.target.value;
    if (val && !val.startsWith('#')) {
        val = '#' + val;
        e.target.value = val;
    }
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
        elements.newColorPicker.value = val.toLowerCase();
        e.target.style.borderColor = '#555';
    } else if (val.length > 1) {
        e.target.style.borderColor = '#e94560';
    }
});

elements.newColorHex.addEventListener('blur', (e) => {
    let val = e.target.value;
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
        e.target.value = val.toUpperCase();
        e.target.style.borderColor = '#555';
    } else {
        e.target.value = elements.newColorPicker.value.toUpperCase();
        e.target.style.borderColor = '#555';
    }
});

elements.toolNoneBtn.addEventListener('click', () => selectTool('none'));
elements.toolRectBtn.addEventListener('click', () => selectTool('rect'));
elements.toolPolyBtn.addEventListener('click', () => selectTool('poly'));
elements.toolPencilBtn.addEventListener('click', () => selectTool('pencil'));
elements.toolEraserBtn.addEventListener('click', () => selectTool('eraser'));
elements.invertSelectionBtn.addEventListener('click', invertSelection);
elements.clearSelectionBtn.addEventListener('click', clearSelection);

elements.uploadArea.addEventListener('click', () => elements.fileInput.click());
elements.uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    elements.uploadArea.style.borderColor = '#ff6b6b';
});
elements.uploadArea.addEventListener('dragleave', () => {
    elements.uploadArea.style.borderColor = '#e94560';
});
elements.uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.uploadArea.style.borderColor = '#e94560';
    setReduceStatus('');
    setResizeStatus('');
    setTransparencyStatus('');
    Promise.resolve(handleFiles(Array.from(e.dataTransfer.files), updateSwapHistoryDisplay))
        .finally(() => {
            syncResizeInputsFromCurrentSize();
        });
});
elements.fileInput.addEventListener('change', (e) => {
    setReduceStatus('');
    setResizeStatus('');
    setTransparencyStatus('');
    Promise.resolve(handleFiles(Array.from(e.target.files), updateSwapHistoryDisplay))
        .finally(() => {
            syncResizeInputsFromCurrentSize();
        });
});

elements.playPauseBtn.addEventListener('click', togglePlayPause);
elements.prevFrameBtn.addEventListener('click', () => { stopAnimation(); showFrame(state.currentFrameIndex - 1); });
elements.nextFrameBtn.addEventListener('click', () => { stopAnimation(); showFrame(state.currentFrameIndex + 1); });
elements.exportBtn.addEventListener('click', exportCurrentFrame);
elements.exportPngBtn.addEventListener('click', exportPngSequence);
elements.applySwapBtn.addEventListener('click', applyColorSwap);
elements.resetBtn.addEventListener('click', resetChanges);
elements.undoBtn.addEventListener('click', undoLastEdit);
elements.redoBtn.addEventListener('click', redoLastEdit);
elements.exportPresetBtn.addEventListener('click', exportPreset);
elements.importPresetBtn.addEventListener('click', () => elements.importPresetInput.click());
elements.importPresetInput.addEventListener('change', (e) => {
    setReduceStatus('');
    setResizeStatus('');
    setTransparencyStatus('');
    Promise.resolve(importPreset(e, updateSwapHistoryDisplay))
        .finally(() => {
            syncResizeInputsFromCurrentSize();
        });
});

elements.zoomSlider.addEventListener('input', (e) => {
    state.zoom = parseInt(e.target.value);
    elements.zoomValue.textContent = state.zoom;
    updateCanvasSize();
    renderCurrentFrame();
});

elements.speedSlider.addEventListener('input', (e) => {
    const fps = parseInt(e.target.value);
    state.customFrameDelay = Math.round(1000 / fps);
    elements.speedValue.textContent = fps;
    state.frameDelays = state.frameDelays.map(() => state.customFrameDelay);
});

// Color grouping controls
elements.groupingToggle.addEventListener('change', (e) => {
    state.colorGroupingEnabled = e.target.checked;
    elements.groupingThresholdContainer.classList.toggle('hidden', !e.target.checked);

    // Clear selections when toggling
    clearColorSelectionState();

    renderPalette();
});

// Debounced threshold update for performance with large palettes
let thresholdDebounceTimer = null;

function updateThreshold(value, source) {
    const clamped = Math.max(1, Math.min(100, parseInt(value) || 30));
    state.colorGroupingThreshold = clamped;

    // Sync both inputs
    if (source !== 'slider') elements.groupingThreshold.value = clamped;
    if (source !== 'input') elements.thresholdInput.value = clamped;

    // Clear selection
    clearColorSelectionState();

    // Debounce the expensive re-render
    clearTimeout(thresholdDebounceTimer);
    thresholdDebounceTimer = setTimeout(() => {
        renderPalette();
    }, 150);
}

elements.groupingThreshold.addEventListener('input', (e) => {
    updateThreshold(e.target.value, 'slider');
});

elements.thresholdInput.addEventListener('input', (e) => {
    updateThreshold(e.target.value, 'input');
});

elements.thresholdInput.addEventListener('blur', (e) => {
    // Ensure valid value on blur
    const clamped = Math.max(1, Math.min(100, parseInt(e.target.value) || 30));
    e.target.value = clamped;
    elements.groupingThreshold.value = clamped;
});

// Ctrl+scroll zoom functionality
elements.previewContainer.addEventListener('wheel', (e) => {
    if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -1 : 1;
        const oldZoom = state.zoom;
        state.zoom = Math.max(1, Math.min(50, state.zoom + delta));

        if (state.zoom !== oldZoom) {
            elements.zoomSlider.value = state.zoom;
            elements.zoomValue.textContent = state.zoom;

            const scrollXRatio = elements.previewContainer.scrollWidth > elements.previewContainer.clientWidth
                ? elements.previewContainer.scrollLeft / (elements.previewContainer.scrollWidth - elements.previewContainer.clientWidth)
                : 0.5;
            const scrollYRatio = elements.previewContainer.scrollHeight > elements.previewContainer.clientHeight
                ? elements.previewContainer.scrollTop / (elements.previewContainer.scrollHeight - elements.previewContainer.clientHeight)
                : 0.5;

            updateCanvasSize();
            renderCurrentFrame();

            requestAnimationFrame(() => {
                if (elements.previewContainer.scrollWidth > elements.previewContainer.clientWidth) {
                    elements.previewContainer.scrollLeft = scrollXRatio * (elements.previewContainer.scrollWidth - elements.previewContainer.clientWidth);
                }
                if (elements.previewContainer.scrollHeight > elements.previewContainer.clientHeight) {
                    elements.previewContainer.scrollTop = scrollYRatio * (elements.previewContainer.scrollHeight - elements.previewContainer.clientHeight);
                }
            });
        }
    }
}, { passive: false });

// Ctrl+drag pan functionality
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let panScrollStartX = 0;
let panScrollStartY = 0;

elements.previewContainer.addEventListener('mousedown', (e) => {
    if (e.ctrlKey && e.button === 0) {
        isPanning = true;
        panStartX = e.clientX;
        panStartY = e.clientY;
        panScrollStartX = elements.previewContainer.scrollLeft;
        panScrollStartY = elements.previewContainer.scrollTop;
        elements.previewContainer.style.cursor = 'grabbing';
        e.preventDefault();
    }
});

document.addEventListener('mousemove', (e) => {
    if (isPanning) {
        const dx = e.clientX - panStartX;
        const dy = e.clientY - panStartY;
        elements.previewContainer.scrollLeft = panScrollStartX - dx;
        elements.previewContainer.scrollTop = panScrollStartY - dy;
    }
});

document.addEventListener('mouseup', () => {
    if (isPanning) {
        isPanning = false;
        elements.previewContainer.style.cursor = '';
    }
    endPaintStroke();
});

elements.paletteSourceUpload.addEventListener('click', () => elements.paletteSourceInput.click());
elements.paletteSourceInput.addEventListener('change', handlePaletteSourceUpload);
elements.clearPaletteSourceBtn.addEventListener('click', clearPaletteSource);

elements.paletteSourceUpload.addEventListener('dragover', (e) => {
    e.preventDefault();
    elements.paletteSourceUpload.style.borderColor = '#e94560';
});
elements.paletteSourceUpload.addEventListener('dragleave', () => {
    elements.paletteSourceUpload.style.borderColor = state.sourcePaletteColors.size > 0 ? '#4caf50' : '#555';
});
elements.paletteSourceUpload.addEventListener('drop', async (e) => {
    e.preventDefault();
    elements.paletteSourceUpload.style.borderColor = state.sourcePaletteColors.size > 0 ? '#4caf50' : '#555';
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        const { loadPaletteSourceImage } = await import('./js/palette.js');
        loadPaletteSourceImage(file);
    }
});

// Canvas mouse events
elements.previewCanvas.addEventListener('click', (e) => {
    if (state.currentFrames.length === 0) return;
    if (state.currentTool !== 'none') return;

    const rect = elements.previewCanvas.getBoundingClientRect();
    const imgX = Math.floor(((e.clientX - rect.left) / rect.width) * state.gifWidth);
    const imgY = Math.floor(((e.clientY - rect.top) / rect.height) * state.gifHeight);

    if (imgX < 0 || imgX >= state.gifWidth || imgY < 0 || imgY >= state.gifHeight) return;

    const frameData = state.currentFrames[state.currentFrameIndex];
    const pixelIndex = (imgY * state.gifWidth + imgX) * 4;
    const r = frameData[pixelIndex];
    const g = frameData[pixelIndex + 1];
    const b = frameData[pixelIndex + 2];
    const a = frameData[pixelIndex + 3];

    if (a === 0) return;

    const colorKey = `${r},${g},${b}`;
    const colorItem = document.querySelector(`.color-item[data-color="${colorKey}"]`);
    if (colorItem) {
        selectColor(colorKey, colorItem);
        colorItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
});

elements.previewCanvas.addEventListener('mousedown', (e) => {
    if (state.currentFrames.length === 0) return;
    if (e.button !== 0) return;

    const pixel = getCanvasPixelFromEvent(e);
    if (!pixel) return;

    if (state.currentTool === 'rect') {
        state.isDrawingSelection = true;
        state.selectionStart = { x: pixel.x, y: pixel.y };
        state.selectionEnd = { x: pixel.x, y: pixel.y };
        renderSelectionOverlay();
    } else if (state.currentTool === 'poly') {
        state.polygonPoints.push({ x: pixel.x, y: pixel.y });
        state.tempPolygonPoint = null;
        renderSelectionOverlay();
        updateSelectionInfo();
    } else if (state.currentTool === 'pencil' || state.currentTool === 'eraser') {
        beginPaintStroke(pixel);
    }
});

elements.previewCanvas.addEventListener('mousemove', (e) => {
    if (state.currentFrames.length === 0) return;

    const pixel = getCanvasPixelFromEvent(e, true);

    if (state.currentTool === 'rect' && state.isDrawingSelection) {
        state.selectionEnd = { x: pixel.x, y: pixel.y };
        renderSelectionOverlay();
    } else if (state.currentTool === 'poly' && state.polygonPoints.length > 0) {
        state.tempPolygonPoint = { x: pixel.x, y: pixel.y };
        renderSelectionOverlay();
    } else if ((state.currentTool === 'pencil' || state.currentTool === 'eraser') && state.isPainting) {
        continuePaintStroke(pixel);
        renderSelectionOverlay();
    }
});

elements.previewCanvas.addEventListener('mouseup', (e) => {
    if (state.currentTool === 'rect' && state.isDrawingSelection) {
        state.isDrawingSelection = false;
        applyRectangleSelection(state.selectionStart.x, state.selectionStart.y, state.selectionEnd.x, state.selectionEnd.y);
        renderSelectionOverlay();
    } else if (state.currentTool === 'pencil' || state.currentTool === 'eraser') {
        endPaintStroke();
    }
});

elements.previewCanvas.addEventListener('mouseleave', () => {
    if (state.currentTool === 'rect' && state.isDrawingSelection) {
        state.isDrawingSelection = false;
        applyRectangleSelection(state.selectionStart.x, state.selectionStart.y, state.selectionEnd.x, state.selectionEnd.y);
        renderSelectionOverlay();
    } else if (state.currentTool === 'pencil' || state.currentTool === 'eraser') {
        endPaintStroke();
    }
});

elements.previewCanvas.addEventListener('dblclick', (e) => {
    if (state.currentTool === 'poly' && state.polygonPoints.length >= 3) {
        applyPolygonSelection(state.polygonPoints);
        state.polygonPoints = [];
        state.tempPolygonPoint = null;
        renderSelectionOverlay();
    }
});

document.addEventListener('keydown', (e) => {
    const tagName = e.target?.tagName || '';
    const isTypingTarget = e.target?.isContentEditable || tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
    const key = e.key.toLowerCase();
    const hasCtrl = e.ctrlKey || e.metaKey;

    if (hasCtrl && !isTypingTarget) {
        if (key === 'z') {
            e.preventDefault();
            if (e.shiftKey) {
                redoLastEdit();
            } else {
                undoLastEdit();
            }
            return;
        }
        if (key === 'y') {
            e.preventDefault();
            redoLastEdit();
            return;
        }
    }

    if (!hasCtrl && !isTypingTarget) {
        if (key === 'd') {
            selectTool('pencil');
            return;
        }
        if (key === 'o') {
            selectTool('none');
            return;
        }
        if (key === 'e') {
            selectTool('eraser');
            return;
        }
        if (key === 's') {
            selectTool('rect');
            return;
        }
        if (key === 'p') {
            selectTool('poly');
            return;
        }
    }

    if (e.key === 'Enter' && state.currentTool === 'poly' && state.polygonPoints.length >= 3) {
        applyPolygonSelection(state.polygonPoints);
        state.polygonPoints = [];
        state.tempPolygonPoint = null;
        renderSelectionOverlay();
    } else if (e.key === 'Escape') {
        if (state.currentTool === 'poly' && state.polygonPoints.length > 0) {
            state.polygonPoints = [];
            state.tempPolygonPoint = null;
            renderSelectionOverlay();
            updateSelectionInfo();
        } else if (state.isDrawingSelection) {
            state.isDrawingSelection = false;
            renderSelectionOverlay();
        } else if (state.isPainting) {
            endPaintStroke();
        }
    }
});

// Logic functions
function applyColorSwap() {
    // Handle group swap if in grouping mode with a selected group
    if (state.colorGroupingEnabled && state.selectedGroup !== null) {
        applyGroupSwap();
        return;
    }

    if (!state.selectedColor) return;

    const [oldR, oldG, oldB] = state.selectedColor.split(',').map(Number);
    const newHex = elements.newColorPicker.value;
    const newR = parseInt(newHex.slice(1, 3), 16);
    const newG = parseInt(newHex.slice(3, 5), 16);
    const newB = parseInt(newHex.slice(5, 7), 16);

    if (oldR === newR && oldG === newG && oldB === newB) return;

    const selectionContext = getSelectionContext();
    const oldHex = rgbToHex(oldR, oldG, oldB);
    const swapEntry = {
        from: { r: oldR, g: oldG, b: oldB, hex: oldHex },
        to: { r: newR, g: newG, b: newB, hex: newHex },
        hasSelection: selectionContext.hasSelection
    };

    if (selectionContext.hasSelection) {
        swapEntry.selectedIndices = selectionContext.selectedIndices;
    }

    state.colorSwapHistory.push(swapEntry);
    pushEditHistoryEntry({ type: 'swap', swap: swapEntry });
    applySwapEntryToFrames(swapEntry);

    extractPalette();
    renderCurrentFrame();
    updateSwapHistoryDisplay();
    clearColorSelectionState();
}

function applyGroupSwap() {
    const groupIndex = state.selectedGroup;
    const groupKeys = state.colorGroups[groupIndex];

    if (!groupKeys || groupKeys.length === 0) return;

    // Get the target color from the picker
    const newHex = elements.newColorPicker.value;
    const targetR = parseInt(newHex.slice(1, 3), 16);
    const targetG = parseInt(newHex.slice(3, 5), 16);
    const targetB = parseInt(newHex.slice(5, 7), 16);

    // Calculate the color mapping for each color in the group
    const colorMappings = calculateGradientMapping(groupKeys, targetR, targetG, targetB);
    const selectionContext = getSelectionContext();
    let hasChanges = false;

    const swapHistoryEntries = [];

    // Record each individual color swap in history (for undo compatibility)
    for (const [oldKey, newColor] of colorMappings) {
        const [oldR, oldG, oldB] = oldKey.split(',').map(Number);

        // Skip if color didn't change
        if (oldR === newColor.r && oldG === newColor.g && oldB === newColor.b) continue;

        const swapEntry = {
            from: { r: oldR, g: oldG, b: oldB, hex: rgbToHex(oldR, oldG, oldB) },
            to: { r: newColor.r, g: newColor.g, b: newColor.b, hex: rgbToHex(newColor.r, newColor.g, newColor.b) },
            hasSelection: selectionContext.hasSelection
        };

        if (selectionContext.hasSelection) {
            swapEntry.selectedIndices = selectionContext.selectedIndices;
        }

        state.colorSwapHistory.push(swapEntry);
        swapHistoryEntries.push({ type: 'swap', swap: swapEntry });
        hasChanges = true;
    }

    if (!hasChanges) {
        return;
    }

    pushEditHistoryEntries(swapHistoryEntries);

    // Apply the mappings to all frames
    for (const frameData of state.currentFrames) {
        for (let i = 0; i < frameData.length; i += 4) {
            const pixelIndex = i / 4;
            if (selectionContext.hasSelection && !selectionContext.selectedSet.has(pixelIndex)) continue;
            if (frameData[i + 3] === 0) continue;

            const colorKey = `${frameData[i]},${frameData[i + 1]},${frameData[i + 2]}`;
            const mapping = colorMappings.get(colorKey);

            if (mapping) {
                frameData[i] = mapping.r;
                frameData[i + 1] = mapping.g;
                frameData[i + 2] = mapping.b;
            }
        }
    }

    extractPalette();
    renderCurrentFrame();
    updateSwapHistoryDisplay();
    clearColorSelectionState();
}

/**
 * Calculate how to map each color in a gradient group to preserve the gradient structure
 * Strategy: Calculate the LAB-space offset from the anchor color to target,
 * then apply that offset to all colors in the group
 */
function calculateGradientMapping(groupKeys, targetR, targetG, targetB) {
    const mappings = new Map();

    // Get the original colors with their LAB values
    const originalColors = groupKeys.map(key => {
        const [r, g, b] = key.split(',').map(Number);
        const lab = rgbToLab(r, g, b);
        return { key, r, g, b, lab };
    });

    // Find the anchor color (the one clicked/selected by the user)
    let anchorColor;
    if (state.selectedAnchorColor) {
        anchorColor = originalColors.find(c => c.key === state.selectedAnchorColor);
    }
    // Fallback to middle color if anchor not found
    if (!anchorColor) {
        const middleIndex = Math.floor(originalColors.length / 2);
        anchorColor = originalColors[middleIndex];
    }

    // Calculate the shift in LAB space
    const targetLab = rgbToLab(targetR, targetG, targetB);
    const deltaL = targetLab.L - anchorColor.lab.L;
    const deltaA = targetLab.a - anchorColor.lab.a;
    const deltaB = targetLab.b - anchorColor.lab.b;

    // Apply the shift to all colors in the group
    for (const color of originalColors) {
        const newL = Math.max(0, Math.min(100, color.lab.L + deltaL));
        const newA = color.lab.a + deltaA;
        const newB = color.lab.b + deltaB;

        const newRgb = labToRgb(newL, newA, newB);

        mappings.set(color.key, {
            r: newRgb.r,
            g: newRgb.g,
            b: newRgb.b
        });
    }

    return mappings;
}

function applyColorReduction(targetValue) {
    if (!state.reduceEnabled) {
        setReduceStatus('Enable Reduce Colors to apply color reduction.', 'neutral');
        return;
    }

    if (state.currentFrames.length === 0) {
        setReduceStatus('Load an image before reducing colors.', 'error');
        return;
    }

    const targetCount = clampReduceTarget(targetValue);
    state.reduceColorTarget = targetCount;
    elements.reduceColorInput.value = targetCount;
    setActiveReducePreset(targetCount);

    const selectionContext = getSelectionContext();
    const scopedColorCounts = new Map();

    for (const frameData of state.currentFrames) {
        for (let i = 0; i < frameData.length; i += 4) {
            const pixelIndex = i / 4;
            if (selectionContext.hasSelection && !selectionContext.selectedSet.has(pixelIndex)) continue;

            const a = frameData[i + 3];
            if (a === 0) continue;

            const r = frameData[i];
            const g = frameData[i + 1];
            const b = frameData[i + 2];
            const colorKey = `${r},${g},${b}`;

            if (!scopedColorCounts.has(colorKey)) {
                scopedColorCounts.set(colorKey, { r, g, b, count: 1 });
            } else {
                scopedColorCounts.get(colorKey).count++;
            }
        }
    }

    const fromColorCount = scopedColorCounts.size;
    if (fromColorCount === 0) {
        setReduceStatus('No opaque pixels found in the current scope.', 'error');
        return;
    }

    if (targetCount >= fromColorCount) {
        setReduceStatus(`No reduction needed: scope already has ${fromColorCount} colors.`, 'neutral');
        return;
    }

    const reductionMap = quantizeColorsLabWeighted(scopedColorCounts, targetCount);
    const colorMap = {};
    let changedPixels = 0;
    let affectedPixelCount = 0;

    for (const [key, value] of reductionMap.entries()) {
        colorMap[key] = { r: value.r, g: value.g, b: value.b };
    }

    for (const frameData of state.currentFrames) {
        for (let i = 0; i < frameData.length; i += 4) {
            const pixelIndex = i / 4;
            if (selectionContext.hasSelection && !selectionContext.selectedSet.has(pixelIndex)) continue;
            if (frameData[i + 3] === 0) continue;

            affectedPixelCount++;
            const colorKey = `${frameData[i]},${frameData[i + 1]},${frameData[i + 2]}`;
            const mappedColor = colorMap[colorKey];
            if (!mappedColor) continue;

            if (mappedColor.r !== frameData[i] || mappedColor.g !== frameData[i + 1] || mappedColor.b !== frameData[i + 2]) {
                frameData[i] = mappedColor.r;
                frameData[i + 1] = mappedColor.g;
                frameData[i + 2] = mappedColor.b;
                changedPixels++;
            }
        }
    }

    if (changedPixels === 0) {
        setReduceStatus('Reduction produced no visible pixel changes.', 'neutral');
        return;
    }

    const uniqueReducedColors = new Set(Object.values(colorMap).map((c) => `${c.r},${c.g},${c.b}`));
    const reductionEntry = {
        type: 'reduction',
        targetCount,
        hasSelection: selectionContext.hasSelection,
        colorMap,
        fromColorCount,
        toColorCount: uniqueReducedColors.size,
        affectedPixelCount,
        changedPixelCount: changedPixels
    };

    if (selectionContext.hasSelection) {
        reductionEntry.selectedIndices = selectionContext.selectedIndices;
    }

    pushEditHistoryEntry(reductionEntry);

    extractPalette();
    renderCurrentFrame();
    updateSwapHistoryDisplay();
    clearColorSelectionState();
    setTransparencyStatus('');
    setReduceStatus(
        `Reduced ${fromColorCount} -> ${reductionEntry.toColorCount} colors (${changedPixels} pixels changed).`,
        'success'
    );
}

function applyTransparencyCleanup(targetValue) {
    if (state.currentFrames.length === 0) {
        setTransparencyStatus('Load an image before deleting transparent pixels.', 'error');
        return;
    }

    const thresholdPercent = clampTransparencyThreshold(targetValue);
    state.transparencyThreshold = thresholdPercent;
    elements.transparencyThresholdInput.value = thresholdPercent;

    const thresholdAlpha = Math.round((thresholdPercent / 100) * 255);
    const selectionContext = getSelectionContext();
    let changedPixels = 0;
    let affectedPixelCount = 0;

    for (const frameData of state.currentFrames) {
        for (let i = 0; i < frameData.length; i += 4) {
            const pixelIndex = i / 4;
            if (selectionContext.hasSelection && !selectionContext.selectedSet.has(pixelIndex)) continue;

            affectedPixelCount++;
            const alpha = frameData[i + 3];
            if (alpha > 0 && alpha < thresholdAlpha) {
                frameData[i] = 0;
                frameData[i + 1] = 0;
                frameData[i + 2] = 0;
                frameData[i + 3] = 0;
                changedPixels++;
            }
        }
    }

    if (changedPixels === 0) {
        setTransparencyStatus(
            `No pixels found below ${thresholdPercent}% opacity in the current scope.`,
            'neutral'
        );
        return;
    }

    const cleanupEntry = {
        type: 'transparency_cleanup',
        thresholdPercent,
        thresholdAlpha,
        hasSelection: selectionContext.hasSelection,
        affectedPixelCount,
        changedPixelCount: changedPixels
    };

    if (selectionContext.hasSelection) {
        cleanupEntry.selectedIndices = selectionContext.selectedIndices;
    }

    pushEditHistoryEntry(cleanupEntry);
    extractPalette();
    renderCurrentFrame();
    renderSelectionOverlay();
    updateSwapHistoryDisplay();
    clearColorSelectionState();
    setTransparencyStatus(
        `Deleted ${changedPixels} pixels below ${thresholdPercent}% opacity.`,
        'success'
    );
}

function applyCropToAssetBounds() {
    if (state.currentFrames.length === 0) {
        setTransparencyStatus('Load an image before cropping.', 'error');
        return;
    }

    const fromWidth = state.gifWidth;
    const fromHeight = state.gifHeight;
    const bounds = getOpaqueBoundsAcrossFrames(state.currentFrames, fromWidth, fromHeight);

    if (!bounds) {
        setTransparencyStatus('Image has no visible pixels to crop.', 'error');
        return;
    }

    if (
        bounds.minX === 0 &&
        bounds.minY === 0 &&
        bounds.width === fromWidth &&
        bounds.height === fromHeight
    ) {
        setTransparencyStatus('No transparent border to crop.', 'neutral');
        return;
    }

    const wasPlaying = state.isPlaying;
    stopAnimation();

    state.currentFrames = cropFramesToBounds(state.currentFrames, fromWidth, fromHeight, bounds);
    state.gifWidth = bounds.width;
    state.gifHeight = bounds.height;

    state.selectionMask = null;
    state.polygonPoints = [];
    state.tempPolygonPoint = null;
    state.isDrawingSelection = false;
    state.isPainting = false;
    state.activePaintTool = null;
    state.strokeSelectionSet = null;
    state.strokePixelMap.clear();

    pushEditHistoryEntry({
        type: 'crop_transparent_border',
        fromWidth,
        fromHeight,
        toWidth: bounds.width,
        toHeight: bounds.height,
        offsetX: bounds.minX,
        offsetY: bounds.minY
    });

    updateCanvasSize();
    extractPalette();
    renderCurrentFrame();
    renderSelectionOverlay();
    syncResizeInputsFromCurrentSize();
    updateSelectionInfo();
    updateSwapHistoryDisplay();
    clearColorSelectionState();
    setResizeStatus('');
    setTransparencyStatus(
        `Cropped ${fromWidth}x${fromHeight} -> ${bounds.width}x${bounds.height} (offset ${bounds.minX},${bounds.minY}).`,
        'success'
    );

    if (wasPlaying && state.currentFrames.length > 1) {
        startAnimation();
    }
}

function applyImageResize() {
    if (state.currentFrames.length === 0) {
        setResizeStatus('Load an image before resizing.', 'error');
        return;
    }

    const fromWidth = state.gifWidth;
    const fromHeight = state.gifHeight;
    let toWidth = fromWidth;
    let toHeight = fromHeight;
    let scalePercent = null;

    if (state.resizeMode === 'pixels') {
        let targetWidth = clampResizeDimension(elements.resizeWidthInput.value, fromWidth);
        let targetHeight = clampResizeDimension(elements.resizeHeightInput.value, fromHeight);

        if (state.resizeKeepAspect) {
            if (resizeAspectDriver === 'height') {
                targetWidth = getAspectLockedWidth(targetHeight);
            } else {
                targetHeight = getAspectLockedHeight(targetWidth);
            }
        }

        state.resizeWidth = targetWidth;
        state.resizeHeight = targetHeight;
        elements.resizeWidthInput.value = targetWidth;
        elements.resizeHeightInput.value = targetHeight;
        toWidth = targetWidth;
        toHeight = targetHeight;

        const percentX = (toWidth / fromWidth) * 100;
        const percentY = (toHeight / fromHeight) * 100;
        if (Math.abs(percentX - percentY) < 0.0001) {
            scalePercent = Math.round(percentX * 100) / 100;
        }
    } else {
        scalePercent = clampResizePercent(elements.resizePercentInput.value);
        state.resizePercent = scalePercent;
        elements.resizePercentInput.value = scalePercent;
        setActiveResizePreset(scalePercent);

        toWidth = Math.max(1, Math.round((fromWidth * scalePercent) / 100));
        toHeight = Math.max(1, Math.round((fromHeight * scalePercent) / 100));
    }

    if (toWidth === fromWidth && toHeight === fromHeight) {
        setResizeStatus(`No resize needed: image is already ${fromWidth}x${fromHeight}.`, 'neutral');
        return;
    }

    if (toWidth > state.resizeMaxDimension || toHeight > state.resizeMaxDimension) {
        setResizeStatus(
            `Resize blocked: max dimension is ${state.resizeMaxDimension}px (requested ${toWidth}x${toHeight}).`,
            'error'
        );
        return;
    }

    const wasPlaying = state.isPlaying;
    stopAnimation();

    state.currentFrames = resizeFramesNearestNeighbor(
        state.currentFrames,
        fromWidth,
        fromHeight,
        toWidth,
        toHeight
    );
    state.gifWidth = toWidth;
    state.gifHeight = toHeight;

    state.selectionMask = null;
    state.polygonPoints = [];
    state.tempPolygonPoint = null;
    state.isDrawingSelection = false;
    state.isPainting = false;
    state.activePaintTool = null;
    state.strokeSelectionSet = null;
    state.strokePixelMap.clear();

    const resizeEntry = {
        type: 'resize',
        resizeMode: state.resizeMode,
        fromWidth,
        fromHeight,
        toWidth,
        toHeight
    };
    if (typeof scalePercent === 'number') {
        resizeEntry.scalePercent = scalePercent;
    }
    pushEditHistoryEntry(resizeEntry);

    updateCanvasSize();
    extractPalette();
    renderCurrentFrame();
    renderSelectionOverlay();
    syncResizeInputsFromCurrentSize();
    updateSelectionInfo();
    updateSwapHistoryDisplay();
    clearColorSelectionState();
    setTransparencyStatus('');
    if (typeof scalePercent === 'number') {
        setResizeStatus(`Resized ${fromWidth}x${fromHeight} -> ${toWidth}x${toHeight} (${scalePercent}%).`, 'success');
    } else {
        setResizeStatus(`Resized ${fromWidth}x${fromHeight} -> ${toWidth}x${toHeight} (px mode).`, 'success');
    }

    if (wasPlaying && state.currentFrames.length > 1) {
        startAnimation();
    }
}

function resetChanges() {
    state.gifWidth = state.originalWidth;
    state.gifHeight = state.originalHeight;
    state.currentFrames = state.originalFrames.map((frame) => new Uint8ClampedArray(frame));
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
    updateCanvasSize();
    extractPalette();
    renderCurrentFrame();
    renderSelectionOverlay();
    syncResizeInputsFromCurrentSize();
    updateSwapHistoryDisplay();
    updateSelectionInfo();
    clearColorSelectionState();
    setReduceStatus('');
    setResizeStatus('');
    setTransparencyStatus('');
}

function updateSwapHistoryDisplay() {
    if (state.editHistory.length === 0) {
        elements.swapHistoryEl.innerHTML = '<em>No edits yet</em>';
        updateHistoryButtons();
        return;
    }

    elements.swapHistoryEl.innerHTML = state.editHistory.map((entry, i) => {
        if (entry.type === 'reduction') {
            const scopeText = entry.hasSelection ? 'selection' : 'full image';
            return `<div style="display: flex; align-items: center; gap: 5px; margin: 3px 0;">
                <span style="display: inline-flex; width: 14px; height: 14px; align-items: center; justify-content: center; border: 1px solid #555; border-radius: 2px; font-size: 9px; color: #4caf50;">Q</span>
                <span style="color: #666; flex: 1;">Reduce to ${entry.targetCount} colors (${scopeText})</span>
                <button onclick="undoSingleSwap(${i})" style="padding: 2px 6px; font-size: 10px; background: #555; border-radius: 3px; cursor: pointer;" title="Undo this reduction">x</button>
            </div>`;
        }

        if (entry.type === 'transparency_cleanup') {
            const scopeText = entry.hasSelection ? 'selection' : 'full image';
            return `<div style="display: flex; align-items: center; gap: 5px; margin: 3px 0;">
                <span style="display: inline-flex; width: 14px; height: 14px; align-items: center; justify-content: center; border: 1px solid #555; border-radius: 2px; font-size: 9px; color: #6bc5ff;">T</span>
                <span style="color: #666; flex: 1;">Delete transparency below ${entry.thresholdPercent}% (${scopeText})</span>
                <button onclick="undoSingleSwap(${i})" style="padding: 2px 6px; font-size: 10px; background: #555; border-radius: 3px; cursor: pointer;" title="Undo this transparency cleanup">x</button>
            </div>`;
        }

        if (entry.type === 'resize') {
            const percentText = typeof entry.scalePercent === 'number' ? ` (${entry.scalePercent}%)` : '';
            return `<div style="display: flex; align-items: center; gap: 5px; margin: 3px 0;">
                <span style="display: inline-flex; width: 14px; height: 14px; align-items: center; justify-content: center; border: 1px solid #555; border-radius: 2px; font-size: 9px; color: #6bc5ff;">R</span>
                <span style="color: #666; flex: 1;">Resize ${entry.fromWidth}x${entry.fromHeight} -> ${entry.toWidth}x${entry.toHeight}${percentText}</span>
                <button onclick="undoSingleSwap(${i})" style="padding: 2px 6px; font-size: 10px; background: #555; border-radius: 3px; cursor: pointer;" title="Undo this resize">x</button>
            </div>`;
        }

        if (entry.type === 'crop_transparent_border') {
            return `<div style="display: flex; align-items: center; gap: 5px; margin: 3px 0;">
                <span style="display: inline-flex; width: 14px; height: 14px; align-items: center; justify-content: center; border: 1px solid #555; border-radius: 2px; font-size: 9px; color: #6bc5ff;">C</span>
                <span style="color: #666; flex: 1;">Crop border ${entry.fromWidth}x${entry.fromHeight} -> ${entry.toWidth}x${entry.toHeight}</span>
                <button onclick="undoSingleSwap(${i})" style="padding: 2px 6px; font-size: 10px; background: #555; border-radius: 3px; cursor: pointer;" title="Undo this crop">x</button>
            </div>`;
        }

        if (entry.type === 'paint') {
            const icon = entry.tool === 'eraser' ? 'E' : 'P';
            const label = entry.tool === 'eraser' ? 'Eraser stroke' : 'Pencil stroke';
            return `<div style="display: flex; align-items: center; gap: 5px; margin: 3px 0;">
                <span style="display: inline-flex; width: 14px; height: 14px; align-items: center; justify-content: center; border: 1px solid #555; border-radius: 2px; font-size: 9px; color: #6bc5ff;">${icon}</span>
                <span style="color: #666; flex: 1;">${label} (${entry.changedPixelCount} px) - Frame ${entry.frameIndex + 1}</span>
                <button onclick="undoSingleSwap(${i})" style="padding: 2px 6px; font-size: 10px; background: #555; border-radius: 3px; cursor: pointer;" title="Undo this stroke">x</button>
            </div>`;
        }

        const swap = entry.swap;
        return `<div style="display: flex; align-items: center; gap: 5px; margin: 3px 0;">
            <span style="width: 14px; height: 14px; background: ${swap.from.hex}; border: 1px solid #555; border-radius: 2px;"></span>
            <span style="color: #666;">-></span>
            <span style="width: 14px; height: 14px; background: ${swap.to.hex}; border: 1px solid #555; border-radius: 2px;"></span>
            <span style="color: #666; flex: 1;">${swap.from.hex} -> ${swap.to.hex}</span>
            <button onclick="undoSingleSwap(${i})" style="padding: 2px 6px; font-size: 10px; background: #555; border-radius: 3px; cursor: pointer;" title="Undo this swap">x</button>
        </div>`;
    }).join('');
    updateHistoryButtons();
}
function undoLastEdit() {
    if (state.isPainting) {
        endPaintStroke();
    }

    if (state.editHistory.length === 0) return;

    const entry = state.editHistory.pop();
    state.redoHistory.push(entry);
    rebuildFramesFromHistory();

    updateCanvasSize();
    extractPalette();
    renderCurrentFrame();
    renderSelectionOverlay();
    syncResizeInputsFromCurrentSize();
    updateSwapHistoryDisplay();
    updateSelectionInfo();
    clearColorSelectionState();
    setTransparencyStatus('');
}

function redoLastEdit() {
    if (state.redoHistory.length === 0) return;

    const entry = state.redoHistory.pop();
    state.editHistory.push(entry);
    rebuildFramesFromHistory();

    updateCanvasSize();
    extractPalette();
    renderCurrentFrame();
    renderSelectionOverlay();
    syncResizeInputsFromCurrentSize();
    updateSwapHistoryDisplay();
    updateSelectionInfo();
    clearColorSelectionState();
    setTransparencyStatus('');
}

function undoSingleSwap(index) {
    if (index < 0 || index >= state.editHistory.length) return;

    state.editHistory.splice(index, 1);
    state.redoHistory = [];
    rebuildFramesFromHistory();

    updateCanvasSize();
    extractPalette();
    renderCurrentFrame();
    renderSelectionOverlay();
    syncResizeInputsFromCurrentSize();
    updateSwapHistoryDisplay();
    updateSelectionInfo();
    clearColorSelectionState();
    setTransparencyStatus('');
}
window.undoSingleSwap = undoSingleSwap;


